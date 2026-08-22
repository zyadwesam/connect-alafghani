import { useEffect, useState } from "react";
import { Heart, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { timeAgo } from "@/lib/format";
import type { CommentWithAuthor } from "@/lib/types";

export function CommentsDialog({
  postId,
  open,
  onOpenChange,
  onChanged,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentWithAuthor | null>(null);
  const [likedIds, setLikedIds] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("*, profiles:profiles!comments_user_id_profiles_fkey(*)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments((data as unknown as CommentWithAuthor[]) ?? []);
    if (user) {
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", user.id);
      setLikedIds((likes ?? []).map((l) => l.comment_id));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  const send = async () => {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text.trim(),
      parent_comment_id: replyTo?.id ?? null,
    });
    if (error) {
      toast.error("تعذّر إضافة التعليق: " + error.message);
      return;
    }
    setText("");
    setReplyTo(null);
    onChanged?.();
    void load();
  };

  const toggleLike = async (id: string) => {
    if (!user) return;
    if (likedIds.includes(id)) {
      await supabase.from("comment_likes").delete().eq("comment_id", id).eq("user_id", user.id);
      setLikedIds(likedIds.filter((x) => x !== id));
    } else {
      await supabase.from("comment_likes").insert({ comment_id: id, user_id: user.id });
      setLikedIds([...likedIds, id]);
    }
    void load();
  };

  const remove = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
    onChanged?.();
    void load();
  };

  const roots = comments.filter((c) => !c.parent_comment_id);

  const renderComment = (c: CommentWithAuthor, depth = 0) => (
    <div key={c.id} className={depth ? "ms-10 mt-2" : "mt-3"}>
      <div className="flex gap-2">
        <UserAvatar src={c.profiles?.avatar_url} name={c.profiles?.full_name} className="size-8" />
        <div className="flex-1">
          <div className="rounded-2xl bg-muted px-3 py-2">
            <p className="text-xs font-bold">{c.profiles?.full_name || c.profiles?.username}</p>
            <p className="text-sm">{c.content}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{timeAgo(c.created_at)}</span>
            <button onClick={() => toggleLike(c.id)} className="flex items-center gap-1">
              <Heart
                className={
                  likedIds.includes(c.id) ? "size-3.5 fill-[var(--like)] text-[var(--like)]" : "size-3.5"
                }
              />
              {c.likes_count}
            </button>
            <button onClick={() => setReplyTo(c)}>رد</button>
            {c.user_id === user?.id ? (
              <button onClick={() => remove(c.id)} className="text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {comments.filter((r) => r.parent_comment_id === c.id).map((r) => renderComment(r, depth + 1))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>التعليقات</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : roots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد تعليقات بعد</p>
        ) : (
          <div>{roots.map((c) => renderComment(c))}</div>
        )}

        <div className="sticky bottom-0 bg-background pt-2">
          {replyTo ? (
            <p className="mb-1 text-xs text-muted-foreground">
              ترد على {replyTo.profiles?.username}{" "}
              <button className="text-primary" onClick={() => setReplyTo(null)}>
                إلغاء
              </button>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب تعليقًا..."
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <Button size="icon" onClick={send} aria-label="إرسال">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
