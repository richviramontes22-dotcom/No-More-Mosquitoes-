import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { pricingTiers } from "@/client/data/site";
import {
  CreditCard,
  RefreshCcw,
  ExternalLink,
  History as HistoryIcon,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const Billing = () => {
  const { toast } = useToast();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const handleOpenPortal = () => {
    setIsOpeningPortal(true);
    // Simulate API call to Stripe
    setTimeout(() => {
      setIsOpeningPortal(false);
      toast({
        title: "Redirecting to Billing Portal",
        description: "You're being securely redirected to Stripe to manage your payments.",
      });
      // In a real app: window.location.href = portalUrl;
    }, 1500);
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Plan Card */}
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 border-none">
                Active Subscription
              </Badge>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-2xl mt-4 font-display">Mosquito + Pest Bundle</CardTitle>
            <CardDescription className="text-foreground/70 font-medium">
              30-day recurring cadence • $125.00 / visit
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Next service: Dec 14, 2024</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Coverage: .21 - .30 acres</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-full flex-1">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Change Plan
              </Button>
              <Button variant="outline" className="rounded-full flex-1">
                Update Cadence
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Card */}
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="pb-8">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-muted-foreground border-border/60">
                Default Payment
              </Badge>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl mt-4 font-display">Visa ending in 4242</CardTitle>
            <CardDescription>
              Expires 12/2026 • Auto-pay enabled
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="rounded-2xl bg-muted/40 p-4 border border-border/40">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Secure Management</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We use Stripe for secure payment processing. We never store your full card details on our servers.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-full w-full" onClick={handleOpenPortal}>
                Add Payment Method
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
                      <Button variant="ghost" size="sm" className="rounded-xl hover:text-primary">
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
