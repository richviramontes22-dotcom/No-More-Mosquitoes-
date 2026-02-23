import SectionHeading from "@/components/common/SectionHeading";
import {
  Video,
  Play,
  Clock,
  Calendar,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Videos = () => {
  const videos = [
    {
      id: "OC-1244",
      recordedAt: "2024-11-30",
      duration: "2:45",
      summary: "Perimeter barrier + drain treatment",
      url: "https://example.com/videos/oc-1244",
      thumbnail: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&q=80&w=800",
    },
    {
      id: "OC-1201",
      recordedAt: "2024-11-09",
      duration: "1:30",
      summary: "Larvicide treatment in planters",
      url: "https://example.com/videos/oc-1201",
      thumbnail: "https://images.unsplash.com/photo-1598902108854-10e335adac99?auto=format&fit=crop&q=80&w=800",
    },
  ];

  return (
    <div className="grid gap-10">
      <SectionHeading
        eyebrow="Visit Videos"
        title="HD Completion Recaps"
        description="Watch high-definition videos from your recent visits confirming treatment areas and technician notes."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {videos.map((video) => (
          <Card key={video.id} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden group">
            <div className="relative aspect-video overflow-hidden">
              <img
                src={video.thumbnail}
                alt={video.summary}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                  <Play className="h-6 w-6 fill-current" />
                </div>
              </div>
              <div className="absolute bottom-3 right-3">
                <Badge className="bg-black/60 backdrop-blur-sm border-none text-[10px] font-bold">
                  {video.duration}
                </Badge>
              </div>
            </div>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/5 border-none text-[10px] font-bold uppercase tracking-wider">
                  Job #{video.id}
                </Badge>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Calendar className="h-3 w-3" />
                  {new Date(video.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <CardTitle className="text-lg mt-2 font-display">{video.summary}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                <a href={video.url} target="_blank" rel="noopener noreferrer">
                  Watch Video Recap
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-[32px] bg-muted/40 border border-border/60 p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-sm mb-6">
          <Video className="h-8 w-8 text-primary" />
        </div>
        <h4 className="text-xl font-bold font-display mb-2">Technician Notes</h4>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Every visit includes a detailed video recap so you can see exactly where we treated and any areas of concern our technicians identified.
        </p>
      </div>
    </div>
  );
};

export default Videos;
