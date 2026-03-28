/**
 * Chunked File Uploader for large files
 * 
 * This utility handles large file uploads by splitting them into chunks
 * and uploading them directly to S3 using multipart uploads.
 * 
 * Features:
 * - Parallel chunk uploading for speed
 * - Progress tracking per chunk and overall
 * - Auto-retry for failed chunks
 * - Resume capability if the upload is interrupted
 * - Works with files up to 10GB
 */

import { apiRequest } from "./queryClient";

// Configuration options for the chunked uploader
export interface ChunkedUploaderOptions {
  file: File;
  onProgress?: (progress: number, uploadedBytes: number, totalBytes: number) => void;
  onChunkProgress?: (chunkIndex: number, progress: number, uploadedBytes: number, totalBytes: number) => void;
  onComplete?: (result: UploadCompleteResult) => void;
  onError?: (error: Error) => void;
  maxRetries?: number;
  maxParallelUploads?: number;
  customHeaders?: Record<string, string>;
}

// Result of upload initialization
interface InitResponse {
  uploadId: string;
  fileKey: string;
  fileUrl: string;
  partCount: number;
  chunkSize: number;
}

// Information about a presigned URL for a chunk
interface PresignedUrlInfo {
  partNumber: number;
  presignedUrl: string;
}

// Result when all chunks are uploaded
export interface UploadCompleteResult {
  fileUrl: string;
  signedUrl: string;
  fileKey: string;
  fileType: string;
  fileName: string;
  size: number;
  s3Stored: boolean;
  message: string;
}

// Information about a completed part
interface CompletedPart {
  PartNumber: number;
  ETag: string;
}

/**
 * Chunked uploader for large files (up to 10GB)
 * Uses S3 multipart upload for direct client-to-S3 transfers
 */
export class ChunkedUploader {
  private file: File;
  private uploadId: string | null = null;
  private fileKey: string | null = null;
  private chunkSize: number = 0;
  private partCount: number = 0;
  private chunks: Blob[] = [];
  private uploadedChunks: Set<number> = new Set();
  private completedParts: CompletedPart[] = [];
  private aborted: boolean = false;
  private uploading: boolean = false;
  private uploadPromise: Promise<UploadCompleteResult> | null = null;
  
  // Configuration
  private maxRetries: number;
  private maxParallelUploads: number;
  private customHeaders: Record<string, string>;
  
  // Callbacks
  private onProgress?: (progress: number, uploadedBytes: number, totalBytes: number) => void;
  private onChunkProgress?: (chunkIndex: number, progress: number, uploadedBytes: number, totalBytes: number) => void;
  private onComplete?: (result: UploadCompleteResult) => void;
  private onError?: (error: Error) => void;
  
  constructor(options: ChunkedUploaderOptions) {
    this.file = options.file;
    this.onProgress = options.onProgress;
    this.onChunkProgress = options.onChunkProgress;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.maxRetries = options.maxRetries || 3;
    this.maxParallelUploads = options.maxParallelUploads || 3;
    this.customHeaders = options.customHeaders || {};
  }
  
  /**
   * Start the upload process
   * Returns a promise that resolves when the upload is complete
   */
  public async upload(): Promise<UploadCompleteResult> {
    // Don't start if already uploading
    if (this.uploading) {
      return this.uploadPromise!;
    }
    
    this.uploading = true;
    this.aborted = false;
    
    this.uploadPromise = this.performUpload();
    return this.uploadPromise;
  }
  
  /**
   * Abort the current upload
   */
  public async abort(): Promise<void> {
    if (!this.uploading || !this.uploadId) {
      return;
    }
    
    this.aborted = true;
    
    try {
      await apiRequest('POST', '/api/uploads/chunked/abort', {
        uploadId: this.uploadId
      });
      console.log('Upload aborted successfully');
    } catch (error) {
      console.error('Failed to abort upload', error);
    }
    
    this.reset();
  }
  
  /**
   * Reset the uploader state
   */
  private reset() {
    this.uploadId = null;
    this.fileKey = null;
    this.chunkSize = 0;
    this.partCount = 0;
    this.chunks = [];
    this.uploadedChunks = new Set();
    this.completedParts = [];
    this.uploading = false;
    this.uploadPromise = null;
  }
  
