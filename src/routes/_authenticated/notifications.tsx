import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RowSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { timeAgo } from "@/lib/format";
import type { NotificationWithActor } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "الإشعارات — وصل" },
      { name: "description", content: "تابع إعجاباتك وتعليقاتك ومتابعيك الجدد لحظيًا." },
      { property: "og:title", content: "الإشعارات — وصل" },
      { property: "og:description", content: "كل تفاعلات حسابك في مكان واحد." },
    ],
  }),
  component: NotificationsPage,
});

const labels: Record<string, string> = {
  like: "أعجب بمنشورك",
  comment: "علّق على منشورك",
  follow: "بدأ بمتابعتك",
  follow_request: "أرسل طلب متابعة",
  mention: "أشار إليك",
  message: "أرسل لك رسالة",
};

function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*, actor:profiles!notifications_actor_id_profiles_fkey(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as unknown as NotificationWithActor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
    void load();
  };

  const acceptRequest = async (actorId: string, notificationId: string) => {
    if (!user) return;
    await supabase
      .from("follows")
      .update({ status: "accepted" })
      .eq("follower_id", actorId)
      .eq("following_id", user.id);
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    void load();
  };

  const list = tab === "unread" ? items.filter((n) => !n.is_read) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">الإشعارات</h1>
        <Button variant="ghost" size="sm" onClick={markAll}>
          <Check className="size-4" /> تعليم الكل كمقروء
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="unread">غير المقروء</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Bell} title="لا توجد إشعارات" description="ستظهر هنا تفاعلات الآخرين معك." />
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <div
              key={n.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${n.is_read ? "bg-card" : "bg-accent/40"}`}
            >
              <UserAvatar src={n.actor?.avatar_url} name={n.actor?.full_name} className="size-10" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate">
                  {n.actor ? (
                    <Link
                      to="/u/$username"
                      params={{ username: n.actor.username }}
                      className="font-bold hover:underline"
                    >
                      {n.actor.full_name || n.actor.username}
                    </Link>
                  ) : (
                    "مستخدم"
                  )}{" "}
                  {labels[n.type] ?? ""}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
              </div>
              {n.type === "follow_request" && n.actor ? (
                <Button size="sm" onClick={() => acceptRequest(n.actor!.user_id, n.id)}>
                  قبول
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
