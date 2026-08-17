import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hash, Search as SearchIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import { RowSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/follow-button";
import type { Hashtag, Profile } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "البحث — وصل" },
      { name: "description", content: "ابحث عن مستخدمين وهاشتاجات واكتشف حسابات جديدة." },
      { property: "og:title", content: "البحث — وصل" },
      { property: "og:description", content: "ابحث عن أصدقائك والهاشتاجات الرائجة." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { user } = useAuth();
  const [term, setTerm] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [tags, setTags] = useState<Hashtag[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSuggestions = async () => {
      if (!user) return;
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const excluded = [...(follows ?? []).map((f) => f.following_id), user.id];
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", `(${excluded.join(",")})`)
        .order("followers_count", { ascending: false })
        .limit(10);
      setSuggestions(data ?? []);
      setLoading(false);
    };
    void loadSuggestions();
  }, [user]);

  useEffect(() => {
    const q = term.trim();
    if (!q) {
      setUsers([]);
      setTags([]);
      return;
    }
    const timer = setTimeout(async () => {
      const [{ data: profiles }, { data: hashtags }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
          .limit(20),
        supabase.from("hashtags").select("*").ilike("tag", `%${q.replace("#", "")}%`).limit(20),
      ]);
      setUsers(profiles ?? []);
      setTags(hashtags ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">البحث</h1>
      <div className="relative">
        <SearchIcon className="absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحث عن مستخدم أو هاشتاج..."
          className="ps-9"
        />
      </div>

      {term.trim() ? (
        <div className="space-y-4">
          {users.length === 0 && tags.length === 0 ? (
            <EmptyState icon={SearchIcon} title="لا توجد نتائج" description="جرّب كلمة بحث أخرى." />
          ) : null}
          {users.map((p) => (
            <UserRow key={p.id} profile={p} />
          ))}
          {tags.map((t) => (
            <Link
              key={t.id}
              to="/tag/$tag"
              params={{ tag: t.tag }}
              className="flex items-center gap-3 rounded-xl border bg-card p-3"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Hash className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">#{t.tag}</span>
                <span className="text-xs text-muted-foreground">{t.posts_count} منشور</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground">اقتراحات للمتابعة</h2>
          {loading ? (
            <div className="space-y-3">
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : suggestions.length === 0 ? (
            <EmptyState icon={SearchIcon} title="لا توجد اقتراحات حاليًا" />
          ) : (
            suggestions.map((p) => <UserRow key={p.id} profile={p} />)
          )}
        </section>
      )}
    </div>
  );
}

function UserRow({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <Link to="/u/$username" params={{ username: profile.username }}>
        <UserAvatar src={profile.avatar_url} name={profile.full_name} className="size-11" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/u/$username"
          params={{ username: profile.username }}
          className="block truncate text-sm font-bold hover:underline"
        >
          {profile.full_name || profile.username}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          @{profile.username} · {profile.followers_count} متابع
        </p>
      </div>
      <FollowButton targetId={profile.user_id} isPrivate={profile.is_private} />
    </div>
  );
}
