import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PostComposer } from "@/features/feed/post-composer";
import { PostCard } from "@/features/feed/post-card";
import { StoriesBar } from "@/features/stories/stories-bar";
import { PostSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PostWithAuthor } from "@/lib/types";

const PAGE = 10;

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "الرئيسية — وصل" },
      { name: "description", content: "تابع أحدث منشورات وستوريز من تتابعهم على وصل." },
      { property: "og:title", content: "الرئيسية — وصل" },
      { property: "og:description", content: "أحدث المنشورات والستوريز من أصدقائك." },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState<"latest" | "following">("latest");
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!user || loadingRef.current) return;
      loadingRef.current = true;
      const offset = reset ? 0 : posts.length;

      let followingIds: string[] = [];
      if (tab === "following") {
        const { data } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .eq("status", "accepted");
        followingIds = [...(data ?? []).map((f) => f.following_id), user.id];
      }

      let query = supabase
        .from("posts")
        .select("*, profiles:profiles!posts_user_id_fkey(*)")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1);

      if (tab === "following") query = query.in("user_id", followingIds);

      const { data } = await query;
      const rows = (data as unknown as PostWithAuthor[]) ?? [];

      let liked: string[] = [];
      if (rows.length > 0) {
        const { data: likes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in(
            "post_id",
            rows.map((p) => p.id),
          );
        liked = (likes ?? []).map((l) => l.post_id);
      }
      const withLikes = rows.map((p) => ({ ...p, liked: liked.includes(p.id) }));

      setPosts((prev) => (reset ? withLikes : [...prev, ...withLikes]));
      setDone(rows.length < PAGE);
      setLoading(false);
      loadingRef.current = false;
    },
    [user, posts.length, tab],
  );

  useEffect(() => {
    setLoading(true);
    setDone(false);
    void fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchPage(false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage, done]);

  const refresh = () => void fetchPage(true);

  return (
    <div className="space-y-4">
      <h1 className="sr-only">الصفحة الرئيسية</h1>
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <StoriesBar />
      </section>

      <PostComposer onCreated={refresh} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="latest">الأحدث</TabsTrigger>
          <TabsTrigger value="following">المتابَعون</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-4">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="لا توجد منشورات بعد"
          description="ابدأ بنشر أول منشور أو تابع أشخاصًا جددًا لتظهر منشوراتهم هنا."
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onChanged={refresh} />
          ))}
        </div>
      )}

      {!done ? <div ref={sentinel} className="h-10" /> : null}
    </div>
  );
}
