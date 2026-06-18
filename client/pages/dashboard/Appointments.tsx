import { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format, isBefore, startOfDay, parseISO } from "date-fns";
import { VideoRecapGrid } from "@/components/dashboard/VideoRecapGrid";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";
import { WeatherStatusModule } from "@/components/dashboard/WeatherStatusModule";
import { useCart } from "@/contexts/CartContext";
import { useMarketplaceOrders } from "@/hooks/dashboard/useMarketplaceOrders";
import {
  Calendar,
  Clock,
  User,
  ChevronRight,
  Plus,
  Bell,
  CheckCircle2,
  CalendarCheck,
  History as HistoryIcon,
  Loader2,
  MapPin,
  AlertCircle,
  Sun,
  Sunset,
  ShoppingCart,
  Package,
  X,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAppointments, type Appointment } from "@/hooks/dashboard/useAppointments";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { stringifyError } from "@/lib/error-utils";
import { formatPrice } from "@/hooks/dashboard/useCatalogItems";

// ── Availability types (mirrors server/routes/availability.ts) ────────────────

interface WindowOption {
  id: string;
  label: string;
  start: string;
  end: string;
  available: boolean;
  remaining: number;
}

interface DayAvailability {
  date: string;
  is_operational: boolean;
  is_blackout: boolean;
  windows: WindowOption[];
}

// ── Reschedule Dialog ─────────────────────────────────────────────────────────

