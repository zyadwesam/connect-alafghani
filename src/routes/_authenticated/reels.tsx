import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Film,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Share2,
  Trash2,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { uploadMedia } from "@/lib/media";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { ReelCommentsDialog } from "@/features/reels/reel-comments-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import type { ReelWithAuthor } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/reels")({
  head: () => ({
    meta: [
      { title: "ريلز — وصل" },
      { name: "description", content: "شاهد فيديوهات قصيرة عمودية من مجتمع وصل." },
      { property: "og:title", content: "ريلز — وصل" },
      { property: "og:description", content: "فيديوهات قصيرة بتمرير عمودي على منصة وصل." },
    ],
  }),
  component: ReelsPage,
});

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ReelsPage() {
  const { user } = useAuth();
  const [reels, setReels] = useState<ReelWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("reels")
      .select("*, profiles:profiles!reels_user_id_profiles_fkey(*)")
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data as unknown as ReelWithAuthor[]) ?? [];
    let liked: string[] = [];
    if (user && rows.length) {
      const { data: likes } = await supabase
        .from("reel_likes")
        .select("reel_id")
        .eq("user_id", user.id)
        .in(
          "reel_id",
          rows.map((r) => r.id),
        );
      liked = (likes ?? []).map((l) => l.reel_id);
    }
    setReels(rows.map((r) => ({ ...r, liked: liked.includes(r.id) })));
    setActiveId((prev) => prev ?? rows[0]?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-extrabold">ريلز</h1>
        <UploadReelDialog onDone={load} />
      </div>

      {loading ? (
        <Skeleton className="mx-auto h-[70vh] w-full max-w-[26rem] rounded-3xl" />
      ) : reels.length === 0 ? (
        <EmptyState
          icon={Film}
          title="لا توجد ريلز بعد"
          description="كن أول من ينشر فيديو قصير على المنصة."
        />
      ) : (
        <div className="no-scrollbar mx-auto h-[calc(100dvh-11rem)] w-full max-w-[26rem] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-3xl md:h-[calc(100dvh-9rem)]">
          {reels.map((reel) => (
            <ReelItem
              key={reel.id}
              reel={reel}
              active={activeId === reel.id}
              muted={muted}
              onMutedChange={setMuted}
              onActive={() => setActiveId(reel.id)}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReelItem({
  reel,
  active,
  muted,
  onMutedChange,
  onActive,
  onChanged,
}: {
  reel: ReelWithAuthor;
  active: boolean;
  muted: boolean;
  onMutedChange: (v: boolean) => void;
  onActive: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const url = useSignedUrl(reel.video_url);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(Boolean(reel.liked));
  const [likes, setLikes] = useState(reel.likes_count);
  const [counted, setCounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(reel.comments_count);

  // keep mute in sync with the global (shared) preference
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, url]);

  // detect which reel is on screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) onActive();
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // only the active reel plays; everything else pauses and rewinds
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      void el.play().catch(() => undefined);
      if (!counted) {
        setCounted(true);
        void supabase
          .from("reels")
          .update({ views_count: reel.views_count + 1 })
          .eq("id", reel.id);
      }
    } else {
      el.pause();
      el.currentTime = 0;
      setProgress(0);
    }
  }, [active, url, counted, reel.id, reel.views_count]);

  const toggleMute = () => {
    onMutedChange(!muted);
    setShowHint(true);
    window.setTimeout(() => setShowHint(false), 800);
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  };

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikes((n) => Math.max(n - 1, 0));
      await supabase.from("reel_likes").delete().eq("reel_id", reel.id).eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikes((n) => n + 1);
      await supabase.from("reel_likes").insert({ reel_id: reel.id, user_id: user.id });
    }
  };

  const follow = async () => {
    if (!user || user.id === reel.user_id) return;
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: reel.user_id });
    toast[error ? "error" : "success"](error ? "تعذّرت المتابعة" : "تمت المتابعة");
  };

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100dvh-11rem)] w-full snap-start snap-always overflow-hidden bg-black md:h-[calc(100dvh-9rem)]"
    >
      {url ? (
        <video
          ref={videoRef}
          src={url}
          loop
          muted={muted}
          playsInline
          preload="metadata"
          className="size-full object-contain"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      ) : (
        <Skeleton className="size-full" />
      )}

      {/* منتصف الشاشة: ضغطة واحدة = كتم/تشغيل الصوت */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        className="absolute inset-x-0 top-0 bottom-32 z-10 cursor-pointer"
      />

      {showHint || muted ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="rounded-full bg-black/50 p-4 text-white backdrop-blur-sm">
            {muted ? <VolumeX className="size-7" /> : <Volume2 className="size-7" />}
          </div>
        </div>
      ) : null}

      {!playing && url ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="rounded-full bg-black/45 p-5 text-white backdrop-blur-sm">
            <Play className="size-8" />
          </div>
        </div>
      ) : null}

      {/* التدرّج السفلي */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-56 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

      {/* معلومات صاحب الريل */}
      <div className="absolute bottom-16 start-4 end-20 z-20 text-white">
        <div className="flex items-center gap-2">
          <UserAvatar src={reel.profiles?.avatar_url} name={reel.profiles?.full_name} className="size-9" />
          <span className="text-sm font-bold">@{reel.profiles?.username}</span>
        </div>
        {reel.caption ? <p className="mt-2 line-clamp-2 text-sm">{reel.caption}</p> : null}
        {reel.audio_name ? <p className="mt-1 text-xs opacity-80">♪ {reel.audio_name}</p> : null}
        <p className="mt-1 text-[11px] opacity-70">{formatCount(reel.views_count)} مشاهدة</p>
      </div>

      {/* أزرار التفاعل */}
      <div className="absolute bottom-24 end-3 z-20 flex flex-col items-center gap-4 text-white">
        <button onClick={() => void toggleLike()} className="flex flex-col items-center text-[11px]">
          <Heart className={liked ? "size-7 fill-[var(--like)] text-[var(--like)]" : "size-7"} />
          {formatCount(likes)}
        </button>
        <button onClick={() => setCommentsOpen(true)} className="flex flex-col items-center text-[11px]">
          <MessageCircle className="size-7" />
          {formatCount(commentsCount)}
        </button>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(window.location.href);
            toast.success("تم نسخ الرابط");
          }}
          className="flex flex-col items-center text-[11px]"
        >
          <Share2 className="size-7" />
          مشاركة
        </button>
        {reel.user_id !== user?.id ? (
          <button onClick={() => void follow()} className="flex flex-col items-center text-[11px]">
            <UserPlus className="size-7" />
            متابعة
          </button>
        ) : (
          <button
            onClick={async () => {
              if (!window.confirm("حذف هذا الريل؟")) return;
              const { error } = await supabase.from("reels").delete().eq("id", reel.id);
              if (error) toast.error("تعذّر حذف الريل");
              else {
                toast.success("تم حذف الريل");
                onChanged();
              }
            }}
            className="flex flex-col items-center text-[11px]"
          >
            <Trash2 className="size-7" />
            حذف
          </button>
        )}
      </div>

      {/* شريط التحكم */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 px-3 pb-3 text-white">
        <button onClick={togglePlay} aria-label={playing ? "إيقاف" : "تشغيل"} className="shrink-0">
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
        <span className="w-10 shrink-0 text-[10px] tabular-nums opacity-80">{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={progress}
          onChange={(e) => {
            const v = Number(e.target.value);
            setProgress(v);
            if (videoRef.current) videoRef.current.currentTime = v;
          }}
          aria-label="تقدّم الفيديو"
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/30 accent-primary"
        />
        <span className="w-10 shrink-0 text-[10px] tabular-nums opacity-80">{formatTime(duration)}</span>
        <button onClick={toggleMute} aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"} className="shrink-0">
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
      </div>

      <ReelCommentsDialog
        reelId={reel.id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        onChanged={() => setCommentsCount((n) => n + 1)}
      />
    </div>
  );
}

function UploadReelDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [audio, setAudio] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !file) {
      toast.error("اختر فيديو أولًا");
      return;
    }
    setBusy(true);
    try {
      const ref = await uploadMedia("reels-media", user.id, file);
      const { error } = await supabase.from("reels").insert({
        user_id: user.id,
        video_url: ref,
        caption: caption || null,
        audio_name: audio || null,
      });
      if (error) throw error;
      toast.success("تم نشر الريل");
      setOpen(false);
      setFile(null);
      setCaption("");
      setAudio("");
      onDone();
    } catch (e) {
      toast.error("تعذّر الرفع: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> ريل جديد
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>رفع ريل جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="الوصف" />
          <Input value={audio} onChange={(e) => setAudio(e.target.value)} placeholder="اسم الصوت (اختياري)" />
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "جارٍ الرفع..." : "نشر"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
