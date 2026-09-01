import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Profile } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — وصل" },
      { name: "description", content: "تحكم في خصوصيتك، كلمة المرور، والحسابات المحظورة." },
      { property: "og:title", content: "الإعدادات — وصل" },
      { property: "og:description", content: "إعدادات الحساب والخصوصية على وصل." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [blocked, setBlocked] = useState<Profile[]>([]);

  const loadBlocked = async () => {
    if (!user) return;
    const { data } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
    const ids = (data ?? []).map((b) => b.blocked_id);
    if (ids.length === 0) {
      setBlocked([]);
      return;
    }
    const { data: profs } = await supabase.from("profiles").select("*").in("user_id", ids);
    setBlocked(profs ?? []);
  };

  useEffect(() => {
    void loadBlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const changePassword = async () => {
    if (password.length < 6) {
      toast.error("كلمة المرور يجب ألا تقل عن ٦ أحرف");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("تعذّر التغيير: " + error.message);
      return;
    }
    setPassword("");
    toast.success("تم تغيير كلمة المرور");
  };

  const setPrivacy = async (isPrivate: boolean) => {
    if (!user) return;
    await supabase.from("profiles").update({ is_private: isPrivate }).eq("user_id", user.id);
    await refreshProfile();
    toast.success("تم تحديث الخصوصية");
  };

  const setCommentPolicy = async (value: "everyone" | "followers") => {
    if (!user) return;
    await supabase.from("profiles").update({ comment_policy: value }).eq("user_id", user.id);
    await refreshProfile();
    toast.success("تم تحديث إعدادات التعليقات");
  };

  const unblock = async (id: string) => {
    if (!user) return;
    await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    toast.success("تم إلغاء الحظر");
    void loadBlocked();
  };

  const deleteAccount = async () => {
    if (!user) return;
    if (!window.confirm("سيتم حذف كل بياناتك نهائيًا. هل أنت متأكد؟")) return;
    await supabase.from("profiles").delete().eq("user_id", user.id);
    await supabase.auth.signOut();
    toast.success("تم حذف بيانات حسابك");
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">الإعدادات</h1>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">الخصوصية</h2>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="priv" className="text-sm leading-snug">حساب خاص (يحتاج موافقة على طلبات المتابعة)</Label>
          <Switch id="priv" className="shrink-0" checked={profile?.is_private ?? false} onCheckedChange={setPrivacy} />
        </div>
        <div className="space-y-1.5">
          <Label>من يمكنه التعليق على منشوراتك</Label>
          <Select
            value={profile?.comment_policy ?? "everyone"}
            onValueChange={(v) => setCommentPolicy(v as "everyone" | "followers")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">الجميع</SelectItem>
              <SelectItem value="followers">المتابعون فقط</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">تغيير كلمة المرور</h2>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة مرور جديدة"
        />
        <Button onClick={changePassword}>تحديث كلمة المرور</Button>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">الحسابات المحظورة</h2>
        {blocked.length === 0 ? (
          <EmptyState icon={UserX} title="لا توجد حسابات محظورة" />
        ) : (
          blocked.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border p-3">
              <UserAvatar src={p.avatar_url} name={p.full_name} className="size-10" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">@{p.username}</span>
              <Button size="sm" variant="outline" onClick={() => unblock(p.user_id)}>
                إلغاء الحظر
              </Button>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-destructive/40 bg-card p-4">
        <h2 className="font-bold text-destructive">حذف الحساب</h2>
        <p className="text-sm text-muted-foreground">
          سيؤدي هذا إلى حذف ملفك الشخصي ومنشوراتك ورسائلك نهائيًا.
        </p>
        <Button variant="destructive" onClick={deleteAccount}>
          حذف حسابي
        </Button>
      </section>
    </div>
  );
}
