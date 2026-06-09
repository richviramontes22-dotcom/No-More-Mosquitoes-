import { useEffect, useState } from "react";
import {
  Play,
  Video as VideoIcon,
  Calendar,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase, withTimeout } from "@/lib/supabase";

interface VideoRecap {
  id: string;
  recordedAt: string;
  summary: string;
  url: string;
  jobId: string;
}

export const VideoRecapGrid = ({ userId }: { userId?: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<VideoRecap[]>([]);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const fetchVideos = async () => {
      try {
        const { data: appointments } = await withTimeout(
          supabase.from("appointments").select("id").eq("user_id", userId),
          10000,
          "Video appointments"
        );
        const appointmentIds = (appointments || []).map((a: any) => a.id);
        if (appointmentIds.length === 0) {
          if (isMounted) setVideos([]);
          return;
        }

        const { data: assignments } = await withTimeout(
          supabase
            .from("assignments")
            .select("id, appointment_id")
            .in("appointment_id", appointmentIds),
          10000,
          "Video assignments"
        );
        const assignmentIds = (assignments || []).map((a: any) => a.id);
        if (assignmentIds.length === 0) {
          if (isMounted) setVideos([]);
          return;
        }

        const { data } = await withTimeout(
          supabase
            .from("job_media")
            .select("id, url, caption, created_at, assignment_id")
            .eq("media_type", "video")
            .in("assignment_id", assignmentIds)
            .order("created_at", { ascending: false }),
          10000,
          "Video media"
        );

        if (isMounted) {
          setVideos(
            (data || []).map((item: any) => {
              const asgn = (assignments || []).find(
                (a: any) => a.id === item.assignment_id
              );
              const apptId = asgn?.appointment_id || "N/A";
              return {
                id: item.id,
                recordedAt: item.created_at,
                summary: item.caption || "Visit Recap",
                url: item.url,
                jobId:
                  apptId !== "N/A"
                    ? apptId.split("-")[0].toUpperCase()
                    : "N/A",
              };
            })
          );
        }
      } catch {
        if (isMounted) setVideos([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchVideos();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-muted/20 rounded-[28px] border border-dashed border-border">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-3" />
        <p className="text-muted-foreground font-medium italic">Loading recaps…</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-border/60 bg-muted/20 px-8 py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40">
          <VideoIcon className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">No visit recaps yet</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            HD recap videos appear here after your technician completes each
            visit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {videos.map((video) => (
        <Card
          key={video.id}
          className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden group"
        >
          <div className="relative aspect-video overflow-hidden bg-muted/40">
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/5 to-muted/60">
              <VideoIcon className="h-12 w-12 text-primary/30" />
            </div>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                <Play className="h-6 w-6 fill-current" />
              </div>
            </div>
          </div>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge
                variant="secondary"
                className="bg-primary/5 text-primary hover:bg-primary/5 border-none text-[10px] font-bold uppercase tracking-wider"
              >
                Job #{video.jobId}
              </Badge>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Calendar className="h-3 w-3" />
                {new Date(video.recordedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <CardTitle className="text-lg mt-2 font-display">
              {video.summary}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all"
            >
              <a href={video.url} target="_blank" rel="noopener noreferrer">
                Watch Video Recap
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default VideoRecapGrid;
