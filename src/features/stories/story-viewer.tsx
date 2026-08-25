import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Eye, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { startConversation } from "@/features/chat/chat-api";
import { timeAgo } from "@/lib/format";
import type { StoryWithAuthor } from "@/lib/types";

const DURATION = 5000;

export function StoryViewer({
  group,
  onClose,
}: {
  group: { userId: string; stories: StoryWithAuthor[] };
  onClose: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<number>(0);
  const [reply, setReply] = useState("");
  const [muted, setMuted] = useState(true);
  const story = group.stories[index];
  const url = useSignedUrl(story?.media_url);
  const mine = group.userId === user?.id;

  useEffect(() => {
    if (!story || !user) return;
    void supabase
      .from("story_views")
      .insert({ story_id: story.id, viewer_id: user.id })
      .then(() => undefined);
    if (mine) {
      void supabase
        .from("story_views")
        .select("id", { count: "exact", head: true })
        .eq("story_id", story.id)
        .then(({ count }) => setViewers(count ?? 0));
    }
  }, [story, user, mine]);

  useEffect(() => {
    setProgress(0);
    const started = Date.now();
    const timer = setInterval(() => {
      const pct = Math.min(((Date.now() - started) / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        if (index < group.stories.length - 1) setIndex(index + 1);
        else onClose();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [index, group.stories.length, onClose]);

  if (!story) return null;

  const sendReply = async () => {
    if (!user || !reply.trim()) return;
    const conversationId = await startConversation(user.id, group.userId);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: `رد على الستوري: ${reply.trim()}`,
    });
    setReply("");
    onClose();
    void navigate({ to: "/messages/$id", params: { id: conversationId } });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col p-3">
        <div className="flex gap-1">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-[width] duration-75"
                style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-white">
          <UserAvatar
            src={story.profiles?.avatar_url}
            name={story.profiles?.full_name}
            className="size-9"
          />
          <div className="flex-1">
            <p className="text-sm font-bold">{story.profiles?.full_name || story.profiles?.username}</p>
            <p className="text-[11px] opacity-75">{timeAgo(story.created_at)}</p>
          </div>
          {story.media_type === "video" ? (
            <button
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
              className="me-1"
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
          ) : null}
          {mine ? (
            <button
              aria-label="حذف الستوري"
              className="me-1"
              onClick={async () => {
                if (!window.confirm("حذف هذا الستوري؟")) return;
                const { error } = await supabase.from("stories").delete().eq("id", story.id);
                if (error) toast.error("تعذّر حذف الستوري");
                else {
                  toast.success("تم حذف الستوري");
                  onClose();
                }
              }}
            >
              <Trash2 className="size-5" />
            </button>
          ) : null}
          <button onClick={onClose} aria-label="إغلاق">
            <X className="size-6" />
          </button>
        </div>

        <div className="relative mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
          {url ? (
            story.media_type === "video" ? (
              <video
                src={url}
                autoPlay
                muted={muted}
                playsInline
                controls={false}
                className="max-h-full w-full object-contain"
              />
            ) : (
              <img src={url} alt="ستوري" className="max-h-full w-full object-contain" />
            )
          ) : null}
          <button
            className="absolute inset-y-0 start-0 w-1/3"
            aria-label="السابق"
            onClick={() => setIndex(Math.max(index - 1, 0))}
          />
          <button
            className="absolute inset-y-0 end-0 w-1/3"
            aria-label="التالي"
            onClick={() =>
              index < group.stories.length - 1 ? setIndex(index + 1) : onClose()
            }
          />
          <ChevronRight className="pointer-events-none absolute start-2 size-6 text-white/60" />
          <ChevronLeft className="pointer-events-none absolute end-2 size-6 text-white/60" />
        </div>

        {story.caption ? (
          <p className="mt-2 text-center text-sm text-white">{story.caption}</p>
        ) : null}

        {mine ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-white/80">
            <Eye className="size-4" /> {viewers} مشاهدة
          </p>
        ) : (
          <div className="mt-3 flex gap-2">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="ردّ على الستوري..."
              className="bg-white/10 text-white placeholder:text-white/60"
            />
            <Button onClick={sendReply}>إرسال</Button>
          </div>
        )}
      </div>
    </div>
  );
}
