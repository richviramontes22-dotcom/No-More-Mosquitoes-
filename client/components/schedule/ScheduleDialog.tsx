import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Home, Mail, PhoneCall, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { FormStatus, isValidEmail, isValidPhone, postJson } from "@/lib/forms";
import { cn } from "@/lib/utils";
import type { ScheduleRequestPayload, ScheduleResponse } from "@shared/api";
import { ScheduleFlow } from "./ScheduleFlow";

const SERVICE_FREQUENCY_OPTIONS = [
  { value: "single", label: "One-time visit" },
  { value: "monthly", label: "Every 4 weeks" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "weekly", label: "Weekly" },
] as const;

const CONTACT_METHOD_OPTIONS = [
  { value: "text", label: "Text me" },
  { value: "call", label: "Call me" },
  { value: "email", label: "Email me" },
] as const;

type ServiceFrequency = (typeof SERVICE_FREQUENCY_OPTIONS)[number]["value"];
type ContactMethod = (typeof CONTACT_METHOD_OPTIONS)[number]["value"];

export type ScheduleFormValues = {
  fullName: string;
  email: string;
  phone: string;
  serviceAddress: string;
  city: string;
  state: string;
  zipCode: string;
  serviceFrequency: ServiceFrequency;
  preferredDate: string;
  preferredContactMethod: ContactMethod;
  notes: string;
  acreage?: number;
};

const initialFormValues: ScheduleFormValues = {
  fullName: "",
  email: "",
  phone: "",
  serviceAddress: "",
  city: "",
  state: "",
  zipCode: "",
  serviceFrequency: "monthly",
  preferredDate: "",
  preferredContactMethod: "text",
  notes: "",
};

type ScheduleDialogProps = {
  open: boolean;
  origin: string | null;
  preset?: Partial<ScheduleFormValues> | null;
  onOpenChange: (open: boolean) => void;
};

type PasswordStrength = {
  score: number;
  label: string;
  percent: number;
  colorClass: string;
};

const zipPattern = /^\d{5}$/;

const evaluatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return {
      score: 0,
      label: "Use at least 8 characters with letters and numbers.",
      percent: 0,
      colorClass: "bg-muted",
    };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  score = Math.min(score, 4);

  const labels = [
    "Add more to strengthen your password.",
    "Getting stronger—add numbers or symbols.",
    "Nice! Add one more unique character for extra security.",
    "Strong password—great choice.",
    "Very strong password.",
  ];

  const colors = [
    "bg-destructive",
    "bg-orange-500",
    "bg-amber-500",
    "bg-lime-500",
    "bg-emerald-500",
  ];

  return {
    score,
    label: labels[score],
    percent: (score / 4) * 100,
    colorClass: colors[score],
  };
};

const createSchedulePayload = (values: ScheduleFormValues, origin: string | null): ScheduleRequestPayload => ({
  ...values,
  origin: origin ?? undefined,
  submittedAt: new Date().toISOString(),
});

