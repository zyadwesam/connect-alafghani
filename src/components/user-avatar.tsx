import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null | undefined;
  name?: string | null | undefined;
  className?: string | undefined;
};

export function UserAvatar({ src, name, className }: Props) {
  const url = useSignedUrl(src);
  const initials = (name ?? "؟").trim().slice(0, 2);

  return (
    <Avatar className={cn("size-10", className)}>
      {url ? <AvatarImage src={url} alt={name ?? "صورة المستخدم"} /> : null}
      <AvatarFallback className="bg-accent text-accent-foreground text-sm font-bold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
