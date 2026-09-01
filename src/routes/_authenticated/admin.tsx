import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { RowSkeleton } from "@/components/skeletons";
import { timeAgo } from "@/lib/format";
import type { Profile, Report } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة — وصل" },
      { name: "description", content: "إحصائيات المنصة ومراجعة البلاغات وإدارة المستخدمين." },
      { property: "og:title", content: "لوحة الإدارة — وصل" },
      { property: "og:description", content: "أدوات إدارة منصة وصل." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ users: 0, posts: 0, today: 0 });
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const [{ count: usersCount }, { count: postsCount }, { count: todayCount }] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }).gt("created_at", since),
    ]);
    setStats({ users: usersCount ?? 0, posts: postsCount ?? 0, today: todayCount ?? 0 });

    const { data: reportRows } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setReports(reportRows ?? []);

    const { data: userRows } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setUsers(userRows ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin]);

  if (authLoading) return <RowSkeleton />;
  if (!isAdmin)
    return (
      <EmptyState
        icon={ShieldAlert}
        title="هذه الصفحة للمشرفين فقط"
        description="ليست لديك صلاحية للوصول إلى لوحة الإدارة."
      />
    );

  const resolveReport = async (report: Report, action: "delete" | "dismiss") => {
    if (action === "delete") {
      const table =
        report.target_type === "post"
          ? "posts"
          : report.target_type === "comment"
            ? "comments"
            : report.target_type === "reel"
              ? "reels"
              : null;
      if (table) await supabase.from(table).delete().eq("id", report.target_id);
    }
    await supabase.from("reports").update({ status: "resolved" }).eq("id", report.id);
    toast.success("تمت معالجة البلاغ");
    void load();
  };

  const toggleSuspend = async (p: Profile) => {
    await supabase.from("profiles").update({ is_suspended: !p.is_suspended }).eq("id", p.id);
    toast.success(p.is_suspended ? "تم تفعيل الحساب" : "تم تعطيل الحساب");
    void load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">لوحة الإدارة</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "المستخدمون", value: stats.users },
          { label: "المنشورات", value: stats.posts },
          { label: "منشورات آخر ٢٤ ساعة", value: stats.today },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <p className="text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-bold">البلاغات</h2>
        {loading ? (
          <RowSkeleton />
        ) : reports.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="لا توجد بلاغات" />
        ) : (
          reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <p className="font-bold">
                  {r.target_type} · {r.reason}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(r.created_at)} · الحالة: {r.status}
                </p>
              </div>
              {r.status !== "resolved" ? (
                <>
                  <Button size="sm" variant="destructive" onClick={() => resolveReport(r, "delete")}>
                    حذف المحتوى
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolveReport(r, "dismiss")}>
                    تجاهل
                  </Button>
                </>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">المستخدمون</h2>
        {users.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">
                {p.full_name || p.username} <span className="text-muted-foreground">@{p.username}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {p.posts_count} منشور · {p.followers_count} متابع
                {p.is_suspended ? " · معطّل" : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => toggleSuspend(p)}>
              {p.is_suspended ? "تفعيل" : "تعطيل"}
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
