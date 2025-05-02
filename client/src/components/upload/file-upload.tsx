import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface FileUploadProps {
  onUploadComplete?: (data: any) => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [datasetDescription, setDatasetDescription] = useState("");
  const [analysisType, setAnalysisType] = useState("bias_analysis");
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || res.statusText);
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: `File uploaded and processing started for ${datasetName}`,
      });
      
      // Reset form state
      setSelectedFile(null);
      setDatasetName("");
      setDatasetDescription("");
      
      // Invalidate datasets query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      
      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete(data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Check file type
    if (!["application/json", "text/csv"].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or JSON file.",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
    
    // Auto-generate name from filename if not set
    if (!datasetName) {
      const fileName = file.name.split(".")[0];
      setDatasetName(fileName);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }
    
    if (!datasetName) {
      toast({
        title: "Missing information",
        description: "Please provide a name for the dataset.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("name", datasetName);
    
    if (datasetDescription) {
      formData.append("description", datasetDescription);
    }
    
    formData.append("analysisType", analysisType);
    
    uploadMutation.mutate(formData);
  };

  return (
    <div className="p-6 bg-card rounded-lg shadow-sm border border-border">
      <h2 className="text-lg font-medium text-foreground">Upload New Data</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload CSV or JSON files for analysis
      </p>
      
      <div className="mt-4">
        <div
          className={`file-upload-dropzone ${isDragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="space-y-1 text-center">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
            
            <div className="flex text-sm text-muted-foreground">
              <label className="relative font-medium text-primary cursor-pointer hover:text-primary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                <span>Upload a file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file-upload"
                  name="file-upload"
                  className="sr-only"
                  accept=".csv,.json,application/json,text/csv"
                  onChange={handleFileInputChange}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-muted-foreground">
              CSV or JSON up to 10MB
            </p>
            
            {selectedFile && (
              <p className="mt-2 text-sm text-primary">
                Selected file: {selectedFile.name}
              </p>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6 mt-6">
        <div className="sm:col-span-3">
          <Label htmlFor="dataset-name">Dataset Name</Label>
          <div className="mt-1">
            <Input
              type="text"
              id="dataset-name"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="e.g. Customer Data Q2 2023"
            />
          </div>
        </div>
        
        <div className="sm:col-span-3">
          <Label htmlFor="analysis-type">Analysis Type</Label>
          <div className="mt-1">
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger>
                <SelectValue placeholder="Select analysis type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bias_analysis">Bias Analysis</SelectItem>
                <SelectItem value="pii_detection">PII Detection</SelectItem>
                <SelectItem value="data_validation">Data Validation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="sm:col-span-6">
          <Label htmlFor="dataset-description">Description (Optional)</Label>
          <div className="mt-1">
            <Input
              type="text"
              id="dataset-description"
              value={datasetDescription}
              onChange={(e) => setDatasetDescription(e.target.value)}
              placeholder="Description of the dataset"
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-end mt-6">
        <Button
          variant="outline"
          onClick={() => {
            setSelectedFile(null);
            setDatasetName("");
            setDatasetDescription("");
          }}
          disabled={isUploading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          className="ml-3"
          disabled={!selectedFile || !datasetName || isUploading}
        >
          {isUploading ? "Uploading..." : "Upload and Process"}
        </Button>
      </div>
    </div>
  );
}
