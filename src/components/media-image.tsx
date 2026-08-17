import { useSignedUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";

export function MediaImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string | undefined;
}) {
  const url = useSignedUrl(src);
  if (!url) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}

export function MediaVideo({
  src,
  className,
  ...rest
}: {
  src: string | null | undefined;
  className?: string | undefined;
} & React.VideoHTMLAttributes<HTMLVideoElement>) {
  const url = useSignedUrl(src);
  if (!url) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <video src={url} className={className} {...rest} />;
}
