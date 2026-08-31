import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Film,
  Home,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/feed", label: "الرئيسية", icon: Home },
  { to: "/reels", label: "ريلز", icon: Film },
  { to: "/search", label: "البحث", icon: Search },
  { to: "/messages", label: "الرسائل", icon: MessageCircle },
  { to: "/notifications", label: "الإشعارات", icon: Bell },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnread(count ?? 0);
    };
    void load();

    const channel = supabase
      .channel("notifications-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id);
    };
    ping();
    const timer = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [user]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-40 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-3 sm:gap-2 sm:px-4">
          <Link to="/feed" className="shrink-0 text-xl font-extrabold text-primary">
            وصل
          </Link>
          <div className="min-w-0 flex-1" />
          <Link to="/notifications" className="relative shrink-0">
            <Button variant="ghost" size="icon" aria-label="الإشعارات">
              <Bell className="size-5" />
            </Button>
            {unread > 0 ? (
              <span className="absolute -top-0.5 start-0 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-bold text-destructive-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            <ThemeToggle />
            {isAdmin ? (
              <Link to="/admin">
                <Button variant="ghost" size="icon" aria-label="لوحة الإدارة">
                  <Shield className="size-5" />
                </Button>
              </Link>
            ) : null}
            <Link to="/settings">
              <Button variant="ghost" size="icon" aria-label="الإعدادات">
                <Settings className="size-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" aria-label="تسجيل الخروج" onClick={signOut}>
              <LogOut className="size-5" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="المزيد">
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {profile ? (
                <DropdownMenuItem asChild>
                  <Link to="/u/$username" params={{ username: profile.username }}>
                    <User className="size-4" /> حسابي
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {isAdmin ? (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Shield className="size-4" /> لوحة الإدارة
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="size-4" /> الإعدادات
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="size-4" /> تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {profile ? (
            <Link to="/u/$username" params={{ username: profile.username }} className="shrink-0">
              <UserAvatar
                src={profile.avatar_url}
                name={profile.full_name}
                className="size-8 sm:size-9"
              />
            </Link>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-6 overflow-x-hidden px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 md:pb-8">
        <aside className="sticky top-20 hidden h-fit w-56 shrink-0 md:block">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-accent",
                  pathname.startsWith(item.to) && "bg-accent text-accent-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            ))}
            {profile ? (
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-accent"
              >
                <User className="size-5" />
                حسابي
              </Link>
            ) : null}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-around py-1.5">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-muted-foreground",
                pathname.startsWith(item.to) && "text-primary",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
