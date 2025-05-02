import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FormLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onCancel?: () => void;
  onSubmit?: () => void;
  submitText?: string;
  cancelText?: string;
  isSubmitting?: boolean;
  isValid?: boolean;
}

export default function FormLayout({
  title,
  description,
  children,
  footer,
  onCancel,
  onSubmit,
  submitText = "Submit",
  cancelText = "Cancel",
  isSubmitting = false,
  isValid = true,
}: FormLayoutProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="flex justify-between border-t p-4">
        {footer ? (
          footer
        ) : (
          <>
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                {cancelText}
              </Button>
            )}
            {onSubmit && (
              <Button
                onClick={onSubmit}
                disabled={isSubmitting || !isValid}
                className={onCancel ? "ml-auto" : ""}
              >
                {isSubmitting ? "Processing..." : submitText}
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
