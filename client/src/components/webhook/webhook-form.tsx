import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Switch } from "@/components/ui/switch";
import { Copy, RefreshCw } from "lucide-react";

const webhookSchema = z.object({
  name: z.string().min(1, "Name is required"),
  endpoint: z.string().url("Must be a valid URL"),
  secret: z.string().optional(),
  isActive: z.boolean().default(true),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

interface WebhookFormProps {
  webhook?: any;
  onClose: () => void;
}

export default function WebhookForm({ webhook, onClose }: WebhookFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(!webhook);

  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: webhook?.name || "",
      endpoint: webhook?.endpoint || "",
      secret: webhook?.secret || "",
      isActive: webhook?.isActive ?? true,
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
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async (data: WebhookFormValues) => {
      const res = await apiRequest("PATCH", `/api/webhooks/${webhook.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook updated",
        description: "Your webhook has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WebhookFormValues) => {
    if (webhook) {
      updateWebhookMutation.mutate(data);
    } else {
      createWebhookMutation.mutate(data);
    }
  };

  const generateSecret = () => {
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    form.setValue("secret", secret);
  };

  const handleCopyEndpoint = () => {
    if (webhook) {
      const baseUrl = window.location.origin;
      const webhookUrl = `${baseUrl}/api/webhook-receiver/${webhook.id}`;
      
      navigator.clipboard.writeText(webhookUrl);
      toast({
        title: "Endpoint URL copied",
        description: "Webhook endpoint URL has been copied to clipboard.",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter webhook name" 
                  {...field} 
                  disabled={webhook && !isEditing}
                />
              </FormControl>
              <FormDescription>
                A descriptive name for your webhook
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="endpoint"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Endpoint URL</FormLabel>
              <FormControl>
                <Input 
                  placeholder="https://example.com/webhook" 
                  {...field} 
                  disabled={webhook && !isEditing}
                />
              </FormControl>
              <FormDescription>
                The URL where data will be sent
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="secret"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Secret Key (Optional)</FormLabel>
                {(isEditing || !webhook) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={generateSecret}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Generate
                  </Button>
                )}
              </div>
              <FormControl>
                <Input 
                  placeholder="Enter secret key or generate one" 
                  {...field} 
                  type="password"
                  disabled={webhook && !isEditing}
                />
              </FormControl>
              <FormDescription>
                Used to validate webhook requests
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>
                  Enable or disable this webhook
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={webhook && !isEditing}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {webhook && (
          <div className="pt-2">
            <FormLabel>Webhook URL</FormLabel>
            <div className="flex mt-1">
              <Input 
                value={`${window.location.origin}/api/webhook-receiver/${webhook.id}`}
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                className="ml-2"
                onClick={handleCopyEndpoint}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <FormDescription>
              Use this URL to receive data from external systems
            </FormDescription>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          {webhook && !isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createWebhookMutation.isPending || updateWebhookMutation.isPending}
              >
                {createWebhookMutation.isPending || updateWebhookMutation.isPending
                  ? "Saving..."
                  : webhook
                  ? "Update"
                  : "Create"
                }
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  );
}
