import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import StatCard from "@/components/dashboard/stat-card";
import ActivityItem from "@/components/dashboard/activity-item";
import FileUpload from "@/components/upload/file-upload";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { 
  FileText, 
  Webhook, 
  SlidersVertical 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  // Fetch dashboard stats
  const { data: datasets } = useQuery({
    queryKey: ["/api/datasets"],
    enabled: !!user,
  });

  // Fetch webhooks
  const { data: webhooks } = useQuery({
    queryKey: ["/api/webhooks"],
    enabled: !!user,
  });

  // Fetch analyses
  const { data: analyses } = useQuery({
    queryKey: ["/api/analyses"],
    enabled: !!user,
  });

  // Fetch recent activities
  const { data: activities } = useQuery({
    queryKey: ["/api/activities", { limit: 5 }],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/activities?limit=5`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!user,
  });

  const handleUploadComplete = (data) => {
    toast({
      title: "Upload Successful",
      description: "Your data has been uploaded and is being processed.",
    });
  };

  const handleViewActivity = (id: number) => {
    // Navigate to appropriate page based on activity type
  };

  return (
    <MainLayout title="Dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 mt-2 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Uploads"
          value={datasets?.length || 0}
          icon={FileText}
          change={datasets?.length > 0 ? { value: 12, isPositive: true } : undefined}
          linkText="View all uploads"
          onClick={() => navigate("/uploads")}
        />
        
        <StatCard
          title="Active Webhooks"
          value={webhooks?.length || 0}
          icon={Webhook}
          change={webhooks?.length > 0 ? { value: 3, isPositive: true } : undefined}
          linkText="Manage webhooks"
          onClick={() => navigate("/webhooks")}
        />
        
        <StatCard
          title="Bias Analyses"
          value={analyses?.filter(a => a.analysisType === "bias_analysis")?.length || 0}
          icon={SlidersVertical}
          change={analyses?.length > 0 ? { value: 8, isPositive: false } : undefined}
          linkText="View analysis reports"
          onClick={() => navigate("/reports")}
        />
      </div>

      {/* Recent Activities Section */}
      <div className="mt-8">
        <h2 className="text-lg font-medium leading-6 text-foreground mb-4">Recent Activities</h2>
        {activities && activities.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    onView={handleViewActivity}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No recent activities found.</p>
            </CardContent>
          </Card>
        )}
        
        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/reports")}
          >
            View all activities
          </Button>
        </div>
      </div>

      {/* Upload New Data Section */}
      <div className="mt-8">
        <FileUpload onUploadComplete={handleUploadComplete} />
      </div>

      {/* Recent Reports Section */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-foreground mb-4">Recent Reports</h2>
        {analyses && analyses.length > 0 ? (
          <div className="mt-2 overflow-hidden bg-card shadow rounded-md">
            <ul className="divide-y divide-border">
              {analyses.slice(0, 3).map((analysis) => (
                <li key={analysis.id}>
                  <Button
                    variant="ghost"
                    className="w-full block hover:bg-muted"
                    onClick={() => navigate(`/reports/${analysis.id}`)}
                  >
                    <div className="px-4 py-4 sm:px-6 text-left w-full">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-primary truncate">
                          {analysis.name}
                        </p>
                        <div className="flex flex-shrink-0 ml-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            analysis.status === "completed" 
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : analysis.status === "failed" 
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}>
                            {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-muted-foreground">
                            <FileText className="flex-shrink-0 mr-1.5 h-5 w-5 text-muted-foreground" />
                            {analysis.datasetId ? "Dataset analysis" : "Webhook data analysis"}
                          </p>
                        </div>
                        <div className="flex items-center mt-2 text-sm text-muted-foreground sm:mt-0">
                          {analysis.createdAt && (
                            <time dateTime={new Date(analysis.createdAt).toISOString()}>
                              {new Date(analysis.createdAt).toLocaleDateString()}
                            </time>
                          )}
                        </div>
                      </div>
                    </div>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No reports found. Upload data to generate reports.</p>
            </CardContent>
          </Card>
        )}

        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/reports")}
          >
            View all reports
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
