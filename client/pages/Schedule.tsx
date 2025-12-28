import { useEffect } from "react";

import SectionHeading from "@/components/common/SectionHeading";
import { CtaBand, PageHero } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";

const serviceHighlights = [
  {
    title: "HD visit recaps",
    description: "Every treatment includes a video recap so you can review technician coverage and areas of focus.",
  },
  {
    title: "Licensed OC technicians",
    description: "Uniformed employees (never contractors) who know the climate, neighborhoods, and HOA requirements.",
  },
  {
    title: "Flexible cadence",
    description: "Choose the schedule that fits your backyard usage—from single-event sprays to weekly guard plans.",
  },
];

const SchedulePage = () => {
  const { open } = useScheduleDialog();

  useEffect(() => {
    open({ source: "schedule-page" });
  }, [open]);

  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Schedule Mosquito Control"
        description="Request your next visit and we’ll confirm the best route window for your property."
        canonicalUrl="https://nomoremosquitoes.us/schedule"
      />
      <PageHero
        variant="split"
        title="Let’s plan your next mosquito-free visit"
        description="Share your preferred date, cadence, and notes about your property. Our coordinator will confirm within one business day."
        aside={
          <div className="space-y-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Need to talk it through?</p>
            <p>
              Call or text <a className="font-semibold text-primary" href="tel:+19497630492">(949) 763-0492</a> and we’ll help pick the right cadence for your yard.
            </p>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => open({ source: "schedule-page-hero" })}>
            Start scheduling
          </Button>
          <Button asChild variant="secondary" size="lg" className="bg-muted/70 text-foreground hover:bg-muted">
            <a href="tel:+19497630492">Call our team</a>
          </Button>
        </div>
      </PageHero>
      <section className="bg-background py-24">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Why homeowners book with us"
            title="Every visit blends proactive protection with friendly service"
            description="From barrier sprays to standing water treatments, our team keeps patios, pools, and play areas ready for guests."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {serviceHighlights.map((highlight) => (
              <Card key={highlight.title} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-xl">{highlight.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{highlight.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <CtaBand title="Questions before scheduling?" href="tel:+19497630492" ctaLabel="Call or text (949) 763-0492" external />
    </div>
  );
};

export default SchedulePage;
