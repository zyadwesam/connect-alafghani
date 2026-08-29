ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.tg_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m text;
  target uuid;
BEGIN
  FOR m IN
    SELECT DISTINCT lower(substring(x[1] from 2))
    FROM regexp_matches(NEW.content, '@([A-Za-z0-9_\u0600-\u06FF]+)', 'g') AS x
  LOOP
    SELECT p.user_id INTO target FROM public.profiles p WHERE lower(p.username) = m LIMIT 1;
    IF target IS NOT NULL AND target <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, actor_id, target_type, target_id)
      VALUES (target, 'mention', NEW.user_id, 'post', NEW.post_id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_mentions ON public.comments;
CREATE TRIGGER trg_comment_mentions
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.tg_comment_mentions();