const ScheduleDialog = ({ open, origin, preset, onOpenChange }: ScheduleDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formValues, setFormValues] = useState<ScheduleFormValues>(initialFormValues);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [confirmation, setConfirmation] = useState<ScheduleResponse | null>(null);

  useEffect(() => {
    if (open) {
      if (preset) {
        setFormValues(prev => ({
          ...prev,
          ...preset,
          // Pre-fill user name and email if available
          fullName: preset.fullName || user?.name || prev.fullName,
          email: preset.email || user?.email || prev.email,
        }));
      } else if (user) {
        setFormValues(prev => ({
          ...prev,
          fullName: user.name || prev.fullName,
          email: user.email || prev.email,
        }));
      }
    } else {
      setStatus("idle");
      setConfirmation(null);
      setFormValues(initialFormValues);
    }
  }, [open, preset, user]);

  const isSubmitting = status === "submitting";

  const invalidReason = useMemo(() => {
    if (!formValues.fullName.trim()) return "Enter your name.";
    if (!isValidEmail(formValues.email)) return "Add a valid email so we can confirm your route.";
    if (!isValidPhone(formValues.phone)) return "Add a valid 10-digit phone number.";
    if (!formValues.serviceAddress.trim()) return "Share the service address.";
    if (!zipPattern.test(formValues.zipCode.trim())) return "Enter a 5-digit ZIP.";
    if (!formValues.serviceFrequency) return "Choose how often you’d like service.";
    if (!formValues.preferredDate) return "Pick your desired start date.";
    return null;
  }, [formValues]);

  const handleChange = <T extends keyof ScheduleFormValues>(field: T, value: ScheduleFormValues[T]) => {
    setFormValues((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invalidReason) {
      toast({ title: "Update request details", description: invalidReason });
      return;
    }

    try {
      setStatus("submitting");
      if (!user) {
        throw new Error("You must be logged in to schedule a service.");
      }

      const response = await postJson<ScheduleResponse>("/api/schedule", createSchedulePayload(formValues, origin));
      setConfirmation(response ?? null);
      setStatus("success");
      toast({
        title: "Request received",
        description: "We’ll reach out soon to lock in your visit window.",
      });
    } catch (error) {
      setStatus("idle");
      toast({
        title: "Unable to schedule",
        description: error instanceof Error ? error.message : "Please try again in a moment.",
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const isDashboardFlow = origin === "dashboard-appointments" || user !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-3xl rounded-[32px] border-border/70 bg-card/95 p-0 shadow-soft overflow-hidden",
        isDashboardFlow && "max-w-4xl"
      )}>
        {status === "success" ? (
          <div className="flex flex-col gap-6 p-10">
            <DialogHeader className="gap-2 text-left">
              <div className="flex items-center gap-3 text-primary">
                <CheckCircle2 className="h-6 w-6" aria-hidden />
                <DialogTitle className="text-2xl">Your visit is scheduled</DialogTitle>
              </div>
              <DialogDescription className="text-base text-muted-foreground">
                We've received your request and locked in your preferred time. A confirmation has been sent to your email.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 rounded-3xl border border-border/60 bg-background/60 p-6">
              <p className="text-sm font-semibold text-muted-foreground">Appointment Summary</p>
              <ul className="grid gap-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                  <span>
                    Scheduled for: {formValues.preferredDate ? new Date(formValues.preferredDate).toLocaleDateString() : "TBD"}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" aria-hidden />
                  <span>
                    Arrival window: {formValues.notes.includes("Slot:") ? formValues.notes.split("Slot:")[1].split("|")[0].trim() : "Standard Morning"}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" aria-hidden />
                  <span>
                    Location: {formValues.serviceAddress || "Primary Property"}
                  </span>
                </li>
              </ul>
              {confirmation?.ticketId ? (
                <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                  Reference ID: {confirmation.ticketId}
                </p>
              ) : null}
            </div>
            <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button onClick={handleClose} className="rounded-xl px-8">Done</Button>
            </DialogFooter>
          </div>
        ) : isDashboardFlow ? (
          <div className="p-8 md:p-12">
            <DialogHeader className="mb-8 space-y-2 text-left">
              <DialogTitle className="text-3xl font-display font-bold">Schedule Service</DialogTitle>
              <DialogDescription className="text-muted-foreground text-lg">
                Pick your preferred timing and tell us about your yard.
              </DialogDescription>
            </DialogHeader>
            <ScheduleFlow
              onCancel={handleClose}
              onSuccess={async (data) => {
                try {
                  setStatus("submitting");
                  const payload = {
                    ...formValues,
                    userId: user?.id,
                    propertyId: data.property?.id,
                    fullName: user?.name || formValues.fullName,
                    email: user?.email || formValues.email,
                    phone: data.phone || formValues.phone,
                    serviceAddress: data.property?.address || formValues.serviceAddress,
                    zipCode: data.property?.zip || formValues.zipCode,
                    preferredDate: data.date.toISOString(),
                    notes: `Slot: ${data.time} | Pets: ${data.questionnaire.hasPets} | Water: ${data.questionnaire.hasStandingWater} | Instructions: ${data.questionnaire.gateInstructions} | Visit Notes: ${data.notes || "None"}`,
                    submittedAt: new Date().toISOString(),
                    serviceFrequency: formValues.serviceFrequency || "monthly",
                    preferredContactMethod: formValues.preferredContactMethod || "text",
                  };
                  const response = await postJson<ScheduleResponse>("/api/schedule", createSchedulePayload(payload as any, origin));
                  setConfirmation(response ?? null);
                  setStatus("success");
                  toast({ title: "Appointment Scheduled", description: "See you soon!" });
                } catch (err) {
                  console.error("Scheduling Error:", err);
                  setStatus("idle");
                  toast({ title: "Error", description: "Failed to schedule. Please try again.", variant: "destructive" });
                }
              }}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-0">
            <DialogHeader className="gap-3 border-b border-border/60 px-10 py-8 text-left">
              <DialogTitle className="text-3xl font-semibold">Lock in your next visit</DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                Share your preferred timing and property details. Our local team confirms every request within one business day.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-8 px-10 py-8">
              <fieldset disabled={isSubmitting} className="grid gap-6">
                <legend className="sr-only">Schedule pest control service</legend>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-full-name">Full name</Label>
                    <Input
                      id="schedule-full-name"
                      autoComplete="name"
                      placeholder="Taylor Johnson"
                      value={formValues.fullName}
                      onChange={(event) => handleChange("fullName", event.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-email">Email</Label>
                    <Input
                      id="schedule-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={formValues.email}
                      onChange={(event) => handleChange("email", event.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-phone">Phone</Label>
                    <Input
                      id="schedule-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(949) 555-0123"
                      value={formValues.phone}
                      onChange={(event) => handleChange("phone", event.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-contact-method">Preferred contact method</Label>
                    <Select
                      value={formValues.preferredContactMethod}
                      onValueChange={(value) => handleChange("preferredContactMethod", value as ScheduleFormValues["preferredContactMethod"])}
                    >
                      <SelectTrigger id="schedule-contact-method">
                        <SelectValue placeholder="Choose a contact method" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_METHOD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-address">Service address</Label>
                    <Input
                      id="schedule-address"
                      autoComplete="street-address"
                      placeholder="742 Evergreen Terrace"
                      value={formValues.serviceAddress}
                      onChange={(event) => handleChange("serviceAddress", event.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-4 grid-cols-[1.5fr_1fr_1fr]">
                    <div className="grid gap-2">
                      <Label htmlFor="schedule-city">City</Label>
                      <Input
                        id="schedule-city"
                        placeholder="Springfield"
                        value={formValues.city}
                        onChange={(event) => handleChange("city", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="schedule-state">State</Label>
                      <Input
                        id="schedule-state"
                        placeholder="IL"
                        value={formValues.state}
                        onChange={(event) => handleChange("state", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="schedule-zip">ZIP</Label>
                      <Input
                        id="schedule-zip"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        placeholder="92657"
                        value={formValues.zipCode}
                        onChange={(event) => handleChange("zipCode", event.target.value)}
                        required
                        maxLength={5}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-frequency">Service cadence</Label>
                    <Select
                      value={formValues.serviceFrequency}
                      onValueChange={(value) => handleChange("serviceFrequency", value as ScheduleFormValues["serviceFrequency"])}
                    >
                      <SelectTrigger id="schedule-frequency">
                        <SelectValue placeholder="Choose timing" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_FREQUENCY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-date">Preferred start date</Label>
                    <Input
                      id="schedule-date"
                      type="date"
                      value={formValues.preferredDate}
                      onChange={(event) => handleChange("preferredDate", event.target.value)}
                      required
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>
                <div className="mt-6 grid gap-2">
                  <Label htmlFor="schedule-notes">Notes for your technician (optional)</Label>
                  <Textarea
                    id="schedule-notes"
                    placeholder="Gate codes, pets, or areas needing extra attention."
                    value={formValues.notes}
                    onChange={(event) => handleChange("notes", event.target.value)}
                    rows={4}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  By submitting, you agree to receive service updates via your preferred contact method. We never share your details outside our company.
                </p>
              </fieldset>
            </div>
            <DialogFooter className="flex items-center justify-between gap-4 border-t border-border/60 px-10 py-6">
              {origin ? (
                <span className="text-xs text-muted-foreground">Requested from {origin}</span>
              ) : (
                <span className="text-xs text-muted-foreground">We confirm all requests within one business day.</span>
              )}
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit request"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleDialog;
