import { Link } from "react-router-dom";
import { lifestyleImages } from "@/data/media";
import { ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import ImageCarousel from "./ImageCarousel";

const CONTACT_PHONE_DISPLAY = "(949) 763-0492";
const CONTACT_PHONE_LINK = "tel:+19497630492";

const HeroSection = () => {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-hero-radial">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/8 via-background to-secondary/10" aria-hidden />
      <div className="absolute inset-y-0 right-0 -z-10 hidden lg:block">
        <div className="h-full w-[520px] bg-mesh-overlay opacity-80" />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-24 sm:px-6 lg:flex-row lg:items-center lg:gap-20 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="flex-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
            {t("hero.eyebrow")}
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold text-foreground sm:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            {t("hero.description")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/schedule"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("hero.scheduleService")}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
            </Link>
            <a
              href="#address-checker"
              className="inline-flex items-center gap-2 rounded-full border border-border/80 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("hero.checkPricing")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={CONTACT_PHONE_LINK}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-secondary/80 px-6 py-3 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {t("hero.callOrText")}
            </a>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { label: t("highlights.completionVideoLabel"), value: t("highlights.everyVisit") },
              { label: t("highlights.reServicePromise"), value: t("highlights.sameWeek") },
              { label: t("highlights.familySafeFormulations"), value: t("highlights.caApproved") },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-soft backdrop-blur"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {item.value}
                </p>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <ImageCarousel 
          images={lifestyleImages}
          autoRotateInterval={5000}
          className="bg-white/90 backdrop-blur"
        />
      </div>
    </section>
  );
};

export default HeroSection;
