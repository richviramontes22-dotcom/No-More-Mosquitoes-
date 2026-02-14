import { CheckCircle2 } from "lucide-react";
import { img_bg_technician_spraying } from "@/data/media";
import { useTranslation } from "@/hooks/use-translation";

const QualityAssuranceSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Content Side */}
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
                {t("quality.program")}
              </span>
              <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl lg:text-5xl leading-tight">
                {t("quality.transparency")}
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                {t("quality.description")}
              </p>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-[32px] border border-border/80 bg-card/80 p-6 shadow-soft backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{t("quality.safety")}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t("quality.safetyDesc")}</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-4 rounded-[32px] border border-border/80 bg-card/80 p-6 shadow-soft backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{t("quality.quality")}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t("quality.qualityDesc")}</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-4 rounded-[32px] border border-border/80 bg-card/80 p-6 shadow-soft backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{t("quality.accountability")}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t("quality.accountabilityDesc")}</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-4 rounded-[32px] border border-border/80 bg-card/80 p-6 shadow-soft backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{t("quality.proof")}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t("quality.afterService")}</p>
                </div>
              </div>
            </div>
            
            <p className="text-sm font-semibold text-foreground">{t("quality.proof")}</p>
          </div>

          {/* Image Side */}
          <div className="relative group">
            <div className="relative overflow-hidden rounded-[40px] border border-border/60 bg-muted p-2 shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]">
              <img
                src={img_bg_technician_spraying.src}
                alt={img_bg_technician_spraying.alt}
                loading="lazy"
                className="aspect-[4/5] w-full rounded-[32px] object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Decorative elements */}
              <div className="absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/10" aria-hidden />
            </div>
            
            {/* Floating proof badge */}
            <div className="absolute -bottom-6 -right-6 hidden sm:flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-brand animate-float">
               <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                 <CheckCircle2 className="h-5 w-5" />
               </div>
               <div>
                 <p className="text-xs font-bold uppercase tracking-wider opacity-80">Verified</p>
                 <p className="font-display font-semibold">Quality Assured</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QualityAssuranceSection;
