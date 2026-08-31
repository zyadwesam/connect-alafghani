import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { RowSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { presenceLabel, isOnline, timeAgo } from "@/lib/format";
import type { Message, Profile } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "الرسائل — وصل" },
      { name: "description", content: "محادثاتك الفردية والجماعية مع إشعارات فورية." },
      { property: "og:title", content: "الرسائل — وصل" },
      { property: "og:description", content: "تراسل أصدقاءك لحظيًا على منصة وصل." },
    ],
  }),
  component: MessagesPage,
});

type Row = {
  id: string;
  isGroup: boolean;
  title: string;
  avatar: string | null;
  lastMessage: Message | null;
  unread: number;
  lastSeen: string | null;
};

function MessagesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select(
        "conversation_id, last_read_at, conversations!inner(id, is_group, group_name, group_avatar_url, last_message_at)",
      )
      .eq("user_id", user.id);

    const list: Row[] = [];
    for (const part of parts ?? []) {
      const conv = part.conversations as unknown as {
        id: string;
        is_group: boolean;
        group_name: string | null;
        group_avatar_url: string | null;
        last_message_at: string;
      };
      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .neq("sender_id", user.id)
        .gt("created_at", part.last_read_at);

      let title = conv.group_name ?? "محادثة";
      let avatar: string | null = conv.group_avatar_url;
      let lastSeen: string | null = null;
      if (!conv.is_group) {
        const { data: others } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conv.id)
          .neq("user_id", user.id);
        const otherId = others?.[0]?.user_id;
        if (otherId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", otherId)
            .maybeSingle();
          const p = prof as Profile | null;
          title = p?.full_name || p?.username || "مستخدم";
          avatar = p?.avatar_url ?? null;
          lastSeen = p?.last_seen_at ?? null;
        }
      }

      list.push({
        id: conv.id,
        isGroup: conv.is_group,
        title,
        avatar,
        lastMessage: (lastMsgs?.[0] as Message | undefined) ?? null,
        unread: count ?? 0,
        lastSeen,
      });
    }

    list.sort(
      (a, b) =>
        new Date(b.lastMessage?.created_at ?? 0).getTime() -
        new Date(a.lastMessage?.created_at ?? 0).getTime(),
    );
    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase
      .channel("messages-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-2 md:space-y-3">
      <h1 className="px-1 text-xl font-extrabold">الرسائل</h1>
      {loading ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="لا توجد محادثات"
          description="ابدأ محادثة من صفحة أي مستخدم عبر زر «مراسلة»."
        />
      ) : (
        rows.map((row) => (
          <Link
            key={row.id}
            to="/messages/$id"
            params={{ id: row.id }}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-card p-3 transition-colors active:bg-accent/60 hover:bg-accent/40"
          >
            <div className="relative shrink-0">
              <UserAvatar src={row.avatar} name={row.title} className="size-14 md:size-12" />
              {!row.isGroup && isOnline(row.lastSeen) ? (
                <span className="absolute bottom-0 end-0 size-3.5 rounded-full border-2 border-card bg-emerald-500" />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold">{row.title}</p>
              {!row.isGroup ? (
                <p
                  className={`truncate text-[11px] ${
                    isOnline(row.lastSeen)
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {presenceLabel(row.lastSeen)}
                </p>
              ) : null}
              <p
                className={`truncate text-xs ${
                  row.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {row.lastMessage?.media_url
                  ? "📎 مرفق"
                  : (row.lastMessage?.content ?? "لا توجد رسائل بعد")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {row.lastMessage ? (
                <span className="text-[11px] text-muted-foreground">
                  {timeAgo(row.lastMessage.created_at)}
                </span>
              ) : null}
              {row.unread > 0 ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                  {row.unread}
                </span>
              ) : null}
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
