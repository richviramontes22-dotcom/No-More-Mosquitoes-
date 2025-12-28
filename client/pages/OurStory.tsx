import { CtaBand, PageHero, TeamGrid, ValuesList } from "@/components/page";
import StorySection from "@/components/sections/StorySection";
import Seo from "@/components/seo/Seo";
import { leadershipTeam } from "@/data/team";
import { organizationSchema } from "@/seo/structuredData";

const brandValues = [
  {
    title: "Honesty",
    description: "We explain every treatment, product selection, and weather adjustment before we leave your property.",
  },
  {
    title: "Hard work",
    description: "Employee-based technicians handle the heavy lifting—no subcontractors, no shortcuts, just detailed service.",
  },
  {
    title: "Dependability",
    description: "Route confirmations, on-time arrivals, and HD completion videos mean you can rely on each visit year-round.",
  },
  {
    title: "Safety",
    description: "California-approved formulations, pollinator protection, and pet-friendly protocols guide every application.",
  },
  {
    title: "Transparency",
    description: "You see what we see—from service notes to footage of every treated zone in your backyard.",
  },
];

const OurStory = () => {
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Our Story | No More Mosquitoes"
        description="From Grandma’s backyard in 2016 to OC homes today—our mission is to protect your space and peace of mind."
        canonicalUrl="https://nomoremosquitoes.us/our-story"
        jsonLd={[organizationSchema]}
      />
      <PageHero
        variant="centered"
        title="How one backyard evening sparked a mission to protect yours."
        description="Born in 2016 from Grandma’s backyard, built on honesty, hard work, and dependability. 100% satisfaction guarantee."
        primaryCta={{ label: "Meet the Team", href: "#team" }}
      >
        <p className="max-w-2xl text-sm text-muted-foreground">
          We transformed a frustrating family gathering into a full-service mosquito and pest program trusted by hundreds of Orange County homeowners.
        </p>
      </PageHero>
      <StorySection />
      <ValuesList
        title="The values that guide every route."
        description="Our brand DNA comes straight from our family—care for others, do the work right the first time, and keep promises."
        items={brandValues}
      />
      <div id="team">
        <TeamGrid
          members={leadershipTeam}
          description="Every technician is trained in-house on California structural pest compliance, safety protocols, and customer care."
        />
      </div>
      <CtaBand title="Get Your First Visit" href="/schedule" />
    </div>
  );
};

export default OurStory;
