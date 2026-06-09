import { useState, useMemo } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { CartPanel } from "@/components/marketplace/CartPanel";
import CheckoutReview from "@/components/marketplace/CheckoutReview";
import type { AppliedPromo } from "@/components/marketplace/CheckoutReview";
import { PaymentDialog } from "@/components/marketplace/PaymentDialog";
import { useCatalogItems, CatalogItem } from "@/hooks/dashboard/useCatalogItems";
import { useCart } from "@/contexts/CartContext";
import { useAppointments } from "@/hooks/dashboard/useAppointments";
import { useMarketplaceOrders } from "@/hooks/dashboard/useMarketplaceOrders";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { ShoppingCart, ChevronRight, RefreshCw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Orders from "@/pages/dashboard/Orders";

interface PaymentState {
  clientSecret: string;
  orderId: string | null;
  confirmationId: string;
  amount: number;
}

const Marketplace = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: catalogItems = [], isLoading: catalogLoading, error: catalogError } = useCatalogItems();
  const { addItem, itemCount, items: cartItems, subtotalCents, taxCents, totalCents, clearCart } = useCart();
  const { data: allAppointments = [] } = useAppointments(user?.id);
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useMarketplaceOrders(user?.id);

  const [activeTab, setActiveTab] = useState<"browse" | "orders">("browse");
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
    // Switch to My Orders tab to show the new order
    setActiveTab("orders");
    toast({ title: "Order confirmed!", description: `Confirmation: ${confirmationId}` });
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
    toast({ title: "Consultation request", description: `We'll reach out about ${item.name} within 24 hours.` });
  };

  return (
    <div className="grid gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Shop"
          title="Browse & Manage Orders"
          description="Add products and services to your cart and view your order history."
        />
        {itemCount > 0 && (
          <Button onClick={() => setIsCartOpen(true)} className="rounded-full shadow-brand h-11 self-start md:self-auto">
            <ShoppingCart className="mr-2 h-4 w-4" />
            View Cart ({itemCount})
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border/60 w-fit">
        {(["browse", "orders"] as const).map((tab) => (
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
            {tab === "browse" ? "Browse" : "My Orders"}
          </button>
        ))}
      </div>

      {/* Browse tab */}
      {activeTab === "browse" && (
        <ProductGrid
          items={catalogItems}
          isLoading={catalogLoading}
          error={catalogError}
          onAddToCart={handleAddToCart}
          onRequestConsultation={handleRequestConsultation}
        />
      )}

      {/* My Orders tab — renders the Orders page component inline */}
      {activeTab === "orders" && (
        <Orders />
      )}

      {/* Panels */}
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
          onOpenChange={(open) => { if (!open) { setIsPaymentOpen(false); setPaymentState(null); } }}
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
