import React, { useState, useMemo, useEffect, useCallback } from "react";
import { format, startOfDay, isBefore } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Home,
  MapPin,
  ClipboardList,
  Phone,
  Building2,
  Plus,
  AlertTriangle,
  Sun,
  Sunset,
  CalendarDays,
  CreditCard,
  PawPrint,
  Baby,
  Droplets,
  Layers,
  RotateCcw,
  Tag,
  X,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PropertyQuestionnaireData } from "@/components/page/PropertyQuestionnaire";
import { AddPropertyDialog } from "@/components/dashboard/properties/AddPropertyDialog";
import PaymentStep from "@/components/schedule/PaymentStep";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/formatCents";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase, withTimeout } from "@/lib/supabase";
import { clearPendingOnboarding } from "@/lib/pendingOnboarding";
import {
  saveFlowProgress,
  clearFlowProgress,
  type FlowProgressState,
} from "@/lib/flowProgress";
import { useCatalogItems } from "@/hooks/dashboard/useCatalogItems";
import { useCart } from "@/contexts/CartContext";
import {
  lookupAnnualCents,
  lookupCadenceCents as lookupCadenceCentsShared,
  lookupOneTimeCents,
} from "@shared/pricing";

// ── Availability types ─────────────────────────────────────────────────────────

interface WindowAvailability {
  id: string;
  label: string;
  start: string;
  end: string;
  available: boolean;
  capacity: number;
  booked: number;
  remaining: number;
}

interface DayAvailability {
  date: string;
  is_operational: boolean;
  is_blackout: boolean;
  blackout_reason?: string;
  windows: WindowAvailability[];
}

// ── Window icon helper ─────────────────────────────────────────────────────────

function WindowIcon({ windowId }: { windowId: string }) {
  if (windowId === "morning") return <Sun className="h-5 w-5" />;
  if (windowId === "afternoon") return <Sunset className="h-5 w-5" />;
  return <Clock className="h-5 w-5" />;
}

// ── Step type ─────────────────────────────────────────────────────────────────
// "plan" is the first step for Path B users (direct signup, no quote widget data).
// It is skipped when initialProgram is already provided (Path A — quote widget).

type Step = "plan" | "property" | "availability" | "date-time" | "questionnaire" | "summary" | "payment";

interface Property {
  id: string;
  address: string;
  zip: string;
  acreage: number;
  isMock?: boolean;
}

interface ScheduleFlowProps {
  onSuccess: (data: any) => void;
  onCancel: () => void;
  initialAddress?: string;
  initialCadenceDays?: number;
  initialProgram?: "subscription" | "one_time";
  /** When true, removes the max-height / overflow-y constraints designed for modal use */
  fullPage?: boolean;
  /** Saved progress from a previous session — restores step + form state on mount */
  savedProgress?: FlowProgressState | null;
}

