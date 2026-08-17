import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { RowSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import type { Profile } from "@/lib/types";

export function FollowList({ mode }: { mode: "followers" | "following" }) {
  const { username } = useParams({ strict: false }) as { username: string };
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", username)
        .maybeSingle();
      if (!prof) {
        setProfiles([]);
        setLoading(false);
        return;
      }
      const { data: rows } = await supabase
        .from("follows")
        .select("follower_id, following_id")
        .eq(mode === "followers" ? "following_id" : "follower_id", prof.user_id)
        .eq("status", "accepted");
      const ids = (rows ?? []).map((r) => (mode === "followers" ? r.follower_id : r.following_id));
      if (ids.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids);
      setProfiles(data ?? []);
      setLoading(false);
    };
    void load();
  }, [username, mode]);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">
        {mode === "followers" ? "المتابِعون" : "يتابعهم"} · @{username}
      </h1>
      {loading ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : profiles.length === 0 ? (
        <EmptyState icon={Users} title="القائمة فارغة" />
      ) : (
        profiles.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <Link to="/u/$username" params={{ username: p.username }}>
              <UserAvatar src={p.avatar_url} name={p.full_name} className="size-11" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                to="/u/$username"
                params={{ username: p.username }}
                className="block truncate text-sm font-bold hover:underline"
              >
                {p.full_name || p.username}
              </Link>
              <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
            </div>
            <FollowButton targetId={p.user_id} isPrivate={p.is_private} />
          </div>
        ))
      )}
    </div>
  );
}
