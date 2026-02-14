import { Link } from "react-router-dom";
import { lifestyleImages } from "@/data/media";
import { ArrowRight, Phone } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import ImageCarousel from "./ImageCarousel";

const CONTACT_PHONE_DISPLAY = "(949) 297-6225";
const CONTACT_PHONE_LINK = "tel:+19492976225";

const HeroSection = () => {
  const { t } = useTranslation();

  const highlightCards = [
    { label: t("highlights.completionVideoLabel"), value: t("highlights.everyVisit") },
    { label: t("highlights.reServicePromise"), value: t("highlights.sameWeek") },
    { label: t("highlights.familySafeFormulations"), value: t("highlights.caApproved") },
  ];

  const ctaButtons = (
    <>
      <Link
        to="/schedule"
        className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t("hero.scheduleService")}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
      </Link>
      <Link
        to="/pricing"
        className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary px-6 py-3 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        {t("hero.checkPricing")}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      <a
        href={CONTACT_PHONE_LINK}
        className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/80 px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        <Phone className="h-4 w-4" aria-hidden />
        {t("hero.callOrText")}
      </a>
    </>
  );

  return (
    <>
      {/* Image section with heading, description, and CTAs overlaid */}
      <section className="relative overflow-hidden h-screen flex items-center justify-center">
        <ImageCarousel
          images={lifestyleImages}
          autoRotateInterval={5000}
          fullscreen={true}
        />
        {/* Grey filter overlay for text visibility */}
        <div className="absolute inset-0 -z-10 bg-neutral-400/20" aria-hidden />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/60 via-black/50 to-black/60" aria-hidden />
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl">
            <h1
              className="font-display text-4xl font-semibold text-white sm:text-5xl lg:text-6xl"
              style={{ textShadow: "0 4px 12px rgba(0,0,0,0.8)" }}
            >
              {t("hero.title")}
            </h1>
            <p 
              className="mt-6 max-w-2xl text-lg font-semibold text-white leading-relaxed"
              style={{ textShadow: "0 4px 16px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)" }}
            >
              {t("hero.description")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {ctaButtons}
            </div>
          </div>
        </div>
      </section>

      {/* White background section with feature panels */}
      <section className="relative bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {highlightCards.map((item) => (
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
      </section>
    </>
  );
};

export default HeroSection;
