import { videoProofs } from "@/data/site";
import SectionHeading from "@/components/common/SectionHeading";
import { technicianImages } from "@/data/media";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";

const VideoProofSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/12 via-background to-accent/10 py-24">
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-40" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Video proof"
          title="See the completion videos customers receive minutes after every visit."
          description="Each service wraps with HD footage, audio notes, and next-step recommendations so you know your yard is protected."
          centered
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {videoProofs.map((proof, index) => (
            <article
              key={proof.jobId}
              className="group relative overflow-hidden rounded-[32px] border border-primary/15 bg-card/90 p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-[0_26px_70px_-50px_rgba(10,64,87,0.7)]"
            >
              <div className="relative h-48 overflow-hidden rounded-2xl">
                <img
                  src={technicianImages[index % technicianImages.length].src}
                  alt={technicianImages[index % technicianImages.length].alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent" aria-hidden />
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary shadow-brand transition group-hover:scale-105"
                    aria-label={`Preview completion video for ${proof.title}`}
                  >
                    <Play className="h-7 w-7" aria-hidden />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  {proof.duration}
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Job {proof.jobId}</p>
                <h3 className="font-display text-xl font-semibold text-foreground">{proof.title}</h3>
                <p className="text-sm text-muted-foreground">{proof.summary}</p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:translate-x-0.5"
                >
                  View secure portal sample
                  <Play className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VideoProofSection;
