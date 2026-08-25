import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function BlockButton({
  targetId,
  onChanged,
}: {
  targetId: string;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetId) return;
    void supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetId)
      .maybeSingle()
      .then(({ data }) => setBlocked(Boolean(data)));
  }, [user, targetId]);

  if (!user || user.id === targetId) return null;

  const toggle = async () => {
    setBusy(true);
    if (blocked) {
      const { error } = await supabase
        .from("blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetId);
      if (error) toast.error("تعذّر إلغاء الحظر");
      else {
        setBlocked(false);
        toast.success("تم إلغاء الحظر");
      }
    } else {
      await supabase
        .from("follows")
        .delete()
        .or(
          `and(follower_id.eq.${user.id},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${user.id})`,
        );
      const { error } = await supabase
        .from("blocks")
        .insert({ blocker_id: user.id, blocked_id: targetId });
      if (error) toast.error("تعذّر الحظر");
      else {
        setBlocked(true);
        toast.success("تم حظر الحساب");
      }
    }
    setBusy(false);
    onChanged?.();
  };

  return (
    <Button size="sm" variant={blocked ? "secondary" : "outline"} disabled={busy} onClick={toggle}>
      <Ban className="size-4" /> {blocked ? "إلغاء الحظر" : "حظر"}
    </Button>
  );
}
