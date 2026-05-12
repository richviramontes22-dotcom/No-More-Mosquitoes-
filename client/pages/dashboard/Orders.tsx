import { useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { useAuth } from "@/contexts/AuthContext";
import { useMarketplaceOrders } from "@/hooks/dashboard/useMarketplaceOrders";
import { formatPrice } from "@/hooks/dashboard/useCatalogItems";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  ShoppingBag,
  RefreshCw,
  LifeBuoy,
  ArrowRight,
} from "lucide-react";

const statusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Paid
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 gap-1">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const fulfillmentBadge = (status: string) => {
  switch (status) {
    case "delivered":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
          Delivered
        </Badge>
      );
    case "scheduled":
      return (
        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
          Scheduled
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Awaiting service visit
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const OrderRow = ({ order }: { order: any }) => {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(order.created_at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-[24px] border border-border/60 bg-card/95 overflow-hidden shadow-soft">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Package className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-foreground">
                {order.confirmation_id || `ORD-${order.id.slice(0, 8).toUpperCase()}`}
              </span>
              {statusBadge(order.status)}
              {fulfillmentBadge(order.fulfillment_status)}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {date}
              </span>
              {order.items?.length > 0 && (
                <span>
                  {order.items.length} item{order.items.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-16 sm:ml-0">
          <div className="text-right">
            <p className="text-xl font-display font-bold text-primary">
              {formatPrice(order.total_cents)}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border/40 p-6 space-y-6 bg-muted/10">
          {/* Line items */}
          {order.items && order.items.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Items Ordered
              </p>
              <div className="rounded-xl border border-border/40 overflow-hidden">
                {order.items.map((item: any, i: number) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-4 py-3 text-sm ${
                      i < order.items.length - 1 ? "border-b border-border/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.unit_price_cents)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-foreground">
                      {formatPrice(item.line_total_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Item details not available.</p>
          )}

          {/* Receipt */}
          <div className="space-y-2 border-t border-border/40 pt-4 text-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Receipt
            </p>
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal_cents || order.total_cents)}</span>
            </div>
            {order.tax_cents > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax (CA)</span>
                <span>{formatPrice(order.tax_cents)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-base">
              <span>Total charged</span>
              <span className="text-primary">{formatPrice(order.total_cents)}</span>
            </div>
          </div>

          {/* Fulfillment info */}
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70">
              Delivery Status
            </p>
            <p className="text-sm text-foreground font-semibold">
              {order.fulfillment_status === "delivered"
                ? "Your items were delivered during a service visit."
                : order.fulfillment_status === "scheduled"
                ? "Delivery is scheduled for your next service visit."
                : "Your items will be delivered at your next scheduled service visit."}
            </p>
            {order.appointment_id && (
              <Link
                to="/dashboard/appointments"
                className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-1"
              >
                View appointment <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {/* Support link */}
          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <p className="text-xs text-muted-foreground">
              Issue with this order?
            </p>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link to="/dashboard/support">
                <LifeBuoy className="h-3.5 w-3.5 mr-1.5" />
                Contact Support
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const Orders = () => {
  const { user } = useAuth();
  const { data: orders = [], isLoading, refetch } = useMarketplaceOrders(user?.id);

  const visibleOrders = orders.filter((o) => o.status !== "failed");

  return (
    <div className="grid gap-8 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading
          eyebrow="Purchase History"
          title="Your Orders"
          description="All marketplace purchases and their delivery status."
        />
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl self-start sm:self-auto"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[24px]" />
          ))}
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-6 rounded-[28px] border border-dashed border-border/60 bg-muted/10 px-8 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-display font-bold text-foreground">
              No orders yet
            </p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Browse the marketplace to add products and services to your next service visit.
            </p>
          </div>
          <Button asChild className="rounded-full shadow-brand px-8 mt-2">
            <Link to="/dashboard/marketplace">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Browse Marketplace
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
          <p className="text-center text-xs text-muted-foreground pt-4">
            Showing {visibleOrders.length} most recent order{visibleOrders.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
};

export default Orders;
