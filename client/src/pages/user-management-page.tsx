import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import MainLayout from "@/components/layout/main-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import UserForm from "@/components/users/user-form";

export default function UserManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Check if current user is admin or manager
  const canManageUsers = user?.role === "admin" || user?.role === "manager";

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: canManageUsers,
  });

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setIsAddUserOpen(true);
  };

  const closeDialog = () => {
    setIsAddUserOpen(false);
    setSelectedUser(null);
  };

  return (
    <MainLayout title="User Management">
      {!canManageUsers ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              You don't have permission to access user management.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium">Users</h2>
            <Button onClick={() => setIsAddUserOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : users && users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarImage
                                src={`https://ui-avatars.com/api/?name=${user.fullName || user.username}&background=random`}
                                alt={user.fullName || user.username}
                              />
                              <AvatarFallback>
                                {user.fullName?.[0] || user.username?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.fullName}</div>
                              <div className="text-xs text-muted-foreground">@{user.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.role === "admin" ? "default" : "outline"}
                          >
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {format(new Date(user.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex justify-center items-center py-10">
                  <p className="text-muted-foreground">No users found.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add/Edit User Dialog */}
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{selectedUser ? "Edit User" : "Add New User"}</DialogTitle>
                <DialogDescription>
                  {selectedUser 
                    ? "Update user details and permissions."
                    : "Create a new user account."}
                </DialogDescription>
              </DialogHeader>
              
              <UserForm 
                user={selectedUser}
                onClose={closeDialog}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </MainLayout>
  );
}
