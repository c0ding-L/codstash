"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";

interface ImageThumbnailProps {
  src: string;
  alt: string;
}

/**
 * A 16:9 thumbnail that zooms with its card on hover. A client leaf only so a
 * file that fails to load shows a placeholder instead of a broken-image icon.
 */
export function ImageThumbnail({ src, alt }: ImageThumbnailProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden bg-muted">
      {failed ? (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-6" aria-label="Image unavailable" />
        </span>
      ) : (
        // From the download route, which next/image's optimiser could not reach with the session.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover transition-transform duration-300 group-hover/card:scale-105"
        />
      )}
    </div>
  );
}
