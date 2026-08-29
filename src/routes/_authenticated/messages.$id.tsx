import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, ImagePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadMedia } from "@/lib/media";
import { MediaImage, MediaVideo } from "@/components/media-image";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message, Profile } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({
    meta: [
      { title: "محادثة — وصل" },
      { name: "description", content: "محادثة فورية مع مؤشر كتابة وعلامات قراءة." },
      { property: "og:title", content: "محادثة — وصل" },
      { property: "og:description", content: "راسل أصدقاءك لحظيًا على وصل." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Profile[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      setMessages((msgs as Message[]) ?? []);

      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", id);
      const ids = (parts ?? []).map((p) => p.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("*").in("user_id", ids);
        setParticipants(profs ?? []);
      }
      setLoading(false);

      if (user) {
        await supabase
          .from("conversation_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("conversation_id", id)
          .eq("user_id", user.id);
        await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", id)
          .neq("sender_id", user.id);
      }
    };
    void load();
  }, [id, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conversation-${id}`, { config: { presence: { key: user.id } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const data = payload as { userId: string; name: string };
        if (data.userId === user.id) return;
        setTyping(data.name);
        setTimeout(() => setTyping(null), 2500);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [id, user]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (mediaRefValue?: string, type?: "image" | "video") => {
    if (!user) return;
    if (!mediaRefValue && !text.trim()) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content: mediaRefValue ? null : text.trim(),
      media_url: mediaRefValue ?? null,
      message_type: type ?? "text",
    });
    if (error) {
      toast.error("تعذّر الإرسال");
      return;
    }
    setText("");
  };

  const upload = async (file: File | undefined) => {
    if (!file || !user) return;
    try {
      const ref = await uploadMedia("messages-media", user.id, file);
      await send(ref, file.type.startsWith("video") ? "video" : "image");
    } catch (e) {
      toast.error("تعذّر رفع الملف: " + (e as Error).message);
    }
  };

  const onTyping = () => {
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user?.id, name: profile?.full_name || profile?.username || "مستخدم" },
    });
  };

  const other = participants.find((p) => p.user_id !== user?.id);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:static md:z-auto md:h-[calc(100vh-8rem)] md:rounded-2xl md:border md:bg-card">
      <header className="flex items-center gap-2 border-b bg-card/95 p-2 backdrop-blur md:gap-3 md:p-3">
        <Link to="/messages" className="md:hidden">
          <Button variant="ghost" size="icon" aria-label="رجوع">
            <ChevronRight className="size-5" />
          </Button>
        </Link>
        <UserAvatar src={other?.avatar_url} name={other?.full_name} className="size-10" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">
            {other?.full_name || other?.username || "محادثة"}
          </p>
          <p className="h-4 truncate text-xs text-primary">{typing ? `${typing} يكتب...` : ""}</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {loading ? (
          <>
            <Skeleton className="h-10 w-40 rounded-2xl" />
            <Skeleton className="ms-auto h-10 w-52 rounded-2xl" />
          </>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            لا توجد رسائل بعد — ابدأ المحادثة الآن
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={mine ? "flex justify-start" : "flex justify-end"}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm sm:max-w-[70%] ${
                    mine
                      ? "rounded-ss-md bg-primary text-primary-foreground"
                      : "rounded-se-md bg-muted"
                  }`}
                >
                  {m.media_url ? (
                    m.message_type === "video" ? (
                      <MediaVideo src={m.media_url} controls className="max-h-64 rounded-xl" />
                    ) : (
                      <MediaImage src={m.media_url} alt="مرفق" className="max-h-64 rounded-xl" />
                    )
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                  {mine ? (
                    <span className="mt-1 block text-[10px] opacity-70">
                      {m.is_read ? "تم القراءة ✓✓" : "تم الإرسال ✓"}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      <div className="flex items-center gap-1.5 border-t bg-card/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:gap-2 md:p-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => fileInput.current?.click()}
          aria-label="إرفاق"
        >
          <ImagePlus className="size-5" />
        </Button>
        <Input
          value={text}
          className="h-11 min-w-0 flex-1 rounded-full bg-muted/60 text-base"
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="اكتب رسالة..."
        />
        <Button size="icon" className="size-11 shrink-0 rounded-full" onClick={() => void send()} aria-label="إرسال">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
