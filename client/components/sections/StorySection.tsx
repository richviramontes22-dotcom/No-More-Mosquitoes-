import SectionHeading from "@/components/common/SectionHeading";
import { lifestyleImages } from "@/data/media";
import { useTranslation } from "@/hooks/use-translation";
import { useSiteContent } from "@/hooks/useSiteContent";

const StorySection = () => {
  const { t } = useTranslation();
  const storyText = useSiteContent("about_story");
  const paragraphs = storyText.split("\n\n").filter((p) => p.trim().length > 0);
  const subheading = t("story.subtitle");
  const body = paragraphs;

  return (
    <section className="bg-gradient-to-br from-background via-background to-muted/40 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t("story.storyEyebrow")}
          title={subheading}
          description={t("story.ourStoryDesc")}
        />
        <div className="mt-8 sm:mt-10 grid gap-8 sm:gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-2">
            {lifestyleImages.slice(0, 2).map((image) => (
              <figure
                key={image.src}
                className="overflow-hidden rounded-[24px] border border-border/60 shadow-soft"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: image.objectPosition || "center" }}
                />
              </figure>
            ))}
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
