import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import UploadsPage from "@/pages/uploads-page";
import WebhooksPage from "@/pages/webhooks-page";
import ReportsPage from "@/pages/reports-page";
import UserManagementPage from "@/pages/user-management-page";
import SettingsPage from "@/pages/settings-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/uploads" component={UploadsPage} />
      <ProtectedRoute path="/webhooks" component={WebhooksPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/users" component={UserManagementPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
