import React, { useState, useRef, ChangeEventHandler } from "react";
import { UploadCloud, X, CheckCircle2, AlertCircle, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/hooks/use-language";

interface AccessibleFileUploadProps {
  id: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in MB
  label?: string;
  helpText?: string;
  disabled?: boolean;
  className?: string;
  value?: File | File[];
  showPreview?: boolean;
  progress?: number;
  uploading?: boolean;
  allowedFileTypes?: string[];
  onFilesSelected: (files: File[]) => void;
  onError?: (error: string) => void;
}

export function AccessibleFileUpload({
  id,
  accept,
  multiple = false,
  maxFiles = 5,
  maxSize = 100, // 100MB default
  label,
  helpText,
  disabled = false,
  className,
  value,
  showPreview = true,
  progress = 0,
  uploading = false,
  allowedFileTypes,
  onFilesSelected,
  onError,
}: AccessibleFileUploadProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Handle when files are selected via the file input or dropped into the drop zone
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    if (multiple && files.length > maxFiles) {
      onError?.(t("Too many files selected. Maximum allowed: {0}", { 0: maxFiles.toString() }));
      return;
    }

    const selectedFilesList = Array.from(files);
    const oversizedFiles = selectedFilesList.filter(file => file.size > maxSize * 1024 * 1024);
    
    if (oversizedFiles.length > 0) {
      onError?.(t("Files too large. Maximum size: {0}MB", { 0: maxSize.toString() }));
      return;
    }

    // Check for allowed file types
    if (allowedFileTypes && allowedFileTypes.length > 0) {
      const invalidFiles = selectedFilesList.filter(file => {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        return !allowedFileTypes.includes(`.${fileExt}`);
      });

      if (invalidFiles.length > 0) {
        onError?.(t("Invalid file type. Allowed types: {0}", { 0: allowedFileTypes.join(', ') }));
        return;
      }
    }

    setSelectedFiles(selectedFilesList);
    onFilesSelected(selectedFilesList);

    // Generate preview URLs if showPreview is true
    if (showPreview) {
      const newPreviewUrls = selectedFilesList.map(file => {
        if (file.type.startsWith('image/')) {
          return URL.createObjectURL(file);
        }
        return '';
      });
      setPreviewUrls(newPreviewUrls);
    }
  };

  // Handle file input change
  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    handleFilesSelected(e.target.files);
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    handleFilesSelected(e.dataTransfer.files);
  };

  // Trigger file input click
  const triggerFileInput = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  // Remove a file from the selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    
    // Create a new FileList from the filtered selectedFiles
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
    
    // If the input value is controlled, we need to reset it
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Get a human-readable file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get appropriate file icon based on file type
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return previewUrls[selectedFiles.indexOf(file)] ? null : <FileIcon className="w-6 h-6 text-gray-400" />;
    }
    if (file.type.startsWith('video/')) {
      return <FileIcon className="w-6 h-6 text-red-400" />;
    }
    if (file.type === 'application/pdf') {
      return <FileIcon className="w-6 h-6 text-orange-400" />;
    }
    return <FileIcon className="w-6 h-6 text-gray-400" />;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex justify-between">
          <label htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
          {helpText && (
            <span className="text-xs text-gray-500">
              {helpText}
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          isDragging ? "border-black bg-gray-50" : "border-gray-300",
          disabled ? "bg-gray-100 cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-gray-50",
          "focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerFileInput();
          }
        }}
        role="button"
        aria-controls={id}
        aria-disabled={disabled}
        aria-describedby={`${id}-help`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
          aria-label={label || t("File upload")}
        />

        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <UploadCloud className={cn(
            "w-8 h-8",
            isDragging ? "text-black" : "text-gray-400"
          )} />
          <div className="text-sm font-medium">
            {t("Drop files here or click to upload")}
          </div>
          <p id={`${id}-help`} className="text-xs text-gray-500">
            {multiple
              ? t("Upload up to {0} files (max {1}MB each)", { 0: maxFiles.toString(), 1: maxSize.toString() })
              : t("Upload a file (max {0}MB)", { 0: maxSize.toString() })
            }
          </p>
        </div>
      </div>

      {/* Upload progress indicator */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>{t("Uploading...")}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium">
            {t("Selected files ({0})", { 0: selectedFiles.length.toString() })}
          </div>
          <ul className="space-y-2">
            {selectedFiles.map((file, index) => (
              <li key={index} className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                <div className="flex items-center space-x-2 overflow-hidden">
                  {showPreview && file.type.startsWith('image/') && previewUrls[index] ? (
                    <div className="h-10 w-10 rounded-md overflow-hidden flex-shrink-0">
                      <img
                        src={previewUrls[index]}
                        alt={file.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    getFileIcon(file)
                  )}
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || uploading}
                  aria-label={t("Remove {0}", { 0: file.name })}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}