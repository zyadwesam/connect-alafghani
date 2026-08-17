import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadMedia } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type Visibility = Database["public"]["Enums"]["post_visibility"];

export function PostComposer({ onCreated }: { onCreated: () => void }) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<"image" | "video" | "none">("none");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [busy, setBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null, type: "image" | "video") => {
    if (!list || list.length === 0) return;
    setFiles(Array.from(list).slice(0, type === "video" ? 1 : 4));
    setKind(type);
  };

  const submit = async () => {
    if (!user) return;
    if (!content.trim() && files.length === 0) {
      toast.error("اكتب شيئًا أو أضف وسائط");
      return;
    }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        urls.push(await uploadMedia("posts-media", user.id, file));
      }
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: content.trim(),
        media_urls: urls,
        media_type: kind,
        visibility,
      });
      if (error) throw error;
      setContent("");
      setFiles([]);
      setKind("none");
      toast.success("تم نشر المنشور");
      onCreated();
    } catch (e) {
      toast.error("تعذّر النشر: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <UserAvatar src={profile?.avatar_url} name={profile?.full_name} />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="بمَ تفكّر؟ استخدم # للهاشتاجات"
          className="min-h-20 resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
        />
      </div>

      {files.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs">
              <span className="max-w-40 truncate">{f.name}</span>
              <button
                onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                aria-label="حذف الملف"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => pick(e.target.files, "image")}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => pick(e.target.files, "video")}
        />
        <Button variant="ghost" size="sm" onClick={() => imageInput.current?.click()}>
          <ImageIcon className="size-4" /> صور
        </Button>
        <Button variant="ghost" size="sm" onClick={() => videoInput.current?.click()}>
          <Video className="size-4" /> فيديو
        </Button>
        <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">عام</SelectItem>
            <SelectItem value="followers">المتابعون</SelectItem>
            <SelectItem value="private">خاص</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} نشر
        </Button>
      </div>
    </div>
  );
}
