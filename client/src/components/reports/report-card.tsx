import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock,
  Copy,
  FileJson, 
  Eye, 
  Download, 
  BarChart, 
  Loader2,
  Database,
  Webhook
} from "lucide-react";
import { formatDistance } from "date-fns";

interface ReportCardProps {
  analysis: any;
}

export default function ReportCard({ analysis }: ReportCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const { toast } = useToast();

  // Fetch full analysis details when details modal is opened
  const { data: analysisDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: [`/api/analyses/${analysis.id}`],
    enabled: isDetailsOpen,
  });

  const getStatusIcon = () => {
    switch (analysis.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "processing":
        return <Clock className="w-5 h-5 text-blue-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getAnalysisTypeIcon = () => {
    switch (analysis.analysisType) {
      case "bias_analysis":
        return <ShieldAlert className="w-5 h-5 text-primary" />;
      case "pii_detection":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "data_validation":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (analysis.status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "processing":
        return <Badge variant="default">Processing</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{analysis.status}</Badge>;
    }
  };

  const getAnalysisTypeName = () => {
    switch (analysis.analysisType) {
      case "bias_analysis":
        return "Bias Analysis";
      case "pii_detection":
        return "PII Detection";
      case "data_validation":
        return "Data Validation";
      default:
        return analysis.analysisType;
    }
  };

  const getSourceType = () => {
    if (analysis.datasetId) {
      return (
        <div className="flex items-center">
          <Database className="w-4 h-4 mr-1 text-muted-foreground" />
          <span>Dataset</span>
        </div>
      );
    } else if (analysis.webhookDataId) {
      return (
        <div className="flex items-center">
          <Webhook className="w-4 h-4 mr-1 text-muted-foreground" />
          <span>Webhook</span>
        </div>
      );
    }
    return "Unknown";
  };

  const getTimeAgo = () => {
    return analysis.createdAt 
      ? formatDistance(new Date(analysis.createdAt), new Date(), { addSuffix: true })
      : 'Unknown';
  };

  const renderResultsPreview = () => {
    if (!analysisDetails || !analysisDetails.results) {
      return (
        <div className="py-10 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-2" />
          <p>No results available</p>
        </div>
      );
    }

    const results = analysisDetails.results;

    // Bias analysis results
    if (analysis.analysisType === "bias_analysis" && results.biasMetrics) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Gender Bias</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl">{(results.biasMetrics.genderBias * 100).toFixed(1)}%</div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${results.biasMetrics.genderBias * 100}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Age Bias</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl">{(results.biasMetrics.ageBias * 100).toFixed(1)}%</div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${results.biasMetrics.ageBias * 100}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Racial Bias</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl">{(results.biasMetrics.racialBias * 100).toFixed(1)}%</div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${results.biasMetrics.racialBias * 100}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Geographic Bias</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl">{(results.biasMetrics.geographicBias * 100).toFixed(1)}%</div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${results.biasMetrics.geographicBias * 100}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="font-medium mb-2">Recommendations</h3>
            <ul className="space-y-1">
              {results.recommendedActions.map((action, index) => (
                <li key={index} className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    // PII detection results
    if (analysis.analysisType === "pii_detection" && results.findings) {
      return (
        <div className="space-y-4">
          <div className="flex justify-between">
            <div>
              <h3 className="font-medium">PII Detection</h3>
              <p className="text-sm text-muted-foreground">
                Scanned {results.scannedFields} fields
              </p>
            </div>
            <Badge 
              variant={results.piiDetected ? "destructive" : "success"}
              className="ml-2"
            >
              {results.piiDetected ? "PII Detected" : "No PII Detected"}
            </Badge>
          </div>

          {results.findings.length > 0 ? (
            <div>
              <h3 className="font-medium mb-2">Found PII Data</h3>
              <div className="border rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Path</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {results.findings.map((finding, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">{finding.path}</td>
                        <td className="px-4 py-2 text-sm">
                          <Badge variant="outline">{finding.type}</Badge>
                        </td>
                        <td className="px-4 py-2 text-sm">{(finding.confidence * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
              <p>No PII detected in the data</p>
            </div>
          )}
        </div>
      );
    }

    // Data validation results
    if (analysis.analysisType === "data_validation") {
      return (
        <div className="space-y-4">
          <div className="flex justify-between">
            <div>
              <h3 className="font-medium">Data Validation</h3>
              <p className="text-sm text-muted-foreground">
                Verified {results.records} records
              </p>
            </div>
            <Badge 
              variant={results.valid ? "success" : "destructive"}
              className="ml-2"
            >
              {results.valid ? "Valid" : "Invalid"}
            </Badge>
          </div>

          {results.issues && results.issues.length > 0 ? (
            <div>
              <h3 className="font-medium mb-2">Issues Found</h3>
              <ul className="space-y-1">
                {results.issues.map((issue, index) => (
                  <li key={index} className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
              <p>Data validated successfully</p>
            </div>
          )}
        </div>
      );
    }

    // Generic fallback
    return (
      <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96">
        {JSON.stringify(results, null, 2)}
      </pre>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              {getAnalysisTypeIcon()}
              <CardTitle className="ml-2 text-lg">{analysis.name}</CardTitle>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="pb-3 pt-1">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-muted-foreground">Type</div>
            <div>{getAnalysisTypeName()}</div>
            
            <div className="text-muted-foreground">Source</div>
            <div>{getSourceType()}</div>
            
            <div className="text-muted-foreground">Created</div>
            <div>{getTimeAgo()}</div>

            <div className="text-muted-foreground">Status</div>
            <div className="flex items-center">
              {getStatusIcon()}
              <span className="ml-1 capitalize">{analysis.status}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            variant="default" 
            size="sm" 
            className="w-full"
            onClick={() => setIsDetailsOpen(true)}
            disabled={analysis.status !== "completed"}
          >
            <Eye className="w-4 h-4 mr-1" />
            View Report
          </Button>
        </CardFooter>
      </Card>

      {/* Report Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{analysis.name}</DialogTitle>
            <DialogDescription>
              {getAnalysisTypeName()} - {getTimeAgo()}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="json">Raw JSON</TabsTrigger>
            </TabsList>
            
            {isLoadingDetails ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="summary" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Analysis Type</h3>
                      <div className="flex items-center">
                        {getAnalysisTypeIcon()}
                        <span className="ml-1">{getAnalysisTypeName()}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Status</h3>
                      <div className="flex items-center">
                        {getStatusIcon()}
                        <span className="ml-1 capitalize">{analysis.status}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Created</h3>
                      <p>{new Date(analysis.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Completed</h3>
                      <p>{analysis.completedAt ? new Date(analysis.completedAt).toLocaleString() : 'Not completed'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Source Type</h3>
                      <p>{getSourceType()}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Initiated By</h3>
                      <p>{analysis.initiatedBy?.fullName || analysis.initiatedBy?.username || 'Unknown'}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Source Details</h3>
                    {analysis.datasetId && analysisDetails?.dataset ? (
                      <div className="bg-muted p-3 rounded-md">
                        <div className="flex items-center mb-1">
                          <FileText className="w-4 h-4 mr-1 text-muted-foreground" />
                          <span className="font-medium">{analysisDetails.dataset.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          File: {analysisDetails.dataset.fileName} ({analysisDetails.dataset.fileType})
                        </p>
                      </div>
                    ) : analysis.webhookDataId && analysisDetails?.webhookData ? (
                      <div className="bg-muted p-3 rounded-md">
                        <div className="flex items-center mb-1">
                          <Webhook className="w-4 h-4 mr-1 text-muted-foreground" />
                          <span className="font-medium">Webhook Data</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Received: {new Date(analysisDetails.webhookData.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No source details available</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="results">
                  {analysis.status === "completed" ? renderResultsPreview() : (
                    <div className="py-10 text-center">
                      <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-2" />
                      <p>Results are not available for incomplete analyses</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="json">
                  {analysisDetails?.results ? (
                    <div className="relative">
                      <div className="absolute top-2 right-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(analysisDetails.results, null, 2));
                            toast({
                              title: "JSON copied",
                              description: "Raw JSON data copied to clipboard",
                            });
                          }}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                        {JSON.stringify(analysisDetails.results, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <FileJson className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p>No JSON data available</p>
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
          
          <div className="flex justify-end space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDetailsOpen(false)}
            >
              Close
            </Button>
            <Button 
              variant="outline" 
              disabled={!analysisDetails?.results}
              onClick={() => {
                // This would typically download a report
                // For now just show a toast
                toast({
                  title: "Download Feature",
                  description: "This feature will be available in a future update.",
                });
              }}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
