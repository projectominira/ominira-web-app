"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Loaded on the first image click, not with the reader.
const Viewer = dynamic(() => import("./ImageLightboxViewer"), { ssr: false });

export type LightboxImage = { src: string; alt?: string; caption?: string };

/** Full-screen viewer over `images`, opened at `index` (null = closed). */
export function ImageLightbox({
  images,
  index,
  onClose,
}: {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
}) {
  if (index === null || images.length === 0) return null;
  return <Viewer images={images} index={index} onClose={onClose} />;
}

/** Click-to-expand for every `<img>` inside a rendered HTML document
 * (articles, Word files). Prev/next walk all of the document's images. */
export function DocumentImages({ contentEl }: { contentEl: HTMLElement | null }) {
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!contentEl) return;
    const onClick = (e: MouseEvent) => {
      const img = e.target instanceof HTMLImageElement ? e.target : null;
      if (!img || img.closest("a") || !img.currentSrc) return;
      const all = Array.from(contentEl.querySelectorAll("img")).filter((i) => i.currentSrc);
      setImages(all.map((i) => ({ src: i.currentSrc, alt: i.alt })));
      setIndex(all.indexOf(img));
    };
    contentEl.addEventListener("click", onClick);
    return () => contentEl.removeEventListener("click", onClick);
  }, [contentEl]);

  return <ImageLightbox images={images} index={index} onClose={() => setIndex(null)} />;
}
