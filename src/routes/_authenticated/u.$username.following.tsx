import { createFileRoute } from "@tanstack/react-router";
import { FollowList } from "@/features/feed/follow-list";

export const Route = createFileRoute("/_authenticated/u/$username/following")({
  head: ({ params }) => ({
    meta: [
      { title: `يتابعهم @${params.username} — وصل` },
      { name: "description", content: `الحسابات التي يتابعها @${params.username} على وصل.` },
      { property: "og:title", content: `يتابعهم @${params.username}` },
      { property: "og:description", content: `الحسابات التي يتابعها @${params.username}.` },
    ],
  }),
  component: () => <FollowList mode="following" />,
});
