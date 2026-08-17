import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

type State = "none" | "pending" | "following";

export function FollowButton({
  targetId,
  isPrivate,
  onChanged,
}: {
  targetId: string;
  isPrivate: boolean;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<State>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetId) return;
    void supabase
      .from("follows")
      .select("status")
      .eq("follower_id", user.id)
      .eq("following_id", targetId)
      .maybeSingle()
      .then(({ data }) => {
        setState(data ? (data.status === "pending" ? "pending" : "following") : "none");
      });
  }, [user, targetId]);

  if (!user || user.id === targetId) return null;

  const toggle = async () => {
    setBusy(true);
    if (state === "none") {
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: targetId,
        status: isPrivate ? "pending" : "accepted",
      });
      if (error) toast.error("تعذّرت المتابعة");
      else setState(isPrivate ? "pending" : "following");
    } else {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);
      if (error) toast.error("تعذّر إلغاء المتابعة");
      else setState("none");
    }
    setBusy(false);
    onChanged?.();
  };

  return (
    <Button
      size="sm"
      variant={state === "following" ? "outline" : state === "pending" ? "secondary" : "default"}
      disabled={busy}
      onClick={toggle}
    >
      {state === "following" ? "إلغاء المتابعة" : state === "pending" ? "بانتظار الموافقة" : "متابعة"}
    </Button>
  );
}
