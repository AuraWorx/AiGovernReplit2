import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Home,
  FileUp,
  Webhook,
  LineChart,
  Users,
  Settings,
  PlusCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onCloseSidebar?: () => void;
}

export default function Sidebar({ onCloseSidebar }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: Home,
    },
    {
      name: "Data Uploads",
      href: "/uploads",
      icon: FileUp,
    },
    {
      name: "Webhooks",
      href: "/webhooks",
      icon: Webhook,
    },
    {
      name: "Reports",
      href: "/reports",
      icon: LineChart,
    },
    {
      name: "User Management",
      href: "/users",
      icon: Users,
      requiresAdmin: true, // Only show for admin users
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  // Filter navigation items based on user role
  const filteredNavItems = navigationItems.filter(
    (item) => !item.requiresAdmin || user?.role === "admin"
  );

  const isActive = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  return (
    <div className="flex flex-col w-64 h-screen bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center justify-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center">
          <PlusCircle className="w-8 h-8 text-primary" />
          <span className="ml-2 text-lg font-semibold text-sidebar-foreground">AI Govern</span>
        </div>
      </div>

      <div className="flex flex-col flex-grow p-4 overflow-y-auto">
        <nav className="flex-1 space-y-1">
          {filteredNavItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={onCloseSidebar}
              className={cn(
                "flex items-center px-4 py-2 text-sm font-medium rounded-md sidebar-link",
                isActive(item.href)
                  ? "text-sidebar-primary bg-sidebar-primary/10 border-l-2 border-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-shrink-0 p-4 border-t border-sidebar-border">
        <div className="flex items-center w-full">
          <div>
            <Avatar className="w-8 h-8">
              <AvatarImage
                src={`https://ui-avatars.com/api/?name=${user?.fullName || user?.username}&background=random`}
                alt={user?.fullName || user?.username || "User"}
              />
              <AvatarFallback>
                {user?.fullName?.[0] || user?.username?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.fullName || user?.username}
            </p>
            <p className="text-xs font-medium text-muted-foreground truncate">
              {user?.role.charAt(0).toUpperCase() + user?.role.slice(1)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
