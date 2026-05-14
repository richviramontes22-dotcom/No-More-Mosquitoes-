import { CtaBand, TeamGrid, ValuesList } from "@/components/page";
import StorySection from "@/components/sections/StorySection";
import Seo from "@/components/seo/Seo";
import { leadershipTeam } from "@/data/team";
import { organizationSchema } from "@/seo/structuredData";
import { useTranslation } from "@/hooks/use-translation";
import { useSiteContent } from "@/hooks/useSiteContent";
import { Button } from "@/components/ui/button";
import { BookOpen, Leaf, Users } from "lucide-react";

const OurStory = () => {
  const { t } = useTranslation();
  const brandValues = t("story.brandValues") as { title: string; description: string }[];
  const missionStatement = useSiteContent("about_mission");

  return (
    <div className="flex flex-col gap-0">
      <Seo
        title={`${t("story.ourStoryTitle")} | No More Mosquitoes`}
        description={t("story.ourStoryDesc")}
        canonicalUrl="https://nomoremosquitoes.us/our-story"
        jsonLd={[organizationSchema]}
      />

      {/* Mission Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-mesh-overlay opacity-10" aria-hidden />
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
            Our Mission
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
            {t("story.subtitle")}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {missionStatement}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild size="lg" className="rounded-full shadow-brand px-8">
              <a href="#story">
                <BookOpen className="mr-2 h-4 w-4" />
                Our Story
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8">
              <a href="#values">
                <Leaf className="mr-2 h-4 w-4" />
                Our Values
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full px-8">
              <a href="#team">
                <Users className="mr-2 h-4 w-4" />
                Meet the Team
              </a>
            </Button>
          </div>
        </div>
      </section>

      <div id="story">
        <StorySection />
      </div>
      <div id="values">
        <ValuesList
          title={t("story.valuesTitle")}
          description={t("story.valuesDesc")}
          items={brandValues}
        />
      </div>
      <div id="team">
        <TeamGrid
          members={leadershipTeam}
          description={t("story.teamDesc")}
        />
      </div>
      <CtaBand title={t("story.getFirstVisit")} href="/schedule" />
    </div>
  );
};

export default OurStory;
