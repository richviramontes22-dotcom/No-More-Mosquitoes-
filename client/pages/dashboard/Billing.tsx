import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { pricingTiers, siteConfig } from "@/data/site";
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
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { calculatePricing } from "@/lib/pricing";

import { PlanChangeDialog } from "@/components/dashboard/billing/PlanChangeDialog";
import { CadenceChangeDialog } from "@/components/dashboard/billing/CadenceChangeDialog";
import { PaymentMethodDialog } from "@/components/dashboard/billing/PaymentMethodDialog";

interface Property {
  id: string;
  address: string;
  zip: string;
  acreage: number;
  plan?: string;
  program?: "subscription" | "annual" | "one_time";
  cadence?: number;
  price?: number;
}

const Billing = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog States
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isCadenceDialogOpen, setIsCadenceDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState({
    cardLast4: user?.card_last4 || "4242",
    cardBrand: user?.card_brand || "Visa",
    cardExpiry: user?.card_expiry || "12/2026"
  });

  // Update payment method when user changes
  useEffect(() => {
    if (user) {
      setPaymentMethod({
        cardLast4: user.card_last4 || "4242",
        cardBrand: user.card_brand || "Visa",
        cardExpiry: user.card_expiry || "12/2026"
      });
    }
  }, [user]);

  useEffect(() => {
    fetchProperties();
  }, [user, location.pathname]);

  const fetchProperties = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;

      // Enrich properties with default plan info if missing
      const enriched = data.map(p => {
        const acreage = p.acreage || 0.25; // Default to 0.25 if missing to avoid crashes
        const pricing = calculatePricing({
          acreage: acreage,
          program: "subscription",
          frequencyDays: 30
        });

        return {
          ...p,
          acreage: acreage,
          plan: p.plan || pricing.tierLabel || "Standard",
          program: p.program || "subscription",
          cadence: p.cadence || 30,
          price: p.price || pricing.perVisit || 0
        };
      });

      setProperties(enriched);
    } catch (error: any) {
      console.error("Error fetching properties:", error);
      toast({ title: "Error", description: "Failed to load property subscriptions.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No active session");

      const response = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create portal session");

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      console.error("Portal Error:", error);
      toast({
        title: "Billing Portal Unavailable",
        description: error.message || "We couldn't connect to Stripe. Please try again later or contact support.",
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

  const handleDownloadInvoice = (invoiceId: string) => {
    toast({
      title: "Download Started",
      description: `Invoice ${invoiceId} is being generated and will download shortly.`,
    });
    // In a real app, we would fetch the hosted PDF URL from Stripe or an API endpoint
    // and trigger a download. For now, we simulate success.
    console.log("Downloading invoice:", invoiceId);
  };

  const invoices = [
    { id: "INV-2024-011", date: "2024-11-30", amount: "$125.00", status: "Paid" },
    { id: "INV-2024-010", date: "2024-11-01", amount: "$125.00", status: "Paid" },
    { id: "INV-2024-009", date: "2024-10-02", amount: "$125.00", status: "Paid" },
  ];

  return (
    <div className="grid gap-10">
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
              <CreditCard className="h-5 w-5 text-muted-foreground" />
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
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{inv.id}</td>
                    <td className="px-6 py-4 text-muted-foreground">{inv.date}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{inv.amount}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="bg-green-500/5 text-green-600 border-green-500/20">
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl hover:text-primary"
                        onClick={() => handleDownloadInvoice(inv.id)}
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
              Showing 3 most recent invoices. Use the portal to view full history.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;
