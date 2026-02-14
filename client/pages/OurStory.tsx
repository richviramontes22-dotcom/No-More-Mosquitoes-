import { CtaBand, PageHero, TeamGrid, ValuesList } from "@/components/page";
import StorySection from "@/components/sections/StorySection";
import Seo from "@/components/seo/Seo";
import { leadershipTeam } from "@/data/team";
import { organizationSchema } from "@/seo/structuredData";
import { useTranslation } from "@/hooks/use-translation";

const OurStory = () => {
  const { t } = useTranslation();
  const brandValues = t("story.brandValues") as { title: string; description: string }[];

  return (
    <div className="flex flex-col gap-0">
      <Seo
        title={`${t("story.ourStoryTitle")} | No More Mosquitoes`}
        description={t("story.ourStoryDesc")}
        canonicalUrl="https://nomoremosquitoes.us/our-story"
        jsonLd={[organizationSchema]}
      />
      <PageHero
        variant="centered"
        title={t("story.subtitle")}
        description={t("story.heroDesc")}
        primaryCta={{ label: t("story.meetTeam"), href: "#team" }}
      >
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("story.heroIntro")}
        </p>
      </PageHero>
      <StorySection />
      <ValuesList
        title={t("story.valuesTitle")}
        description={t("story.valuesDesc")}
        items={brandValues}
      />
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
