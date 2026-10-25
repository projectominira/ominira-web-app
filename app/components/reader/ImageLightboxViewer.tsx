"use client";

import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import type { LightboxImage } from "./ImageLightbox";

export default function ImageLightboxViewer({
  images,
  index,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
}) {
  const single = images.length === 1;
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={images}
      plugins={[Counter]}
      className="om-lightbox"
      carousel={{ finite: single, padding: 24 }}
      controller={{ closeOnBackdropClick: true }}
      render={single ? { buttonPrev: () => null, buttonNext: () => null } : undefined}
      counter={{ container: { style: { top: 0, bottom: "unset" } } }}
    />
  );
}
