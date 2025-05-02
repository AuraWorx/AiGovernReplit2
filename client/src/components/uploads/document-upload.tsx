import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Folder, FileText, Upload, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

interface DocumentUploadProps {
  onSuccess?: (data: any) => void;
}

export function DocumentUpload({ onSuccess }: DocumentUploadProps) {
  const [uploadTab, setUploadTab] = useState<string>("file");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFolder, setUploadedFolder] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState<string>("");
  const [datasetDescription, setDatasetDescription] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  // Handle folder selection
  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Get the folder name from the webkitRelativePath of the first file
      const folderPath = files[0].webkitRelativePath.split('/')[0];
      setUploadedFolder(folderPath);
      setSelectedFiles(Array.from(files));
    }
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiRequest("POST", "/api/uploads/documents", formData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: `${selectedFiles.length} files uploaded and analysis started.`,
      });
      setSelectedFiles([]);
      setUploadedFolder(null);
      setDatasetName("");
      setDatasetDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
      
      // Invalidate queries for datasets and analyses
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("name", datasetName || `Document Upload - ${new Date().toISOString()}`);
    formData.append("description", datasetDescription || "Uploaded for PII detection");
    
    if (uploadTab === "file") {
      // Multiple file upload
      selectedFiles.forEach(file => {
        formData.append("files", file);
      });
    } else {
      // Folder upload
      formData.append("isDirectory", "true");
      formData.append("directoryPath", uploadedFolder || "");
      selectedFiles.forEach(file => {
        formData.append("files", file, file.webkitRelativePath);
      });
    }
    
    uploadMutation.mutate(formData);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Document Upload for PII Detection</CardTitle>
        <CardDescription>
          Upload files or folders to scan for personally identifiable information (PII)
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <Label htmlFor="name">Dataset Name</Label>
            <Input
              id="name"
              placeholder="Enter a name for this dataset"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
            />
          </div>
          
          <div className="grid gap-4">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter a description for these documents"
              value={datasetDescription}
              onChange={(e) => setDatasetDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <Tabs defaultValue="file" value={uploadTab} onValueChange={setUploadTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">
                <FileText className="h-4 w-4 mr-2" />
                Files
              </TabsTrigger>
              <TabsTrigger value="folder">
                <Folder className="h-4 w-4 mr-2" />
                Folder
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="file" className="mt-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileText className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                <p className="mb-2">Drag and drop files or click to browse</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Supports PDF, DOCX, TXT, and JSON files (max 10MB each)
                </p>
                
                <Input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  accept=".pdf,.docx,.doc,.txt,.json"
                  className="hidden"
                  id="file-upload"
                />
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select Files
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="folder" className="mt-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Folder className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                <p className="mb-2">Select a folder for batch processing</p>
                <p className="text-xs text-muted-foreground mb-4">
                  The folder will be processed recursively
                </p>
                
                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-ignore - Using non-standard HTML5 attribute
                  webkitdirectory="true"
                  // @ts-ignore - Using non-standard HTML5 attribute
                  directory="true"
                  onChange={handleFolderSelect}
                  className="hidden"
                  id="folder-upload"
                />
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Select Folder
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          
          {selectedFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Selected Items:</h3>
              <div className="bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                {uploadTab === "folder" && uploadedFolder && (
                  <div className="mb-2 font-medium">
                    <Folder className="h-4 w-4 inline mr-1" />
                    {uploadedFolder}
                  </div>
                )}
                <ul className="text-sm space-y-1">
                  {selectedFiles.slice(0, 5).map((file, index) => (
                    <li key={index} className="flex items-center">
                      <FileText className="h-3 w-3 mr-1 text-muted-foreground" />
                      <span className="truncate">{uploadTab === "folder" ? file.webkitRelativePath : file.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {(file.size / 1024).toFixed(0)} KB
                      </Badge>
                    </li>
                  ))}
                  {selectedFiles.length > 5 && (
                    <li className="text-muted-foreground">
                      +{selectedFiles.length - 5} more files
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
          
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Uploaded documents will be processed to detect PII such as personal names, 
              email addresses, phone numbers, credit cards, SSNs, and more.
              The results will be available in the Analysis tab when complete.
            </AlertDescription>
          </Alert>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={uploadMutation.isPending}
            onClick={() => {
              setSelectedFiles([]);
              setUploadedFolder(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
              if (folderInputRef.current) folderInputRef.current.value = "";
            }}
          >
            Clear
          </Button>
          
          <Button
            type="submit"
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Start PII Detection
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}