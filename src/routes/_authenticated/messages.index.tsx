import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { RowSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { timeAgo } from "@/lib/format";
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
};

function MessagesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at, conversations!inner(id, is_group, group_name, group_avatar_url, last_message_at)")
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
        }
      }

      list.push({
        id: conv.id,
        isGroup: conv.is_group,
        title,
        avatar,
        lastMessage: (lastMsgs?.[0] as Message | undefined) ?? null,
        unread: count ?? 0,
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void load())
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
            className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/40"
          >
            <UserAvatar src={row.avatar} name={row.title} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{row.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.lastMessage?.content ?? "لا توجد رسائل بعد"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {row.lastMessage ? (
                <span className="text-[11px] text-muted-foreground">
                  {timeAgo(row.lastMessage.created_at)}
                </span>
              ) : null}
              {row.unread > 0 ? (
                <span className="rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
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
