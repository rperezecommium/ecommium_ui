"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { AfterSalesAdminEvidence } from "./after-sales-admin";

type EvidenceImage = {
  privateEvidenceId: string;
  src: string;
};

function evidenceSource(caseId: string, privateEvidenceId: string) {
  return `/admin/postventa/cases/${encodeURIComponent(caseId)}/evidences/${encodeURIComponent(privateEvidenceId)}/content`;
}

export function AfterSalesEvidenceGallery({
  caseId,
  evidences,
  evidenceIds,
  title = "Evidencias del cliente",
  emptyMessage = "El cliente no adjuntó evidencias.",
  variant = "card",
}: {
  caseId: string;
  evidences: AfterSalesAdminEvidence[];
  evidenceIds?: string[];
  title?: string;
  emptyMessage?: string;
  variant?: "card" | "inline";
}) {
  const eligibleEvidences = evidenceIds
    ? evidences.filter((evidence) => evidenceIds.includes(evidence.evidenceId))
    : evidences.filter((evidence) => evidence.visibility !== "INTERNAL");
  const images: EvidenceImage[] = eligibleEvidences
    .filter((evidence) => evidence.evidenceType === "IMAGE" && evidence.privateEvidenceId)
    .map((evidence) => ({
      privateEvidenceId: evidence.privateEvidenceId as string,
      src: evidenceSource(caseId, evidence.privateEvidenceId as string),
    }));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const currentIndex = activeIndex ?? 0;
  const activeImage = activeIndex === null ? null : images[currentIndex];

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") setActiveIndex((current) => current === null ? null : (current + 1) % images.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, images.length]);

  if (!images.length) {
    if (variant === "inline") {
      return null;
    }
    return (
      <section className="adminCard afterSalesCollectionPanel">
        <div className="adminCardHeader"><h3>{title}</h3></div>
        <div className="adminEmptyState">{emptyMessage}</div>
      </section>
    );
  }

  const showPrevious = () => setActiveIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
  const showNext = () => setActiveIndex((current) => current === null ? null : (current + 1) % images.length);

  const gallery = (
    <>
      <div className={variant === "inline" ? "afterSalesEvidenceInlineGrid" : "afterSalesEvidenceGrid"}>
        {images.map((image, index) => (
          <button aria-label={`Abrir evidencia ${index + 1} de ${images.length}`} className="afterSalesEvidenceThumbnail" key={image.privateEvidenceId} onClick={() => setActiveIndex(index)} type="button">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`Evidencia ${index + 1}`} loading="lazy" src={image.src} />
          </button>
        ))}
      </div>
      {activeImage ? (
        <div aria-label="Visor de evidencias" aria-modal="true" className="afterSalesEvidenceLightbox" role="dialog">
          <button aria-label="Cerrar visor" className="afterSalesEvidenceLightboxClose" onClick={() => setActiveIndex(null)} type="button"><X aria-hidden="true" size={24} /></button>
          {images.length > 1 ? <button aria-label="Ver evidencia anterior" className="afterSalesEvidenceLightboxPrevious" onClick={showPrevious} type="button"><ChevronLeft aria-hidden="true" size={32} /></button> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`Evidencia ${currentIndex + 1} de ${images.length}`} className="afterSalesEvidenceLightboxImage" src={activeImage.src} />
          {images.length > 1 ? <button aria-label="Ver evidencia siguiente" className="afterSalesEvidenceLightboxNext" onClick={showNext} type="button"><ChevronRight aria-hidden="true" size={32} /></button> : null}
          <p className="afterSalesEvidenceLightboxCounter">{currentIndex + 1} de {images.length}</p>
        </div>
      ) : null}
    </>
  );

  if (variant === "inline") {
    return <div className="afterSalesEvidenceInline">{gallery}</div>;
  }

  return (
    <section className="adminCard afterSalesCollectionPanel">
      <div className="adminCardHeader"><h3>{title}</h3><span className="adminBadge">{images.length}</span></div>
      {gallery}
    </section>
  );
}
