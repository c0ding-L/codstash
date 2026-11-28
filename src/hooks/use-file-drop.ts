"use client";

import { useState, type DragEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * Drag-and-drop onto a file zone: whether a drag is over it, and the handlers to spread on it.
 * Dropped files go to `onFiles`, except while `disabled`.
 */
export function useFileDrop({ disabled, onFiles }: { disabled: boolean; onFiles: (files: FileList) => void }) {
  const [dragging, setDragging] = useState(false);

  const dropProps = {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (!disabled) setDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(),
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      // Leaving for one of the zone's own children is not leaving the zone.
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      if (!disabled) onFiles(event.dataTransfer.files);
    },
  };

  return { dragging, dropProps };
}

/** The dashed drop zone's classes, as each state shows it. */
export function dropZoneClassName({ dragging, disabled, invalid = false }: { dragging: boolean; disabled: boolean; invalid?: boolean }) {
  return cn(
    "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center transition-colors",
    "hover:border-ring hover:bg-muted/40 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
    dragging && "border-ring bg-muted/60",
    invalid && "border-destructive/50",
    disabled && "pointer-events-none opacity-50",
  );
}
