# Nawras Connect

ابنِ لي منصة تواصل اجتماعي شاملة (زي فيسبوك/تويتر) باستخدام:
- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth + Database + Storage + Realtime + Row Level Security)
- React Router للتنقل
- اللغة: عربي بالكامل مع دعم RTL كامل (dir="rtl"، خط عربي مثل Cairo أو Tajawal من Google Fonts)

## نظرة عامة
منصة تواصل اجتماعي عامة يقدر فيها المستخدمين ينشروا بوستات (نص/صور/فيديو)، يتابعوا بعض، يتفاعلوا (لايك/كومنت/مشاركة)، ينشروا ستوريز، يتراسلوا لحظيًا، وينشروا فيديوهات قصيرة (Reels)، مع نظام إشعارات لحظي بالكامل.

## قاعدة البيانات (Supabase Schema)
أنشئ الجداول التالية مع RLS policies دقيقة (كل مستخدم يقدر يشوف/يعدّل بياناته فقط، والمحتوى العام مرئي للجميع إلا لو كان الحساب خاص):

- `profiles` (id, user_id, username [unique], full_name, avatar_url, cover_url, bio, is_private, is_verified, followers_count, following_count, posts_count, created_at)
- `follows` (id, follower_id, following_id, status [accepted/pending إذا كان الحساب خاص], created_at)
- `posts` (id, user_id, content, media_urls[], media_type [image/video/none], visibility [public/followers/private], likes_count, comments_count, shares_count, created_at)
- `post_likes` (id, post_id, user_id, created_at)
- `comments` (id, post_id, user_id, parent_comment_id [للردود], content, likes_count, created_at)
- `comment_likes` (id, comment_id, user_id, created_at)
- `shares` (id, post_id, user_id, created_at)
- `stories` (id, user_id, media_url, media_type [image/video], caption, expires_at [24 ساعة من الإنشاء], views_count, created_at)
- `story_views` (id, story_id, viewer_id, viewed_at)
- `reels` (id, user_id, video_url, thumbnail_url, caption, audio_name, likes_count, comments_count, shares_count, views_count, created_at)
- `reel_likes` (id, reel_id, user_id, created_at)
- `reel_comments` (id, reel_id, user_id, content, created_at)
- `conversations` (id, is_group, group_name, group_avatar_url, created_at)
- `conversation_participants` (id, conversation_id, user_id, joined_at, last_read_at)
- `messages` (id, conversation_id, sender_id, content, media_url, message_type [text/image/video], is_read, created_at)
- `notifications` (id, user_id, type [like/comment/follow/mention/message/follow_request], actor_id, target_type, target_id, is_read, created_at)
- `blocks` (id, blocker_id, blocked_id, created_at)
- `reports` (id, reporter_id, target_type [post/comment/user/reel], target_id, reason, status, created_at)
- `hashtags` (id, tag, posts_count)
- `post_hashtags` (id, post_id, hashtag_id)

## المميزات المطلوبة بالتفصيل

### 1. نظام المصادقة والبروفايل
- تسجيل دخول/حساب عبر Supabase Auth (Email + Password)، مع اختيار username فريد عند التسجيل
- صفحة بروفايل: صورة شخصية، صورة غلاف، نبذة، عدد المتابعين/المتابَعين/البوستات
- تعديل البروفايل (صورة، بيانات، الخصوصية: حساب عام/خاص)
- تبويبات في البروفايل: البوستات، الريلز، الوسائط، الإعجابات

