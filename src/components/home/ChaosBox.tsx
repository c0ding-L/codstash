"use client";

import { Bookmark, FileText, Globe, SquareTerminal } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { GitHubIcon, NotionIcon, SlackIcon, VSCodeIcon } from "./BrandIcons";

const SIZE = 52;
const MAX_SPEED = 0.9;
const REPEL_RADIUS = 110;

const lucideClass = "size-6 text-neutral-300";

/** Starting positions as fractions of the box, so server and client render the same HTML. */
const icons: { key: string; icon: ReactNode; x: number; y: number; rotate: number }[] = [
  { key: "notion", icon: <NotionIcon />, x: 0.08, y: 0.12, rotate: -12 },
  { key: "github", icon: <GitHubIcon />, x: 0.62, y: 0.05, rotate: 8 },
  { key: "slack", icon: <SlackIcon />, x: 0.84, y: 0.3, rotate: -10 },
  { key: "vscode", icon: <VSCodeIcon />, x: 0.3, y: 0.32, rotate: 14 },
  { key: "browser", icon: <Globe className={lucideClass} aria-hidden />, x: 0.38, y: 0.6, rotate: -6 },
  { key: "terminal", icon: <SquareTerminal className={lucideClass} aria-hidden />, x: 0.6, y: 0.76, rotate: 16 },
  { key: "file", icon: <FileText className={lucideClass} aria-hidden />, x: 0.2, y: 0.74, rotate: -18 },
  { key: "bookmark", icon: <Bookmark className={lucideClass} aria-hidden />, x: 0.82, y: 0.68, rotate: 22 },
];

type Body = { x: number; y: number; vx: number; vy: number; rotate: number; spin: number; phase: number };

/**
 * Where developer knowledge lives today: eight icons drifting around a box,
 * bouncing off its walls and moving away from the cursor. Positions are written
 * straight to the DOM each frame, so the animation never re-renders React.
 */
export function ChaosBox() {
  const boxRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let width = box.clientWidth;
    let height = box.clientHeight;
    const pointer = { x: 0, y: 0, active: false };

    const bodies: Body[] = icons.map((icon, index) => {
      const angle = index * 2.4;
      return {
        x: icon.x * (width - SIZE),
        y: icon.y * (height - SIZE),
        vx: Math.cos(angle) * 0.5,
        vy: Math.sin(angle) * 0.5,
        rotate: icon.rotate,
        spin: index % 2 ? 0.12 : -0.12,
        phase: index,
      };
    });

    // From here on `transform` carries the position; the server's left/top would add to it.
    iconRefs.current.forEach((element) => {
      if (!element) return;
      element.style.left = "0";
      element.style.top = "0";
    });

    const resize = new ResizeObserver(() => {
      width = box.clientWidth;
      height = box.clientHeight;
    });
    resize.observe(box);

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = box.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerleave", onLeave);

    let frame = 0;
    const tick = (time: number) => {
      bodies.forEach((body, index) => {
        if (pointer.active) {
          const dx = body.x + SIZE / 2 - pointer.x;
          const dy = body.y + SIZE / 2 - pointer.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < REPEL_RADIUS) {
            const push = (1 - distance / REPEL_RADIUS) * 0.6;
            body.vx += (dx / distance) * push;
            body.vy += (dy / distance) * push;
          }
        }

        // Bleed off the cursor's push, but never below a gentle drift.
        const speed = Math.hypot(body.vx, body.vy);
        if (speed > MAX_SPEED) {
          body.vx *= 0.94;
          body.vy *= 0.94;
        } else if (speed < 0.3) {
          body.vx *= 1.02;
          body.vy *= 1.02;
        }

        body.x += body.vx;
        body.y += body.vy;
        if (body.x < 0 || body.x > width - SIZE) {
          body.vx *= -1;
          body.x = Math.min(Math.max(body.x, 0), width - SIZE);
        }
        if (body.y < 0 || body.y > height - SIZE) {
          body.vy *= -1;
          body.y = Math.min(Math.max(body.y, 0), height - SIZE);
        }

        body.rotate += body.spin;
        const scale = 1 + Math.sin(time / 900 + body.phase) * 0.06;
        const element = iconRefs.current[index];
        if (element) {
          element.style.transform = `translate(${body.x}px, ${body.y}px) rotate(${body.rotate}deg) scale(${scale})`;
        }
      });
      frame = requestAnimationFrame(tick);
    };

    // Run the loop only while the box is on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = entry.isIntersecting ? requestAnimationFrame(tick) : 0;
    });
    visibility.observe(box);

    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      resize.disconnect();
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Your knowledge today...</p>
      <div
        ref={boxRef}
        role="img"
        aria-label="Notion, GitHub, Slack, VS Code, browser tabs, a terminal, a text file and bookmarks"
        className="relative h-[340px] overflow-hidden rounded-xl border border-dashed border-border bg-card/40"
      >
        {icons.map((icon, index) => (
          <div
            key={icon.key}
            ref={(element) => {
              iconRefs.current[index] = element;
            }}
            className="absolute top-0 left-0 grid size-[52px] place-items-center rounded-xl border border-border bg-neutral-900 shadow-lg shadow-black/40 will-change-transform"
            style={{
              left: `calc(${icon.x * 100}% - ${icon.x * SIZE}px)`,
              top: `calc(${icon.y * 100}% - ${icon.y * SIZE}px)`,
              transform: `rotate(${icon.rotate}deg)`,
            }}
          >
            {icon.icon}
          </div>
        ))}
      </div>
    </div>
  );
}
