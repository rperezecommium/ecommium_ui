"use client";

import { ImageIcon, Pencil } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ImageChoice = { id: string; src?: string; label: string };

export function ProductVariantImagePicker({ label, currentImage, choices, inherited, isDefault, onAssign, onImageError }: {
  label: string;
  currentImage?: ImageChoice;
  choices: ImageChoice[];
  inherited: boolean;
  isDefault: boolean;
  onAssign: (imageId?: string) => void;
  onImageError: (imageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const alternatives = choices.filter((image) => image.id !== currentImage?.id);

  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const floating = panel.current.getBoundingClientRect();
      const right = anchor.right + 8;
      const left = right + floating.width <= window.innerWidth - 8 ? right : anchor.left - floating.width - 8;
      panel.current.style.left = `${Math.max(8, Math.min(left, window.innerWidth - floating.width - 8))}px`;
      panel.current.style.top = `${Math.max(8, Math.min(anchor.top, window.innerHeight - floating.height - 8))}px`;
      panel.current.style.visibility = "visible";
    }
    position();
    (panel.current?.querySelector<HTMLButtonElement>("[data-image-choice]") ?? panel.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    const observer = new ResizeObserver(position);
    if (panel.current) observer.observe(panel.current);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(event: Event) {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      } else if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && panel.current?.contains(document.activeElement)) {
        const buttons = Array.from(panel.current.querySelectorAll<HTMLButtonElement>("button"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
        event.preventDefault();
        buttons[next]?.focus();
      }
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [open]);

  function assign(imageId?: string) {
    onAssign(imageId);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <>
      <button ref={trigger} type="button" aria-label={`Asignar imagen a ${label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((value) => !value)} className={`productTinyThumb productVariantImageTrigger ${inherited ? "productTinyThumbInherited" : ""}`}>
        {currentImage?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentImage.src} alt="" onError={() => onImageError(currentImage.id)} />
        ) : <ImageIcon size={16} aria-hidden="true" />}
        <span className="productVariantImagePencil"><Pencil size={8} aria-hidden="true" /></span>
      </button>
      {open ? createPortal(
        <div ref={panel} id={id} className="productVariantImagePopover" role="dialog" aria-label={`Cambiar imagen de ${label}`}>
            <div className="productVariantImagePopoverGrid">
              {alternatives.map((image) => (
                <button key={image.id} data-image-choice className="productVariantImagePopoverChoice" type="button" title={image.label} aria-label={`Elegir ${image.label}`} onClick={() => assign(image.id)}>
                  {image.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.src} alt="" onError={() => onImageError(image.id)} />
                  ) : <ImageIcon size={12} aria-hidden="true" />}
                </button>
              ))}
                <button data-image-choice className="productVariantImagePopoverChoice" type="button" aria-label={isDefault ? "Sin portada" : "Heredar imagen de variante 0"} title={isDefault ? "Sin portada" : "Heredar imagen de variante 0"} onClick={() => assign()}>
                  <ImageIcon size={24} aria-hidden="true" />
                </button>
            </div>
        </div>, document.body,
      ) : null}
    </>
  );
}
