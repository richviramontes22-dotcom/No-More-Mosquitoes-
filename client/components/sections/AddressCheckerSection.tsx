import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, MapPin, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { pricingTiers, serviceAreaZipCodes } from "@/data/site";
import { useTranslation } from "@/hooks/use-translation";

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
                <div className="grid gap-4 sm:grid-cols-[1.4fr_0.6fr]">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    {t("address.propertyAddress")}
                    <input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder={t("address.addressPlaceholder")}
                      autoComplete="street-address"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    {t("address.zipCode")}
                    <input
                      value={zip}
                      onChange={(event) => setZip(event.target.value)}
                      placeholder={t("address.zipPlaceholder")}
                      autoComplete="postal-code"
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
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {t("address.checkService")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  <Link
                    to="/schedule"
                    className="inline-flex items-center gap-2 rounded-full border border-border/80 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {t("address.skipScheduling")}
                  </Link>
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
                  <Link
                    to="/schedule"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {t("address.reserveRoute")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
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
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {t("address.joinWaitlistBtn")}
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
