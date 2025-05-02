import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import MainLayout from "@/components/layout/main-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Webhook, Plus, Copy, Code, Link2, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import WebhookForm from "@/components/webhook/webhook-form";

const webhookSchema = z.object({
  name: z.string().min(1, "Name is required"),
  endpoint: z.string().url("Must be a valid URL"),
  secret: z.string().optional(),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

export default function WebhooksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isWebhookFormOpen, setIsWebhookFormOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch webhooks
  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["/api/webhooks"],
  });

  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: "",
      endpoint: "",
      secret: "",
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: WebhookFormValues) => {
      const res = await apiRequest("POST", "/api/webhooks", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook created",
        description: "Your webhook has been created successfully.",
      });
      setIsWebhookFormOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WebhookFormValues) => {
    createWebhookMutation.mutate(data);
  };

  const handleCopyUrl = (webhook) => {
    // Construct the webhook URL
    const webhookUrl = `${window.location.origin}/api/webhook-receiver/${webhook.id}`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "URL copied",
      description: "Webhook URL has been copied to clipboard.",
    });
  };

  const copyWebhookCode = (webhook) => {
    const baseUrl = window.location.origin;
    const webhookUrl = `${baseUrl}/api/webhook-receiver/${webhook.id}`;
    
    const code = `
// Example code to call this webhook
fetch("${webhookUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ${webhook.secret ? `"X-Webhook-Signature": "YOUR_COMPUTED_SIGNATURE"` : ""}
  },
  body: JSON.stringify({
    // Your data here
    "sample": "data",
    "timestamp": new Date().toISOString()
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error("Error calling webhook:", error));
`;
    
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied",
      description: "Example code has been copied to clipboard.",
    });
  };

  const filteredWebhooks = webhooks 
    ? activeTab === "all" 
      ? webhooks 
      : webhooks.filter(webhook => (
          activeTab === "active" ? webhook.isActive : !webhook.isActive
        ))
    : [];

  return (
    <MainLayout title="Webhooks">
      <div className="flex justify-between items-center mb-6">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Webhooks</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Button onClick={() => setIsWebhookFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredWebhooks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWebhooks.map((webhook) => (
            <Card key={webhook.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg truncate">{webhook.name}</CardTitle>
                  <Badge variant={webhook.isActive ? "default" : "outline"}>
                    {webhook.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription className="truncate">
                  {webhook.endpoint}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDistanceToNow(new Date(webhook.createdAt), { addSuffix: true })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Secret</span>
                    <span>{webhook.secret ? "Configured" : "Not set"}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col space-y-2 pt-0">
                <div className="flex space-x-2 w-full">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleCopyUrl(webhook)}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy URL
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => copyWebhookCode(webhook)}
                  >
                    <Code className="w-3 h-3 mr-1" />
                    Copy Code
                  </Button>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    setSelectedWebhook(webhook);
                    setIsWebhookFormOpen(true);
                  }}
                >
                  <Link2 className="w-3 h-3 mr-1" />
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Webhook className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No webhooks found. Create a webhook to receive data from external systems.
            </p>
            <Button onClick={() => setIsWebhookFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Webhook
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Webhook Form Dialog */}
      <Dialog open={isWebhookFormOpen} onOpenChange={setIsWebhookFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedWebhook ? "Webhook Details" : "Create New Webhook"}</DialogTitle>
            <DialogDescription>
              {selectedWebhook 
                ? "View and manage your webhook settings."
                : "Create a webhook to receive data from external systems."}
            </DialogDescription>
          </DialogHeader>
          
          <WebhookForm 
            webhook={selectedWebhook} 
            onClose={() => {
              setIsWebhookFormOpen(false);
              setSelectedWebhook(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
