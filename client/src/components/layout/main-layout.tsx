import { ReactNode, useState } from "react";
import Sidebar from "./sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Search, Bell, Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/ui/theme-provider";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
}

export default function MainLayout({ children, title }: MainLayoutProps) {
  const { user, logoutMutation } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop and mobile */}
      <div
        className={`${
          sidebarOpen ? "block" : "hidden"
        } md:block md:flex-shrink-0 md:w-64 z-20`}
      >
        <Sidebar onCloseSidebar={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        {/* Top navigation */}
        <div className="relative z-10 flex flex-shrink-0 h-16 bg-card shadow">
          <button
            type="button"
            className="px-4 text-muted-foreground border-r border-border focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary md:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex justify-between flex-1 px-4">
            <div className="flex flex-1">
              <div className="flex w-full md:ml-0">
                <div className="relative w-full text-muted-foreground focus-within:text-foreground">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-5 h-5" />
                  </div>
                  <Input
                    type="search"
                    placeholder="Search..."
                    className="block w-full h-full py-2 pl-10 pr-3 text-foreground placeholder-muted-foreground bg-background border-border rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center ml-4 md:ml-6">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <Bell className="w-5 h-5" />
              </Button>

              {/* Profile dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative flex items-center p-1 ml-3 text-sm bg-background rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src={`https://ui-avatars.com/api/?name=${user?.fullName || user?.username}&background=random`}
                        alt={user?.fullName || user?.username || "User"}
                      />
                      <AvatarFallback>
                        {user?.fullName?.[0] || user?.username?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user?.fullName || user?.username}</DropdownMenuLabel>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleTheme}>
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="relative flex-1 overflow-y-auto focus:outline-none">
          {/* Page header */}
          <div className="py-6 mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          </div>

          {/* Page content */}
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <div className="py-4">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
