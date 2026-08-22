import { supabase } from "@/integrations/supabase/client";

/** يعيد معرّف محادثة فردية بين مستخدمين، وينشئها إذا لم توجد. */
export async function startConversation(meId: string, otherId: string): Promise<string> {
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations!inner(is_group)")
    .eq("user_id", meId);

  const candidateIds = (mine ?? [])
    .filter((row) => !(row.conversations as unknown as { is_group: boolean }).is_group)
    .map((row) => row.conversation_id);

  if (candidateIds.length > 0) {
    const { data: matches } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherId)
      .in("conversation_id", candidateIds);
    const found = matches?.[0]?.conversation_id;
    if (found) return found;
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({ is_group: false, created_by: meId })
    .select("id")
    .single();
  if (error) throw error;

  const { error: partsError } = await supabase.from("conversation_participants").insert([
    { conversation_id: conversation.id, user_id: meId },
    { conversation_id: conversation.id, user_id: otherId },
  ]);
  if (partsError) throw partsError;

  return conversation.id;
}
