
CREATE POLICY "media_read_authenticated" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('avatars','covers','posts-media','stories-media','reels-media','messages-media'));

CREATE POLICY "media_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('avatars','covers','posts-media','stories-media','reels-media','messages-media')
  AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "media_update_own_folder" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('avatars','covers','posts-media','stories-media','reels-media','messages-media')
  AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "media_delete_own_folder" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('avatars','covers','posts-media','stories-media','reels-media','messages-media')
  AND (storage.foldername(name))[1] = auth.uid()::text);

REVOKE EXECUTE ON FUNCTION public.tg_post_counts(), public.tg_post_likes(), public.tg_comments(),
  public.tg_comment_likes(), public.tg_shares(), public.tg_reel_likes(), public.tg_reel_comments(),
  public.tg_follows(), public.tg_story_views(), public.tg_messages(), public.tg_post_hashtags(),
  public.handle_new_user() FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid,uuid), public.is_following(uuid,uuid),
  public.can_view_user(uuid), public.is_participant(uuid,uuid), public.has_role(uuid, public.app_role) FROM anon;
