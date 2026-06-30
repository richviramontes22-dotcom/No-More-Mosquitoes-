import { FormEvent, useState } from "react";
import {
  MapPin, Loader2, RotateCcw, CheckCircle2, Layers,
  ArrowRight, Edit2, CalendarCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCents as fmtCents } from "@/lib/formatCents";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";
import { useToast } from "@/hooks/use-toast";
import { usePropertyLookup } from "@/hooks/use-property-lookup";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { savePendingOnboarding } from "@/lib/pendingOnboarding";
import { GoogleAddressAutocomplete, type GoogleAddressAutocompleteResult } from "@/components/common/GoogleAddressAutocomplete";
import { lookupAnnualCents, lookupCadenceCents as lookupCadenceCentsShared, lookupOneTimeCents } from "@shared/pricing";

type Program = "subscription" | "one_time" | "annual";

const inputCls =
  "w-full rounded-xl border border-border/70 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition";

type Props = { id?: string };

const QuoteWidgetSection = ({ id }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const { lookup, isLoading: isSearching, error } = usePropertyLookup();
  const { open } = useScheduleDialog();
  const isCustomer = Boolean(user) && (profile?.role || user?.role) === "customer";

  const [phase, setPhase] = useState<"address" | "plans">("address");

  // Address fields
  const [address, setAddress] = useState("");
  const [city, setCity]       = useState("");
  const [stateVal, setStateVal] = useState("CA");
  const [zip, setZip]         = useState("");
  const [acreage, setAcreage] = useState<number | null>(null);

  // Coordinates/place ID from Google Places Autocomplete — when present, the
  // backend skips re-geocoding and goes straight to county parcel lookup.
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);

  // Lookup failure fallback
  const [lookupFailed, setLookupFailed] = useState(false);
  const [manualAcreage, setManualAcreage] = useState("");

  // Out-of-service-area — no manual acreage fallback, no path to checkout,
  // just a friendly message + waitlist capture.
  const [outOfServiceArea, setOutOfServiceArea] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);

  // Plan selection
  const [selectedProgram, setSelectedProgram] = useState<Program>("subscription");
  const [selectedCadence, setSelectedCadence] = useState<number>(21);

  const subPriceCents     = acreage ? lookupCadenceCentsShared(acreage, selectedCadence) : null;
  const annualPriceCents  = acreage ? lookupAnnualCents(acreage) : null;
  const onetimePriceCents = acreage ? lookupOneTimeCents(acreage) : null;

  const [county, setCounty] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<"high" | "medium" | "low" | null>(null);
  const [acreageSource, setAcreageSource] = useState<string | null>(null);

  // True when the resolved parcel is larger than our priced range (e.g. a
  // condo/HOA shared parcel) — shows a manual unit-size panel instead of
  // pricing tiles until the customer picks/enters a treatment-area size.
  const [oversized, setOversized] = useState(false);

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!address || !zip) {
      toast({ title: "Missing details", description: "Please enter a street address and ZIP code.", variant: "destructive" });
      return;
    }
    setLookupFailed(false);
    setOutOfServiceArea(false);
    const data = await lookup(address, zip, city, stateVal, lat, lng, placeId);
    if (data) {
      if (data.outOfServiceArea) {
        // Not covered yet — never show manual acreage entry or any path to
        // checkout for an address we can't actually service.
        setOutOfServiceArea(true);
        return;
      }
      setAcreage(data.acreage);
      setCounty(data.county ?? null);
      setConfidence(data.confidence ?? null);
      setAcreageSource(data.acreageSource ?? null);
      setOversized(!!data.oversized);
      setPhase("plans");
    } else if (error === "manual_required") {
      // Manual review required — show contact path rather than manual entry
      setLookupFailed(true);
    } else {
      setLookupFailed(true);
    }
  };

  const handleWaitlistSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail || waitlistSubmitted || waitlistSubmitting) return;
    setWaitlistSubmitting(true);
    try {
      const res = await fetch("/api/service-areas/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail, address, city, state: stateVal, zip }),
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
  };

  const handlePlaceSelect = (result: GoogleAddressAutocompleteResult) => {
    setAddress(result.streetAddress);
    if (result.city) setCity(result.city);
    if (result.state) setStateVal(result.state);
    if (result.zip) setZip(result.zip);
    setLat(result.lat);
    setLng(result.lng);
    setPlaceId(result.placeId);
    setLookupFailed(false);
    setOversized(false);
  };

  const handleManualProceed = () => {
    const val = parseFloat(manualAcreage);
    const resolved = !isNaN(val) && val > 0 ? val : 0.25;
    setAcreage(resolved);
    setAcreageSource("manual");
    setConfidence("low");
    setManualAcreage(resolved.toString());
    setPhase("plans");
  };

  // Oversized/shared-parcel panel — customer picks (or enters) their unit's
  // approximate treatment area so we can show real pricing tiles.
  const handleOversizedPreset = (value: number) => {
    setAcreage(value);
    setAcreageSource("manual");
    setConfidence("low");
    setOversized(false);
  };

  const handleOversizedProceed = () => {
    const val = parseFloat(manualAcreage);
    const resolved = !isNaN(val) && val > 0 ? Math.min(val, 2) : 0.25;
    setAcreage(resolved);
    setAcreageSource("manual");
    setConfidence("low");
    setManualAcreage(resolved.toString());
    setOversized(false);
  };

  const handleSchedule = () => {
    // One-time treatments don't recur — no cadence to record.
    const cadenceDays = selectedProgram === "annual" ? 30 : selectedProgram === "one_time" ? undefined : selectedCadence;
    const priceCents =
      selectedProgram === "annual" ? annualPriceCents :
      selectedProgram === "one_time" ? onetimePriceCents :
      subPriceCents;
    savePendingOnboarding({
      address,
      city,
      state: stateVal,
      zip,
      acreage: acreage ?? 0.2,
      program: selectedProgram,
      cadenceDays,
      estimatedPrice: priceCents != null ? priceCents / 100 : undefined,
      source: "pricing-page",
    });

    const preset = {
      serviceAddress: address,
      city,
      state: stateVal,
      zipCode: zip,
      cadenceDays,
      program: selectedProgram,
      notes: `Selected on pricing page. Property: ${acreage ?? "?"} acres.`,
    };

    if (isCustomer) {
      open({ source: "pricing-page", preset });
    } else if (user) {
      // Signed in, but as staff (admin/employee), not a real customer — the
      // schedule flow assumes an existing customer's own properties/billing,
      // which a staff account doesn't have. Sending them to /login would
      // just bounce them straight back to their own portal, since they're
      // already authenticated. Use the admin Quote Lookup tool instead.
      toast({
        title: "Signed in as staff on this device",
        description: "This device is signed in to a staff account, so this widget can't open the customer scheduling flow. Use the admin Quote Lookup tool to get a quote for a customer.",
        variant: "destructive",
      });
    } else {
      navigate("/login", { state: { from: "/schedule", mode: "signup", preset } });
    }
  };

  return (
    <section id={id} className="relative bg-gradient-to-b from-background to-primary/[0.03] py-20 sm:py-28">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">

        {/* ── Phase 1: Address Entry ── */}
        {phase === "address" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
                Instant Quote
              </span>
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">Get Your Instant Price</h2>
              <p className="text-base text-muted-foreground max-w-md mx-auto">
                Enter your address — we'll detect your property size automatically and show you exact pricing for every plan.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              className="rounded-[32px] border border-border/60 bg-card shadow-soft p-6 sm:p-8 space-y-5"
            >
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Street Address</label>
                <GoogleAddressAutocomplete
                  value={address}
                  onChange={value => {
                    setAddress(value);
                    setLookupFailed(false);
                    setOversized(false);
                    setLat(undefined);
                    setLng(undefined);
                    setPlaceId(undefined);
                  }}
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="e.g. 123 Oak Street"
                  className={`${inputCls} h-auto`}
                  autoComplete="street-address"
                />
              </div>

              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">City</label>
                  <input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Anaheim"
                    className={inputCls}
                    autoComplete="address-level2"
                  />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">State</label>
                  <input
                    value={stateVal}
                    onChange={e => setStateVal(e.target.value.toUpperCase())}
                    placeholder="CA"
                    maxLength={2}
                    className={cn(inputCls, "text-center uppercase")}
                    autoComplete="address-level1"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ZIP</label>
                  <input
                    value={zip}
                    onChange={e => { setZip(e.target.value.replace(/\D/g, "")); setLookupFailed(false); setOversized(false); }}
                    placeholder="92801"
                    maxLength={5}
                    inputMode="numeric"
                    className={inputCls}
                    autoComplete="postal-code"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSearching}
                className="w-full h-12 rounded-xl shadow-brand text-base font-bold gap-2"
              >
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <MapPin className="h-5 w-5" />
                    Get My Price
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </>
                )}
              </Button>

              {outOfServiceArea && (
                <div className="rounded-2xl border border-border/70 bg-muted/60 px-5 py-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <p className="text-sm font-bold text-foreground">We're not in your area yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      We're not currently servicing this area yet, but we'd love to know there's demand near you.
                      Join the waitlist and we'll notify you the moment we expand here.
                    </p>
                  </div>
                  {waitlistSubmitted ? (
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                      You're on the list — we'll email you when we launch in your area.
                    </div>
                  ) : (
                    <form className="flex items-end gap-3" onSubmit={handleWaitlistSubmit}>
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

              {lookupFailed && (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700/40 px-5 py-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">We couldn't auto-detect this property</p>
                    <p className="text-xs text-amber-800/70 dark:text-amber-300/70 mt-1">
                      Our parcel database doesn't have a record for this address. Enter your lot size below and we'll calculate your exact price.
                    </p>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-amber-900/70 dark:text-amber-300/70">
                        Lot size (acres)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={manualAcreage}
                        onChange={e => setManualAcreage(e.target.value)}
                        placeholder="e.g. 0.25"
                        className="w-full rounded-xl border border-amber-300/60 bg-white dark:bg-amber-950/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualAcreage("0.25")}
                      className="flex-shrink-0 rounded-xl border border-amber-300/60 bg-white dark:bg-amber-950/50 px-3 py-3 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 transition whitespace-nowrap"
                    >
                      Use 0.25 ac
                    </button>
                  </div>
                  <Button
                    type="button"
                    onClick={handleManualProceed}
                    className="w-full h-11 rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm"
                  >
                    See Pricing
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </form>

            <p className="text-center text-xs text-muted-foreground">
              No account required&nbsp;·&nbsp;Your quote is saved when you sign up
            </p>
          </div>
        )}

        {/* ── Phase 2: Plan Selection ── */}
        {phase === "plans" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Address pill */}
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/40 px-4 py-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {address}{city ? `, ${city}` : ""}{stateVal ? `, ${stateVal}` : ""}
                  </span>
                  {acreage !== null && (
                    <span className="flex-shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      {acreage} acres
                    </span>
                  )}
                  {confidence === "low" && (
                    <span className="flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      Est.
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPhase("address")}
                  className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
              {confidence === "low" && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 text-center px-2">
                  Lot size estimated — actual pricing may vary slightly. Our team will confirm before your first visit.
                </p>
              )}
            </div>

            {!oversized ? (
              <>
            {/* Plan tiles */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">Choose your service plan</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {([
                  {
                    value: "subscription" as Program,
                    label: "Recurring Service",
                    description: "Regular treatments keep mosquito populations under control all season.",
                    badge: "Most popular",
                    icon: <RotateCcw className="h-5 w-5" />,
                    priceDisplay: subPriceCents ? `${fmtCents(subPriceCents)} / visit` : null,
                    priceSub: "per scheduled treatment + tax",
                  },
                  {
                    value: "one_time" as Program,
                    label: "One-Time Treatment",
                    description: "Single knockdown + barrier visit. Great for events or trying us out.",
                    badge: null,
                    icon: <CheckCircle2 className="h-5 w-5" />,
                    priceDisplay: onetimePriceCents ? fmtCents(onetimePriceCents) : null,
                    priceSub: "single treatment + tax",
                  },
                  {
                    value: "annual" as Program,
                    label: "Annual Plan",
                    description: "Full-season coverage billed once — no per-visit charges ever.",
                    badge: "Best value",
                    icon: <Layers className="h-5 w-5" />,
                    priceDisplay: annualPriceCents ? fmtCents(annualPriceCents) : null,
                    priceSub: "per year, all visits included + tax",
                  },
                ]).map(({ value, label, description, badge, icon, priceDisplay, priceSub }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedProgram(value)}
                    className={cn(
                      "relative flex flex-col items-start gap-2 p-5 rounded-[24px] border-2 text-left transition-all",
                      selectedProgram === value
                        ? "border-primary bg-primary/5 shadow-md ring-4 ring-primary/5"
                        : "border-border/60 bg-card hover:border-primary/40",
                    )}
                  >
                    {badge && (
                      <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground">
                        {badge}
                      </span>
                    )}
                    <div className={cn(
                      "h-10 w-10 rounded-2xl flex items-center justify-center transition-colors",
                      selectedProgram === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}>
                      {icon}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
                    </div>
                    {priceDisplay && (
                      <div className="mt-auto pt-2">
                        <span className={cn(
                          "text-xl font-black tracking-tight",
                          selectedProgram === value ? "text-primary" : "text-foreground",
                        )}>
                          {priceDisplay}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{priceSub}</p>
                      </div>
                    )}
                    {selectedProgram === value && (
                      <CheckCircle2 className="absolute bottom-4 right-4 h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Annual callout */}
            {selectedProgram === "annual" && annualPriceCents && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 space-y-1 animate-in fade-in duration-300">
                <p className="text-sm font-bold text-primary">Full season, one payment</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your annual plan covers all monthly (30-day) treatments for 12 months at {fmtCents(annualPriceCents)} + tax — billed once upfront.
                </p>
              </div>
            )}

            {/* Frequency picker — subscription only */}
            {selectedProgram === "subscription" && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">Treatment frequency</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { days: 14, label: "Every 2 wks", note: "High density / event prep" },
                    { days: 21, label: "Every 3 wks",  note: "Most popular" },
                    { days: 30, label: "Monthly",       note: "Standard protection" },
                    { days: 42, label: "Every 6 wks",  note: "Low exposure areas" },
                  ]).map(({ days, label, note }) => {
                    const p = acreage ? lookupCadenceCentsShared(acreage, days) : null;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setSelectedCadence(days)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-4 rounded-[20px] border-2 text-center transition-all",
                          selectedCadence === days
                            ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/10"
                            : "border-border/60 bg-card hover:border-primary/40",
                        )}
                      >
                        {p ? (
                          <>
                            <span className={cn("text-base font-black", selectedCadence === days ? "text-primary" : "text-foreground")}>
                              {fmtCents(p)}
                            </span>
                            <span className="text-[9px] text-muted-foreground">+ tax</span>
                          </>
                        ) : null}
                        <span className="text-[10px] font-bold leading-tight">{label}</span>
                        <span className="text-[9px] text-muted-foreground leading-tight">{note}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grandfathering callout */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
              <p className="text-sm font-bold text-foreground">Lock in today's rate</p>
              <p className="text-xs text-muted-foreground mt-1">
                Prices may increase for new customers over time — active subscribers keep their current rate for as long as their service remains active. No lapses, no rate increases.
              </p>
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <Button
                onClick={handleSchedule}
                className="w-full h-14 rounded-[20px] shadow-brand text-base font-bold gap-2"
              >
                <CalendarCheck className="h-5 w-5" />
                Schedule Service
                <ArrowRight className="h-5 w-5" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {isCustomer
                  ? "Opens the scheduling flow with your address and plan pre-selected."
                  : "We'll create your account and pre-fill your address — no re-entering details."}
              </p>
            </div>
              </>
            ) : (
              /* Oversized/shared-parcel result — the matched property record is
                 larger than our priced range (e.g. a condo/HOA shared parcel).
                 Ask for the customer's unit/treatment-area size instead of
                 rendering tiles with no price. */
              <div className="rounded-[32px] border border-primary/20 bg-primary/5 p-6 sm:p-8 space-y-5 animate-in fade-in duration-300">
                <div>
                  <p className="text-sm font-bold text-foreground">This looks like a shared or multi-unit property</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    The property record we found covers {acreage} acres — likely a shared building, HOA common area, or larger parcel rather than a single unit's yard. Tell us roughly how much area we'll be treating and we'll show your exact price.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 0.05, label: "Small", note: "~2,200 sq ft" },
                    { value: 0.10, label: "Medium", note: "~4,400 sq ft" },
                    { value: 0.25, label: "Large", note: "~10,900 sq ft" },
                  ]).map(({ value, label, note }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleOversizedPreset(value)}
                      className="flex flex-col items-center gap-1 p-4 rounded-[20px] border-2 border-border/60 bg-card hover:border-primary/40 text-center transition-all"
                    >
                      <span className="text-base font-black text-foreground">{value} ac</span>
                      <span className="text-[10px] font-bold">{label}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{note}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Or enter your own (acres)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="2"
                      value={manualAcreage}
                      onChange={e => setManualAcreage(e.target.value)}
                      placeholder="e.g. 0.15"
                      className={inputCls}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleOversizedProceed}
                    className="h-12 rounded-xl gap-2 font-bold"
                  >
                    See Pricing
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default QuoteWidgetSection;
