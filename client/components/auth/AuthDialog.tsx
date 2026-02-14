import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AuthTabs from "@/components/auth/AuthTabs";

export type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "login" | "signup";
  redirectTo?: string | null;
  source?: string | null;
};

const AuthDialog = ({ open, onOpenChange, defaultMode = "login", redirectTo, source }: AuthDialogProps) => {
  const navigate = useNavigate();

  const handleSuccess = useCallback(
    () => {
      onOpenChange(false);
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
        return;
      }
      navigate("/dashboard", { replace: true });
    },
    [navigate, onOpenChange, redirectTo],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[28px] border-border/70 bg-card/95 p-0 shadow-soft">
        <DialogHeader className="gap-3 border-b border-border/60 px-8 py-6 text-left">
          <DialogTitle className="text-2xl font-semibold">Customer login</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {source ? `Started from ${source.replace(/-/g, " ")}. ` : null}
            Sign in or create a portal account to manage visits, invoices, and payments.
          </DialogDescription>
        </DialogHeader>
        <div className="px-8 py-6">
          <AuthTabs defaultMode={defaultMode} onSuccess={handleSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
