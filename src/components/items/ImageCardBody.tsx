"use client";

import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { CardContent } from "@/components/ui/card";

interface ImageCardBodyProps {
  src: string;
  alt: string;
  /** The title and its pin mark, rendered on the server. */
  heading: ReactNode;
  /** The relative update time, measured on the server against the page's `now`. */
  time: string;
  description: string | null;
}

type Size = { width: number; height: number };

/**
 * The 16:9 thumbnail and the details under it. A client component because the
 * image's dimensions are stored nowhere: they are read from the loaded image, and
 * a file that fails to load shows a placeholder instead of a broken-image icon.
 */
export function ImageCardBody({ src, alt, heading, time, description }: ImageCardBodyProps) {
  const tc = useTranslations("common");
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState<Size | null>(null);

  // The image is in the server HTML, so it can load or fail before React attaches
  // `onLoad` / `onError`. Read its state once on mount to catch that case.
  useEffect(() => {
    const img = imgRef.current;
    if (!img?.complete) return;
    if (img.naturalWidth > 0) setSize({ width: img.naturalWidth, height: img.naturalHeight });
    else setFailed(true);
  }, []);

  return (
    <>
      <div className="relative aspect-video overflow-hidden bg-muted">
        {failed ? (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-6" aria-label={tc("imageUnavailable")} />
          </span>
        ) : (
          // From the download route, which next/image's optimiser could not reach with the session.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={(e) =>
              setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
            }
            onError={() => setFailed(true)}
            className="size-full object-cover transition-transform duration-300 group-hover/card:scale-105"
          />
        )}
      </div>

      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">{heading}</div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {size ? `${size.width}×${size.height} / ` : null}
            {time}
          </span>
        </div>
        {description ? (
          <p className="truncate text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </>
  );
}
