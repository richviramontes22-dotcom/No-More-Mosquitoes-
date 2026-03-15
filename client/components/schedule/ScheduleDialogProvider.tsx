import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

import ScheduleDialog from "@/components/schedule/ScheduleDialog";

export type ScheduleFormValues = {
  fullName: string;
  email: string;
  phone: string;
  serviceAddress: string;
  zipCode: string;
  serviceFrequency: string;
  preferredDate: string;
  preferredContactMethod: string;
  notes: string;
};

export type ScheduleDialogOpenOptions = {
  source?: string;
  preset?: Partial<ScheduleFormValues>;
};

type ScheduleDialogContextValue = {
  open: (options?: ScheduleDialogOpenOptions) => void;
  close: () => void;
};

const ScheduleDialogContext = createContext<ScheduleDialogContextValue | null>(null);

export const ScheduleDialogProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  const [preset, setPreset] = useState<Partial<ScheduleFormValues> | null>(null);

  const open = useCallback((options?: ScheduleDialogOpenOptions) => {
    setOrigin(options?.source ?? null);
    setPreset(options?.preset ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setOrigin(null);
    setPreset(null);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (!nextOpen) {
      setOrigin(null);
      setPreset(null);
    }
  }, []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <ScheduleDialogContext.Provider value={value}>
      {children}
      <ScheduleDialog
        open={isOpen}
        origin={origin}
        preset={preset}
        onOpenChange={handleOpenChange}
      />
    </ScheduleDialogContext.Provider>
  );
};

export const useScheduleDialog = () => {
  const context = useContext(ScheduleDialogContext);
  if (!context) {
    throw new Error("useScheduleDialog must be used within a ScheduleDialogProvider");
  }
  return context;
};
