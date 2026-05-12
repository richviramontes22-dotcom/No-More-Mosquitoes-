import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { CartPanel } from "@/components/marketplace/CartPanel";
import CheckoutReview from "@/components/marketplace/CheckoutReview";
import type { AppliedPromo } from "@/components/marketplace/CheckoutReview";
import { PaymentDialog } from "@/components/marketplace/PaymentDialog";
import { useCatalogItems, CatalogItem, formatPrice } from "@/hooks/dashboard/useCatalogItems";
import { useCart } from "@/contexts/CartContext";
import { useAppointments } from "@/hooks/dashboard/useAppointments";
import { useMarketplaceOrders } from "@/hooks/dashboard/useMarketplaceOrders";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  ShoppingCart,
  ChevronRight,
  Package,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PaymentState {
  clientSecret: string;
  orderId: string | null;
  confirmationId: string;
  amount: number;
}

const Marketplace = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: catalogItems = [], isLoading: catalogLoading, error: catalogError } = useCatalogItems();
  const { addItem, itemCount, items: cartItems, subtotalCents, taxCents, totalCents, clearCart } = useCart();
  const { data: allAppointments = [] } = useAppointments(user?.id);
  const { data: recentOrders = [], refetch: refetchOrders } = useMarketplaceOrders(user?.id);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const nextUpcomingAppointment = useMemo(() => {
    const upcoming = allAppointments.filter(
      (app: { status: string }) => app.status === "Requested" || app.status === "Scheduled"
    );
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [allAppointments]);

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsReviewOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (!user) return;
    setIsCreatingPayment(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session.");

      const res = await fetch("/api/marketplace/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            id: item.id,
            slug: item.slug,
            name: item.name,
            quantity: item.quantity,
            priceType: item.priceType,
            priceCents: item.cartPrice ?? item.priceCents ?? 0,
            minPriceCents: item.minPriceCents,
            maxPriceCents: item.maxPriceCents,
          })),
          appointmentId: nextUpcomingAppointment?.id ?? null,
          propertyId: (nextUpcomingAppointment as any)?.propertyId ?? null,
          subtotalCents,
          taxCents,
          totalCents,
          promoDiscountCents: appliedPromo?.discount_cents ?? 0,
          stripePromotionCodeId: appliedPromo?.stripe_promotion_code_id ?? null,
          promoDatabaseId: appliedPromo?.promo_code_id ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment.");

      setPaymentState({
        clientSecret: data.clientSecret,
        orderId: data.orderId,
        confirmationId: data.confirmationId,
        amount: data.amount,
      });
      setIsReviewOpen(false);
      setIsPaymentOpen(true);
    } catch (err: any) {
      toast({ title: "Payment setup failed", description: err.message, variant: "destructive" });
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handlePaymentSuccess = async (confirmationId: string) => {
    clearCart();
    setIsPaymentOpen(false);
    setPaymentState(null);
    await refetchOrders();
    // Navigate to orders page so customer sees their order immediately
    navigate("/dashboard/orders");
    toast({
      title: "Order confirmed!",
      description: `Confirmation: ${confirmationId}`,
    });
  };

  const handleAddToCart = (item: CatalogItem) => {
    try {
      addItem(item, 1);
      toast({ title: "Added to cart", description: `${item.name} added.` });
    } catch {
      toast({ title: "Error", description: "Failed to add item.", variant: "destructive" });
    }
  };

  const handleRequestConsultation = (item: CatalogItem) => {
    toast({
      title: "Consultation request",
      description: `We'll reach out about ${item.name} within 24 hours.`,
    });
  };

  // Show the 2 most recent non-failed orders as a preview
  const previewOrders = recentOrders.filter((o) => o.status !== "failed").slice(0, 2);

  return (
    <div className="grid gap-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Marketplace"
          title="Browse & Add Services"
          description="Add products and services to your cart and pay securely — no redirects."
        />
        {itemCount > 0 && (
          <Button onClick={() => setIsCartOpen(true)} className="rounded-full shadow-brand h-11 self-start md:self-auto">
            <ShoppingCart className="mr-2 h-4 w-4" />
            View Cart ({itemCount})
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Product Grid */}
      <ProductGrid
        items={catalogItems}
        isLoading={catalogLoading}
        error={catalogError}
        onAddToCart={handleAddToCart}
        onRequestConsultation={handleRequestConsultation}
      />

      {/* ── Recent Orders Preview ─────────────────────────────────────────── */}
      {previewOrders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold text-foreground">Recent Orders</h3>
            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80">
              <Link to="/dashboard/orders" className="flex items-center gap-1.5">
                View all orders <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {previewOrders.map((order) => (
              <Link
                key={order.id}
                to="/dashboard/orders"
                className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-soft transition hover:border-primary/30 hover:bg-muted/20"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {order.confirmation_id || `ORD-${order.id.slice(0, 8).toUpperCase()}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {order.status === "completed" ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Paid
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 gap-1">
                      <Clock className="h-3 w-3" /> Pending
                    </Badge>
                  )}
                  <span className="font-bold text-sm text-primary">{formatPrice(order.total_cents)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Panels ───────────────────────────────────────────────────────── */}
      <CartPanel open={isCartOpen} onOpenChange={setIsCartOpen} onCheckout={handleCheckout} />

      <CheckoutReview
        open={isReviewOpen && !isPaymentOpen}
        onOpenChange={(open) => { if (!open) { setIsReviewOpen(false); setAppliedPromo(null); } }}
        nextAppointment={nextUpcomingAppointment}
        isLoading={isCreatingPayment}
        error={null}
        onConfirm={handleConfirmOrder}
        appliedPromo={appliedPromo}
        onPromoApplied={setAppliedPromo}
      />

      {paymentState && (
        <PaymentDialog
          open={isPaymentOpen}
          onOpenChange={(open) => {
            if (!open) { setIsPaymentOpen(false); setPaymentState(null); }
          }}
          clientSecret={paymentState.clientSecret}
          confirmationId={paymentState.confirmationId}
          amount={paymentState.amount}
          items={cartItems}
          subtotalCents={subtotalCents}
          taxCents={taxCents}
          nextAppointment={nextUpcomingAppointment}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default Marketplace;
