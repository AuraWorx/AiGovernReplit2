import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/ui/theme-provider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Sun,
  Moon,
  User,
  Settings,
  Lock,
  Bell,
  Shield,
  Terminal, 
  Check,
  Building,
  LogOut
} from "lucide-react";

// Profile update schema
const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
});

// Password change schema
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm password is required"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");

  // Fetch tenant details
  const { data: tenant } = useQuery({
    queryKey: ["/api/tenant"],
    enabled: !!user,
  });

  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PATCH", `/api/users/${user!.id}/profile`, data);
      return await res.json();
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.setQueryData(["/api/user"], updatedUser);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", `/api/users/${user!.id}/change-password`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to change password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onProfileSubmit = (data: ProfileFormValues) => {
    profileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormValues) => {
    passwordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <MainLayout title="Settings">
      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 mb-4">
                  <AvatarImage
                    src={`https://ui-avatars.com/api/?name=${user?.fullName || user?.username}&background=random&size=80`}
                    alt={user?.fullName || user?.username || "User"}
                  />
                  <AvatarFallback>
                    {user?.fullName?.[0] || user?.username?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <h3 className="font-medium text-lg">{user?.fullName}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge className="mt-2" variant="outline">
                  {user?.role.charAt(0).toUpperCase() + user?.role.slice(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <ul className="space-y-1 p-2">
                <li>
                  <Button
                    variant={activeTab === "profile" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("profile")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Button>
                </li>
                <li>
                  <Button
                    variant={activeTab === "password" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("password")}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Password
                  </Button>
                </li>
                <li>
                  <Button
                    variant={activeTab === "appearance" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("appearance")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Appearance
                  </Button>
                </li>
                <li>
                  <Button
                    variant={activeTab === "organization" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("organization")}
                  >
                    <Building className="mr-2 h-4 w-4" />
                    Organization
                  </Button>
                </li>
                <li>
                  <Button
                    variant={activeTab === "developer" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveTab("developer")}
                  >
                    <Terminal className="mr-2 h-4 w-4" />
                    Developer
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="Your email address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      disabled={profileMutation.isPending}
                    >
                      {profileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Password Tab */}
          {activeTab === "password" && (
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your account password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormDescription>
                            Password must be at least 8 characters long
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      disabled={passwordMutation.isPending}
                    >
                      {passwordMutation.isPending ? "Changing..." : "Change Password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how the application looks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Theme</h3>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("light")}
                      className="flex items-center"
                    >
                      <Sun className="h-4 w-4 mr-1" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                      className="flex items-center"
                    >
                      <Moon className="h-4 w-4 mr-1" />
                      Dark
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("system")}
                      className="flex items-center"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      System
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Organization Tab */}
          {activeTab === "organization" && (
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
                <CardDescription>
                  View your organization information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tenant ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Organization Name</h3>
                      <p>{tenant.name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Schema Name</h3>
                      <p>{tenant.schemaName}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Status</h3>
                      <Badge variant={tenant.isActive ? "default" : "destructive"}>
                        {tenant.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Created</h3>
                      <p>{new Date(tenant.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Loading organization details...</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Developer Tab */}
          {activeTab === "developer" && (
            <Card>
              <CardHeader>
                <CardTitle>Developer Settings</CardTitle>
                <CardDescription>
                  Advanced settings for developers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  This section contains advanced settings for developers. These settings are currently in beta and may change in the future.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">API Access</h3>
                      <p className="text-sm text-muted-foreground">Enable API access for this account</p>
                    </div>
                    <Switch disabled checked={false} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Developer Mode</h3>
                      <p className="text-sm text-muted-foreground">Enable additional debugging features</p>
                    </div>
                    <Switch disabled checked={false} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Webhooks Logging</h3>
                      <p className="text-sm text-muted-foreground">Enable detailed webhook request logging</p>
                    </div>
                    <Switch disabled checked={false} />
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button variant="outline" disabled>
                    <Terminal className="mr-2 h-4 w-4" />
                    Generate API Key
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  Developer features will be available in a future update.
                </p>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
