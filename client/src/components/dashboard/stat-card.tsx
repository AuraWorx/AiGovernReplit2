import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: {
    value: number;
    isPositive: boolean;
  };
  linkText?: string;
  linkHref?: string;
  onClick?: () => void;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  linkText,
  linkHref,
  onClick,
}: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1 w-0 ml-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </p>
              <div className="flex items-baseline">
                <div className="text-2xl font-semibold text-foreground">{value}</div>
                {change && (
                  <div
                    className={cn(
                      "flex items-baseline ml-2 text-sm font-semibold",
                      change.isPositive
                        ? "text-green-600 dark:text-green-500"
                        : "text-red-600 dark:text-red-500"
                    )}
                  >
                    <svg
                      className={cn(
                        "self-center flex-shrink-0 w-5 h-5",
                        change.isPositive
                          ? "text-green-500"
                          : "text-red-500"
                      )}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d={
                          change.isPositive
                            ? "M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                            : "M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                        }
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="sr-only">
                      {change.isPositive ? "Increased by" : "Decreased by"}
                    </span>
                    {change.value}%
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {(linkText || onClick) && (
        <CardFooter className="px-5 py-3 bg-muted">
          <div className="text-sm">
            {linkHref ? (
              <a
                href={linkHref}
                className="font-medium text-primary hover:text-primary/80"
              >
                {linkText}
              </a>
            ) : (
              <button
                onClick={onClick}
                className="font-medium text-primary hover:text-primary/80"
              >
                {linkText}
              </button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
