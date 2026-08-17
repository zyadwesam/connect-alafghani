import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flag, Heart, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { MediaImage, MediaVideo } from "@/components/media-image";
import { CommentsDialog } from "@/features/feed/comments-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCount, timeAgo } from "@/lib/format";
import type { PostWithAuthor } from "@/lib/types";

export function PostCard({
  post,
  onChanged,
}: {
  post: PostWithAuthor;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [likes, setLikes] = useState(post.likes_count);
  const [openComments, setOpenComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const mine = post.user_id === user?.id;

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikes((n) => Math.max(n - 1, 0));
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikes((n) => n + 1);
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
    }
  };

  const share = async () => {
    if (!user) return;
    await supabase.from("shares").insert({ post_id: post.id, user_id: user.id });
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/feed#post-${post.id}`);
    } catch {
      /* تجاهل */
    }
    toast.success("تمت المشاركة ونسخ الرابط");
    onChanged();
  };

  const remove = async () => {
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    toast.success("تم حذف المنشور");
    onChanged();
  };

  const saveEdit = async () => {
    const { error } = await supabase.from("posts").update({ content: draft }).eq("id", post.id);
    if (error) {
      toast.error("تعذّر التعديل");
      return;
    }
    setEditing(false);
    toast.success("تم تحديث المنشور");
    onChanged();
  };

  const report = async () => {
    if (!user) return;
    await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "post",
      target_id: post.id,
      reason: "محتوى غير لائق",
    });
    toast.success("تم إرسال البلاغ");
  };

  const renderContent = (text: string) =>
    text.split(/(\s+)/).map((part, i) =>
      part.startsWith("#") && part.length > 1 ? (
        <Link
          key={i}
          to="/tag/$tag"
          params={{ tag: part.slice(1).toLowerCase() }}
          className="text-primary hover:underline"
        >
          {part}
        </Link>
      ) : (
        <span key={i}>{part}</span>
      ),
    );

  return (
    <article id={`post-${post.id}`} className="rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex items-center gap-3">
        <Link to="/u/$username" params={{ username: post.profiles?.username ?? "" }}>
          <UserAvatar src={post.profiles?.avatar_url} name={post.profiles?.full_name} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/u/$username"
            params={{ username: post.profiles?.username ?? "" }}
            className="block truncate text-sm font-bold hover:underline"
          >
            {post.profiles?.full_name || post.profiles?.username}
          </Link>
          <p className="text-xs text-muted-foreground">
            @{post.profiles?.username} · {timeAgo(post.created_at)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="خيارات">
              <MoreHorizontal className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {mine ? (
              <>
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> تعديل
                </DropdownMenuItem>
                <DropdownMenuItem onClick={remove} className="text-destructive">
                  <Trash2 className="size-4" /> حذف
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={report}>
                <Flag className="size-4" /> إبلاغ
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit}>
              حفظ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      ) : post.content ? (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
          {renderContent(post.content)}
        </p>
      ) : null}

      {post.media_urls.length > 0 ? (
        <div
          className={
            post.media_urls.length > 1
              ? "mt-3 grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl"
              : "mt-3 overflow-hidden rounded-xl"
          }
        >
          {post.media_urls.map((m) =>
            post.media_type === "video" ? (
              <MediaVideo key={m} src={m} controls className="max-h-[520px] w-full bg-black" />
            ) : (
              <MediaImage
                key={m}
                src={m}
                alt="وسائط المنشور"
                className="max-h-[520px] w-full object-cover"
              />
            ),
          )}
        </div>
      ) : null}

      <footer className="mt-3 flex items-center gap-1 border-t pt-2 text-sm">
        <Button variant="ghost" size="sm" onClick={toggleLike}>
          <Heart className={liked ? "size-4 fill-[var(--like)] text-[var(--like)]" : "size-4"} />
          {formatCount(likes)}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpenComments(true)}>
          <MessageCircle className="size-4" />
          {formatCount(post.comments_count)}
        </Button>
        <Button variant="ghost" size="sm" onClick={share}>
          <Share2 className="size-4" />
          {formatCount(post.shares_count)}
        </Button>
      </footer>

      <CommentsDialog
        postId={post.id}
        open={openComments}
        onOpenChange={setOpenComments}
        onChanged={onChanged}
      />
    </article>
  );
}
