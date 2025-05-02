import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import FileUpload from "@/components/upload/file-upload";
import { DocumentUpload } from "@/components/uploads/document-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Eye, 
  Download, 
  Loader2,
  FileJson,
  File,
  FileSpreadsheet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function UploadsPage() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("all");

  // Fetch datasets
  const { data: datasets, isLoading, refetch } = useQuery({
    queryKey: ["/api/datasets"],
  });

  const handleFileUploadComplete = () => {
    toast({
      title: "Upload Complete",
      description: "Your file has been uploaded and is being processed.",
    });
    refetch();
  };
  
  const handleViewAnalysis = (datasetId: number) => {
    // Find if there's an analysis for this dataset
    if (datasets) {
      const dataset = datasets.find(d => d.id === datasetId);
      if (dataset && dataset.analyses && dataset.analyses.length > 0) {
        navigate(`/reports/${dataset.analyses[0].id}`);
      } else {
        toast({
          title: "No Analysis Found",
          description: "There is no analysis available for this dataset.",
          variant: "destructive",
        });
      }
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    if (fileType === "application/json") {
      return <Badge variant="outline">JSON</Badge>;
    } else if (fileType === "text/csv") {
      return <Badge variant="outline">CSV</Badge>;
    }
    return <Badge variant="outline">File</Badge>;
  };

  const getFormattedFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDatasets = datasets
    ? activeTab === "all"
      ? datasets
      : datasets.filter(dataset => {
          if (activeTab === "json") return dataset.fileType === "application/json";
          if (activeTab === "csv") return dataset.fileType === "text/csv";
          return true;
        })
    : [];

  // Add upload type state
  const [uploadType, setUploadType] = useState<"data" | "documents">("data");

  return (
    <MainLayout title="Data Uploads">
      <Tabs defaultValue="data" value={uploadType} onValueChange={(v) => setUploadType(v as "data" | "documents")}>
        <div className="flex justify-between items-center mb-6">
          <TabsList>
            <TabsTrigger value="data">Data Files</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="data">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center mb-6">
              <TabsList>
                <TabsTrigger value="all">All Files</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="csv">CSV</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab}>
              <div className="grid grid-cols-1 gap-6">
                <FileUpload onUploadComplete={handleFileUploadComplete} />
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="documents">
          <div className="grid grid-cols-1 gap-6">
            <DocumentUpload onSuccess={handleFileUploadComplete} />

            <Card>
              <CardHeader>
                <CardTitle>Uploaded Datasets</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredDatasets.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDatasets.map((dataset) => (
                        <TableRow key={dataset.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                              {dataset.name}
                            </div>
                          </TableCell>
                          <TableCell>{getFileTypeIcon(dataset.fileType)}</TableCell>
                          <TableCell>{getFormattedFileSize(dataset.fileSize)}</TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(dataset.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            {dataset.analyses && dataset.analyses.length > 0 ? (
                              <Badge 
                                variant={
                                  dataset.analyses[0].status === "completed" ? "success" :
                                  dataset.analyses[0].status === "failed" ? "destructive" : "default"
                                }
                              >
                                {dataset.analyses[0].status.charAt(0).toUpperCase() + dataset.analyses[0].status.slice(1)}
                              </Badge>
                            ) : (
                              <Badge variant="outline">No Analysis</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewAnalysis(dataset.id)}
                                disabled={!dataset.analyses || dataset.analyses.length === 0}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                              {dataset.filePath && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toast({
                                    title: "Download Feature",
                                    description: "This feature will be available in a future update.",
                                  })}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No datasets found. Upload your first file above.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
