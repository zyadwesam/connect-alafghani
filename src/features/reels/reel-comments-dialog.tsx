import { useEffect, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { timeAgo } from "@/lib/format";
import type { Profile } from "@/lib/types";

type ReelComment = {
  id: string;
  reel_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export function ReelCommentsDialog({
  reelId,
  open,
  onOpenChange,
  onChanged,
}: {
  reelId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReelComment[]>([]);
  const [authors, setAuthors] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reel_comments")
      .select("*")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true });
    const list = (data as ReelComment[]) ?? [];
    setRows(list);
    const ids = Array.from(new Set(list.map((c) => c.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", ids);
      const map: Record<string, Profile> = {};
      for (const p of (profs as Profile[]) ?? []) map[p.user_id] = p;
      setAuthors(map);
    } else {
      setAuthors({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reelId]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("reel_comments")
      .insert({ reel_id: reelId, user_id: user.id, content: text.trim() });
    setBusy(false);
    if (error) {
      toast.error("تعذّر إضافة التعليق");
      return;
    }
    setText("");
    onChanged?.();
    void load();
  };

  const remove = async (id: string) => {
    await supabase.from("reel_comments").delete().eq("id", id);
    onChanged?.();
    void load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>التعليقات</DialogTitle>
        </DialogHeader>

        <div className="min-h-24 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد تعليقات بعد</p>
          ) : (
            rows.map((c) => {
              const p = authors[c.user_id];
              return (
                <div key={c.id} className="mt-3 flex gap-2">
                  <UserAvatar src={p?.avatar_url} name={p?.full_name} className="size-8" />
                  <div className="flex-1">
                    <div className="rounded-2xl bg-muted px-3 py-2">
                      <p className="text-xs font-bold">{p?.full_name || p?.username || "مستخدم"}</p>
                      <p className="text-sm">{c.content}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{timeAgo(c.created_at)}</span>
                      {c.user_id === user?.id ? (
                        <button onClick={() => void remove(c.id)} className="text-destructive">
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب تعليقًا..."
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
          />
          <Button size="icon" disabled={busy} onClick={() => void send()} aria-label="إرسال">
            <Send className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
