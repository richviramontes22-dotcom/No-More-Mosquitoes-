import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

import AuthDialog from "@/components/auth/AuthDialog";

export type AuthDialogOpenOptions = {
  defaultMode?: "login" | "signup";
  redirectTo?: string;
  source?: string;
};

type AuthDialogContextValue = {
  open: (options?: AuthDialogOpenOptions) => void;
  close: () => void;
};

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export const AuthDialogProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AuthDialogOpenOptions | null>(null);

  const open = useCallback((openOptions?: AuthDialogOpenOptions) => {
    setOptions(openOptions ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (!nextOpen) {
      setOptions(null);
    }
  }, []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <AuthDialog
        open={isOpen}
        onOpenChange={handleOpenChange}
        defaultMode={options?.defaultMode}
        redirectTo={options?.redirectTo ?? null}
        source={options?.source ?? null}
      />
    </AuthDialogContext.Provider>
  );
};

export const useAuthDialog = () => {
  const context = useContext(AuthDialogContext);
  if (!context) {
    throw new Error("useAuthDialog must be used within an AuthDialogProvider");
  }
  return context;
};
