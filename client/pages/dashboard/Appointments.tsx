import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
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
  AlertTriangle,
  ShoppingCart,
  Package
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAppointments } from "@/hooks/dashboard/useAppointments";
import { stringifyError } from "@/lib/error-utils";
import { formatPrice } from "@/hooks/dashboard/useCatalogItems";

interface Appointment {
  id: string;
  date: string;
  timeWindow: string;
  program: string;
  technician: string;
  status: string;
  address: string;
}


const Appointments = () => {
  const { open: openScheduleDialog } = useScheduleDialog();
  const { toast } = useToast();
  const location = useLocation();
  const { user, isHydrated } = useAuth();
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

  const handleReschedule = (id: string) => {
    toast({
      title: "Rescheduling Request",
      description: `Request for Job #${id} submitted. A team member will call you shortly or you can call us directly.`,
    });
  };

  const handleScheduleNew = () => {
    openScheduleDialog({ source: "dashboard-appointments" });
  };

  const handleAddReminder = () => {
    toast({
      title: "Calendar Sync",
      description: "Successfully added 2 upcoming visits to your device calendar.",
    });
  };

  const handleViewDetails = (id: string) => {
    toast({
      title: `Job Details: #${id}`,
      description: "Detailed technician notes and route tracking are loading...",
    });
  };

  return (
    <div className="grid gap-10">
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
                          onClick={() => handleReschedule(visit.id)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full hover:bg-primary/5 hover:text-primary transition-colors"
                          onClick={() => handleViewDetails(visit.id)}
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
    </div>
  );
};

export default Appointments;
