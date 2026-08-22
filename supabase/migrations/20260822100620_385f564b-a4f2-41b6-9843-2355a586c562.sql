DROP POLICY IF EXISTS conversations_select ON public.conversations;
CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_participant(id, auth.uid()));