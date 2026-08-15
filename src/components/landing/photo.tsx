"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A real photograph with a graceful gradient fallback. Photos load from
 * Unsplash's public CDN in the visitor's browser; if one ever fails, a soft
 * placeholder shows instead of a broken image.
 */
export function Photo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] bg-panel shadow-md",
        className,
      )}
    >
      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent-soft to-panel text-4xl">
          🥗
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
