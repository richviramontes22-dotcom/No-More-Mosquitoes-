import SectionHeading from "@/components/common/SectionHeading";
import { lifestyleImages } from "@/data/media";
import { useTranslation } from "@/hooks/use-translation";

const StorySection = () => {
  const { t } = useTranslation();
  const storyText = (t("story.content") || "") as string;
  const paragraphs = storyText.split("\n\n").filter((paragraph) => paragraph.trim().length > 0);
  const heading = t("story.title");
  const subheading = t("story.subtitle");
  const body = paragraphs;

  return (
    <section className="bg-gradient-to-br from-background via-background to-muted/40 py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t("story.storyEyebrow")}
          title={subheading}
          description={t("story.ourStoryDesc")}
        />
        <div className="mt-10 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-primary/15 bg-primary/5 p-8 text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              {heading}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {lifestyleImages.slice(0, 2).map((image) => (
                <figure
                  key={image.src}
                  className="overflow-hidden rounded-[24px] border border-border/60 shadow-soft"
                >
                  <img src={image.src} alt={image.alt} loading="lazy" className="h-full w-full object-cover" />
                </figure>
              ))}
            </div>
          </div>
          <div className="space-y-5 text-base leading-relaxed text-muted-foreground">
            {body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StorySection;
