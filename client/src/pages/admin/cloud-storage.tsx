import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminLayout } from "../../components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import {
  Cloud,
  FileText,
  Film,
  Image,
  Music,
  File,
  Folder,
  Upload,
  RefreshCw,
  X,
  ArrowLeft,
  Download,
  ChevronRight,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Interfaces for cloud storage data
interface S3Status {
  enabled: boolean;
  bucket: string;
  region: string;
}

interface S3Stats {
  totalSize: number;
  totalFiles: number;
  folders: S3Folder[];
}

interface S3Folder {
  name: string;
  path: string;
  count: number;
}

interface S3File {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
  contentType: string;
}

// Format bytes to human-readable format (KB, MB, GB)
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Format date to a readable form
function formatDate(date: Date) {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(date).toLocaleDateString(undefined, options);
}

// Extract folder name from path
function getFolderName(path: string) {
  // Remove trailing slash
  const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
  
  // Split by slash and get the last segment
  const segments = normalizedPath.split("/");
  return segments[segments.length - 1] || normalizedPath;
}

// Get file name from key
function getFileName(key: string) {
  // Split by slash and get the last segment
  const segments = key.split("/");
  return segments[segments.length - 1];
}

export default function CloudStorage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for current folder path and file uploads
  const [currentPath, setCurrentPath] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Query to check if S3 storage is enabled
  const { data: s3Status, isLoading: isStatusLoading } = useQuery<S3Status>({
    queryKey: ["/api/cloud-storage/status"],
    refetchOnWindowFocus: false,
    // Remove onError as it's not supported in the current version
  });
  
  // Query to get storage statistics
  const { data: stats, isLoading: isStatsLoading } = useQuery<S3Stats>({
    queryKey: ["/api/cloud-storage/stats"],
    refetchOnWindowFocus: false,
    enabled: s3Status ? s3Status.enabled === true : false,
    // Remove onError as it's not supported in the current version
  });
  
  // Query to get files in the current folder
  const { 
    data: files, 
    isLoading: isFilesLoading,
    refetch: refetchFiles
  } = useQuery<S3File[]>({
    queryKey: ["/api/cloud-storage/files", currentPath],
    refetchOnWindowFocus: false,
    enabled: s3Status ? s3Status.enabled === true : false,
    // Remove onError as it's not supported in the current version
  });
  
  // Mutation to delete a file
  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await apiRequest("DELETE", `/api/cloud-storage/files/${encodeURIComponent(key)}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("Success"),
        description: t("File deleted successfully"),
      });
      
      // Refetch files and stats
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-storage/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-storage/stats"] });
    },
    onError: () => {
      toast({
        title: t("Error"),
        description: t("Failed to delete file"),
        variant: "destructive",
      });
    },
  });
  
  // Delete file handler
  const handleDeleteFile = (key: string) => {
    if (window.confirm(t("Are you sure you want to delete this file?"))) {
      deleteMutation.mutate(key);
    }
  };
  
  // Navigate to folder
  const navigateToFolder = (folder: string) => {
    setCurrentPath(folder);
  };
  
  // Navigate up one level
  const navigateUp = () => {
    if (!currentPath) return;
    
    const segments = currentPath.split("/");
    segments.pop(); // Remove the last segment
    
    setCurrentPath(segments.join("/"));
  };
  
  // Get breadcrumb segments for the current path
  const getBreadcrumbs = () => {
    if (!currentPath) return [];
    
    const segments = currentPath.split("/");
    let path = "";
    
    return segments.map((segment, index) => {
      path = index === 0 ? segment : `${path}/${segment}`;
      return {
        name: segment,
        path,
      };
    });
  };
  
  // Get file icon based on content type
  const getFileIcon = (file: S3File) => {
    if (file.contentType === "folder") {
      return <Folder className="h-6 w-6 text-blue-500" />;
    }
    
    if (file.contentType.startsWith("image/")) {
      return <Image className="h-6 w-6 text-purple-500" />;
    }
    
    if (file.contentType.startsWith("video/")) {
      return <Film className="h-6 w-6 text-red-500" />;
    }
    
    if (file.contentType.startsWith("audio/")) {
      return <Music className="h-6 w-6 text-orange-500" />;
    }
    
    if (file.contentType === "application/pdf") {
      return <FileText className="h-6 w-6 text-amber-500" />;
    }
    
    return <File className="h-6 w-6 text-gray-500" />;
  };
  
  // Handle file click
  const handleFileClick = (file: S3File) => {
    if (file.contentType === "folder") {
      navigateToFolder(file.key);
      return;
    }
    
    // For regular files, open in a new tab
    window.open(file.url, "_blank");
  };
  
  // Handle file selection for upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };
  
  // Handle folder selection
  const handleFolderSelect = (folder: S3Folder) => {
    navigateToFolder(folder.path);
  };
  
  // Upload file to cloud storage
  const uploadFile = async (file: File) => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Create a FormData object
      const formData = new FormData();
      formData.append("file", file);
      
      // Add folder path if we're in a folder
      if (currentPath) {
        formData.append("folder", currentPath);
      }
      
      // Track upload progress (simulated for now)
      const uploadInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const increment = Math.random() * 10;
          return Math.min(prev + increment, 99); // Cap at 99% until complete
        });
      }, 200);
      
      // Make the upload request
      const response = await fetch(`/api/cloud-storage/upload`, {
        method: "POST",
        body: formData,
      });
      
      clearInterval(uploadInterval);
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      setUploadProgress(100);
      
      // Refetch files and stats
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-storage/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cloud-storage/stats"] });
      
      // Show success toast
      toast({
        title: t("Upload Successful"),
        description: t("File has been uploaded to cloud storage"),
      });
      
      // Reset state
      setSelectedFile(null);
      setUploadOpen(false);
      
    } catch (error) {
      console.error("Upload error:", error);
      
      toast({
        title: t("Upload Failed"),
        description: typeof error === 'string' ? error : t("Failed to upload file to cloud storage"),
        variant: "destructive",
      });
      
    } finally {
      setIsUploading(false);
    }
  };
  
  // If storage is not enabled, show setup message
  if (!isStatusLoading && (!s3Status || !s3Status.enabled === false)) {
    return (
      <AdminLayout>
        <div className="p-6">
          <AdminHeader 
            title={t("Cloud Storage")} 
            subtitle={t("Manage files in your cloud storage")}
          />
          
          <Alert className="my-6">
            <Cloud className="h-5 w-5" />
            <AlertTitle>{t("Cloud Storage Not Configured")}</AlertTitle>
            <AlertDescription>
              {t("Cloud storage integration (Amazon S3) is not configured. Please set the required environment variables.")}
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle>{t("Required Configuration")}</CardTitle>
              <CardDescription>
                {t("Set the following environment variables to enable cloud storage")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-2">
                <li><code>AWS_ACCESS_KEY_ID</code>: {t("Your AWS access key ID")}</li>
                <li><code>AWS_SECRET_ACCESS_KEY</code>: {t("Your AWS secret access key")}</li>
                <li><code>AWS_REGION</code>: {t("AWS region (e.g., us-east-1)")}</li>
                <li><code>AWS_S3_BUCKET</code>: {t("S3 bucket name")}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="p-6">
        <AdminHeader 
          title={t("Cloud Storage")} 
          subtitle={t("Manage files in your cloud storage")}
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/cloud-storage/files"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/cloud-storage/stats"] });
                }}
                disabled={isStatsLoading || isFilesLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("Refresh")}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Initialize the form with current values
                  if (s3Status) {
                    setNewBucketName(s3Status.bucket || "");
                    setNewRegion(s3Status.region || "");
                  }
                  setSettingsOpen(true);
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                {t("S3 Settings")}
              </Button>
              
              {/* S3 Settings Dialog */}
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("S3 Bucket Settings")}</DialogTitle>
                    <DialogDescription>
                      {t("Update your Amazon S3 configuration")}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="bucketName" className="text-right">
                        {t("Bucket Name")}
                      </Label>
                      <Input
                        id="bucketName"
                        value={newBucketName}
                        onChange={(e) => setNewBucketName(e.target.value)}
                        placeholder="my-s3-bucket"
                      />
                      <p className="text-xs text-gray-500">
                        {t("Current bucket:")} {s3Status?.bucket || "Not set"}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="region" className="text-right">
                        {t("AWS Region")} ({t("Optional")})
                      </Label>
                      <Input
                        id="region"
                        value={newRegion}
                        onChange={(e) => setNewRegion(e.target.value)}
                        placeholder="us-east-1"
                      />
                      <p className="text-xs text-gray-500">
                        {t("Current region:")} {s3Status?.region || "Not set"}
                      </p>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setSettingsOpen(false)}
                      disabled={updateSettingsMutation.isPending}
                    >
                      {t("Cancel")}
                    </Button>
                    <Button 
                      onClick={() => {
                        if (newBucketName) {
                          updateSettingsMutation.mutate({ 
                            bucket: newBucketName,
                            region: newRegion || undefined
                          });
                        } else {
                          toast({
                            title: t("Validation Error"),
                            description: t("Bucket name is required"),
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={updateSettingsMutation.isPending || !newBucketName}
                    >
                      {updateSettingsMutation.isPending ? t("Updating...") : t("Update Settings")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    {t("Upload File")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("Upload File to Cloud Storage")}</DialogTitle>
                    <DialogDescription>
                      {currentPath 
                        ? t("Uploading to folder: ") + currentPath
                        : t("Uploading to root folder")}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!isUploading ? (
                    <>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="file">{t("Select File")}</Label>
                          <Input 
                            id="file" 
                            type="file" 
                            onChange={handleFileSelect}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setUploadOpen(false)}
                          disabled={isUploading}
                        >
                          {t("Cancel")}
                        </Button>
                        <Button 
                          onClick={() => selectedFile && uploadFile(selectedFile)}
                          disabled={!selectedFile || isUploading}
                        >
                          {t("Upload")}
                        </Button>
                      </DialogFooter>
                    </>
                  ) : (
                    <div className="py-4">
                      <div className="mb-2 text-sm">
                        {t("Uploading")} {selectedFile?.name}...
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                      <div className="mt-2 text-xs text-gray-500 text-right">
                        {Math.round(uploadProgress)}%
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          }
        />
        
        {/* Storage stats and folder navigation */}
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          {/* Storage Stats */}
          <Card>
            <CardHeader>
              <CardTitle>{t("Storage Statistics")}</CardTitle>
              <CardDescription>
                {stats 
                  ? t("Bucket: ") + (s3Status && s3Status.bucket ? s3Status.bucket : "") 
                  : t("Loading storage statistics...")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="flex items-center justify-center h-24">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium">{t("Total Files")}</div>
                    <div className="text-2xl font-bold">{stats.totalFiles.toLocaleString()}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium">{t("Total Size")}</div>
                    <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
          
          {/* Folder Navigation */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("Folders")}</CardTitle>
              <CardDescription>
                {stats?.folders ? t("Top-level folders in your storage") : t("Loading folders...")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="flex items-center justify-center h-24">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : stats?.folders && stats.folders.length > 0 ? (
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {stats.folders.map((folder) => (
                    <div 
                      key={folder.path}
                      className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleFolderSelect(folder)}
                    >
                      <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{getFolderName(folder.path)}</div>
                        <div className="text-xs text-gray-500">
                          {folder.count} {t("files")}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  {t("No folders found in storage")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Current folder view and file listing */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div>
                <CardTitle>
                  {currentPath 
                    ? t("Folder Contents: ") + getFolderName(currentPath)
                    : t("All Files")}
                </CardTitle>
                
                {/* Breadcrumb navigation */}
                {currentPath && (
                  <div className="flex flex-wrap items-center gap-1 mt-2 text-sm text-gray-500">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => setCurrentPath("")}
                    >
                      <Cloud className="h-3.5 w-3.5 mr-1" />
                      {t("Root")}
                    </Button>
                    
                    {getBreadcrumbs().map((crumb, index) => (
                      <div key={crumb.path} className="flex items-center">
                        <ChevronRight className="h-3 w-3 mx-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => navigateToFolder(crumb.path)}
                        >
                          {crumb.name}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {currentPath && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateUp}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("Back")}
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            {isFilesLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : files && files.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">{t("Name")}</TableHead>
                      <TableHead>{t("Type")}</TableHead>
                      <TableHead>{t("Size")}</TableHead>
                      <TableHead>{t("Last Modified")}</TableHead>
                      <TableHead className="text-right">{t("Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow key={file.key}>
                        <TableCell className="font-medium">
                          <div 
                            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleFileClick(file)}
                          >
                            {getFileIcon(file)}
                            <span className="truncate max-w-xs">
                              {file.contentType === "folder" 
                                ? getFolderName(file.key)
                                : getFileName(file.key)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {file.contentType === "folder" 
                            ? t("Folder")
                            : file.contentType}
                        </TableCell>
                        <TableCell>
                          {file.contentType === "folder" 
                            ? "-"
                            : formatBytes(file.size)}
                        </TableCell>
                        <TableCell>
                          {file.contentType === "folder" 
                            ? "-"
                            : formatDate(file.lastModified)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {file.contentType !== "folder" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(file.url, "_blank")}
                                title={t("Download")}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFile(file.key)}
                              title={t("Delete")}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                {currentPath 
                  ? t("This folder is empty")
                  : t("No files found in storage")}
              </div>
            )}
          </CardContent>
          
          {files && files.length > 0 && (
            <CardFooter className="flex justify-between border-t pt-6">
              <div className="text-sm text-gray-500">
                {files.length} {t("files")} {currentPath && t("in") + " " + getFolderName(currentPath)}
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}