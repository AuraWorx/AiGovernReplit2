import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import ReportCard from "@/components/reports/report-card";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  LineChart, 
  Loader2 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Fetch analyses
  const { data: analyses, isLoading } = useQuery({
    queryKey: ["/api/analyses"],
  });

  // Filter and sort analyses
  const filteredAndSortedAnalyses = analyses
    ? analyses
        .filter((analysis) => {
          if (activeTab === "all") return true;
          if (activeTab === "bias") return analysis.analysisType === "bias_analysis";
          if (activeTab === "pii") return analysis.analysisType === "pii_detection";
          if (activeTab === "validation") return analysis.analysisType === "data_validation";
          return true;
        })
        .sort((a, b) => {
          if (sortBy === "newest") {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          if (sortBy === "oldest") {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
          if (sortBy === "status") {
            // Sort completed first, then processing, then failed
            const statusOrder = { completed: 0, processing: 1, pending: 2, failed: 3 };
            return statusOrder[a.status] - statusOrder[b.status];
          }
          return 0;
        })
    : [];

  return (
    <MainLayout title="Analysis Reports">
      <div className="flex justify-between items-center mb-6">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Reports</TabsTrigger>
            <TabsTrigger value="bias">Bias Analysis</TabsTrigger>
            <TabsTrigger value="pii">PII Detection</TabsTrigger>
            <TabsTrigger value="validation">Data Validation</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center">
          <span className="text-sm mr-2 text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAndSortedAnalyses.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAndSortedAnalyses.map((analysis) => (
            <ReportCard key={analysis.id} analysis={analysis} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <LineChart className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-2">
              No analysis reports found.
            </p>
            <p className="text-muted-foreground text-center text-sm">
              Upload data or configure webhooks to generate analysis reports.
            </p>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
}
