import SectionHeading from "@/components/common/SectionHeading";
import { scheduleSteps } from "@/data/site";
import { lifestyleImages } from "@/data/media";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/use-translation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const ScheduleSection = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const schedulePath = user ? "/dashboard/appointments" : "/login";

  return (
    <section id="schedule-service" className="relative overflow-hidden bg-primary/8 py-16 sm:py-24">
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-40" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[28px] sm:rounded-[36px] border border-primary/30 bg-white/90 p-6 sm:p-10 shadow-[0_30px_80px_-50px_rgba(10,70,92,0.7)] backdrop-blur">
          <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
            <div className="max-w-2xl space-y-4">
              <SectionHeading
                eyebrow={t("schedule.scheduleFlow")}
                title={t("schedule.threeSteps")}
                description={t("schedule.flowDesc")}
              />
              <Button
                asChild
                className="rounded-full px-6 py-3 h-auto shadow-brand"
              >
                <Link to={schedulePath}>
                  {t("schedule.launchSchedule")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
            <div className="overflow-hidden rounded-[24px] sm:rounded-[32px] border border-primary/20 shadow-soft">
              <img
                src={lifestyleImages[0].src}
                alt={lifestyleImages[0].alt}
                loading="lazy"
                className="aspect-video sm:aspect-auto h-full w-full object-cover"
                style={{ objectPosition: lifestyleImages[0].objectPosition || "center" }}
              />
            </div>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className="rounded-[28px] border border-border/70 bg-card/90 p-6 shadow-soft"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CalendarDays className="h-6 w-6" aria-hidden />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
                  {t("schedule.title")} {num}
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold text-foreground">{t(`schedule.step${num}`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`schedule.step${num}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScheduleSection;
