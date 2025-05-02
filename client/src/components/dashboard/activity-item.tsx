import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistance } from "date-fns";
import { Check, AlertCircle, FileUp, Webhook, Bot } from "lucide-react";

// Activity types with different icons and colors
const ACTIVITY_ICONS = {
  dataset_uploaded: {
    icon: FileUp,
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  analysis_completed: {
    icon: Check,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  analysis_failed: {
    icon: AlertCircle,
    bgColor: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  webhook_created: {
    icon: Webhook,
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    iconColor: "text-yellow-600 dark:text-yellow-400",
  },
  webhook_data_received: {
    icon: Webhook,
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  analysis_started: {
    icon: Bot,
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  // Default for any other activity type
  default: {
    icon: Check,
    bgColor: "bg-gray-100 dark:bg-gray-800",
    iconColor: "text-gray-600 dark:text-gray-400",
  },
};

interface ActivityItemProps {
  activity: {
    id: number;
    action: string;
    description: string;
    createdAt: string;
    user: {
      id: number;
      fullName: string;
      username: string;
    };
  };
  onView?: (id: number) => void;
}

export default function ActivityItem({ activity, onView }: ActivityItemProps) {
  // Get icon and styling based on activity type or use default
  const { icon: Icon, bgColor, iconColor } = ACTIVITY_ICONS[activity.action] || ACTIVITY_ICONS.default;
  
  const timeAgo = activity.createdAt 
    ? formatDistance(new Date(activity.createdAt), new Date(), { addSuffix: true })
    : '';

  const handleView = () => {
    if (onView) {
      onView(activity.id);
    }
  };

  return (
    <li className="py-4">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {activity.description}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            By: {activity.user.fullName || activity.user.username} • {timeAgo}
          </p>
        </div>
        {onView && (
          <div>
            <Button
              variant="outline"
              size="sm"
              className="inline-flex items-center shadow-sm px-2.5 py-0.5 text-sm rounded-full"
              onClick={handleView}
            >
              View
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
