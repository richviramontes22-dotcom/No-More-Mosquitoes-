import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, MapPin, Sparkles, Loader } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { pricingTiers, serviceAreaZipCodes } from "@/data/site";
import { useTranslation } from "@/hooks/use-translation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePropertyLookup } from "@/hooks/use-property-lookup";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";
import { Button } from "@/components/ui/button";
import { GoogleAddressAutocomplete, type GoogleAddressAutocompleteResult } from "@/components/common/GoogleAddressAutocomplete";

const convertSqftToAcres = (squareFeet: number) => {
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) {
    return null;
  }
  return Math.round((squareFeet / 43560) * 100) / 100;
};

const findTierByAcreage = (acreage: number | null) => {
  if (acreage === null) {
    return null;
  }
  return pricingTiers.find((tier) => acreage >= tier.min && acreage <= tier.max) ?? null;
};

type ResultState =
  | { status: "idle" }
  | { status: "in_area"; acreage: number | null; tierLabel: string | null }
  | { status: "out_of_area" }
  | { status: "custom"; acreage: number };

const AddressCheckerSection = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const { open } = useScheduleDialog();
  const isCustomer = Boolean(user) && (profile?.role || user?.role) === "customer";
  const { lookup, isLoading, data: parcelData, error: searchError } = usePropertyLookup();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [squareFeet, setSquareFeet] = useState("");

  // Coordinates/place ID from Google Places Autocomplete — when present, the
  // backend skips re-geocoding and goes straight to county parcel lookup.
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [checkingServiceArea, setCheckingServiceArea] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const acreage = useMemo(() => {
    const parsedSqft = parseFloat(squareFeet);
    if (Number.isNaN(parsedSqft)) {
      return null;
    }
    return convertSqftToAcres(parsedSqft);
  }, [squareFeet]);

  // Effect to show error toast when searchError changes
  useEffect(() => {
    if (searchError) {
      toast({
        title: "Search Failed",
        description: searchError,
        variant: "destructive"
      });
    }
  }, [searchError, toast]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedZip = zip.trim();

    if (!address || !normalizedZip) {
      toast({ title: "Missing information", description: "Please enter both address and ZIP code" });
      return;
    }

    let databaseServiceAreaCovered = false;
    setCheckingServiceArea(true);
    try {
      const serviceAreaRes = await fetch(`/api/service-areas/check?zip=${encodeURIComponent(normalizedZip)}`);
      if (!serviceAreaRes.ok) throw new Error("Service area check failed");
      const serviceArea = await serviceAreaRes.json();
      if (!serviceArea.covered) {
        setResult({ status: "out_of_area" });
        return;
      }
      databaseServiceAreaCovered = true;
    } catch (err) {
      const inStaticFallback = serviceAreaZipCodes.includes(normalizedZip);
      toast({
        title: "Service area check unavailable",
        description: inStaticFallback
          ? "Using the static ZIP fallback for this check."
          : "We could not verify this ZIP from the database. Please try again.",
        variant: inStaticFallback ? "default" : "destructive",
      });
      if (!inStaticFallback) {
        setResult({ status: "out_of_area" });
        return;
      }
    } finally {
      setCheckingServiceArea(false);
    }

    const data = await lookup(address, normalizedZip, city, state, lat, lng, placeId);

    if (data) {
      const fetchedAcreage = data.acreage;
      const tier = findTierByAcreage(fetchedAcreage);
      if (!tier || tier.subscription === "custom" || fetchedAcreage > 2) {
        setResult({ status: "custom", acreage: fetchedAcreage });
      } else {
        setResult({ status: "in_area", acreage: fetchedAcreage, tierLabel: tier.label });
      }
    } else {
      // Regrid fallback: trust the DB service-area check first, then the static ZIP list if the API was unavailable.
      const inArea = databaseServiceAreaCovered || serviceAreaZipCodes.includes(normalizedZip);
      if (!inArea) {
        setResult({ status: "out_of_area" });
      } else {
        // Zip is in area but Regrid failed, ask for manual sqft
        if (!acreage) {
          toast({
            title: "Address not found",
            description: "We couldn't locate that address automatically. Please enter your property square footage manually."
          });
          setResult({ status: "in_area", acreage: null, tierLabel: null });
        } else {
          const tier = findTierByAcreage(acreage);
          setResult({ status: "in_area", acreage, tierLabel: tier?.label ?? null });
        }
      }
    }
  };

  const handlePlaceSelect = (place: GoogleAddressAutocompleteResult) => {
    setAddress(place.streetAddress);
    if (place.city) setCity(place.city);
    if (place.state) setState(place.state);
    if (place.zip) setZip(place.zip);
    setLat(place.lat);
    setLng(place.lng);
    setPlaceId(place.placeId);
  };

  const handleReserve = () => {
    const currentAcreage = result.status === "in_area" ? result.acreage : acreage;
    const preset = {
      serviceAddress: address,
      city: city,
      state: state,
      zipCode: zip,
      notes: currentAcreage ? `Estimated acreage: ${currentAcreage} acres` : "",
    };

    if (isCustomer) {
      open({ source: "address-checker", preset });
    } else if (user) {
      // Signed in, but as staff (admin/employee), not a real customer — see
      // the matching comment in QuoteWidgetSection.tsx's handleSchedule.
      toast({
        title: "Signed in as staff on this device",
        description: "This device is signed in to a staff account, so this widget can't open the customer scheduling flow. Use the admin Quote Lookup tool to get a quote for a customer.",
        variant: "destructive",
      });
    } else {
      // Send to signup with preset in state
      navigate("/login", {
        state: {
          from: "/schedule",
          mode: "signup",
          preset
        }
      });
    }
  };

  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);

  const handleWaitlistSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!waitlistEmail || waitlistSubmitted || waitlistSubmitting) return;
    setWaitlistSubmitting(true);
    try {
      const res = await fetch("/api/service-areas/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail, address, city, state, zip }),
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

  return (
    <section id="address-checker" className="relative overflow-hidden bg-gradient-to-b from-muted/40 via-background to-background py-24">
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-60" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-primary/10 bg-card/80 p-8 shadow-soft backdrop-blur lg:p-12">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-primary">
                    {t("address.checker")}
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
                    {t("address.title")}
                  </h2>
                </div>
              </div>
              <p className="mt-6 max-w-2xl text-base text-muted-foreground">
                {t("address.description")}
              </p>
              <form className="mt-8 grid gap-6" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr]">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    {t("address.propertyAddress")}
                    <GoogleAddressAutocomplete
                      value={address}
                      onChange={(value) => {
                        setAddress(value);
                        setLat(undefined);
                        setLng(undefined);
                        setPlaceId(undefined);
                      }}
                      onPlaceSelect={handlePlaceSelect}
                      placeholder={t("address.addressPlaceholder")}
                      autoComplete="street-address"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80 h-auto"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    City
                    <input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="City"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    State
                    <input
                      value={state}
                      onChange={(event) => setState(event.target.value)}
                      placeholder="State"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    {t("address.zipCode")}
                    <input
                      type="text"
                      inputMode="numeric"
                      value={zip}
                      onChange={(event) => setZip(event.target.value.replace(/[^0-9]/g, ""))}
                      placeholder={t("address.zipPlaceholder")}
                      autoComplete="postal-code"
                      maxLength={5}
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                      required
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                  {t("address.lotSize")}
                  <div className="relative">
                    <input
                      value={squareFeet}
                      onChange={(event) => setSquareFeet(event.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder={t("address.lotPlaceholder")}
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {t("address.sqft")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("address.lotHint")}
                  </p>
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    type="submit"
                    disabled={isLoading || checkingServiceArea}
                    className="inline-flex h-auto items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-brand"
                  >
                    {isLoading || checkingServiceArea ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" aria-hidden />
                        {t("address.checkService")}
                      </>
                    ) : (
                      <>
                        {t("address.checkService")}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReserve}
                    className="inline-flex h-auto items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition"
                  >
                    {t("address.skipScheduling")}
                  </Button>
                </div>
              </form>
              <div className="mt-8 space-y-4 rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-6 text-sm text-muted-foreground">
                <p className="flex items-start gap-2 text-foreground">
                  <Sparkles className="mt-1 h-4 w-4 text-primary" aria-hidden />
                  <span>
                    {t("address.integratingNote")}
                  </span>
                </p>
                <p>
                  <strong className="font-semibold text-foreground">{t("address.zipsServing")}</strong> {serviceAreaZipCodes.join(", ")}
                </p>
              </div>
            </div>
            <div className="rounded-[28px] border border-border/70 bg-white/90 p-6 shadow-soft backdrop-blur">
              {result.status === "idle" && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-muted-foreground">
                  <MapPin className="h-12 w-12 text-primary/50" aria-hidden />
                  <p className="max-w-xs">
                    {t("address.enterAddress")}
                  </p>
                </div>
              )}

              {result.status === "in_area" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                        {t("address.weService")}
                      </p>
                      <p className="text-lg font-semibold text-foreground">{t("address.buildCustom")}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-5">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {t("address.estimatedAcreage")}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">
                      {result.acreage ? `${result.acreage} acres` : t("address.confirmOnSite")}
                    </p>
                    {result.tierLabel ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("address.tierLabel")} <span className="font-semibold text-foreground">{result.tierLabel}</span>. {t("address.choose21")}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("address.shareSquareFeet")}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleReserve}
                    className="inline-flex h-auto w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-brand"
                  >
                    {t("address.reserveRoute")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}

              {result.status === "custom" && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-secondary/30 p-5 text-secondary-foreground">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em]">{t("address.largeProperty")}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {t("address.customRequired")}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {`Your estimate: ${result.acreage.toFixed(2)} acres.`} {t("address.largePropertyDesc")}
                    </p>
                  </div>
                  <Link
                    to="/contact"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {t("address.bookCustom")}
                  </Link>
                </div>
              )}

              {result.status === "out_of_area" && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-muted/60 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      {t("address.outsideRoutes")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {t("address.joinWaitlist")}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("address.expansionNote")}
                    </p>
                  </div>
                  {waitlistSubmitted ? (
                    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                      {t("address.waitlistConfirm")}
                    </div>
                  ) : (
                    <form className="grid gap-3" onSubmit={handleWaitlistSubmit}>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                        {t("address.emailAddress")}
                        <input
                          value={waitlistEmail}
                          onChange={(event) => setWaitlistEmail(event.target.value)}
                          placeholder={t("address.emailPlaceholder")}
                          type="email"
                          className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                          required
                        />
                      </label>
                      <Button
                        type="submit"
                        disabled={waitlistSubmitting}
                        className="inline-flex h-auto items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-brand"
                      >
                        {waitlistSubmitting ? <Loader className="h-4 w-4 animate-spin" aria-hidden /> : null}
                        {t("address.joinWaitlistBtn")}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AddressCheckerSection;
