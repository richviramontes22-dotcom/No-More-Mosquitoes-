import { useState, useEffect } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  RefreshCcw,
  ExternalLink,
  History as HistoryIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Zap,
  Plus,
  MapPin,
  Building2,
  X,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase, withTimeout } from "@/lib/supabase";
import { useProperties } from "@/hooks/dashboard/useProperties";
import { useSubscriptions } from "@/hooks/dashboard/useSubscriptions";
import { WeatherStatusModule } from "@/components/dashboard/WeatherStatusModule";

import { PlanChangeDialog } from "@/components/dashboard/billing/PlanChangeDialog";
import { CadenceChangeDialog } from "@/components/dashboard/billing/CadenceChangeDialog";
import { PaymentMethodDialog } from "@/components/dashboard/billing/PaymentMethodDialog";

interface Property {
  id: string;
  subscriptionId?: string | null;
  address: string;
  zip: string;
  acreage: number;
  plan?: string;
  program?: "subscription" | "annual" | "one_time";
  cadence?: number;
  price?: number;
  status?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

const EMPTY_PROPERTIES: Property[] = [];

const Billing = () => {
  const { toast } = useToast();
  const { user, isHydrated } = useAuth();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog States
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isCadenceDialogOpen, setIsCadenceDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [cancelPropertyId, setCancelPropertyId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // CRITICAL FIX: With keepPreviousData: true in hooks, data is preserved across refetches
  const { data: propertyRows = EMPTY_PROPERTIES, isLoading: isPropertiesLoading, error: propertiesError, refetch: refetchProperties, status: propertiesStatus } = useProperties(user?.id);
  const { data: subscriptionProperties = EMPTY_PROPERTIES, isLoading: isSubscriptionLoading, error: subscriptionError, refetch: refetchSubscriptions, status: subscriptionsStatus } = useSubscriptions(user?.id);

  // SECTION 6: Fetch profile data separately using useProfile hook
  // Payment card data comes from profile, not auth
  const { data: profile } = useProfile();

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState({
    cardLast4: profile?.card_last4 || "4242",
    cardBrand: profile?.card_brand || "Visa",
    cardExpiry: profile?.card_expiry || "12/2026"
  });

  // Update payment method when profile changes
  useEffect(() => {
    if (profile) {
      setPaymentMethod({
        cardLast4: profile.card_last4 || "4242",
        cardBrand: profile.card_brand || "Visa",
        cardExpiry: profile.card_expiry || "12/2026"
      });
    }
  }, [profile]);

  // SECTION 5: Guarantee page loader terminates
  // Calculate whether page is truly loading (not just waiting for auth)
  useEffect(() => {
    if (!user?.id) {
      console.log("[Billing] No userId, clearing");
      setProperties([]);
      setIsLoading(false);
      return;
    }

    if (!isHydrated) {
      console.log("[Billing] Auth not hydrated yet, waiting");
      setIsLoading(true);
      return;
    }

    const nextProperties = (subscriptionProperties.length > 0 ? subscriptionProperties : propertyRows) as Property[];

    // SECTION 8: Debug logging for validation
    console.log("[Billing] DETAILED STATE:", {
      authReady: isHydrated,
      userId: user?.id ? "***" : "none",
      propertiesStatus,
      subscriptionsStatus,
      propertyRowsCount: propertyRows.length,
      subscriptionPropertiesCount: subscriptionProperties.length,
      propertiesError: propertiesError?.message,
      subscriptionsError: subscriptionError?.message,
      isPropertiesLoading,
      isSubscriptionLoading,
      nextPropertiesCount: nextProperties.length
    });

    // Page is loading only if both queries are still loading AND we have no data
    const bothLoadingWithNoData =
      (isPropertiesLoading && propertyRows.length === 0) &&
      (isSubscriptionLoading && subscriptionProperties.length === 0);

    setProperties(nextProperties);
    setIsLoading(bothLoadingWithNoData);
    console.log("[Billing] Setting isLoading to", bothLoadingWithNoData, "Properties count:", nextProperties.length);
  }, [propertyRows, subscriptionProperties, isPropertiesLoading, isSubscriptionLoading, user?.id, propertiesError, subscriptionError, isHydrated, propertiesStatus, subscriptionsStatus, user]);

  const handleOpenPortal = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to manage your billing.",
        variant: "destructive",
      });
      return;
    }

    setIsOpeningPortal(true);
    try {
      console.log("[Billing Portal] Starting portal session creation");

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error("[Billing Portal] No access token available");
        throw new Error("No active session");
      }

      console.log("[Billing Portal] Token obtained, calling /api/billing/create-portal-session");

      const response = await withTimeout(fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      }), 10000, "Billing portal session");

      console.log("[Billing Portal] Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Billing Portal] API error:", errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Billing Portal] Portal URL received:", data.url ? "✓ Valid URL" : "✗ No URL");

      if (!data.url) {
        console.error("[Billing Portal] No URL in response:", data);
        throw new Error("No portal URL returned from server");
      }

      console.log("[Billing Portal] Redirecting to Stripe portal");
      window.location.href = data.url;
    } catch (error: any) {
      console.error("[Billing Portal] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      let userMessage = error.message;

      if (error.message.includes("timed out")) {
        userMessage = "Request timed out. Stripe may be temporarily unavailable.";
      } else if (error.message.includes("Failed to fetch")) {
        userMessage = "Network error. Please check your connection and try again.";
      } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        userMessage = "Authentication failed. Please try logging in again.";
      } else if (error.message.includes("not configured")) {
        userMessage = "Billing is not configured. Please contact support.";
      }

      toast({
        title: "Billing Portal Unavailable",
        description: userMessage,
        variant: "destructive",
      });
      setIsOpeningPortal(false);
    }
  };

  const handlePlanChangeSuccess = (data: { propertyId: string; newPlan: string; program: string; price: number; cadence?: number }) => {
    setProperties(prev => prev.map(p =>
      p.id === data.propertyId
        ? { ...p, plan: data.newPlan, program: data.program as any, price: data.price, cadence: data.cadence || p.cadence }
        : p
    ));
    void refetchSubscriptions();
    void refetchProperties();

    const programLabels = {
      subscription: "Monthly Subscription",
      annual: "Yearly Plan",
      one_time: "One-time Treatment"
    };

    toast({
      title: "Plan Updated",
      description: `Plan updated to ${programLabels[data.program as keyof typeof programLabels]}.`,
    });
  };

  const handleCadenceChangeSuccess = (newCadence: number) => {
    if (selectedProperty) {
      setProperties(prev => prev.map(p =>
        p.id === selectedProperty.id ? { ...p, cadence: newCadence } : p
      ));
    }
    void refetchSubscriptions();
    void refetchProperties();
    toast({
      title: "Cadence Updated",
      description: `Service frequency is now every ${newCadence} days.`,
    });
  };

  const handlePaymentMethodSuccess = () => {
    setPaymentMethod({
      cardLast4: "5555",
      cardBrand: "Mastercard",
      cardExpiry: "08/2028"
    });
    toast({
      title: "Payment Method Added",
      description: "Your new Mastercard ending in 5555 has been securely saved.",
    });
  };

  const handleOpenPlanDialog = (property: Property) => {
    setSelectedProperty(property);
    setIsPlanDialogOpen(true);
  };

  const handleOpenCadenceDialog = (property: Property) => {
    setSelectedProperty(property);
    setIsCadenceDialogOpen(true);
  };

  const handleDownloadInvoice = (inv: { id: string; invoice_pdf?: string | null; hosted_invoice_url?: string | null }) => {
    const url = inv.invoice_pdf || inv.hosted_invoice_url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast({ title: "PDF Unavailable", description: "This invoice does not have a downloadable PDF yet.", variant: "destructive" });
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelPropertyId || !user) return;

    setIsCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("Not authenticated");

      const response = await withTimeout(fetch("/api/billing/cancel-subscription", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: cancelPropertyId,
        }),
      }), 10000, "Cancel subscription");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      // Remove property from list
      setProperties(prev => prev.filter(p => p.id !== cancelPropertyId));
      void refetchSubscriptions();
      void refetchProperties();

      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled. You'll lose access after the current billing period.",
      });

      setCancelPropertyId(null);
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      toast({
        title: "Cancellation Failed",
        description: error.message || "Unable to cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const [invoices, setInvoices] = useState<Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    currency: string;
    created: string | null;
    invoice_pdf: string | null;
    hosted_invoice_url: string | null;
  }>>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const fetchInvoices = async () => {
      setInvoicesLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/billing/invoices?limit=10", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setInvoices(json.invoices || []);
        }
      } catch {
        // Non-fatal — billing history unavailable
      } finally {
        setInvoicesLoading(false);
      }
    };
    fetchInvoices();
  }, [user?.id]);

  // Check if we have actual errors to display
  const hasError = (propertiesError || subscriptionError) && properties.length === 0 && !isLoading;
  const errorMessage = propertiesError?.message || subscriptionError?.message || "Failed to load properties and subscriptions";

  return (
    <div className="grid gap-10">
      {/* Weather and Service Status Module */}
      <WeatherStatusModule />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Plan & Billing"
          title="Manage your subscription"
          description="Update your service tier, change payment methods, and view your billing history."
        />
        <Button
          variant="outline"
          className="rounded-xl shadow-sm"
          onClick={handleOpenPortal}
          disabled={isOpeningPortal}
        >
          {isOpeningPortal ? "Connecting..." : "Stripe Billing Portal"}
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6">
        <h3 className="text-xl font-display font-bold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Active Subscriptions by Property
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasError ? (
          <Card className="rounded-[28px] border border-red-200 bg-red-50 p-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-900">Unable to Load Subscriptions</p>
                <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-lg"
                  onClick={() => {
                    refetchProperties();
                    refetchSubscriptions();
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          </Card>
        ) : properties.length === 0 ? (
          <Card className="rounded-[28px] border-dashed border-2 p-12 text-center bg-muted/5">
            <p className="text-muted-foreground">No properties found. Add a property to start a subscription.</p>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {properties.map((property) => (
              <Card key={property.id} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden flex flex-col">
                <CardHeader className="bg-primary/5 pb-8">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 border-none">
                      {property.program === "one_time" ? "Single Treatment" : "Active Subscription"}
                    </Badge>
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-2xl mt-4 font-display flex items-start gap-2">
                    <MapPin className="h-5 w-5 mt-1 text-primary shrink-0" />
                    {property.address}
                  </CardTitle>
                  <CardDescription className="text-foreground/70 font-medium ml-7">
                    {property.program === "one_time"
                      ? "One-time intensive service"
                      : `${property.cadence}-day recurring cadence`} • ${property.price}.00 {property.program === "annual" ? "/ year" : "/ visit"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6 flex-1">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>Coverage Tier: <span className="font-semibold text-foreground">{property.plan}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>Property Size: <span className="font-semibold text-foreground">{property.acreage.toFixed(2)} Acres</span></span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/40 flex flex-wrap gap-3 mt-auto relative z-20">
                    <Button
                      className="rounded-full flex-1 h-12 shadow-brand"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPlanDialog(property);
                      }}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Manage Plan
                    </Button>
                    {property.program !== "one_time" && (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-full flex-1 h-12 border-border/60"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCadenceDialog(property);
                          }}
                        >
                          <Zap className="mr-2 h-4 w-4 text-primary" />
                          Cadence
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full flex-1 h-12 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelPropertyId(property.id);
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Payment Method Section */}
      <div className="grid gap-6">
        <h3 className="text-xl font-display font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Default Payment Method
        </h3>
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="pb-8">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-muted-foreground border-border/60">
                Securely Stored by Stripe
              </Badge>
              {/* Card Brand Icon */}
              <div className="h-12 w-20 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs overflow-hidden" style={{
                background: paymentMethod.cardBrand === 'Visa' ? 'linear-gradient(135deg, #1434CB 0%, #1F69D1 100%)' :
                           paymentMethod.cardBrand === 'Mastercard' ? 'linear-gradient(135deg, #EB001B 0%, #F79E1B 100%)' :
                           paymentMethod.cardBrand === 'American Express' ? 'linear-gradient(135deg, #006FCF 0%, #00D4FF 100%)' :
                           'linear-gradient(135deg, #718596 0%, #8b98a9 100%)'
              }}>
                {paymentMethod.cardBrand === 'Visa' ? 'VISA' :
                 paymentMethod.cardBrand === 'Mastercard' ? 'MC' :
                 paymentMethod.cardBrand === 'American Express' ? 'AMEX' :
                 'CARD'}
              </div>
            </div>
            <CardTitle className="text-2xl mt-4 font-display">{paymentMethod.cardBrand} ending in {paymentMethod.cardLast4}</CardTitle>
            <CardDescription>
              Expires {paymentMethod.cardExpiry} • Used for all properties
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="rounded-2xl bg-muted/40 p-4 border border-border/40">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Native Security</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sensitive card data is encrypted and sent directly to Stripe. We never store full card numbers on our infrastructure.
                  </p>
                </div>
              </div>
            </div>
            <Button
              className="rounded-full w-full h-12 border-border/60"
              variant="outline"
              onClick={() => setIsPaymentDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Update Payment Method
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <PlanChangeDialog
        key={`plan-${selectedProperty?.id || "none"}`}
        open={isPlanDialogOpen}
        onOpenChange={(open) => {
          setIsPlanDialogOpen(open);
          if (!open) {
            // Give small delay to avoid flicker during close animation
            setTimeout(() => setSelectedProperty(null), 150);
          }
        }}
        property={selectedProperty ? {
          id: selectedProperty.id,
          address: selectedProperty.address,
          acreage: selectedProperty.acreage,
          zip: selectedProperty.zip
        } : { id: "", address: "", acreage: 0, zip: "" }}
        currentPlan={selectedProperty?.plan || ""}
        currentProgram={(selectedProperty?.program as any) || "subscription"}
        currentCadence={selectedProperty?.cadence || 30}
        onSuccess={handlePlanChangeSuccess}
      />

      <CadenceChangeDialog
        key={`cadence-${selectedProperty?.id || "none"}`}
        open={isCadenceDialogOpen}
        onOpenChange={(open) => {
          setIsCadenceDialogOpen(open);
          if (!open) {
            setTimeout(() => setSelectedProperty(null), 150);
          }
        }}
        propertyId={selectedProperty?.id || ""}
        currentCadence={selectedProperty?.cadence || 30}
        onSuccess={handleCadenceChangeSuccess}
      />

      <PaymentMethodDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        onSuccess={handlePaymentMethodSuccess}
      />

      {/* Invoices Section */}
      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Billing History</CardTitle>
            <CardDescription>Recent invoices and service payments.</CardDescription>
          </div>
          <HistoryIcon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-y border-border/40 bg-muted/30">
                  <th className="px-6 py-3 font-semibold text-muted-foreground">Invoice ID</th>
                  <th className="px-6 py-3 font-semibold text-muted-foreground">Date</th>
                  <th className="px-6 py-3 font-semibold text-muted-foreground">Amount</th>
                  <th className="px-6 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {invoicesLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Loading invoice history…
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      No invoices found. Invoices appear here after your first payment.
                    </td>
                  </tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{inv.number || inv.id}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {inv.created ? new Date(inv.created).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {inv.total != null ? `$${(inv.total / 100).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="bg-green-500/5 text-green-600 border-green-500/20 capitalize">
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl hover:text-primary"
                        onClick={() => handleDownloadInvoice(inv)}
                      >
                        Download PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 border-t border-border/40 text-center">
            <p className="text-xs text-muted-foreground">
              Showing up to 10 most recent paid invoices. Use the billing portal for full history.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={cancelPropertyId !== null} onOpenChange={(open) => {
        if (!open) setCancelPropertyId(null);
      }}>
        <AlertDialogContent className="rounded-[24px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to cancel the subscription for{" "}
                <span className="font-semibold text-foreground">
                  {properties.find(p => p.id === cancelPropertyId)?.address}
                </span>
                ?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                <p className="font-semibold mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Your service will stop after the current billing period</li>
                  <li>You'll lose access to future scheduled appointments</li>
                  <li>You can reactivate anytime through the billing portal</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel className="rounded-lg">
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700 rounded-lg"
            >
              {isCancelling ? "Cancelling..." : "Cancel Subscription"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Billing;
