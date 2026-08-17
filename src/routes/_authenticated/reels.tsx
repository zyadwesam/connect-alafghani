import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Film, Heart, MessageCircle, Plus, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { uploadMedia } from "@/lib/media";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
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

function ReelsPage() {
  const { user } = useAuth();
  const [reels, setReels] = useState<ReelWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("reels")
      .select("*, profiles:profiles!reels_user_id_fkey(*)")
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data as unknown as ReelWithAuthor[]) ?? [];
    let liked: string[] = [];
    if (user && rows.length) {
      const { data: likes } = await supabase
        .from("reel_likes")
        .select("reel_id")
        .eq("user_id", user.id)
        .in("reel_id", rows.map((r) => r.id));
      liked = (likes ?? []).map((l) => l.reel_id);
    }
    setReels(rows.map((r) => ({ ...r, liked: liked.includes(r.id) })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">ريلز</h1>
        <UploadReelDialog onDone={load} />
      </div>

      {loading ? (
        <Skeleton className="h-[70vh] w-full rounded-2xl" />
      ) : reels.length === 0 ? (
        <EmptyState
          icon={Film}
          title="لا توجد ريلز بعد"
          description="كن أول من ينشر فيديو قصير على المنصة."
        />
      ) : (
        <div className="no-scrollbar h-[calc(100vh-9rem)] snap-y snap-mandatory overflow-y-auto rounded-2xl">
          {reels.map((reel) => (
            <ReelItem key={reel.id} reel={reel} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReelItem({ reel, onChanged }: { reel: ReelWithAuthor; onChanged: () => void }) {
  const { user } = useAuth();
  const url = useSignedUrl(reel.video_url);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(Boolean(reel.liked));
  const [likes, setLikes] = useState(reel.likes_count);
  const [counted, setCounted] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
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
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [counted, reel.id, reel.views_count]);

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

  const comment = async () => {
    if (!user) return;
    const text = window.prompt("اكتب تعليقك");
    if (!text) return;
    await supabase.from("reel_comments").insert({ reel_id: reel.id, user_id: user.id, content: text });
    toast.success("تم إضافة التعليق");
    onChanged();
  };

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full snap-start overflow-hidden bg-black">
      {url ? (
        <video
          ref={videoRef}
          src={url}
          loop
          muted
          playsInline
          className="size-full object-contain"
          onClick={(e) => {
            const el = e.currentTarget;
            if (el.paused) void el.play();
            else el.pause();
          }}
        />
      ) : (
        <Skeleton className="size-full" />
      )}

      <div className="absolute bottom-6 start-4 end-20 text-white">
        <div className="flex items-center gap-2">
          <UserAvatar src={reel.profiles?.avatar_url} name={reel.profiles?.full_name} className="size-9" />
          <span className="text-sm font-bold">@{reel.profiles?.username}</span>
        </div>
        {reel.caption ? <p className="mt-2 text-sm">{reel.caption}</p> : null}
        {reel.audio_name ? <p className="mt-1 text-xs opacity-80">♪ {reel.audio_name}</p> : null}
        <p className="mt-1 text-xs opacity-70">{formatCount(reel.views_count)} مشاهدة</p>
      </div>

      <div className="absolute bottom-8 end-3 flex flex-col items-center gap-4 text-white">
        <button onClick={toggleLike} className="flex flex-col items-center text-xs">
          <Heart className={liked ? "size-7 fill-[var(--like)] text-[var(--like)]" : "size-7"} />
          {formatCount(likes)}
        </button>
        <button onClick={comment} className="flex flex-col items-center text-xs">
          <MessageCircle className="size-7" />
          {formatCount(reel.comments_count)}
        </button>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(window.location.href);
            toast.success("تم نسخ الرابط");
          }}
          className="flex flex-col items-center text-xs"
        >
          <Share2 className="size-7" />
          مشاركة
        </button>
        {reel.user_id !== user?.id ? (
          <button onClick={follow} className="flex flex-col items-center text-xs">
            <UserPlus className="size-7" />
            متابعة
          </button>
        ) : null}
      </div>
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
        <Button>
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