export const ScheduleFlow = ({ onSuccess, onCancel, initialAddress, initialCadenceDays, initialProgram, fullPage = false, savedProgress }: ScheduleFlowProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();

  // Catalog add-ons for the summary step cross-sell
  const { data: catalogItems = [] } = useCatalogItems();
  const { addItem: addToCart, itemCount: cartItemCount } = useCart();
  const featuredAddOns = useMemo(
    () => catalogItems.filter(i => i.category === "add_on" && i.active !== false).slice(0, 3),
    [catalogItems],
  );

  // Whether plan data arrived from outside (Path A: quote widget).
  // If false, show the plan step first so the user explicitly chooses.
  const hasPlanFromProps = !!initialProgram;

  // Plan state — editable in-flow (Path B) or pre-seeded from props (Path A).
  const [selectedCadenceDays, setSelectedCadenceDays] = useState<number>(
    savedProgress?.cadenceDays ?? initialCadenceDays ?? 21,
  );
  const [selectedProgram, setSelectedProgram] = useState<"subscription" | "one_time" | "annual">(
    savedProgress?.program ?? initialProgram ?? "subscription",
  );
  // planChoice drives the plan-step UI and includes "annual" as a selectable option.
  // It is never persisted to the server — "annual" redirects to /contact instead.
  const [planChoice, setPlanChoice] = useState<"subscription" | "one_time" | "annual">(
    savedProgress?.program ?? initialProgram ?? "subscription",
  );

  // Determine starting step: resume from saved progress if available.
  // Both paths now start at "property" — plan comes after so acreage is known.
  const startStep = ((): Step => {
    const saved = savedProgress?.step;
    if (saved && saved !== "payment") return saved; // never resume at payment
    return "property";
  })();

  const [step, setStep] = useState<Step>(startStep);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedWindow, setSelectedWindow] = useState<WindowAvailability | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  // Tracks whether the user explicitly chose to override their profile phone
  const [phoneOverridden, setPhoneOverridden] = useState(false);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [visitNotes, setVisitNotes] = useState("");

  // ── Inline payment state ─────────────────────────────────────────────────────
  const [paymentClientSecret,  setPaymentClientSecret]  = useState<string | null>(null);
  const [paymentIntentId,      setPaymentIntentId]      = useState<string | null>(null);
  const [paymentSubscriptionId,setPaymentSubscriptionId]= useState<string | null>(null);
  const [isLoadingPayment,     setIsLoadingPayment]     = useState(false);
  const [paymentError,         setPaymentError]         = useState<string | null>(null);
  // Set when the server's final service-area gate blocks checkout — shows a
  // friendly message + waitlist signup instead of the generic payment-error
  // box with a (useless, here) Retry button.
  const [outOfServiceArea,     setOutOfServiceArea]     = useState(false);
  const [waitlistEmail,        setWaitlistEmail]        = useState("");
  const [waitlistSubmitted,    setWaitlistSubmitted]    = useState(false);
  const [waitlistSubmitting,   setWaitlistSubmitting]   = useState(false);

  // ── Promo code (applied before the payment intent is created) ────────────────
  const [promoInput,   setPromoInput]   = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount_cents: number;
    stripe_promotion_code_id: string | null;
    promo_code_id: string | null;
    description: string;
  } | null>(null);
  const [promoError,   setPromoError]   = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // ── Post-booking multi-property state ─────────────────────────────────────────
  const [bookingCompleted,     setBookingCompleted]     = useState(false);
  const [bookedPropertyId,     setBookedPropertyId]     = useState<string | null>(null);

  // ── Availability preferences ────────────────────────────────────────────────
  // 0=Sun,1=Mon…6=Sat — matches JS Date.getDay() and DB convention
  const [preferredDays, setPreferredDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [preferredWindows, setPreferredWindows] = useState<string[]>(["morning", "afternoon"]);
  // flexibility: 0=exact date, 1=±1 day, 2=±2 days, 99=any
  const [flexibilityDays, setFlexibilityDays] = useState<number>(1);

  // ── Phone pre-fill from profile ──────────────────────────────────────────────
  // Pre-fill once when profile loads, only if the field is still empty and the
  // customer hasn't manually overridden it.
  useEffect(() => {
    if (profile?.phone && !phoneOverridden && !contactPhone) {
      setContactPhone(profile.phone);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.phone]);

  // Restore remaining form state from saved progress on mount (property, dates, etc.)
  useEffect(() => {
    if (!savedProgress) return;
    if (savedProgress.selectedPropertyId) setSelectedPropertyId(savedProgress.selectedPropertyId);
    if (savedProgress.contactPhone) { setContactPhone(savedProgress.contactPhone); setPhoneOverridden(true); }
    if (savedProgress.selectedDateISO) setSelectedDate(new Date(savedProgress.selectedDateISO));
    if (savedProgress.preferredDays)   setPreferredDays(savedProgress.preferredDays);
    if (savedProgress.preferredWindows) setPreferredWindows(savedProgress.preferredWindows);
    if (savedProgress.flexibilityDays !== undefined) setFlexibilityDays(savedProgress.flexibilityDays);
    if (savedProgress.visitNotes)      setVisitNotes(savedProgress.visitNotes);
    // Reconstruct selectedWindow from persisted details — the full object is not serializable
    // via availability API alone (the map may not have loaded yet at mount time).
    if (savedProgress.selectedWindowId && savedProgress.selectedWindowLabel) {
      setSelectedWindow({
        id:        savedProgress.selectedWindowId,
        label:     savedProgress.selectedWindowLabel,
        start:     savedProgress.selectedWindowStart ?? "",
        end:       savedProgress.selectedWindowEnd   ?? "",
        available: true,
        capacity:  0,
        booked:    0,
        remaining: 0,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // Persist progress whenever the step advances (not at payment — cleared on success)
  useEffect(() => {
    if (!user?.id || step === "payment") return;
    const progress = {
      userId:               user.id,
      step,
      cadenceDays:          selectedCadenceDays,
      program:              selectedProgram,
      selectedPropertyId:   selectedPropertyId ?? null,
      contactPhone:         contactPhone || undefined,
      selectedDateISO:      selectedDate?.toISOString() ?? null,
      selectedWindowId:     selectedWindow?.id ?? null,
      selectedWindowLabel:  selectedWindow?.label ?? null,
      selectedWindowStart:  selectedWindow?.start ?? null,
      selectedWindowEnd:    selectedWindow?.end ?? null,
      preferredDays,
      preferredWindows,
      flexibilityDays,
      visitNotes:           visitNotes || undefined,
    };
    saveFlowProgress(progress);
    // Also persist to Supabase profile so progress survives cache clears and
    // can be resumed from a different device (fire-and-forget).
    supabase.from("profiles").update({ onboarding_progress: progress } as any).eq("id", user.id)
      .then(({ error }: any) => { if (error) console.warn("[ScheduleFlow] Cloud save failed:", error.message); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // True when the current phone value came from the profile and wasn't overridden
  const isPhoneFromProfile =
    !phoneOverridden &&
    Boolean(profile?.phone) &&
    contactPhone === profile?.phone;

  // ── Availability state ───────────────────────────────────────────────────────
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, DayAvailability>>(new Map());
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);

  const fetchAvailability = useCallback(async (from?: Date) => {
    setIsLoadingAvailability(true);
    setAvailabilityError(false);
    try {
      const startDate = from ?? new Date();
      const dateFrom  = startDate.toISOString().slice(0, 10);
      const response  = await fetch(`/api/availability?date_from=${dateFrom}&days=45`);

      if (!response.ok) throw new Error("Availability fetch failed");

      const json = await response.json() as { days: DayAvailability[] };

      setAvailabilityMap((prev) => {
        const next = new Map(prev);
        for (const day of json.days) next.set(day.date, day);
        return next;
      });
      setLoadedFrom(dateFrom);
    } catch {
      setAvailabilityError(true);
    } finally {
      setIsLoadingAvailability(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const [questionnaireData, setQuestionnaireData] = useState<PropertyQuestionnaireData>({
    hasPets: false,
    petDetails: "",
    childrenUseYard: false,
    primaryConcerns: "",
    hasStandingWater: false,
    yardUsage: "weekly",
    gateInstructions: "",
  });

  const fetchProperties = async () => {
    if (!user) {
      setProperties([]);
      setSelectedPropertyId(null);
      return;
    }
    setIsLoadingProperties(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, address, zip, acreage")
        .eq("user_id", user.id);

      if (error) throw error;

      const allProperties = (data || []) as Property[];
      setProperties(allProperties);

      if (allProperties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(allProperties[0].id);
      } else if (allProperties.length === 0) {
        setSelectedPropertyId(null);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      setProperties([]);
      setSelectedPropertyId(null);
    } finally {
      setIsLoadingProperties(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [user]);

  const selectedProperty = useMemo(() =>
    properties.find(p => p.id === selectedPropertyId),
  [properties, selectedPropertyId]);

  // ── Date helpers ─────────────────────────────────────────────────────────────

  const getDayAvailability = (date: Date): DayAvailability | undefined =>
    availabilityMap.get(date.toISOString().slice(0, 10));

  const isDateDisabled = (date: Date): boolean => {
    if (isBefore(date, startOfDay(new Date()))) return true;
    if (isLoadingAvailability) return false;
    const day = getDayAvailability(date);
    if (!day) return false;
    return !day.is_operational || day.is_blackout;
  };

  const windowsForDate = useMemo((): WindowAvailability[] => {
    if (!selectedDate) return [];
    return getDayAvailability(selectedDate)?.windows ?? [];
  }, [selectedDate, availabilityMap]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step === "property") {
      if (!selectedPropertyId) {
        toast({ title: "Property Required", description: "Please select a property for service." });
        return;
      }
      if (!contactPhone.trim()) {
        toast({ title: "Phone Required", description: "Please provide a contact number for the technician." });
        return;
      }
      // Path B: go to plan selection (acreage now known for pricing display)
      // Path A: skip plan — cadence/program arrived from quote widget
      setStep(hasPlanFromProps ? "availability" : "plan");
    } else if (step === "plan") {
      setSelectedProgram(planChoice);
      if (planChoice === "annual") setSelectedCadenceDays(30); // annual is monthly cadence
      setStep("availability");
    } else if (step === "availability") {
      setStep("date-time");
    } else if (step === "date-time") {
      if (!selectedDate || !selectedWindow) {
        toast({ title: "Selection Required", description: "Please select a date and arrival window." });
        return;
      }
      setStep("questionnaire");
    } else if (step === "questionnaire") {
      setStep("summary");
    } else if (step === "summary") {
      setStep("payment");
    }
  };

  const handleBack = () => {
    if (step === "property")      { onCancel(); return; }
    if (step === "plan")          { setStep("property"); return; }
    if (step === "availability")  { setStep(hasPlanFromProps ? "property" : "plan"); return; }
    if (step === "date-time")     { setStep("availability");  return; }
    if (step === "questionnaire") { setStep("date-time");     return; }
    if (step === "summary")       { setStep("questionnaire"); return; }
    if (step === "payment")       { setStep("summary");       return; }
  };

  const isFirstStep = step === "property"; // property is always the first step

  // ── Promo code ────────────────────────────────────────────────────────────────
  // Applying/removing a promo clears the cached client secret so the payment-intent
  // effect below (keyed on `appliedPromo`) re-fetches a fresh intent at the discounted amount.

  const currentPlanCents = () =>
    selectedProgram === "annual"   ? annualPriceCents  :
    selectedProgram === "one_time" ? onetimePriceCents :
    subPriceCents;

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoError(null);
    setPromoLoading(true);
    try {
      const res = await fetch("/api/promos/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim(), order_total_cents: currentPlanCents() ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setPromoError(json.error || "Invalid code"); return; }
      if (selectedProgram === "subscription" && !json.stripe_promotion_code_id) {
        setPromoError("This code can't be applied to recurring plans. Try a one-time or annual plan, or contact support.");
        return;
      }
      setAppliedPromo({
        code: promoInput.trim().toUpperCase(),
        discount_cents: json.discount_cents,
        stripe_promotion_code_id: json.stripe_promotion_code_id,
        promo_code_id: json.promo_code_id,
        description: json.description,
      });
      setPromoInput("");
      setPaymentClientSecret(null);
      setPaymentIntentId(null);
    } catch {
      setPromoError("Could not validate code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError(null);
    setPaymentClientSecret(null);
    setPaymentIntentId(null);
  };

  // ── Payment intent fetch (runs when user enters payment step, or promo changes) ─

  useEffect(() => {
    if (step !== "payment") return;
    if (paymentClientSecret) return; // already fetched

    const fetch_ = async () => {
      setIsLoadingPayment(true);
      setPaymentError(null);
      setOutOfServiceArea(false);
      try {
        if (!selectedProperty) throw new Error("No property selected. Please go back and select your service address.");
        if (!selectedProperty.acreage || selectedProperty.acreage <= 0) throw new Error("The selected property has no lot size on record. Please update its acreage in your dashboard before checking out.");
        if (!selectedWindow)   throw new Error("No arrival window selected. Please go back and pick a date and time window.");
        if (!selectedDate)     throw new Error("No date selected. Please go back and select your preferred service date.");

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("No active session");

        // Persist phone to profile before payment
        if (contactPhone.trim() && user?.id) {
          supabase.from("profiles").update({ phone: contactPhone.trim() }).eq("id", user.id)
            .then(({ error }) => { if (error) console.warn("[ScheduleFlow] Phone save failed:", error.message); });
        }

        const scheduledDate = selectedDate!.toISOString().slice(0, 10);

        const response = await withTimeout(fetch("/api/billing/create-payment-intent", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId:      selectedProperty!.id,
            acreage:         selectedProperty!.acreage,
            cadenceDays:     selectedCadenceDays,
            program:         selectedProgram,
            window:          selectedWindow!.id,
            windowLabel:     selectedWindow!.label,
            windowStart:     selectedWindow!.start,
            scheduledDate,
            notes:           visitNotes,
            preferredDays,
            preferredWindows,
            flexibilityDays,
            promoDiscountCents:     appliedPromo?.discount_cents ?? 0,
            stripePromotionCodeId: appliedPromo?.stripe_promotion_code_id ?? null,
            promoDatabaseId:        appliedPromo?.promo_code_id ?? null,
          }),
        }), 12000, "Payment intent");

        const data = await response.json();
        if (!response.ok) {
          if (data.code === "OUT_OF_SERVICE_AREA") {
            setOutOfServiceArea(true);
            return;
          }
          throw new Error(data.error || "Failed to initialize payment");
        }

        setPaymentClientSecret(data.clientSecret);
        setPaymentIntentId(data.intentId);
        setPaymentSubscriptionId(data.subscriptionId ?? null);
      } catch (err: any) {
        setPaymentError(err.message || "Could not load payment form. Please try again.");
      } finally {
        setIsLoadingPayment(false);
      }
    };

    fetch_();
    // paymentClientSecret is intentionally in this array: clicking "Retry"
    // after a decline sets it to null, which must re-trigger this effect to
    // fetch a fresh PaymentIntent. The `if (paymentClientSecret) return;`
    // guard above makes the reverse transition (null -> secret, which also
    // re-fires this effect) a no-op, so this can't loop or double-fetch.
  }, [step, appliedPromo, paymentClientSecret]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── After Stripe confirms payment — create appointment + finalize ─────────────

  const handleBookingConfirmed = async (piId: string) => {
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");

      const response = await withTimeout(fetch("/api/billing/confirm-booking", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: piId,
          subscriptionId:  paymentSubscriptionId,
          program:         selectedProgram,
          propertyId:      selectedProperty!.id,
          scheduledDate:   selectedDate!.toISOString().slice(0, 10),
          windowId:        selectedWindow!.id,
          windowLabel:     selectedWindow!.label,
          windowStart:     selectedWindow!.start,
          notes:           visitNotes,
          cadenceDays:     selectedCadenceDays,
          preferredDays,
          preferredWindows,
          flexibilityDays,
        }),
      }), 12000, "Confirm booking");

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Booking confirmation failed");

      clearPendingOnboarding();
      clearFlowProgress();
      // Clear cloud-saved progress too (fire-and-forget)
      supabase.from("profiles").update({ onboarding_progress: null } as any).eq("id", user!.id)
        .then(({ error }: any) => { if (error) console.warn("[ScheduleFlow] Cloud clear failed:", error.message); });
      onSuccess({});
      if (fullPage) {
        // Stay on page so user can schedule additional properties before going to dashboard
        setBookedPropertyId(selectedProperty!.id);
        setBookingCompleted(true);
      } else {
        window.location.href = "/dashboard/billing?booked=true";
      }
    } catch (err: any) {
      setPaymentError(err.message || "Could not finalize your booking. Please contact support.");
      setIsSubmitting(false);
    }
  };

  // ── Plan pricing — sourced from @shared/pricing (single source of truth) ──
  const acreage = selectedProperty?.acreage;
  const lookupCadenceCents = (cadence: number): number | null =>
    acreage ? lookupCadenceCentsShared(acreage, cadence) : null;
  const subPriceCents     = lookupCadenceCents(selectedCadenceDays);
  const annualPriceCents  = acreage ? lookupAnnualCents(acreage) : null;
  const onetimePriceCents = acreage ? lookupOneTimeCents(acreage) : null;
  const fmtCents = formatCents;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <AddPropertyDialog
        open={isAddPropertyOpen}
        onOpenChange={setIsAddPropertyOpen}
        onSuccess={(newProp) => {
          fetchProperties();
          setSelectedPropertyId(newProp.id);
        }}
      />

      {/* ── Booking complete: success + multi-property prompt ── */}
      {bookingCompleted && (() => {
        const bookedProp = properties.find(p => p.id === bookedPropertyId);
        const remaining  = properties.filter(p => p.id !== bookedPropertyId);
        const paidCents  =
          selectedProgram === "annual"   ? annualPriceCents  :
          selectedProgram === "one_time" ? onetimePriceCents :
          subPriceCents;
        // Next billing date — cadenceDays from today (Stripe anchors billing at subscription creation).
        const nextBillingDate: Date | null = selectedProgram === "one_time" ? null : (() => {
          const d = new Date();
          if (selectedProgram === "annual") d.setFullYear(d.getFullYear() + 1);
          else d.setDate(d.getDate() + selectedCadenceDays);
          return d;
        })();
        const handleScheduleAnother = (propId: string) => {
          setSelectedPropertyId(propId);
          setBookingCompleted(false);
          setBookedPropertyId(null);
          setSelectedDate(undefined);
          setSelectedWindow(null);
          setPaymentClientSecret(null);
          setPaymentIntentId(null);
          setPaymentSubscriptionId(null);
          setPaymentError(null);
          setStep(hasPlanFromProps ? "availability" : "plan");
        };
        return (
          <div className="max-w-2xl mx-auto space-y-8 py-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Success header */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 text-green-600 mx-auto">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="font-display text-3xl font-bold text-foreground">Payment Confirmed!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your first visit is scheduled. We'll send a confirmation once our team verifies availability for your window.
              </p>
            </div>

            {/* Receipt card */}
            <div className="rounded-[28px] border border-green-200 bg-green-50/60 dark:bg-green-500/10 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-green-200/60">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="font-bold text-green-800 dark:text-green-300 text-sm uppercase tracking-wider">Receipt</p>
              </div>
              <div className="px-6 py-5 grid sm:grid-cols-2 gap-4 text-sm">
                {bookedProp && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Service address</p>
                    <p className="font-semibold">{bookedProp.address}</p>
                  </div>
                )}
                {selectedDate && selectedWindow && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">First visit</p>
                    <p className="font-semibold">{format(selectedDate, "MMMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">{selectedWindow.label}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Plan</p>
                  <p className="font-semibold">
                    {selectedProgram === "one_time" ? "One-Time Treatment"
                    : selectedProgram === "annual"  ? "Annual Protection Plan"
                    : `Recurring — every ${selectedCadenceDays} days`}
                  </p>
                </div>
                {paidCents && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Amount charged</p>
                    <p className="text-2xl font-black text-green-700 dark:text-green-400">{fmtCents(paidCents)}</p>
                  </div>
                )}
                {nextBillingDate && (
                  <div className="sm:col-span-2 pt-2 border-t border-green-200/60">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Next charge</p>
                    <p className="font-semibold flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {format(nextBillingDate, "MMMM d, yyyy")}
                      <span className="text-xs text-muted-foreground font-normal">(approximate — see dashboard for exact date)</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional properties */}
            {remaining.length > 0 && (
              <div className="rounded-[28px] border border-border/60 bg-card shadow-soft p-6 space-y-4">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground text-center">
                  You have {remaining.length} more propert{remaining.length === 1 ? "y" : "ies"} — schedule service for {remaining.length === 1 ? "it" : "them"} now?
                </p>
                <div className="grid gap-3">
                  {remaining.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleScheduleAnother(p.id)}
                      className="flex items-center gap-4 p-4 rounded-[20px] border-2 border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5 text-left transition-all group"
                    >
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors flex-shrink-0">
                        <Home className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate">{p.address}</p>
                        <p className="text-xs text-muted-foreground">ZIP: {p.zip} · {p.acreage} acres</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Go to dashboard */}
            <div className="flex flex-col items-center gap-3">
              <Button
                className="rounded-full px-10 h-14 shadow-brand text-base font-bold min-w-[240px]"
                onClick={() => { window.location.href = "/dashboard/billing?booked=true"; }}
              >
                Go to My Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              {remaining.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  To add additional properties later, visit your dashboard settings.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Progress stepper + step content + nav — hidden once booking is complete */}
      {!bookingCompleted && (<>
      <div className="flex items-center justify-between max-w-2xl mx-auto mb-12 px-4">
        {([
          { id: "property",      label: "Property",  icon: Building2    },
          ...(!hasPlanFromProps ? [{ id: "plan", label: "Plan", icon: Layers }] : []),
          { id: "availability",  label: "Schedule",  icon: CalendarDays },
          { id: "date-time",     label: "Timing",    icon: Clock        },
          { id: "questionnaire", label: "Details",   icon: ClipboardList},
          { id: "summary",       label: "Review",    icon: CheckCircle2 },
          { id: "payment",       label: "Payment",   icon: CreditCard   },
        ] as { id: Step; label: string; icon: React.ElementType }[]).map((s, idx, arr) => {
          const isCompleted = arr.findIndex(item => item.id === step) > idx;
          const isActive    = s.id === step;
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm",
                  isActive    ? "border-primary bg-primary text-primary-foreground scale-110" :
                  isCompleted ? "border-primary bg-primary/10 text-primary" :
                                "border-muted bg-muted/30 text-muted-foreground"
                )}>
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest hidden sm:block",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>{s.label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div className={cn(
                  "h-[2px] flex-1 mx-1 sm:mx-3 transition-colors duration-500",
                  isCompleted ? "bg-primary" : "bg-muted"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className={cn(
        "transition-all duration-500 ease-in-out",
        fullPage ? "min-h-0" : "min-h-[450px] max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar",
      )}>

        {/* ── Step: Plan Selection (Path B — direct signup, no quote widget data) ── */}
        {step === "plan" && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-display font-bold">Choose your service plan</h2>
              <p className="text-muted-foreground">
                Pricing is based on your property ({acreage ? `${acreage} acres` : "acreage unknown"}).
              </p>
            </div>

            {/* Program type */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">Service type</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {([
                  {
                    value: "subscription" as const,
                    label: "Recurring Service",
                    description: "Scheduled visits keep populations under control season-long.",
                    badge: "Most popular",
                    icon: <RotateCcw className="h-5 w-5" />,
                    priceDisplay: subPriceCents ? `${fmtCents(subPriceCents)} / visit` : null,
                    priceSub: "per scheduled treatment + tax",
                  },
                  {
                    value: "one_time" as const,
                    label: "One-Time Treatment",
                    description: "A single visit — perfect for events or trying us out.",
                    badge: null,
                    icon: <CheckCircle2 className="h-5 w-5" />,
                    priceDisplay: onetimePriceCents ? fmtCents(onetimePriceCents) : null,
                    priceSub: "single treatment + tax",
                  },
                  {
                    value: "annual" as const,
                    label: "Annual Plan",
                    description: "Full-season coverage billed once — no per-visit charges.",
                    badge: "Best value",
                    icon: <Layers className="h-5 w-5" />,
                    priceDisplay: annualPriceCents ? fmtCents(annualPriceCents) : null,
                    priceSub: "per year, all visits included + tax",
                  },
                ]).map(({ value, label, description, badge, icon, priceDisplay, priceSub }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPlanChoice(value)}
                    className={cn(
                      "relative flex flex-col items-start gap-2 p-6 rounded-[24px] border-2 text-left transition-all",
                      planChoice === value
                        ? "border-primary bg-primary/5 shadow-md ring-4 ring-primary/5"
                        : "border-border/60 bg-card hover:border-primary/40",
                    )}
                  >
                    {badge && (
                      <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        {badge}
                      </span>
                    )}
                    <div className={cn(
                      "h-10 w-10 rounded-2xl flex items-center justify-center transition-colors",
                      planChoice === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}>
                      {icon}
                    </div>
                    <p className="font-bold text-lg leading-tight">{label}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                    {priceDisplay && (
                      <div className="mt-1">
                        <span className={cn(
                          "text-2xl font-black tracking-tight",
                          planChoice === value ? "text-primary" : "text-foreground",
                        )}>
                          {priceDisplay}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{priceSub}</p>
                      </div>
                    )}
                    {planChoice === value && (
                      <CheckCircle2 className="absolute bottom-4 right-4 h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Annual info callout */}
            {planChoice === "annual" && annualPriceCents && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 space-y-1 animate-in fade-in duration-300">
                <p className="text-sm font-bold text-primary">Full season, one payment</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your annual plan covers all monthly (30-day) treatments for 12 months at {fmtCents(annualPriceCents)} + tax — billed once upfront.
                </p>
              </div>
            )}

            {/* Cadence — only shown for recurring subscription */}
            {planChoice === "subscription" && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">Treatment frequency</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { days: 14, label: "Every 2 wks", note: "High density / event prep" },
                    { days: 21, label: "Every 3 wks",  note: "Most popular" },
                    { days: 30, label: "Monthly",       note: "Standard protection" },
                    { days: 42, label: "Every 6 wks",  note: "Low exposure areas" },
                  ]).map(({ days, label, note }) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSelectedCadenceDays(days)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-4 rounded-[20px] border-2 text-center transition-all",
                        selectedCadenceDays === days
                          ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/10"
                          : "border-border/60 bg-card hover:border-primary/40",
                      )}
                    >
                      {(() => { const p = lookupCadenceCents(days); return p ? (
                        <>
                          <span className={cn("text-base font-black", selectedCadenceDays === days ? "text-primary" : "text-foreground")}>
                            {fmtCents(p)}
                          </span>
                          <span className="text-[9px] text-muted-foreground">+ tax</span>
                        </>
                      ) : null; })()}
                      <span className="text-[10px] font-bold leading-tight">{label}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{note}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grandfathering callout */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
              <p className="text-sm font-bold text-foreground">Lock in today's rate</p>
              <p className="text-xs text-muted-foreground mt-1">
                Prices may increase for new customers over time — but active subscribers keep their current rate for as long as their service remains active. No rate increases, ever, as long as there's no lapse in payments or service.
              </p>
            </div>
          </div>
        )}

        {/* ── Step: Property ── */}
        {step === "property" && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-display font-bold">Where should we spray?</h2>
              <p className="text-muted-foreground">Confirm your service address and contact details.</p>
            </div>

            <div className="grid gap-6">
              <div className="space-y-4">
                <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Select Property</Label>
                {isLoadingProperties ? (
                  <div className="flex items-center justify-center p-12 bg-muted/20 rounded-[28px] border border-dashed border-border">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  </div>
                ) : properties.length > 0 ? (
                  <div className="grid gap-4">
                    {properties.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPropertyId(p.id)}
                        className={cn(
                          "flex items-center gap-4 p-5 rounded-[24px] border-2 text-left transition-all hover:border-primary/40",
                          selectedPropertyId === p.id
                            ? "border-primary bg-primary/5 shadow-md ring-4 ring-primary/5"
                            : "border-border/60 bg-card"
                        )}
                      >
                        <div className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                          selectedPropertyId === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          <Home className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-lg">{p.address}</p>
                          <p className="text-sm text-muted-foreground font-medium">ZIP: {p.zip} · {p.acreage} acres</p>
                        </div>
                        {selectedPropertyId === p.id && <CheckCircle2 className="h-6 w-6 text-primary" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-muted/20 rounded-[28px] border border-dashed border-border space-y-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                      <Home className="h-6 w-6" />
                    </div>
                    <p className="text-muted-foreground font-medium italic">No properties found. Please add a property to continue.</p>
                    <Button variant="outline" className="rounded-xl" onClick={() => setIsAddPropertyOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add Property
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="link" className="text-primary text-xs font-bold uppercase tracking-widest p-0 h-auto" onClick={() => setIsAddPropertyOpen(true)}>
                  <Plus className="mr-1 h-3 w-3" /> Add another location
                </Button>
              </div>

              {/* ── Phone field — prefilled + locked when profile.phone exists ── */}
              <div className="space-y-3">
                <Label htmlFor="contact-phone" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Best Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                  {isPhoneFromProfile ? (
                    <>
                      <Input
                        id="contact-phone"
                        className="pl-12 pr-24 h-14 rounded-2xl text-lg font-medium border-2 bg-muted/30 text-muted-foreground cursor-default focus-visible:ring-0"
                        value={contactPhone}
                        readOnly
                        type="tel"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-bold">On file</span>
                      </div>
                    </>
                  ) : (
                    <Input
                      id="contact-phone"
                      placeholder="(555) 000-0000"
                      className="pl-12 h-14 rounded-2xl text-lg font-medium border-2 focus-visible:ring-primary/20"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      type="tel"
                    />
                  )}
                </div>
                {isPhoneFromProfile ? (
                  <button
                    type="button"
                    onClick={() => { setPhoneOverridden(true); setContactPhone(""); }}
                    className="text-xs text-primary font-semibold hover:underline underline-offset-2 transition-colors"
                  >
                    Use a different number
                  </button>
                ) : (
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Technicians will use this number for arrival updates.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step: General Availability ── */}
        {step === "availability" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-display font-bold">When are you generally available?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Knowing your general availability helps us route technicians efficiently — so visits happen closer to your preferred window. These are preferences, not commitments. We'll always confirm the exact date before your service day.
              </p>
            </div>

            <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2">
              <CardContent className="p-8 space-y-8">

                {/* Preferred days */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Best days for service</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Mon", value: 1 }, { label: "Tue", value: 2 }, { label: "Wed", value: 3 },
                      { label: "Thu", value: 4 }, { label: "Fri", value: 5 }, { label: "Sat", value: 6 },
                    ].map(({ label, value }) => {
                      const active = preferredDays.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPreferredDays(prev =>
                            active ? prev.filter(d => d !== value) : [...prev, value]
                          )}
                          className={cn(
                            "h-10 px-4 rounded-xl text-sm font-bold border-2 transition-all",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/60 text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preferred windows */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Preferred arrival windows</p>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { label: "Morning (8AM–12PM)",   value: "morning",   icon: <Sun className="h-4 w-4" /> },
                      { label: "Afternoon (12PM–4PM)", value: "afternoon", icon: <Sunset className="h-4 w-4" /> },
                    ].map(({ label, value, icon }) => {
                      const active = preferredWindows.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPreferredWindows(prev =>
                            active ? prev.filter(w => w !== value) : [...prev, value]
                          )}
                          className={cn(
                            "flex items-center gap-2 h-11 px-5 rounded-2xl text-sm font-bold border-2 transition-all",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/60 text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          {icon} {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scheduling flexibility */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Date flexibility</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Exact date only", value: 0  },
                      { label: "±1 day",           value: 1  },
                      { label: "±2 days",           value: 2  },
                      { label: "Flexible",          value: 99 },
                    ].map(({ label, value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFlexibilityDays(value)}
                        className={cn(
                          "h-10 px-4 rounded-xl text-sm font-bold border-2 transition-all",
                          flexibilityDays === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/60 text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    More flexibility helps us route your technician efficiently and arrive closer to the start of your window.
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step: Date & Window ── */}
        {step === "date-time" && (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2">
              <CardHeader className="bg-primary/5 border-b border-border/40 p-6">
                <CardTitle className="text-xl font-display flex items-center gap-2">
                  Select Date
                  {isLoadingAvailability && <Loader2 className="h-4 w-4 animate-spin text-primary/50" />}
                </CardTitle>
                <CardDescription>
                  {availabilityError
                    ? "Availability data temporarily unavailable — showing all dates."
                    : "Bold dates have available service windows. Select your preferred first service date."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {availabilityError && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Availability check failed. Dates shown may not reflect current capacity.
                  </div>
                )}
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedWindow(null);
                  }}
                  className="rounded-md border-none w-full"
                  disabled={isDateDisabled}
                  modifiers={{
                    hasWindows: (date) => {
                      if (isBefore(date, startOfDay(new Date()))) return false;
                      const day = getDayAvailability(date);
                      return !!day?.is_operational && !day.is_blackout && day.windows.some(w => w.available);
                    },
                    preferredDay: (date) => preferredDays.includes(date.getDay()),
                  }}
                  modifiersClassNames={{
                    hasWindows:   "font-bold text-primary",
                    preferredDay: "ring-1 ring-inset ring-primary/25",
                  }}
                />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2 h-full">
                <CardHeader className="bg-primary/5 border-b border-border/40 p-6">
                  <CardTitle className="text-xl font-display">Preferred Arrival Window</CardTitle>
                  <CardDescription className="font-medium text-primary">
                    {selectedDate ? format(selectedDate, "PPPP") : "Pick a date on the calendar"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {!selectedDate ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center text-primary/40 animate-pulse">
                        <CalendarIcon className="h-8 w-8" />
                      </div>
                      <p className="text-muted-foreground font-medium italic max-w-[200px]">Select a date to view available arrival windows.</p>
                    </div>
                  ) : isLoadingAvailability && windowsForDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                      <p className="text-sm text-muted-foreground">Loading availability…</p>
                    </div>
                  ) : windowsForDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                      <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-muted-foreground font-medium">
                        {getDayAvailability(selectedDate)?.is_blackout
                          ? `Not available: ${getDayAvailability(selectedDate)?.blackout_reason || "date blocked"}`
                          : "No arrival windows available on this date. Please choose another day."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {windowsForDate.map((win) => (
                        <button
                          key={win.id}
                          className={cn(
                            "group relative flex items-center justify-between p-5 rounded-2xl border-2 transition-all text-left",
                            selectedWindow?.id === win.id
                              ? "border-primary bg-primary/5 ring-4 ring-primary/5"
                              : "border-border/60 hover:border-primary/30",
                            !win.available && "opacity-40 cursor-not-allowed bg-muted/50 border-transparent grayscale"
                          )}
                          disabled={!win.available}
                          onClick={() => setSelectedWindow(win)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                              selectedWindow?.id === win.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                            )}>
                              <WindowIcon windowId={win.id} />
                            </div>
                            <div>
                              <p className="font-bold">{win.label}</p>
                              {win.available
                                ? <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                    {win.remaining} spot{win.remaining !== 1 ? "s" : ""} left
                                  </p>
                                : <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fully Booked</p>
                              }
                            </div>
                          </div>
                          {selectedWindow?.id === win.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                        </button>
                      ))}
                      {selectedWindow && (
                        <p className="text-xs text-muted-foreground mt-4 px-1">We'll prioritize your preferred window. Exact arrival time within the window will be confirmed by your technician.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Step: Details (compact — fits viewport without scrolling) ── */}
        {step === "questionnaire" && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="rounded-[28px] border-border/60 shadow-soft border-2">
              <CardHeader className="bg-primary/5 border-b border-border/40 px-6 py-5">
                <CardTitle className="text-lg font-display">Visit Details</CardTitle>
                <CardDescription className="text-sm">Help us prepare for your visit.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-5">

                {/* Toggles row */}
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: "hasPets",         label: "Pets on property", icon: <PawPrint className="h-4 w-4" /> },
                    { key: "childrenUseYard", label: "Children in yard",  icon: <Baby     className="h-4 w-4" /> },
                    { key: "hasStandingWater",label: "Standing water",    icon: <Droplets className="h-4 w-4" /> },
                  ] as { key: keyof PropertyQuestionnaireData; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setQuestionnaireData({ ...questionnaireData, [key]: !questionnaireData[key] })}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-all",
                        questionnaireData[key as keyof typeof questionnaireData]
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {icon}
                      <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Yard usage */}
                <div className="flex items-center gap-4">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Yard usage
                  </Label>
                  <Select
                    value={questionnaireData.yardUsage}
                    onValueChange={(v) => setQuestionnaireData({ ...questionnaireData, yardUsage: v })}
                  >
                    <SelectTrigger className="rounded-xl h-9 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="occasionally">Occasionally</SelectItem>
                      <SelectItem value="rarely">Rarely</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-border/40" />

                {/* Gate instructions + visit notes */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Gate / access instructions
                    </Label>
                    <Textarea
                      placeholder="Gate code, key location, entry notes…"
                      className="rounded-xl min-h-[90px] text-sm resize-none"
                      value={questionnaireData.gateInstructions}
                      onChange={(e) => setQuestionnaireData({ ...questionnaireData, gateInstructions: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Visit notes (this appointment)
                    </Label>
                    <Textarea
                      placeholder="e.g., Gate unlocked, avoid north flower beds…"
                      className="rounded-xl min-h-[90px] text-sm resize-none"
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step: Summary ── */}
        {step === "summary" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-2 mb-8">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mb-4">
                <ClipboardList className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-display font-bold">Review Your Preferences</h2>
              <p className="text-muted-foreground">We'll prioritize your preferred date and arrival window. Our team confirms all visits before the service day.</p>
            </div>

            <Card className="rounded-[32px] border-border/60 shadow-soft overflow-hidden border-2">
              <CardHeader className="bg-primary text-primary-foreground p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Service Summary</CardTitle>
                    <p className="text-primary-foreground/70 text-sm font-medium mt-1">Preferred Arrival Window Selected</p>
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white border-none px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                    Ready
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Scheduled</p>
                      <div className="flex items-center gap-3 font-bold text-xl">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        {selectedDate && format(selectedDate, "MMM d, yyyy")}
                      </div>
                      {selectedWindow && (
                        <div className="flex items-center gap-3 text-muted-foreground font-semibold">
                          <Clock className="h-4 w-4" />
                          {selectedWindow.label}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground/70 font-medium pl-7">
                        Your technician will aim to arrive within this window. We'll send updates on the day of service.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Service Address</p>
                      <div className="flex items-start gap-3 font-bold text-lg leading-tight">
                        <MapPin className="h-5 w-5 text-primary mt-1" />
                        <span>{selectedProperty?.address || initialAddress || "Primary Location"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Contact & Site</p>
                      <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm font-bold">
                          <Phone className="h-4 w-4 text-primary" />
                          {contactPhone}
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold">
                          <CheckCircle2 className={cn("h-4 w-4", questionnaireData.hasPets ? "text-primary" : "text-muted-foreground/30")} />
                          Pets: {questionnaireData.hasPets ? "Yes" : "No"}
                        </li>
                        <li className="flex items-center gap-3 text-sm font-bold">
                          <CheckCircle2 className={cn("h-4 w-4", questionnaireData.hasStandingWater ? "text-primary" : "text-muted-foreground/30")} />
                          Standing water: {questionnaireData.hasStandingWater ? "Yes" : "No"}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {visitNotes && (
                  <div className="p-6 rounded-[24px] bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/60 mb-3">Appointment Notes</p>
                    <p className="text-sm font-medium italic text-amber-700/80">"{visitNotes}"</p>
                  </div>
                )}

                {questionnaireData.gateInstructions && (
                  <div className="p-6 rounded-[24px] bg-primary/5 border border-primary/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-3">Special Instructions</p>
                    <p className="text-sm font-medium italic text-primary/80">"{questionnaireData.gateInstructions}"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Add-ons cross-sell ── */}
            {featuredAddOns.length > 0 && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Enhance your service</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Add products or services to your cart — check out separately after booking.</p>
                  </div>
                  {cartItemCount > 0 && (
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                      {cartItemCount} in cart
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {featuredAddOns.map(addon => (
                    <div key={addon.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-border/60 bg-card p-4 hover:border-primary/20 transition-colors">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug truncate">{addon.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{addon.description}</p>
                        <p className="text-xs font-bold text-primary mt-1">{addon.priceCents ? `$${(addon.priceCents / 100).toFixed(0)}` : "Free"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { addToCart(addon, 1); toast({ title: `${addon.name} added to cart`, description: "Complete checkout from the Marketplace tab." }); }}
                        className="flex-shrink-0 h-8 w-8 rounded-xl bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary flex items-center justify-center transition-colors"
                        title="Add to cart"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step: Payment ── */}
        {step === "payment" && (() => {
          const paymentCents =
            selectedProgram === "annual"   ? annualPriceCents  :
            selectedProgram === "one_time" ? onetimePriceCents :
            subPriceCents;
          const discountCents = appliedPromo ? Math.min(appliedPromo.discount_cents, paymentCents ?? 0) : 0;
          const discountedCents = paymentCents != null ? Math.max(50, paymentCents - discountCents) : null;
          const amountLabel = discountedCents != null ? fmtCents(discountedCents) : undefined;

          return (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 text-primary mb-3">
                  <CreditCard className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-display font-bold">Complete your order</h2>
                <p className="text-sm text-muted-foreground mt-1">Review your details, then enter payment to confirm service.</p>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
                {/* ── Order summary ── */}
                <div className="rounded-[24px] border border-border/60 bg-card shadow-soft overflow-hidden self-start">
                  <div className="bg-primary px-6 py-4">
                    <p className="font-bold text-sm text-primary-foreground uppercase tracking-widest">Order Summary</p>
                  </div>
                  <div className="px-6 py-5 space-y-4 text-sm">
                    {selectedProperty && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service address</p>
                          <p className="font-semibold leading-snug">{selectedProperty.address}</p>
                          <p className="text-xs text-muted-foreground">{selectedProperty.zip} · {selectedProperty.acreage} acres</p>
                        </div>
                      </div>
                    )}
                    {selectedDate && selectedWindow && (
                      <div className="flex items-start gap-3">
                        <CalendarDays className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">First visit</p>
                          <p className="font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
                          <p className="text-xs text-muted-foreground">{selectedWindow.label}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <RotateCcw className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plan</p>
                        <p className="font-semibold">
                          {selectedProgram === "one_time" ? "One-Time Treatment"
                          : selectedProgram === "annual"  ? "Annual Protection Plan"
                          : `Recurring — every ${selectedCadenceDays} days`}
                        </p>
                        {selectedProgram !== "one_time" && (
                          <p className="text-xs text-muted-foreground">Auto-renews. Cancel anytime.</p>
                        )}
                      </div>
                    </div>
                    {/* Promo code */}
                    <div className="border-t border-border/40 pt-4 space-y-2">
                      {appliedPromo ? (
                        <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm">
                          <span className="flex items-center gap-1.5 text-green-800 font-semibold">
                            <Tag className="h-3.5 w-3.5" />
                            {appliedPromo.code}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-green-700 font-bold">−{fmtCents(discountCents)}</span>
                            <button
                              type="button"
                              onClick={handleRemovePromo}
                              className="text-green-700/60 hover:text-green-900"
                              aria-label="Remove promo code"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-2">
                            <Input
                              value={promoInput}
                              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                              placeholder="Promo code"
                              className="rounded-xl h-9 text-sm"
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyPromo(); } }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl h-9 shrink-0"
                              disabled={promoLoading || !promoInput.trim()}
                              onClick={handleApplyPromo}
                            >
                              {promoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                            </Button>
                          </div>
                          {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                        </div>
                      )}
                    </div>

                    {/* Amount due */}
                    <div className="border-t border-border/40 pt-4 space-y-1.5">
                      {appliedPromo && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="text-muted-foreground">{paymentCents ? fmtCents(paymentCents) : "—"}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-muted-foreground">Due today</span>
                        <span className="text-2xl font-black text-primary">{amountLabel ?? "—"}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground text-right">
                        {selectedProgram === "annual"       && annualPriceCents  ? `Then ${fmtCents(annualPriceCents)} / year`
                         : selectedProgram === "subscription" && subPriceCents   ? `Then ${fmtCents(subPriceCents)} every ${selectedCadenceDays} days`
                         : "No recurring charges"}
                        {" + applicable tax"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Payment form ── */}
                <div className="space-y-4">
                  {isLoadingPayment && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground rounded-[24px] border border-dashed border-border/60 bg-card">
                      <Loader2 className="h-7 w-7 animate-spin text-primary/50" />
                      <span className="text-sm font-medium">Setting up secure checkout…</span>
                    </div>
                  )}

                  {outOfServiceArea && !isLoadingPayment && (
                    <div className="rounded-2xl border border-border/70 bg-muted/60 p-5 space-y-3">
                      <p className="text-sm font-bold text-foreground">We're not currently servicing this area yet.</p>
                      <p className="text-xs text-muted-foreground">
                        We'd love to know there's demand near you — join the waitlist and we'll email you the
                        moment we expand to your area.
                      </p>
                      {waitlistSubmitted ? (
                        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                          You're on the list — we'll email you when we launch in your area.
                        </div>
                      ) : (
                        <form
                          className="flex items-end gap-3"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!waitlistEmail || waitlistSubmitting) return;
                            setWaitlistSubmitting(true);
                            try {
                              const res = await fetch("/api/service-areas/waitlist", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  email: waitlistEmail,
                                  address: selectedProperty?.address,
                                  zip: selectedProperty?.zip,
                                }),
                              });
                              if (!res.ok) {
                                const body = await res.json().catch(() => ({}));
                                throw new Error(body.error || "Could not save your waitlist signup.");
                              }
                              setWaitlistSubmitted(true);
                            } catch (err: any) {
                              toast({ title: "Waitlist signup failed", description: err.message, variant: "destructive" });
                            } finally {
                              setWaitlistSubmitting(false);
                            }
                          }}
                        >
                          <div className="flex-1 space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Email address
                            </label>
                            <input
                              type="email"
                              value={waitlistEmail}
                              onChange={(e) => setWaitlistEmail(e.target.value)}
                              placeholder="you@example.com"
                              required
                              className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                            />
                          </div>
                          <Button type="submit" disabled={waitlistSubmitting} className="h-11 rounded-xl font-bold shrink-0">
                            {waitlistSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Notify Me"}
                          </Button>
                        </form>
                      )}
                    </div>
                  )}

                  {paymentError && !isLoadingPayment && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {paymentError}
                      <button
                        type="button"
                        onClick={() => { setPaymentClientSecret(null); setPaymentError(null); setStep("payment"); }}
                        className="ml-2 underline font-semibold"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {paymentClientSecret && !isLoadingPayment && (
                    <PaymentStep
                      clientSecret={paymentClientSecret}
                      onPaymentConfirmed={handleBookingConfirmed}
                      onError={(msg) => setPaymentError(msg)}
                      returnUrl={`${window.location.origin}/dashboard/billing?booked=true`}
                      amountLabel={amountLabel}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Navigation — back always visible; Next hidden on payment (PaymentStep has its own submit) */}
      <div className="flex items-center justify-between pt-8 border-t border-border/40 sticky bottom-0 bg-background/80 backdrop-blur-md z-10 pb-4">
        <Button
          variant="ghost"
          className="rounded-2xl px-8 h-14 font-bold text-muted-foreground hover:bg-muted"
          onClick={isFirstStep ? onCancel : handleBack}
          disabled={isSubmitting || isLoadingPayment}
        >
          {isFirstStep ? "Cancel" : <><ArrowLeft className="mr-2 h-5 w-5" /> Back</>}
        </Button>

        {step !== "payment" && (
          <Button
            className="rounded-2xl px-10 h-14 shadow-brand min-w-[200px] font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleNext}
            disabled={isSubmitting || (step === "property" && properties.length === 0)}
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing…</>
            ) : step === "summary" ? (
              <>Continue to Payment <ArrowRight className="ml-2 h-5 w-5" /></>
            ) : step === "questionnaire" ? (
              <>Continue to Review <ArrowRight className="ml-2 h-5 w-5" /></>
            ) : (
              <>Next Step <ArrowRight className="ml-2 h-5 w-5" /></>
            )}
          </Button>
        )}
      </div>
      </>)}
    </div>
  );
};
