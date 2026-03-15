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
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { stringifyError } from "@/lib/error-utils";

interface VideoRecap {
  id: string;
  recordedAt: string;
  duration: string;
  summary: string;
  url: string;
  thumbnail: string;
  jobId: string;
}

const Videos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<VideoRecap[]>([]);

  const fetchVideos = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch appointments for this user to ensure we only see their videos
      const { data: appointments, error: appError } = await supabase
        .from("appointments")
        .select("id")
        .eq("user_id", user.id);

      if (appError) throw appError;

      const appointmentIds = appointments?.map(a => a.id) || [];
      if (appointmentIds.length === 0) {
        setVideos([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch assignments for these appointments
      const { data: assignments, error: assignError } = await supabase
        .from("assignments")
        .select("id, appointment_id")
        .in("appointment_id", appointmentIds);

      if (assignError) {
        console.error("Error fetching assignments for videos:", assignError);
        // Don't throw, just show empty
        setVideos([]);
        setIsLoading(false);
        return;
      }

      const assignmentIds = assignments?.map(a => a.id) || [];
      if (assignmentIds.length === 0) {
        setVideos([]);
        setIsLoading(false);
        return;
      }

      // 3. Finally fetch the videos for these assignments
      const { data, error } = await supabase
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
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: VideoRecap[] = (data || []).map((item: any) => {
        const assignment = assignments.find(a => a.id === item.assignment_id);
        const appointmentId = assignment?.appointment_id || "N/A";
        const jobId = appointmentId !== "N/A" ? appointmentId.split("-")[0].toUpperCase() : "N/A";

        return {
          id: item.id,
          recordedAt: item.created_at,
          duration: "—",
          summary: item.caption || "Visit Recap",
          url: item.url,
          thumbnail: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&q=80&w=800",
          jobId: jobId
        };
      });

      setVideos(mapped);
    } catch (err: any) {
      console.error("Error fetching videos:", err);
      toast({
        title: "System: Videos Fetch Error",
        description: stringifyError(err),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [user]);

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
        ) : videos.length > 0 ? (
          videos.map((video) => (
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
