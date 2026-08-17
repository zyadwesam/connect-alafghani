import { createFileRoute } from "@tanstack/react-router";
import { FollowList } from "@/features/feed/follow-list";

export const Route = createFileRoute("/_authenticated/u/$username/followers")({
  head: ({ params }) => ({
    meta: [
      { title: `متابعو @${params.username} — وصل` },
      { name: "description", content: `قائمة متابعي @${params.username} على منصة وصل.` },
      { property: "og:title", content: `متابعو @${params.username}` },
      { property: "og:description", content: `تعرّف على متابعي @${params.username}.` },
    ],
  }),
  component: () => <FollowList mode="followers" />,
});
