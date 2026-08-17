import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadMedia } from "@/lib/media";
import { UserAvatar } from "@/components/user-avatar";
import { StoriesSkeleton } from "@/components/skeletons";
import { StoryViewer } from "@/features/stories/story-viewer";
import type { StoryWithAuthor } from "@/lib/types";

export type StoryGroup = { userId: string; stories: StoryWithAuthor[] };

export function StoriesBar() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<StoryGroup | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("stories")
      .select("*, profiles:profiles!stories_user_id_fkey(*)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const stories = (data as unknown as StoryWithAuthor[]) ?? [];
    const map = new Map<string, StoryWithAuthor[]>();
    for (const s of stories) {
      map.set(s.user_id, [...(map.get(s.user_id) ?? []), s]);
    }
    setGroups(Array.from(map, ([userId, list]) => ({ userId, stories: list })));
    if (user) {
      const { data: views } = await supabase
        .from("story_views")
        .select("story_id")
        .eq("viewer_id", user.id);
      setSeen((views ?? []).map((v) => v.story_id));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const upload = async (file: File | undefined) => {
    if (!file || !user) return;
    try {
      const isVideo = file.type.startsWith("video");
      const ref = await uploadMedia("stories-media", user.id, file);
      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: ref,
        media_type: isVideo ? "video" : "image",
      });
      if (error) throw error;
      toast.success("تم نشر الستوري");
      void load();
    } catch (e) {
      toast.error("تعذّر نشر الستوري: " + (e as Error).message);
    }
  };

  if (loading) return <StoriesSkeleton />;

  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <button className="flex w-16 shrink-0 flex-col items-center gap-1" onClick={() => fileInput.current?.click()}>
        <span className="relative">
          <UserAvatar src={profile?.avatar_url} name={profile?.full_name} className="size-16" />
          <span className="absolute -bottom-0.5 -start-0.5 flex size-6 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
            <Plus className="size-3.5" />
          </span>
        </span>
        <span className="w-16 truncate text-center text-[11px]">ستوري جديد</span>
      </button>

      {groups.map((g) => {
        const unseen = g.stories.some((s) => !seen.includes(s.id));
        const author = g.stories[0]?.profiles;
        return (
          <button
            key={g.userId}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
            onClick={() => setActive(g)}
          >
            <span
              className={
                unseen
                  ? "story-ring rounded-full p-[2px]"
                  : "rounded-full bg-muted p-[2px]"
              }
            >
              <UserAvatar
                src={author?.avatar_url}
                name={author?.full_name}
                className="size-[60px] border-2 border-card"
              />
            </span>
            <span className="w-16 truncate text-center text-[11px]">
              {author?.username ?? "مستخدم"}
            </span>
          </button>
        );
      })}

      {active ? (
        <StoryViewer
          group={active}
          onClose={() => {
            setActive(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
