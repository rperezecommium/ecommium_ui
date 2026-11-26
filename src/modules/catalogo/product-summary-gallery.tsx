"use client";

import { Trash2 } from "lucide-react";

type GalleryImage = { id: string; src: string; alt: string };

export function ProductSummaryGallery({ images, onImageError, selectedId, onSelect, onRemove }: {
  images: GalleryImage[];
  onImageError: (id: string) => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (!images.length) return <span>Sin imágenes disponibles</span>;

  return (
    <div className="productSummaryGallery" role="region" aria-label="Galería de imágenes del producto" tabIndex={0}>
      {images.map((image) => (
        <div className="productSummaryGalleryThumb" key={image.id}>
          <button className="productSummaryImageSelect" type="button" aria-label={`Editar metadata: ${image.alt}`} aria-pressed={selectedId === image.id} onClick={() => onSelect(image.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.alt} loading="lazy" width={80} height={60} onError={() => onImageError(image.id)} />
          </button>
          <button className="productSummaryImageDelete" type="button" aria-label={`Eliminar del borrador: ${image.alt}`} title="Eliminar del borrador" onClick={() => onRemove(image.id)}>
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
