import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Lock, MessageCircle, Newspaper, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadMedia } from "@/lib/media";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { UserAvatar } from "@/components/user-avatar";
import { MediaImage } from "@/components/media-image";
import { PostCard } from "@/features/feed/post-card";
import { FollowButton } from "@/components/follow-button";
import { EmptyState } from "@/components/empty-state";
import { PostSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { startConversation } from "@/features/chat/chat-api";
import { formatCount } from "@/lib/format";
import type { PostWithAuthor, Profile, ReelWithAuthor } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — وصل` },
      { name: "description", content: `تصفح ملف @${params.username} ومنشوراته وريلزه على وصل.` },
      { property: "og:title", content: `@${params.username} — وصل` },
      { property: "og:description", content: `الملف الشخصي لـ @${params.username}.` },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [reels, setReels] = useState<ReelWithAuthor[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const coverUrl = useSignedUrl(profile?.cover_url);
  const mine = profile?.user_id === user?.id;

  const load = async () => {
    setLoading(true);
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    setProfile(prof ?? null);
    if (prof) {
      const [{ data: postRows }, { data: reelRows }] = await Promise.all([
        supabase
          .from("posts")
          .select("*, profiles:profiles!posts_user_id_profiles_fkey(*)")
          .eq("user_id", prof.user_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("reels")
          .select("*, profiles:profiles!reels_user_id_profiles_fkey(*)")
          .eq("user_id", prof.user_id)
          .order("created_at", { ascending: false }),
      ]);
      setPosts((postRows as unknown as PostWithAuthor[]) ?? []);
      setReels((reelRows as unknown as ReelWithAuthor[]) ?? []);

      if (user && prof.user_id === user.id) {
        const { data: likes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", user.id);
        const ids = (likes ?? []).map((l) => l.post_id);
        if (ids.length) {
          const { data: liked } = await supabase
            .from("posts")
            .select("*, profiles:profiles!posts_user_id_profiles_fkey(*)")
            .in("id", ids)
            .order("created_at", { ascending: false });
          setLikedPosts((liked as unknown as PostWithAuthor[]) ?? []);
        } else {
          setLikedPosts([]);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, user?.id]);

  const message = async () => {
    if (!user || !profile) return;
    try {
      const id = await startConversation(user.id, profile.user_id);
      await navigate({ to: "/messages/$id", params: { id } });
    } catch (e) {
      toast.error("تعذّر فتح المحادثة: " + (e as Error).message);
    }
  };

  if (loading) return <PostSkeleton />;
  if (!profile)
    return <EmptyState icon={Newspaper} title="هذا الحساب غير موجود" />;

  const media = posts.flatMap((p) => (p.media_type === "image" ? p.media_urls : []));

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="h-36 bg-accent">
          {coverUrl ? (
            <img src={coverUrl} alt="صورة الغلاف" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="px-4 pb-4">
          <div className="-mt-10 flex items-end justify-between">
            <UserAvatar
              src={profile.avatar_url}
              name={profile.full_name}
              className="size-20 border-4 border-card"
            />
            <div className="flex gap-2">
              {mine ? (
                <EditProfileDialog
                  profile={profile}
                  onSaved={() => {
                    void load();
                    void refreshProfile();
                  }}
                />
              ) : (
                <>
                  <FollowButton
                    targetId={profile.user_id}
                    isPrivate={profile.is_private}
                    onChanged={load}
                  />
                  <Button size="sm" variant="outline" onClick={message}>
                    <MessageCircle className="size-4" /> مراسلة
                  </Button>
                </>
              )}
            </div>
          </div>

          <h1 className="mt-3 flex items-center gap-1.5 text-lg font-extrabold">
            {profile.full_name || profile.username}
            {profile.is_verified ? <ShieldCheck className="size-4 text-primary" /> : null}
            {profile.is_private ? <Lock className="size-4 text-muted-foreground" /> : null}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio ? <p className="mt-2 text-sm">{profile.bio}</p> : null}

          <div className="mt-3 flex gap-5 text-sm">
            <span>
              <b>{formatCount(profile.posts_count)}</b>{" "}
              <span className="text-muted-foreground">منشور</span>
            </span>
            <Link to="/u/$username/followers" params={{ username: profile.username }}>
              <b>{formatCount(profile.followers_count)}</b>{" "}
              <span className="text-muted-foreground">متابع</span>
            </Link>
            <Link to="/u/$username/following" params={{ username: profile.username }}>
              <b>{formatCount(profile.following_count)}</b>{" "}
              <span className="text-muted-foreground">يتابع</span>
            </Link>
          </div>
        </div>
      </div>

      <Tabs defaultValue="posts">
        <TabsList className={mine ? "grid w-full grid-cols-4" : "grid w-full grid-cols-3"}>
          <TabsTrigger value="posts">المنشورات</TabsTrigger>
          <TabsTrigger value="reels">الريلز</TabsTrigger>
          <TabsTrigger value="media">الوسائط</TabsTrigger>
          {mine ? <TabsTrigger value="likes">الإعجابات</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="posts" className="space-y-4 pt-4">
          {posts.length === 0 ? (
            <EmptyState icon={Newspaper} title="لا توجد منشورات" />
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)
          )}
        </TabsContent>

        <TabsContent value="reels" className="pt-4">
          {reels.length === 0 ? (
            <EmptyState icon={Newspaper} title="لا توجد ريلز" />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {reels.map((r) => (
                <div key={r.id} className="aspect-[9/16] overflow-hidden rounded-xl bg-muted">
                  <MediaImage src={r.thumbnail_url} alt="ريل" className="size-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="media" className="pt-4">
          {media.length === 0 ? (
            <EmptyState icon={Camera} title="لا توجد وسائط" />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                <MediaImage
                  key={m}
                  src={m}
                  alt="وسائط"
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          )}
        </TabsContent>

        {mine ? (
          <TabsContent value="likes" className="space-y-4 pt-4">
            {likedPosts.length === 0 ? (
              <EmptyState icon={Newspaper} title="لم تعجب بأي منشور بعد" />
            ) : (
              likedPosts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function EditProfileDialog({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [isPrivate, setIsPrivate] = useState(profile.is_private);
  const [busy, setBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const patch: {
        full_name: string;
        bio: string;
        is_private: boolean;
        avatar_url?: string;
        cover_url?: string;
      } = {
        full_name: fullName,
        bio,
        is_private: isPrivate,
      };
      if (avatar) patch.avatar_url = await uploadMedia("avatars", user.id, avatar);
      if (cover) patch.cover_url = await uploadMedia("covers", user.id, cover);
      const { error } = await supabase.from("profiles").update(patch).eq("user_id", user.id);
      if (error) throw error;
      toast.success("تم تحديث الملف الشخصي");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error("تعذّر الحفظ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">تعديل الملف</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل الملف الشخصي</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الاسم الكامل</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>النبذة</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الصورة الشخصية</Label>
            <Input
              ref={avatarInput}
              type="file"
              accept="image/*"
              onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>صورة الغلاف</Label>
            <Input
              ref={coverInput}
              type="file"
              accept="image/*"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <Label htmlFor="private">حساب خاص</Label>
            <Switch id="private" checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
