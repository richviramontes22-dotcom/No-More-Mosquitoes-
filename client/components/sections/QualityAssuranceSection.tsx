import { CheckCircle2 } from "lucide-react";
import { technicianImages } from "@/data/media";
import { useTranslation } from "@/hooks/use-translation";

const QualityAssuranceSection = () => {
  const { t } = useTranslation();
  const qaImage = technicianImages[0];
  
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-muted/30 via-background to-background py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 space-y-5 lg:order-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              {t("quality.program")}
            </span>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              {t("quality.transparency")}
            </h2>
            <p className="text-base text-muted-foreground">
              {t("quality.description")}
            </p>
            <ul className="grid gap-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4">
                <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t("quality.safety")}</p>
                  <p>{t("quality.safetyDesc")}</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4">
                <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t("quality.quality")}</p>
                  <p>{t("quality.qualityDesc")}</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4">
                <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t("quality.accountability")}</p>
                  <p>{t("quality.accountabilityDesc")}</p>
                </div>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              {t("quality.afterService")}
            </p>
            <p className="text-sm font-semibold text-foreground">{t("quality.proof")}</p>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-white/90 p-2 shadow-soft backdrop-blur">
              <img
                src={qaImage.src}
                alt={qaImage.alt}
                loading="lazy"
                className="h-full w-full rounded-[22px] object-cover"
              />
              <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-black/5" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QualityAssuranceSection;
