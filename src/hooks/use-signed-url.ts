import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/media";

export function useSignedUrl(ref: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!ref) {
      setUrl(null);
      return;
    }
    getSignedUrl(ref).then((value) => {
      if (active) setUrl(value);
    });
    return () => {
      active = false;
    };
  }, [ref]);

  return url;
}
