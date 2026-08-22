import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/features/feed/post-card";
import { PostSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import type { PostWithAuthor } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/tag/$tag")({
  head: ({ params }) => ({
    meta: [
      { title: `#${params.tag} — وصل` },
      { name: "description", content: `منشورات موسومة بـ #${params.tag} على منصة وصل.` },
      { property: "og:title", content: `#${params.tag} — وصل` },
      { property: "og:description", content: `تصفح منشورات هاشتاج #${params.tag}.` },
    ],
  }),
  component: TagPage,
});

function TagPage() {
  const { tag } = Route.useParams();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: hashtag } = await supabase
      .from("hashtags")
      .select("id")
      .eq("tag", tag.toLowerCase())
      .maybeSingle();
    if (!hashtag) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const { data: links } = await supabase
      .from("post_hashtags")
      .select("post_id")
      .eq("hashtag_id", hashtag.id);
    const ids = (links ?? []).map((l) => l.post_id);
    if (ids.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("posts")
      .select("*, profiles:profiles!posts_user_id_profiles_fkey(*)")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setPosts((data as unknown as PostWithAuthor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">#{tag}</h1>
      {loading ? (
        <PostSkeleton />
      ) : posts.length === 0 ? (
        <EmptyState icon={Hash} title="لا توجد منشورات بهذا الهاشتاج" />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)
      )}
    </div>
  );
}
