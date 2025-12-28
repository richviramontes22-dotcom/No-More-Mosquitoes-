import { Link } from "react-router-dom";
import { CheckCircle2, Waves } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

const PlanCardsSection = () => {
  const { t } = useTranslation();

  const plans = [
    {
      name: t("plans.oneTime"),
      price: t("plans.onePricing"),
      cadence: t("plans.oneCadence"),
      features: t("plans.oneFeatures"),
      ctaLabel: t("plans.oneBook"),
      ctaHref: "/schedule",
      accent: "bg-secondary/30 text-secondary-foreground",
    },
    {
      name: t("plans.subscriptionName"),
      price: t("plans.subPricing"),
      cadence: t("plans.subCadence"),
      features: t("plans.subFeatures"),
      ctaLabel: t("plans.subStart"),
      ctaHref: "/schedule",
      accent: "bg-primary text-primary-foreground",
    },
    {
      name: t("plans.annualName"),
      price: t("plans.annualPricing"),
      cadence: t("plans.annualCadence"),
      features: t("plans.annualFeatures"),
      ctaLabel: t("plans.annualGo"),
      ctaHref: "/contact",
      accent: "bg-accent text-accent-foreground",
    },
  ];

  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-6 text-left lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
              {t("plans.plansPrograms")}
            </span>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              {t("plans.plansTitle")}
            </h2>
            <p className="text-base text-muted-foreground">
              {t("plans.plansDesc")}
            </p>
          </div>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("plans.compareFull")}
          </Link>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="relative overflow-hidden rounded-[32px] border border-border/80 bg-card/80 p-6 shadow-soft backdrop-blur"
            >
              <div className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${plan.accent}`}>
                {plan.cadence}
              </div>
              <h3 className="mt-6 font-display text-2xl font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{plan.price}</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {plan.features.map((feature: string) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={plan.ctaHref}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {plan.ctaLabel}
                <Waves className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlanCardsSection;