### 2. الفيد الرئيسي (News Feed)
- عرض بوستات المستخدمين اللي بتتابعهم بترتيب زمني أو خوارزمية بسيطة (الأحدث + الأكثر تفاعلًا)
- إنشاء بوست: نص + صور متعددة أو فيديو + اختيار مستوى الخصوصية (عام/متابعين/خاص)
- استخراج الهاشتاجات (#) تلقائيًا من النص وربطها بجدول hashtags
- لايك/كومنت (مع ردود متداخلة nested replies)/مشاركة على كل بوست
- زرار حذف/تعديل للبوست الخاص بالمستخدم نفسه فقط
- Infinite scroll لتحميل البوستات

### 3. الستوريز (Stories)
- شريط أفقي أعلى الفيد يعرض ستوريز المستخدمين المتابَعين (دائرة صورة مع تحديد ملوّن لو فيه ستوري لم تُشاهد)
- عارض ستوريز full-screen بعداد تلقائي (auto-advance) بين الستوريز، مع شريط تقدم لكل ستوري
- الستوريز تختفي تلقائيًا بعد 24 ساعة (فلترة عبر expires_at)
- تتبع من شاهد الستوري (Story Views) - يظهر لصاحب الستوري فقط
- إمكانية الرد على الستوري (يفتح شات مباشر)

### 4. الفيديوهات القصيرة (Reels)
- صفحة عرض عمودي (Vertical scroll) بملء الشاشة، فيديو واحد في كل مرة، مع autoplay عند الظهور في الشاشة
- أزرار جانبية: لايك، كومنت، مشاركة، متابعة صاحب الفيديو
- رفع ريلز جديد: فيديو + وصف + اسم الصوت (اختياري)
- عداد المشاهدات (views_count) يزيد تلقائيًا عند التشغيل

### 5. الشات المباشر (Real-time Messaging)
- استخدم Supabase Realtime (channels) للرسائل الفورية بدون تحديث الصفحة
- محادثات فردية وجماعية (Group chats)
- إرسال نص، صور، فيديوهات قصيرة
- مؤشر "قيد الكتابة..." (typing indicator) عبر Presence
- علامة "تم القراءة" (read receipts)
- قائمة المحادثات مرتبة بآخر رسالة، مع عداد الرسائل غير المقروءة

### 6. نظام المتابعة والبحث
- زر متابعة/إلغاء متابعة، مع نظام "طلب متابعة" للحسابات الخاصة (يحتاج موافقة)
- صفحة بحث: بحث عن مستخدمين (بالاسم أو الـ username) وهاشتاجات
- صفحة "اقتراحات للمتابعة" (مستخدمين لم يتابعهم بعد)
- صفحة المتابعين/المتابَعين لكل بروفايل

### 7. الإشعارات اللحظية (Realtime Notifications)
- استخدم Supabase Realtime لتحديث الإشعارات فوريًا بدون refresh
- أنواع الإشعارات: لايك، كومنت، متابعة جديدة، طلب متابعة، منشن (@username)، رسالة جديدة
- جرس إشعارات في الـ Navbar مع عداد غير مقروء، وقائمة منسدلة تعرض آخر الإشعارات
- صفحة إشعارات كاملة مع تصنيف (الكل / غير مقروء)

### 8. الإعدادات والخصوصية
- تغيير كلمة المرور، الخصوصية (عام/خاص)، حظر مستخدمين (Blocks)
- إدارة من يقدر يعلق على بوستاتك (الجميع/المتابعين فقط)
- الإبلاغ عن بوست/تعليق/مستخدم (Reports) - يظهر لوحة أدمن بسيطة لمراجعتها
- حذف الحساب

### 9. لوحة تحكم إدارية (Admin) بسيطة
- إحصائيات عامة: عدد المستخدمين، البوستات، النشاط اليومي
- مراجعة البلاغات (Reports) واتخاذ إجراء (حذف محتوى/تعطيل حساب)
- إدارة المستخدمين (تعطيل/تفعيل/حذف حساب)

### 10. تصميم عام
- تصميم عصري يشبه منصات التواصل المعروفة، ألوان جذابة (اقترح لوحة ألوان - مثلاً أزرق أساسي مع تمييز لوني للتفاعلات)
- Responsive بالكامل، مع تجربة موبايل ممتازة (bottom navigation bar للموبايل زي التطبيقات الحقيقية)
- Dark mode toggle
- Skeleton loading لكل قائمة (فيد، ستوريز، ريلز، رسائل)
- Toast notifications للأفعال (تم النشر، تم الحذف، إلخ)
- Empty states مصممة (لا يوجد بوستات، لا يوجد رسائل، إلخ)

## ملاحظات تقنية مهمة
- فعّل Row Level Security على كل جدول، مع سياسات تحترم الخصوصية (is_private) والحظر (blocks)
- استخدم Supabase Storage buckets منفصلة: avatars (public)، covers (public)، posts-media (public مع RLS للحذف/التعديل)، stories-media (public، تُنظّف تلقائيًا بعد 24 ساعة عبر scheduled function أو تُفلتر فقط بالعرض)، reels-media (public)، messages-media (private حسب أعضاء المحادثة)
- استخدم Supabase Realtime channels لـ: الرسائل، الإشعارات، مؤشر الكتابة، تحديث اللايكات اللحظي
- استخدم React Context أو Zustand لإدارة حالة المستخدم الحالي والإشعارات غير المقروءة
- نظّم الكود: /components, /pages, /hooks, /lib, /types, /features (اختياري لتقسيم حسب الميزة: feed, stories, reels, chat, notifications)
- اكتب TypeScript types/interfaces لكل جداول قاعدة البيانات
- ابدأ بإنشاء قاعدة البيانات والـ RLS policies أولاً، بعدين الأساسيات (Auth + Profile + Feed)، بعدين الميزات المتقدمة (Stories + Reels + Chat + Realtime Notifications)

ابدأ بإنشاء هيكل المشروع وقاعدة البيانات أولاً، ثم اعرض عليّ الخطة قبل البدء في بناء كل الصفحات.
استخدم داتا بيز خاصه بيك

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://connect-alafghani.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1e4338b7-6a13-4b53-8b48-47226a68438a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
