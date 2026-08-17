import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Film, MessageCircle, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "وصل — منصة تواصل اجتماعي عربية بالكامل" },
      {
        name: "description",
        content:
          "انضم إلى وصل: منشورات وستوريز وريلز ورسائل فورية بواجهة عربية أنيقة تدعم RTL بالكامل.",
      },
      { property: "og:title", content: "وصل — منصة تواصل اجتماعي عربية" },
      {
        property: "og:description",
        content: "شارك لحظاتك، تابع أصدقاءك، وتراسل معهم لحظيًا على منصة وصل.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/feed", replace: true });
  }, [loading, session, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <span className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-accent-foreground">
          منصة عربية بالكامل
        </span>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
          وصل — مكانك للتواصل ومشاركة اللحظات
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          منشورات، ستوريز تختفي بعد ٢٤ ساعة، ريلز عمودية، رسائل فورية وإشعارات لحظية — كل ذلك
          بواجهة عربية أنيقة.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">ابدأ الآن مجانًا</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ mode: "login" }}>
              تسجيل الدخول
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Sparkles, title: "ستوريز", text: "شارك يومك وتابع من شاهده" },
            { icon: Film, title: "ريلز", text: "فيديوهات قصيرة بتمرير عمودي" },
            { icon: MessageCircle, title: "رسائل فورية", text: "محادثات فردية وجماعية لحظية" },
            { icon: Users, title: "متابعات", text: "حسابات عامة وخاصة بطلبات متابعة" },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5 text-start shadow-sm">
              <f.icon className="mb-3 size-6 text-primary" />
              <h2 className="font-bold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
