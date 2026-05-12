import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import {
  Video as VideoIcon,
  Play,
  Clock,
  Calendar,
  ExternalLink,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, withTimeout } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { stringifyError } from "@/lib/error-utils";

interface VideoRecap {
  id: string;
  recordedAt: string;
  duration: string;
  summary: string;
  url: string;
  thumbnail: string | null;
  jobId: string;
}

const Videos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<VideoRecap[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // SECTION 5: Guarantee page loader terminates
  useEffect(() => {
    if (!user?.id) {
      if (import.meta.env.DEV) console.log("[Videos] No userId, skipping load");
      setIsLoading(false);
      setVideos([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const fetchVideos = async () => {
      try {
        if (import.meta.env.DEV) console.log("[Videos] query started");
        // 1. Fetch appointments for this user to ensure we only see their videos
        const { data: appointments, error: appError } = await withTimeout(
          supabase
            .from("appointments")
            .select("id")
            .eq("user_id", user.id),
          10000,
          "Video appointments"
        );

        if (appError) throw appError;

        const appointmentIds = appointments?.map(a => a.id) || [];
        if (appointmentIds.length === 0) {
          if (import.meta.env.DEV) console.log("[Videos] No appointments, no videos");
          if (isMounted) setVideos([]);
          return;
        }

        // 2. Fetch assignments for these appointments
        const { data: assignments, error: assignError } = await withTimeout(
          supabase
            .from("assignments")
            .select("id, appointment_id")
            .in("appointment_id", appointmentIds),
          10000,
          "Video assignments"
        );

        if (assignError) {
          console.error("[Videos] query timed out or failed: assignment fetch", assignError);
          if (isMounted) setVideos([]);
          return;
        }

        const assignmentIds = assignments?.map(a => a.id) || [];
        if (assignmentIds.length === 0) {
          if (import.meta.env.DEV) console.log("[Videos] No assignments, no videos");
          if (isMounted) setVideos([]);
          return;
        }

        if (!isMounted) {
          if (import.meta.env.DEV) console.log("[Videos] component unmounted, stopping");
          return;
        }

        // 3. Finally fetch the videos for these assignments
        const { data, error } = await withTimeout(
          supabase
            .from("job_media")
            .select(`
              id,
              url,
              caption,
              created_at,
              assignment_id
            `)
            .eq("media_type", "video")
            .in("assignment_id", assignmentIds)
            .order("created_at", { ascending: false }),
          10000,
          "Video media"
        );

        if (error) throw error;

        if (import.meta.env.DEV) console.log("[Videos] query success count=" + (data?.length || 0));

        const mapped: VideoRecap[] = (data || []).map((item: any) => {
          const assignment = assignments.find(a => a.id === item.assignment_id);
          const appointmentId = assignment?.appointment_id || "N/A";
          const jobId = appointmentId !== "N/A" ? appointmentId.split("-")[0].toUpperCase() : "N/A";

          return {
            id: item.id,
            recordedAt: item.created_at,
            duration: "â€”",
            summary: item.caption || "Visit Recap",
            url: item.url,
            thumbnail: null, // real thumbnails not yet available in job_media
            jobId: jobId
          };
        });

        if (isMounted) setVideos(mapped);
      } catch (err: any) {
        console.error("[Videos] query exception:", err);
        if (isMounted) {
          // CRITICAL FIX: Don't clear data on error, preserve what we have
          setError(err);
          // Only show toast if we have no videos at all
          if (videos.length === 0) {
            if (import.meta.env.DEV) console.log("[Videos] rendering error state");
            toast({
              title: "Unable to Load Videos",
              description: stringifyError(err),
              variant: "destructive"
            });
          } else {
            if (import.meta.env.DEV) console.log("[Videos] rendering data state with cached videos");
          }
        }
      } finally {
        // CRITICAL: Always clear loading state, even on error/timeout
        if (isMounted) {
          if (import.meta.env.DEV) console.log("[Videos] loading complete");
          setIsLoading(false);
        }
      }
    };

    fetchVideos();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <div className="grid gap-10">
      <SectionHeading
        eyebrow="Visit Videos"
        title="HD Completion Recaps"
        description="Watch high-definition videos from your recent visits confirming treatment areas and technician notes."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {isLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center p-20 bg-muted/20 rounded-[32px] border border-dashed border-border">
            <Loader2 className="h-10 w-10 animate-spin text-primary/40 mb-4" />
            <p className="text-muted-foreground font-medium italic">Loading your videos...</p>
          </div>
        ) : error && videos.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-red-50 rounded-[28px] border border-red-200 space-y-4">
            <VideoIcon className="h-10 w-10 text-red-600 mx-auto" />
            <div className="space-y-2">
              <p className="font-semibold text-red-900">Unable to Load Videos</p>
              <p className="text-sm text-red-700">{error.message}</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl">
              Reload Page
            </Button>
          </div>
        ) : videos.length > 0 ? (
          videos.map((video) => (
            <Card key={video.id} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden group">
              <div className="relative aspect-video overflow-hidden bg-muted/40">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.summary}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/5 to-muted/60">
                    <VideoIcon className="h-12 w-12 text-primary/30" />
                    <span className="text-xs text-muted-foreground font-medium">Visit Recap</span>
                  </div>
                )}
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
                    Job #{video.jobId}
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
          ))
        ) : (
          <div className="col-span-full p-20 text-center bg-muted/20 rounded-[32px] border border-dashed border-border space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/40 mb-4">
              <VideoIcon className="h-8 w-8" />
            </div>
            <p className="text-muted-foreground font-medium italic">No visit videos available yet.</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Videos are uploaded shortly after your technician completes their visit.</p>
          </div>
        )}
      </div>

      <div className="rounded-[32px] bg-muted/40 border border-border/60 p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-sm mb-6">
          <VideoIcon className="h-8 w-8 text-primary" />
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
