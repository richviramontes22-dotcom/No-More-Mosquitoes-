import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, MapPin, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { pricingTiers, serviceAreaZipCodes } from "@/data/site";

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
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const acreage = useMemo(() => {
    const parsedSqft = parseFloat(squareFeet);
    if (Number.isNaN(parsedSqft)) {
      return null;
    }
    return convertSqftToAcres(parsedSqft);
  }, [squareFeet]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedZip = zip.trim();
    const inArea = serviceAreaZipCodes.includes(normalizedZip);

    if (!normalizedZip) {
      setResult({ status: "idle" });
      return;
    }

    if (!inArea) {
      setResult({ status: "out_of_area" });
      return;
    }

    if (acreage === null) {
      setResult({ status: "in_area", acreage: null, tierLabel: null });
      return;
    }

    const tier = findTierByAcreage(acreage);
    if (!tier || tier.subscription === "custom" || acreage > 2) {
      setResult({ status: "custom", acreage });
      return;
    }

    setResult({ status: "in_area", acreage, tierLabel: tier.label });
  };

  const handleWaitlistSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!waitlistEmail || waitlistSubmitted) return;
    setWaitlistSubmitted(true);
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
                    Address checker
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
                    See if we’re servicing your block and estimate your acreage.
                  </h2>
                </div>
              </div>
              <p className="mt-6 max-w-2xl text-base text-muted-foreground">
                Connects to Google Places or Mapbox for autocomplete and parcel data, then estimates lot size. Don’t have the exact square footage? Enter your best estimate—our team fine-tunes it during onboarding.
              </p>
              <form className="mt-8 grid gap-6" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-[1.4fr_0.6fr]">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    Property address
                    <input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="123 Coastal View, Newport Beach"
                      autoComplete="street-address"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    ZIP code
                    <input
                      value={zip}
                      onChange={(event) => setZip(event.target.value)}
                      placeholder="92663"
                      autoComplete="postal-code"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                      required
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                  Lot size in square feet (optional)
                  <div className="relative">
                    <input
                      value={squareFeet}
                      onChange={(event) => setSquareFeet(event.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="4350"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      sqft
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Don’t know the square footage? We’ll estimate automatically using lot-size APIs keyed to your address.
                  </p>
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Check service & estimate pricing
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  <Link
                    to="/schedule"
                    className="inline-flex items-center gap-2 rounded-full border border-border/80 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Skip to scheduling
                  </Link>
                </div>
              </form>
              <div className="mt-8 space-y-4 rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-6 text-sm text-muted-foreground">
                <p className="flex items-start gap-2 text-foreground">
                  <Sparkles className="mt-1 h-4 w-4 text-primary" aria-hidden />
                  <span>
                    We’re integrating parcel lookups from Mapbox Tilesets + county assessor data. Until then, technicians confirm acreage during first-visit walk-through.
                  </span>
                </p>
                <p>
                  <strong className="font-semibold text-foreground">ZIPs we currently service:</strong> {serviceAreaZipCodes.join(", ")}
                </p>
              </div>
            </div>
            <div className="rounded-[28px] border border-border/70 bg-white/90 p-6 shadow-soft backdrop-blur">
              {result.status === "idle" && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-muted-foreground">
                  <MapPin className="h-12 w-12 text-primary/50" aria-hidden />
                  <p className="max-w-xs">
                    Enter your address and ZIP code to confirm service availability and get pricing tailored to your acreage.
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
                        We service your address
                      </p>
                      <p className="text-lg font-semibold text-foreground">Let’s build a custom plan.</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-5">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Estimated acreage
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">
                      {result.acreage ? `${result.acreage} acres` : "We’ll confirm on-site"}
                    </p>
                    {result.tierLabel ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        You’re in tier <span className="font-semibold text-foreground">{result.tierLabel}</span>. Choose a 21-day cadence for premium coverage or adjust in the quote widget below.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Share your square footage for instant pricing, or continue below to calculate manually.
                      </p>
                    )}
                  </div>
                  <Link
                    to="/schedule"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Reserve a route time
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              )}

              {result.status === "custom" && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-secondary/30 p-5 text-secondary-foreground">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em]">Large property</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      Acreage over 2.0 requires a custom site walk.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {`Your estimate: ${result.acreage.toFixed(2)} acres.`} Our licensed specialist will craft a treatment blueprint and pricing proposal within one business day.
                    </p>
                  </div>
                  <Link
                    to="/contact"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Book a custom inspection
                  </Link>
                </div>
              )}

              {result.status === "out_of_area" && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-muted/60 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Outside current routes
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      Join the waitlist. We’ll alert you when service opens.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Expansion to southern Los Angeles County and Inland Empire is underway. Share your email for early access.
                    </p>
                  </div>
                  {waitlistSubmitted ? (
                    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                      Thanks! You’re on the list. We’ll update you within 48 hours with availability and prevention tips you can use now.
                    </div>
                  ) : (
                    <form className="grid gap-3" onSubmit={handleWaitlistSubmit}>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                        Email address
                        <input
                          value={waitlistEmail}
                          onChange={(event) => setWaitlistEmail(event.target.value)}
                          placeholder="you@example.com"
                          type="email"
                          className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Join the waitlist
                      </button>
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