function RescheduleDialog({
  appointment,
  onClose,
  onSuccess,
}: {
  appointment: Appointment;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, DayAvailability>>(new Map());
  const [isLoadingAvail, setIsLoadingAvail] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedWindow, setSelectedWindow] = useState<WindowOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  // Fetch 45 days of availability on open
  useEffect(() => {
    setIsLoadingAvail(true);
    fetch(`/api/availability?days=45`)
      .then(r => r.json())
      .then((json: { days: DayAvailability[] }) => {
        const map = new Map<string, DayAvailability>();
        json.days.forEach(d => map.set(d.date, d));
        setAvailabilityMap(map);
      })
      .catch(() => {})
      .finally(() => setIsLoadingAvail(false));
  }, []);

  const isDateDisabled = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return true;
    const day = availabilityMap.get(date.toISOString().slice(0, 10));
    if (!day) return false;
    return !day.is_operational || day.is_blackout;
  };

  const windowsForDate = selectedDate
    ? (availabilityMap.get(selectedDate.toISOString().slice(0, 10))?.windows ?? [])
    : [];

  const handleSubmit = async () => {
    if (!selectedDate || !selectedWindow) return;
    setIsSubmitting(true);

    const scheduledDate = selectedDate.toISOString().slice(0, 10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const resp = await fetch(`/api/appointments/${appointment.id}/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          scheduledDate,
          windowId:    selectedWindow.id,
          windowLabel: selectedWindow.label,
          windowStart: selectedWindow.start,
        }),
      });

      if (resp.status === 409) {
        const { error } = await resp.json();
        toast({ title: "Window unavailable", description: error, variant: "destructive" });
        setSelectedWindow(null);
        // Refresh availability
        fetch(`/api/availability?days=45`)
          .then(r => r.json())
          .then((json: { days: DayAvailability[] }) => {
            const map = new Map<string, DayAvailability>();
            json.days.forEach(d => map.set(d.date, d));
            setAvailabilityMap(map);
          })
          .catch(() => {});
        return;
      }

      if (!resp.ok) {
        const { error } = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error);
      }

      toast({
        title: "Appointment rescheduled",
        description: `New date: ${format(selectedDate, "MMMM d, yyyy")} · ${selectedWindow.label}`,
      });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Reschedule failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showRequestDialog) {
    return (
      <RescheduleRequestDialog
        appointment={appointment}
        onClose={() => setShowRequestDialog(false)}
        onSubmitted={onClose}
      />
    );
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-[28px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="bg-primary/5 px-8 py-6 border-b border-border/40">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Reschedule Appointment
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Job #{appointment.displayId} · currently {appointment.timeWindow}
          </p>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Calendar */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Select a new date {isLoadingAvail && <span className="text-primary/50">(loading…)</span>}
            </p>
            <CalendarPicker
              mode="single"
              selected={selectedDate}
              onSelect={d => { setSelectedDate(d); setSelectedWindow(null); }}
              disabled={isDateDisabled}
              className="rounded-xl border border-border/60 p-3 w-full"
            />
          </div>

          {/* Windows */}
          {selectedDate && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Available arrival windows — {format(selectedDate, "MMMM d")}
              </p>
              {windowsForDate.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No windows available on this date.</p>
              ) : (
                <div className="grid gap-2">
                  {windowsForDate.map(win => (
                    <button
                      key={win.id}
                      disabled={!win.available}
                      onClick={() => setSelectedWindow(win)}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all",
                        selectedWindow?.id === win.id
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:border-primary/30",
                        !win.available && "opacity-40 cursor-not-allowed bg-muted/50 border-transparent",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {win.id === "morning" ? <Sun className="h-4 w-4 text-primary" /> : <Sunset className="h-4 w-4 text-primary" />}
                        <div>
                          <p className="font-bold text-sm">{win.label}</p>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                            {win.available ? `${win.remaining} spot${win.remaining !== 1 ? "s" : ""} left` : "Fully booked"}
                          </p>
                        </div>
                      </div>
                      {selectedWindow?.id === win.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button variant="ghost" className="flex-1 rounded-xl h-11" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 rounded-xl h-11 shadow-brand"
            disabled={!selectedDate || !selectedWindow || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rescheduling…</> : "Confirm Reschedule"}
          </Button>
        </div>

        <div className="px-6 pb-6 -mt-2 text-center">
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-primary"
            onClick={() => setShowRequestDialog(true)}
          >
            Don't see a date that works? Request a different one
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Reschedule Request Dialog (additive — for dates not open to instant rebooking) ─

function RescheduleRequestDialog({
  appointment,
  onClose,
  onSubmitted,
}: {
  appointment: Appointment;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredWindowLabel, setPreferredWindowLabel] = useState("Morning (8AM–12PM)");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!preferredDate) {
      toast({ title: "Please select a preferred date", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const resp = await fetch(`/api/appointments/${appointment.id}/reschedule-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ preferredDate, preferredWindowLabel, reason: reason || undefined }),
      });
      if (!resp.ok) {
        const { error } = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error);
      }
      toast({ title: "Request sent", description: "We'll review your request and email you once it's decided." });
      onSubmitted();
    } catch (err: any) {
      toast({ title: "Failed to send request", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-display font-bold">Request a Different Date</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            We'll review this and email you once it's approved or if we need to follow up. Your current appointment stays as-is until then.
          </p>
        </DialogHeader>
        <div className="space-y-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Preferred Date</p>
            <input
              type="date"
              value={preferredDate}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Preferred Window</p>
            <select
              value={preferredWindowLabel}
              onChange={(e) => setPreferredWindowLabel(e.target.value)}
              className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
            >
              <option>Morning (8AM–12PM)</option>
              <option>Afternoon (12PM–4PM)</option>
              <option>No preference</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Reason (optional)</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              placeholder="Anything we should know?"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" className="flex-1 rounded-xl h-11" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 rounded-xl h-11 shadow-brand" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : "Send Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Appointment Detail Dialog ─────────────────────────────────────────────────

function AppointmentDetailDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const displayDate = appointment.scheduledDate
    ? format(parseISO(appointment.scheduledDate + "T00:00:00"), "EEEE, MMMM d, yyyy")
    : appointment.date
    ? new Date(appointment.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "Date not set";

  const statusColor =
    appointment.status === "Scheduled" ? "bg-blue-100 text-blue-700" :
    appointment.status === "Completed" ? "bg-green-100 text-green-700" :
    appointment.status === "Canceled"  ? "bg-red-100 text-red-700"   :
    "bg-muted text-muted-foreground";

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md rounded-[28px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="bg-primary text-primary-foreground px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Job #{appointment.displayId}</p>
              <DialogTitle className="text-xl font-display font-bold">{displayDate}</DialogTitle>
            </div>
            <Badge className={cn("border-none text-xs font-bold", statusColor)}>{appointment.status}</Badge>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-5">
          <DetailRow icon={<Clock className="h-4 w-4" />} label="Arrival Window" value={appointment.timeWindow} />
          <DetailRow icon={<MapPin className="h-4 w-4" />} label="Service Address" value={appointment.address} />
          <DetailRow icon={<Package className="h-4 w-4" />} label="Program" value={appointment.program} />
          <DetailRow icon={<User className="h-4 w-4" />} label="Technician" value={appointment.technician} />

          {appointment.window && (
            <div className="pt-4 border-t border-border/40">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">About your arrival window</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your technician will arrive during the <strong>{appointment.timeWindow}</strong> window.
                You'll receive a reminder the day before and a same-day notification when your technician is on the way.
              </p>
            </div>
          )}
        </div>

        <div className="px-8 pb-6">
          <Button variant="outline" className="w-full rounded-xl h-11" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const Appointments = () => {
  const { open: openScheduleDialog } = useScheduleDialog();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isHydrated } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"schedule" | "recaps">("schedule");
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const { items: cartItems, subtotalCents, taxCents, totalCents } = useCart();
  const { data: recentOrders = [] } = useMarketplaceOrders(user?.id);

  // Use React Query hook for caching and automatic data management
  const { data: allAppointments = [], isLoading, isError, error, status } = useAppointments(user?.id);

  // SECTION 5: Guarantee page loader terminates
  // Page is not loading if:
  // - Auth is not ready (auth takes priority), OR
  // - Query has finished loading (success/error), OR
  // - We have some data already cached
  const isPageLoading = isHydrated && (isLoading && allAppointments.length === 0);
  const hasLoadError = isHydrated && isError && allAppointments.length === 0;

  // Separate upcoming and past visits using useMemo to avoid recalculation
  const { upcomingVisits, pastVisits } = useMemo(() => {
    const upcoming = allAppointments.filter(v => v.status === "Requested" || v.status === "Scheduled");
    const past = allAppointments.filter(v => v.status === "Completed" || v.status === "Canceled");

    return {
      upcomingVisits: upcoming,
      pastVisits: past
    };
  }, [allAppointments]);

  // SECTION 8: Debug logging for validation
  useEffect(() => {
    console.log("[Appointments] authReady=" + isHydrated + " userId=" + (user?.id ? "***" : "none") + " status=" + status + " isPageLoading=" + isPageLoading);
  }, [isHydrated, user?.id, status, isPageLoading]);

  // CRITICAL FIX: Log errors but do NOT clear the UI or data
  // React Query keepPreviousData will preserve last known data
  useEffect(() => {
    if (isError && error) {
      console.error("[Appointments] query timed out or failed", error);
      // Only show toast if we have no data at all
      if (allAppointments.length === 0) {
        console.log("[Appointments] rendering error state");
        toast({
          title: "Unable to Load Appointments",
          description: stringifyError(error),
          variant: "destructive"
        });
      } else {
        // Show warning toast instead of destructive error
        console.log("[Appointments] rendering data state with cached appointments");
        toast({
          title: "Info: Using cached appointments",
          description: "Showing previously loaded data. New data could not be fetched.",
          variant: "default"
        });
      }
    }
  }, [isError, error, toast, allAppointments.length]);

  useEffect(() => {
    const { preset } = (location.state as { preset?: any }) || {};
    if (preset) {
      openScheduleDialog({ source: "redirect-preset", preset });
    }
  }, [location.state, openScheduleDialog]);

  const handleReschedule = useCallback((visit: Appointment) => {
    setReschedulingAppt(visit);
  }, []);

  const handleRescheduleSuccess = useCallback(() => {
    setReschedulingAppt(null);
    queryClient.invalidateQueries({ queryKey: ["appointments", user?.id] });
  }, [queryClient, user?.id]);

  const handleScheduleNew = () => {
    openScheduleDialog({ source: "dashboard-appointments" });
  };

  const handleAddReminder = () => {
    navigate("/dashboard/profile");
  };

  const handleViewDetails = useCallback((visit: Appointment) => {
    setDetailAppt(visit);
  }, []);

  return (
    <div className="grid gap-10">
      {/* Dialogs */}
      {reschedulingAppt && (
        <RescheduleDialog
          appointment={reschedulingAppt}
          onClose={() => setReschedulingAppt(null)}
          onSuccess={handleRescheduleSuccess}
        />
      )}
      {detailAppt && (
        <AppointmentDetailDialog
          appointment={detailAppt}
          onClose={() => setDetailAppt(null)}
        />
      )}

      {/* Weather and Service Status Module */}
      <WeatherStatusModule />

      {/* Pending Checkout Reminder */}
      {cartItems.length > 0 && (
        <Card className="rounded-[28px] border-blue-200 bg-blue-50 shadow-soft">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mt-0.5">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">Items Waiting for Checkout</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    You have {cartItems.length} item{cartItems.length !== 1 ? "s" : ""} in your cart ({formatPrice(totalCents)}) ready to be scheduled for your next appointment.
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                className="rounded-full bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = '/dashboard/marketplace'}
              >
                Complete Checkout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Marketplace Purchases */}
      {recentOrders.length > 0 && (
        <Card className="rounded-[28px] border-green-200 bg-green-50 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900">Recent Marketplace Purchase</h3>
                <p className="text-sm text-green-800 mt-1">Ordered {new Date(recentOrders[0].created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {recentOrders[0].items && recentOrders[0].items.length > 0 && (
                <div className="pl-10">
                  {recentOrders[0].items.slice(0, 3).map((item) => (
                    <p key={item.id} className="text-green-800">
                      • {item.item_name} (qty: {item.quantity})
                    </p>
                  ))}
                  {recentOrders[0].items.length > 3 && (
                    <p className="text-green-700 italic">+{recentOrders[0].items.length - 3} more items</p>
                  )}
                </div>
              )}
              <div className="pl-10 pt-2 border-t border-green-200">
                <p className="font-medium text-green-900">Total: {formatPrice(recentOrders[0].total_cents)}</p>
                <p className="text-xs text-green-700 mt-1">
                  {recentOrders[0].fulfillment_status === "pending"
                    ? "Scheduled for your next service visit"
                    : "Fulfilled"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Appointments"
          title="Your Service Schedule"
          description="Manage your upcoming and past visits. Reschedule or cancel within policy windows."
        />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl" onClick={handleAddReminder}>
            <Bell className="mr-2 h-4 w-4 text-primary" />
            Add Reminders
          </Button>
          <Button className="rounded-xl shadow-brand" onClick={handleScheduleNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border/60 w-fit">
        {(["schedule", "recaps"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === tab
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "schedule" ? "Schedule" : "Visit Recaps"}
          </button>
        ))}
      </div>

      {activeTab === "recaps" && (
        <VideoRecapGrid userId={user?.id} />
      )}

      {activeTab === "schedule" && (<>
        <div className="space-y-8">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold font-display">Upcoming Visits</h3>
        </div>

        <div className="grid gap-6">
          {isPageLoading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-[28px] border border-dashed border-border">
              <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
              <p className="text-muted-foreground font-medium italic">Loading your schedule...</p>
            </div>
          ) : hasLoadError ? (
            <div className="p-12 text-center bg-red-50 rounded-[28px] border border-red-200 space-y-4">
              <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
              <div className="space-y-2">
                <p className="font-semibold text-red-900">Unable to Load Appointments</p>
                <p className="text-sm text-red-700">{error?.message}</p>
              </div>
              <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl">
                Reload Page
              </Button>
            </div>
          ) : upcomingVisits.length > 0 ? (
            upcomingVisits.map((visit) => (
              <Card key={visit.id} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft transition-all hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job #{visit.displayId || visit.id}</span>
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px]">
                            {visit.status}
                          </Badge>
                        </div>
                        <h4 className="text-lg font-bold">{new Date(visit.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</h4>
                        <div className="flex flex-col gap-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Window: {visit.timeWindow}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {visit.address}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden lg:block">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Program</p>
                        <p className="text-sm font-medium">{visit.program}</p>
                      </div>
                      <div className="text-right hidden lg:block border-l border-border/60 pl-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Technician</p>
                        <p className="text-sm font-medium">{visit.technician}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => handleReschedule(visit)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full hover:bg-primary/5 hover:text-primary transition-colors"
                          onClick={() => handleViewDetails(visit)}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="p-12 text-center bg-muted/20 rounded-[28px] border border-dashed border-border space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/40 mb-4">
                <Calendar className="h-8 w-8" />
              </div>
              <p className="text-muted-foreground font-medium italic">No upcoming visits scheduled.</p>
              <Button onClick={handleScheduleNew} variant="outline" className="rounded-xl">
                Schedule Service
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold font-display">Past Visits</h3>
        </div>

        <div className="rounded-[28px] border border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Date</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Job ID</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Program</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground">Technician</th>
                  <th className="px-6 py-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isPageLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary/40" />
                      Loading history...
                    </td>
                  </tr>
                ) : pastVisits.length > 0 ? (
                  pastVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium">{new Date(visit.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="px-6 py-4 text-muted-foreground">#{visit.displayId || visit.id}</td>
                      <td className="px-6 py-4">{visit.program}</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        {visit.technician}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant="outline" className="bg-green-500/5 text-green-600 border-green-500/20 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {visit.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground italic">
                      No past visits on record.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </>)}
    </div>
  );
};

export default Appointments;
