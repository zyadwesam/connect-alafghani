import type { Database } from "@/integrations/supabase/types";

export type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type Post = Tables["posts"]["Row"];
export type Comment = Tables["comments"]["Row"];
export type Story = Tables["stories"]["Row"];
export type Reel = Tables["reels"]["Row"];
export type Conversation = Tables["conversations"]["Row"];
export type Participant = Tables["conversation_participants"]["Row"];
export type Message = Tables["messages"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type Report = Tables["reports"]["Row"];
export type Follow = Tables["follows"]["Row"];
export type Hashtag = Tables["hashtags"]["Row"];

export type PostWithAuthor = Post & {
  profiles: Profile | null;
  liked?: boolean;
};

export type ReelWithAuthor = Reel & { profiles: Profile | null; liked?: boolean };
export type CommentWithAuthor = Comment & { profiles: Profile | null };
export type StoryWithAuthor = Story & { profiles: Profile | null };
export type NotificationWithActor = Notification & { actor: Profile | null };
