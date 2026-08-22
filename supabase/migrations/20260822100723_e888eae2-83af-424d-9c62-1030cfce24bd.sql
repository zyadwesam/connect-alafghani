DELETE FROM public.posts WHERE content = 'اختبار نشر تلقائي #تجربة';
DELETE FROM public.conversations c WHERE NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id);