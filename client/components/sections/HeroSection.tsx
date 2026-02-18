import { Link } from "react-router-dom";
import { lifestyleImages } from "@/data/media";
import { ArrowRight, Phone } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useIsMobile } from "@/hooks/use-mobile";
import ImageCarousel from "./ImageCarousel";

const CONTACT_PHONE_DISPLAY = "(949) 297-6225";
const CONTACT_PHONE_LINK = "tel:+19492976225";

const HeroSection = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // Show all lifestyle images in the carousel
  const displayImages = lifestyleImages;

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
      <section className="relative overflow-hidden h-[100dvh] flex flex-col">
        <ImageCarousel
          images={displayImages}
          autoRotateInterval={5000}
          fullscreen={true}
          objectFit="cover"
        />

        {/* Header Spacer for alignment */}
        <div className="pt-[72px] sm:pt-[80px]" />

        {/* Slim Banner under Header */}
        <div className="w-full bg-black/20 border-b border-white/10 py-1.5 backdrop-blur-md relative z-20">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.4em] text-white/90">
              {t("hero.eyebrow")}
            </p>
          </div>
        </div>

        {/* Dark overlay for text visibility */}
        <div className="absolute inset-0 z-0 bg-black/30" aria-hidden />
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-black/60 via-black/20 to-black/60" aria-hidden />

        <div className="mx-auto flex flex-1 w-full max-w-6xl flex-col justify-center px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl text-left pb-12 sm:pb-24">
            <h1
              className="font-display text-3xl font-semibold text-white sm:text-5xl lg:text-6xl"
              style={{ textShadow: "0 4px 12px rgba(0,0,0,0.8)" }}
            >
              {t("hero.title")}
            </h1>
            <p
              className="mt-4 max-w-2xl text-base font-semibold text-white leading-relaxed sm:mt-6 sm:text-lg"
              style={{ textShadow: "0 4px 16px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)" }}
            >
              {t("hero.description")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                to="/schedule"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              >
                {t("hero.scheduleService")}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-secondary/40 bg-secondary px-6 py-3.5 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:w-auto"
              >
                {t("hero.checkPricing")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href={CONTACT_PHONE_LINK}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/80 px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:w-auto"
              >
                <Phone className="h-4 w-4" aria-hidden />
                {t("hero.callOrText")}
              </a>
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