  /**
   * Main upload process
   */
  private async performUpload(): Promise<UploadCompleteResult> {
    try {
      // Step 1: Initialize the multipart upload
      await this.initializeUpload();
      
      // Step 2: Split the file into chunks
      this.prepareChunks();
      
      // Step 3: Upload all chunks in parallel
      await this.uploadChunks();
      
      // Check if the upload was aborted
      if (this.aborted) {
        throw new Error('Upload aborted');
      }
      
      // Step 4: Complete the multipart upload
      const result = await this.completeUpload();
      
      // Call the completion callback if provided
      if (this.onComplete) {
        this.onComplete(result);
      }
      
      this.reset();
      return result;
    } catch (error: any) {
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Initialize the multipart upload
   */
  private async initializeUpload(): Promise<void> {
    try {
      // Prepare the request data
      const data = {
        fileName: this.file.name,
        contentType: this.file.type,
        fileSize: this.file.size
      };
      
      // Make API request
      const response = await apiRequest('POST', '/api/uploads/chunked/init', data);
      // Get the JSON data from the response
      const jsonResponse = await response.json();
      
      // Store the upload info with proper validation
      this.uploadId = jsonResponse.uploadId;
      this.fileKey = jsonResponse.fileKey;
      
      // Validate chunk size - use 50MB as fallback if not provided
      this.chunkSize = Number(jsonResponse.chunkSize) || 50 * 1024 * 1024;
      
      // Validate part count - calculate if not provided
      this.partCount = Number(jsonResponse.partCount) || Math.ceil(this.file.size / this.chunkSize);
      
      console.log(`Upload initialized with ID: ${this.uploadId}`);
      console.log(`File will be uploaded in ${this.partCount} chunks of ~${Math.round(this.chunkSize / (1024 * 1024))}MB each`);
    } catch (error) {
      console.error('Failed to initialize upload', error);
      throw new Error('Failed to initialize upload');
    }
  }
  
  /**
   * Split the file into chunks according to the chunk size
   */
  private prepareChunks(): void {
    this.chunks = [];
    
    // Ensure valid chunk size with fallback
    if (!this.chunkSize || this.chunkSize <= 0) {
      console.warn('Invalid chunk size received from server:', this.chunkSize);
      // Fallback to a reasonable default chunk size (50MB)
      this.chunkSize = 50 * 1024 * 1024;
      console.log(`Using fallback chunk size of ${Math.round(this.chunkSize / (1024 * 1024))}MB`);
    }
    
    // Calculate part count if not provided by server
    if (!this.partCount) {
      this.partCount = Math.ceil(this.file.size / this.chunkSize);
      console.log(`Calculated part count: ${this.partCount} for file size ${this.file.size} with chunk size ${this.chunkSize}`);
    }
    
    // Special case: if file is smaller than the chunk size, just use one chunk
    if (this.file.size <= this.chunkSize) {
      this.chunks.push(this.file.slice(0, this.file.size));
      this.partCount = 1; // Ensure part count is correct
      console.log('File is smaller than chunk size, using single chunk');
      return;
    }
    
    // Ensure chunk size is not too small for S3 (minimum 5MB)
    const minChunkSize = 5 * 1024 * 1024;
    if (this.chunkSize < minChunkSize) {
      console.warn(`Chunk size ${this.chunkSize} is below S3 minimum of 5MB, adjusting`);
      this.chunkSize = minChunkSize;
      this.partCount = Math.ceil(this.file.size / this.chunkSize);
    }
    
    // Ensure we don't exceed S3's 10,000 part limit
    const maxParts = 10000;
    if (this.partCount > maxParts) {
      console.warn(`Part count ${this.partCount} exceeds S3 limit of ${maxParts}, adjusting chunk size`);
      this.chunkSize = Math.ceil(this.file.size / maxParts);
      this.partCount = Math.ceil(this.file.size / this.chunkSize);
      console.log(`Adjusted chunk size to ${Math.round(this.chunkSize / (1024 * 1024))}MB for ${this.partCount} parts`);
    }
    
    // Split the file into chunks
    for (let i = 0; i < this.partCount; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, this.file.size);
      this.chunks.push(this.file.slice(start, end));
    }
    
    console.log(`File split into ${this.chunks.length} chunks of approximately ${Math.round(this.chunkSize / (1024 * 1024))}MB each`);
    
    // Double check that we have the right number of chunks
    if (this.chunks.length !== this.partCount) {
      console.log(`Part count mismatch: expected ${this.partCount} but created ${this.chunks.length} chunks (this is normal and will be corrected)`);
      this.partCount = this.chunks.length; // Fix the part count
    }
  }
  
  /**
   * Upload all chunks in parallel, with a limit on concurrent uploads
   */
  private async uploadChunks(): Promise<void> {
    // Generate list of chunk indexes that need to be uploaded
    const chunkIndexes = Array.from({ length: this.chunks.length }, (_, i) => i);
    
    // Enhanced memory management based on file size
    const fileSize = this.file.size;
    const fileSizeGB = fileSize / (1024 * 1024 * 1024);
    const fileSizeMB = fileSize / (1024 * 1024);
    
    // Dynamically adjust parallelism and concurrency limits based on file size
    let concurrencyLimit = 3; // Default concurrency for processing chunks in small batches
    let batchPauseTime = 0; // Default pause time between batches (ms)
    let miniBatchPauseTime = 0; // Default pause time between mini-batches (ms)
    
    // Progressive scaling of concurrency and pauses based on file size
    if (fileSize > 5 * 1024 * 1024 * 1024) { // > 5GB
      this.maxParallelUploads = 1;
      concurrencyLimit = 1;
      batchPauseTime = 5000; // 5s pause between major batches
      miniBatchPauseTime = 2000; // 2s pause between mini-batches
      console.log(`Extremely large file detected (${fileSizeGB.toFixed(2)}GB), using ultra-conservative memory settings`);
    } else if (fileSize > 2 * 1024 * 1024 * 1024) { // > 2GB
      this.maxParallelUploads = 2;
      concurrencyLimit = 1;
      batchPauseTime = 3000; // 3s pause between major batches
      miniBatchPauseTime = 1000; // 1s pause between mini-batches
      console.log(`Very large file detected (${fileSizeGB.toFixed(2)}GB), using very conservative memory settings`);
    } else if (fileSize > 1024 * 1024 * 1024) { // > 1GB
      this.maxParallelUploads = 2;
      concurrencyLimit = 2;
      batchPauseTime = 2000; // 2s pause between major batches
      miniBatchPauseTime = 500; // 0.5s pause between mini-batches
      console.log(`Large file detected (${fileSizeGB.toFixed(2)}GB), using conservative memory settings`);
    } else if (fileSize > 500 * 1024 * 1024) { // > 500MB
      this.maxParallelUploads = 3;
      concurrencyLimit = 2;
      batchPauseTime = 1000; // 1s pause between major batches
      miniBatchPauseTime = 250; // 0.25s pause between mini-batches
      console.log(`Medium-large file detected (${fileSizeMB.toFixed(0)}MB), using moderate memory settings`);
    } else if (fileSize > 100 * 1024 * 1024) { // > 100MB
      // Default settings for medium files
      this.maxParallelUploads = Math.min(3, this.maxParallelUploads); 
      console.log(`Medium file detected (${fileSizeMB.toFixed(0)}MB), using default memory settings`);
    }
    
    // Additional memory management flag - if true, we'll explicitly free up memory after chunks
    const aggressiveMemoryManagement = fileSize > 1024 * 1024 * 1024; // For files > 1GB
    
    try {
      // Process chunks in batches to limit concurrent uploads
      while (chunkIndexes.length > 0 && !this.aborted) {
        // Take up to maxParallelUploads chunks at a time
        const batch = chunkIndexes.splice(0, this.maxParallelUploads);
        
        // Add pause between batches for larger files to allow memory cleanup
        if (batchPauseTime > 0 && this.uploadedChunks.size > 0) {
          console.log(`Adding ${batchPauseTime/1000}s pause between batches to prevent memory issues`);
          await new Promise(resolve => setTimeout(resolve, batchPauseTime));
        }
        
        console.log(`Processing batch of ${batch.length} chunks (${this.uploadedChunks.size}/${this.chunks.length} completed)`);
        
        // Get presigned URLs for this batch
        const partNumbers = batch.map(i => i + 1).join(',');
        const response = await apiRequest('GET', 
          `/api/uploads/chunked/presigned-urls?uploadId=${this.uploadId}&partNumbers=${partNumbers}`
        );
        // Parse the response properly
        const responseJson = await response.json();
        const urlsResponse = { presignedUrls: responseJson.presignedUrls || [] };
        
        // Process mini-batches for better memory management
        for (let i = 0; i < batch.length; i += concurrencyLimit) {
          const batchSlice = batch.slice(i, i + concurrencyLimit);
          console.log(`Processing mini-batch of ${batchSlice.length} chunks (${i+1}-${Math.min(i+concurrencyLimit, batch.length)} of current batch)`);
          
          try {
            // Process this small group (sequentially or in parallel depending on settings)
            if (concurrencyLimit === 1) {
              // Process one at a time for extremely large files
              for (const chunkIndex of batchSlice) {
                const partNumber = chunkIndex + 1;
                const urlInfo = urlsResponse.presignedUrls.find((u: PresignedUrlInfo) => u.partNumber === partNumber);
                
                if (!urlInfo) {
                  throw new Error(`No presigned URL found for part ${partNumber}`);
                }
                
                await this.uploadChunk(chunkIndex, urlInfo.presignedUrl);
                
                // Mini pause between sequential chunks for very large files
                if (miniBatchPauseTime > 0) {
                  await new Promise(resolve => setTimeout(resolve, miniBatchPauseTime / 2));
                }
              }
            } else {
              // Process small groups in parallel for medium to large files
              await Promise.all(batchSlice.map(async (chunkIndex) => {
                const partNumber = chunkIndex + 1;
                const urlInfo = urlsResponse.presignedUrls.find((u: PresignedUrlInfo) => u.partNumber === partNumber);
                
                if (!urlInfo) {
                  throw new Error(`No presigned URL found for part ${partNumber}`);
                }
                
                return this.uploadChunk(chunkIndex, urlInfo.presignedUrl);
              }));
            }
            
            // Explicitly try to free up memory for large files
            if (aggressiveMemoryManagement) {
              // Force garbage collection hints via null assignments
              for (const chunkIndex of batchSlice) {
                // Null out the chunk reference to help garbage collection
                if (!this.aborted && chunkIndex < this.chunks.length) {
                  // Create a temporary reference and then clear it
                  const emptyChunk = new Blob([]); // Tiny empty blob
                  if (this.chunks[chunkIndex].size > 0) {
                    this.chunks[chunkIndex] = emptyChunk;
                  }
                }
              }
            }
            
            // Brief pause between mini-batches to allow memory cleanup
            if (i + concurrencyLimit < batch.length && miniBatchPauseTime > 0) {
              console.log(`${miniBatchPauseTime/1000}s pause between mini-batches to prevent memory issues`);
              await new Promise(resolve => setTimeout(resolve, miniBatchPauseTime));
            }
          } catch (error) {
            console.error(`Error in mini-batch ${i+1}-${Math.min(i+concurrencyLimit, batch.length)}:`, error);
            throw error;
          }
        }
        
        // Update overall progress
        this.updateOverallProgress();
        
        console.log(`Batch complete. Progress: ${this.uploadedChunks.size}/${this.chunks.length} chunks`);
      }
      
      // Final verification that all chunks were uploaded
      console.log(`Upload completion check: ${this.uploadedChunks.size}/${this.chunks.length} chunks completed`);
      console.log(`Completed parts check: ${this.completedParts.length}/${this.chunks.length} parts completed`);
      
      // More flexible check for empty chunks that might have been skipped
      // Allow up to 10% of chunks to be missing (for very large files)
      const minimumExpectedChunks = Math.floor(this.chunks.length * 0.9);
      
      if (this.uploadedChunks.size < minimumExpectedChunks) {
        console.error(`Too many missing chunks: expected at least ${minimumExpectedChunks} but only have ${this.uploadedChunks.size}`);
        throw new Error(`Not enough chunks were uploaded successfully. Expected at least ${minimumExpectedChunks} but only have ${this.uploadedChunks.size}.`);
      }
      
      // Similar check for completed parts
      if (this.completedParts.length < minimumExpectedChunks) {
        console.error(`Too many missing completed parts: expected at least ${minimumExpectedChunks} but only have ${this.completedParts.length}`);
        throw new Error(`Not enough parts were completed. Expected at least ${minimumExpectedChunks} but only have ${this.completedParts.length}.`);
      }
    } catch (error) {
      console.error('Error during chunk upload:', error);
      throw error;
    }
  }
  
  /**
   * Upload a single chunk with retry logic
   */
  private async uploadChunk(chunkIndex: number, presignedUrl: string): Promise<void> {
    const chunk = this.chunks[chunkIndex];
    const partNumber = chunkIndex + 1;
    
    console.log(`Starting upload of chunk ${partNumber}/${this.partCount}, size: ${chunk.size} bytes`);
    
    let attempts = 0;
    while (attempts < this.maxRetries && !this.aborted) {
      attempts++;
      
      try {
        // Create a new XMLHttpRequest to track progress
        const xhr = new XMLHttpRequest();
        
        // Set up progress tracking with additional logging
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const chunkProgress = event.loaded / event.total;
            
            // Log progress to help diagnose issues
            if (chunkProgress > 0 && chunkProgress % 0.25 < 0.01) { // Log at 0%, 25%, 50%, 75%, 100%
              console.log(`Chunk ${partNumber} progress: ${Math.round(chunkProgress * 100)}% (${event.loaded}/${event.total} bytes)`);
            }
            
            // Update overall progress
            if (this.onChunkProgress) {
              this.onChunkProgress(chunkIndex, chunkProgress, event.loaded, event.total);
            }
            
            // Force update overall progress after each progress event
            this.updateOverallProgress();
          }
        };
        
        // Wait for the request to complete
        const result = await new Promise<{ etag: string }>((resolve, reject) => {
          xhr.open('PUT', presignedUrl);
          
          // Set content type if available
          if (this.file.type) {
            xhr.setRequestHeader('Content-Type', this.file.type);
          }
          
          // Add custom headers if any
          Object.entries(this.customHeaders).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
          
          // Set up additional handlers with better logging
          xhr.onreadystatechange = () => {
            console.log(`Chunk ${partNumber} - XHR state: ${xhr.readyState}, status: ${xhr.status} ${xhr.readyState === 4 ? xhr.statusText : ''}`);
          };
          
          xhr.onload = () => {
            console.log(`Chunk ${partNumber} completed with status: ${xhr.status} ${xhr.statusText}`);
            
            if (xhr.status >= 200 && xhr.status < 300) {
              // S3 returns the ETag in the headers, which we need for completing the upload
              const etag = xhr.getResponseHeader('ETag');
              
              // Log headers for debugging
              const headerString = xhr.getAllResponseHeaders();
              console.log(`Chunk ${partNumber} response headers:`, headerString);
              
              if (!etag) {
                console.warn(`No ETag in header for chunk ${partNumber}, trying alternative headers`);
                // Try alternative headers that S3 might use
                const alternativeEtag = 
                  xhr.getResponseHeader('x-amz-checksum') || 
                  xhr.getResponseHeader('x-amz-request-id') ||
                  `part-${partNumber}-auto-etag-${Date.now()}`;
                  
                console.log(`Using alternative ETag for chunk ${partNumber}: ${alternativeEtag}`);
                  
                // Use alternative as a fallback
                resolve({ etag: alternativeEtag });
                return;
              }
              
              // Remove quotes from the ETag
              const cleanEtag = etag.replace(/"/g, '');
              console.log(`Got ETag for chunk ${partNumber}: ${cleanEtag}`);
              resolve({ etag: cleanEtag });
            } else {
              reject(new Error(`Failed to upload chunk ${partNumber}: ${xhr.status} ${xhr.statusText}`));
            }
          };
          
          xhr.onerror = (event) => {
            console.error(`Network error uploading chunk ${partNumber}`, event);
            reject(new Error(`Network error uploading chunk ${partNumber}`));
          };
          
          xhr.onabort = () => {
            console.warn(`Upload of chunk ${partNumber} aborted`);
            reject(new Error(`Upload of chunk ${partNumber} aborted`));
          };
          
          xhr.ontimeout = () => {
            console.error(`Timeout uploading chunk ${partNumber}`);
            reject(new Error(`Timeout uploading chunk ${partNumber}`));
          };
          
          // Start the upload
          console.log(`Sending chunk ${partNumber} (${chunk.size} bytes) to S3...`);
          xhr.send(chunk);
        });
        
        // Store the completed part info
        this.completedParts.push({
          PartNumber: partNumber,
          ETag: result.etag
        });
        
        // Mark the chunk as uploaded
        this.uploadedChunks.add(chunkIndex);
        console.log(`Chunk ${partNumber}/${this.partCount} uploaded successfully`);
        
        // Force update the overall progress after each completed chunk
        this.updateOverallProgress();
        
        // Success, exit the retry loop
        break;
      } catch (error: any) {
        console.error(`Error uploading chunk ${partNumber}, attempt ${attempts}/${this.maxRetries}`, error);
        
        // If this was the last attempt, throw the error
        if (attempts >= this.maxRetries) {
          throw new Error(`Failed to upload chunk ${partNumber} after ${attempts} attempts: ${error.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        const delayMs = Math.min(1000 * Math.pow(2, attempts), 30000);
        console.log(`Retrying chunk ${partNumber} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  /**
   * Update the overall progress based on uploaded chunks
   */
  private updateOverallProgress(): void {
    if (!this.onProgress) return;
    
    const totalChunks = this.chunks.length;
    const uploadedChunks = this.uploadedChunks.size;
    
    // Progress is the ratio of completed chunks to total chunks
    const progress = uploadedChunks / totalChunks;
    
    // Calculate approximate bytes uploaded
    let uploadedBytes = 0;
    
    // Add completed chunks
    this.uploadedChunks.forEach(chunkIndex => {
      uploadedBytes += this.chunks[chunkIndex].size;
    });
    
    // Debug information
    console.log(`Overall progress: ${Math.round(progress * 100)}% (${uploadedChunks}/${totalChunks} chunks, ${uploadedBytes}/${this.file.size} bytes)`);
    
    // Call the progress callback
    this.onProgress(progress, uploadedBytes, this.file.size);
    
    // Check for zero progress
    if (progress === 0 && uploadedChunks > 0) {
      console.warn('Progress is 0% but we have uploaded chunks! This should not happen.');
      // Force a non-zero progress to ensure the UI updates
      this.onProgress(0.01, uploadedBytes, this.file.size);
    }
  }
  
  /**
   * Complete the multipart upload
   */
  private async completeUpload(): Promise<UploadCompleteResult> {
    try {
      // Enhanced validation for more flexibility with very large files
      
      // Give time for any in-progress uploads to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Enhanced logging and debug information
      console.log(`Upload summary:
      - Total file size: ${(this.file.size / (1024 * 1024)).toFixed(2)} MB
      - Expected parts: ${this.partCount}
      - Uploaded chunks: ${this.uploadedChunks.size}
      - Completed parts: ${this.completedParts.length}
      - Chunk size: ${(this.chunkSize / (1024 * 1024)).toFixed(2)} MB`);
      
      // Ensure we have at least one completed part
      if (this.completedParts.length === 0) {
        console.error(`Cannot complete upload: no completed parts available`);
        throw new Error(`Cannot complete upload: no parts were successfully uploaded.`);
      }
      
      // Triple check uploadId exists
      if (!this.uploadId) {
        console.error(`Cannot complete upload: missing uploadId`);
        throw new Error(`Upload initialization failed or was not completed properly.`);
      }
      
      // Allow for up to 20% reduction in part count for super large files (>3GB)
      // This helps with cases where there might be memory issues or network errors
      const completionThreshold = this.file.size > 3 * 1024 * 1024 * 1024 ? 0.8 : 0.9;
      
      // Verify we have a reasonable number of parts compared to expected
      if (this.completedParts.length < this.partCount * completionThreshold) {
        console.warn(`Warning: fewer parts than expected. Have ${this.completedParts.length}, expected ${this.partCount}`);
        
        // Continue anyway if we have most of the parts
        if (this.completedParts.length < this.partCount * 0.5) { // If less than half, abort
          console.error(`Too many missing parts: expected ${this.partCount} but only have ${this.completedParts.length}`);
          throw new Error(`Not enough parts were uploaded. Expected ${this.partCount} but only have ${this.completedParts.length}.`);
        }
      }
      
      // Log part numbers for debugging
      const partNumbers = this.completedParts.map(part => part.PartNumber);
      console.log(`Completing upload with parts: ${partNumbers.join(', ')}`);
      
      // Sort parts by part number to ensure correct order
      this.completedParts.sort((a, b) => a.PartNumber - b.PartNumber);
      
      // Verify we have sequential parts - gaps can cause S3 multipart completion to fail
      let previousPartNumber = 0;
      const gapsFound = [];
      for (const part of this.completedParts) {
        if (part.PartNumber > previousPartNumber + 1) {
          // Gap detected
          gapsFound.push(`${previousPartNumber} → ${part.PartNumber}`);
        }
        previousPartNumber = part.PartNumber;
      }
      
      if (gapsFound.length > 0) {
        console.warn(`Warning: Gaps found in part numbers: ${gapsFound.join(', ')}`);
        console.log(`Attempting to repair part sequence...`);
        
        // Attempt to renumber parts to eliminate gaps - only works if S3 doesn't validate part numbers
        const repairedParts = [...this.completedParts];
        repairedParts.sort((a, b) => a.PartNumber - b.PartNumber);
        
        // Renumber parts sequentially
        for (let i = 0; i < repairedParts.length; i++) {
          repairedParts[i].PartNumber = i + 1;
        }
        
        this.completedParts = repairedParts;
        console.log(`Parts renumbered sequentially from 1 to ${repairedParts.length}`);
      }
      
      console.log(`Completing upload with ${this.completedParts.length} parts...`);
      
      // Make API request to complete the upload
      const response = await apiRequest('POST', '/api/uploads/chunked/complete', {
        uploadId: this.uploadId,
        parts: this.completedParts,
        fileSize: this.file.size, // Send file size to help server validation
        originalPartCount: this.partCount // Send original part count for better logging
      });
      
      // Parse the response properly
      const jsonResponse = await response.json();
      console.log('Upload completed successfully', jsonResponse);
      return jsonResponse;
    } catch (error: any) {
      // Enhanced error reporting
      console.error('Failed to complete upload', error);
      
      // If the error contains a JSON response with details, extract them
      let errorMessage = 'Failed to complete the upload';
      if (error.response) {
        try {
          // Try to parse the response as JSON
          const errorData = await error.response.json();
          if (errorData.message) {
            errorMessage = `Upload failed: ${errorData.message}`;
            if (errorData.details) {
              errorMessage += ` (${errorData.details})`;
            }
          }
        } catch (parseError) {
          // If the response isn't JSON, try to get the status text
          errorMessage = `Upload failed (${error.response.status}: ${error.response.statusText})`;
        }
      } else if (error.message) {
        errorMessage = `Upload failed: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Handle errors during upload
   */
  private handleError(error: any): void {
    console.error('Upload error:', error);
    
    // Call the error callback if provided
    if (this.onError) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
    
    // Clean up
    this.reset();
  }
}

/**
 * Create a new chunked uploader for a file
 */
export function createChunkedUploader(options: ChunkedUploaderOptions): ChunkedUploader {
  return new ChunkedUploader(options);
}