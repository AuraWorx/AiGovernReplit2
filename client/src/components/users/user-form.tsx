import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Schema for creating a new user
const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(1, "Full name is required"),
  role: z.enum(["user", "manager", "admin"]).default("user"),
});

// Schema for updating an existing user
const updateUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(1, "Full name is required"),
  role: z.enum(["user", "manager", "admin"]),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

interface UserFormProps {
  user?: any;
  onClose: () => void;
}

export default function UserForm({ user, onClose }: UserFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch tenant data for user creation
  const { data: tenant } = useQuery({
    queryKey: ["/api/tenant"],
  });

  // Use different form schema based on whether we're creating or updating
  const formSchema = user ? updateUserSchema : createUserSchema;
  
  // Cast the form handler to accept either form type
  const form = useForm<CreateUserFormValues | UpdateUserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: user
      ? {
          email: user.email || "",
          fullName: user.fullName || "",
          role: user.role || "user",
        }
      : {
          username: "",
          password: "",
          email: "",
          fullName: "",
          role: "user",
        },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormValues) => {
      const res = await apiRequest("POST", "/api/register", {
        ...data,
        tenantId: tenant?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "The user has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: UpdateUserFormValues) => {
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "The user has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateUserFormValues | UpdateUserFormValues) => {
    if (user) {
      updateUserMutation.mutate(data as UpdateUserFormValues);
    } else {
      createUserMutation.mutate(data as CreateUserFormValues);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {!user && (
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="Enter username" {...field} />
                </FormControl>
                <FormDescription>
                  Username must be at least 3 characters
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Enter email address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {!user && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="Enter password" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  Password must be at least 8 characters
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Controls user's permissions and access levels
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createUserMutation.isPending || updateUserMutation.isPending}
          >
            {createUserMutation.isPending || updateUserMutation.isPending
              ? "Saving..."
              : user
              ? "Update User"
              : "Create User"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}
