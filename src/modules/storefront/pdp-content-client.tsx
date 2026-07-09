"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Mail, Minus, Plus, RotateCcw, Search, Share2, ShieldCheck, Truck, X } from "lucide-react";
import { StorefrontAddToCartButton } from "./cart-client";
import type { StorefrontPdpData } from "./pdp";
import { sendStorefrontSearchEvent } from "./search-events-client";

type Props = {
  data: StorefrontPdpData;
};

export function StorefrontPdpContentClient({ data }: Props) {
  const initialVariantId =
    data.variants.find((variant) => variant.isDefault)?.variantId ??
    data.variants[0]?.variantId ??
    null;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(initialVariantId);
  const [quantity, setQuantity] = useState(1);
  const [shareUrl, setShareUrl] = useState(`/pdp/${data.slug}`);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const [zoomLens, setZoomLens] = useState({ active: false, x: 50, y: 50 });
  const selectedVariant = useMemo(
    () =>
      data.variants.find((variant) => variant.variantId === selectedVariantId) ??
      data.variants.find((variant) => variant.isDefault) ??
      data.variants[0],
    [data.variants, selectedVariantId],
  );
  const selectedImages = selectedVariant?.images.length ? selectedVariant.images : data.images;
  const mainImage = selectedImages[0] ?? {
    url: data.imageUrl ?? "",
    alt: data.imageAlt ?? data.title,
  };
  const backHref =
    data.categoryHref ??
    (data.categorySlug
      ? `/plp/${encodeURIComponent(data.categorySlug)}`
      : `/plp/${encodeURIComponent(slugFromCategory(data.category) ?? "bike-drivetrain")}`);
  const reference = selectedVariant?.refId ?? data.refId ?? data.productId ?? data.slug;
  const ean = selectedVariant?.ean ?? data.ean;
  const priceDisplay = selectedVariant?.priceDisplay ?? data.priceDisplay;
  const previousPriceDisplay = selectedVariant?.previousPriceDisplay ?? data.previousPriceDisplay;
  const priceAmountMinor = selectedVariant?.priceAmountMinor ?? data.priceAmountMinor;
  const previousPriceAmountMinor = selectedVariant?.previousPriceAmountMinor ?? data.previousPriceAmountMinor;
  const discountPercent = discountPercentage(previousPriceAmountMinor, priceAmountMinor);
  const available = selectedVariant?.available ?? data.available;
  const availableQuantity = selectedVariant?.availableQuantity ?? data.availableQuantity;
  const selectedVariantImage = selectedVariant?.images[0] ?? mainImage;
  const selectedVariantDetails = selectedVariant?.options.map((option) => `${option.attributeCode}: ${option.valueCode}`).join(", ");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShareUrl(window.location.href));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!zoomModalOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setZoomModalOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [zoomModalOpen]);

  function updateZoomLens(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    setZoomLens({ active: true, x, y });
  }

  async function copyShareUrl() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        copyTextWithFallback(shareUrl);
      }
      setCopiedShareUrl(true);
      window.setTimeout(() => setCopiedShareUrl(false), 1800);
    } catch {
      const copied = copyTextWithFallback(shareUrl);
      setCopiedShareUrl(copied);
      if (copied) {
        window.setTimeout(() => setCopiedShareUrl(false), 1800);
      }
    }
  }

  async function shareProduct() {
    if (!navigator.share) {
      await copyShareUrl();
      return;
    }

    try {
      await navigator.share({
        title: data.title,
        text: richTextToPlainText(data.shortDescription) ?? data.title,
        url: shareUrl,
      });
    } catch {
      // The user can cancel the native share sheet; no UI error is needed.
    }
  }

  function recordAddToCartEvent() {
    sendStorefrontSearchEvent({
      organizationId: data.eventContext.organizationId,
      shopId: data.eventContext.shopId,
      eventType: "add-to-cart",
      visitorId: data.eventContext.visitorId,
      productDetails: [{
        productId: data.productId ?? data.slug,
        variantId: selectedVariant?.variantId ?? null,
        quantity,
      }],
      uri: window.location.href,
      occurredAt: new Date().toISOString(),
    });
  }

  return (
    <>
      <nav className="storefrontBreadcrumb">
        <Link href="/">Inicio</Link>
        <span>/</span>
        <Link href={backHref}>{data.category ?? "Catalogo"}</Link>
        <span>/</span>
        <span>{data.title}</span>
      </nav>
      <section className="storefrontPdpLayout">
        <div className="storefrontPdpGallery">
          <div
            className="storefrontPdpImage"
            onMouseEnter={mainImage.url ? updateZoomLens : undefined}
            onMouseLeave={() => setZoomLens((value) => ({ ...value, active: false }))}
            onMouseMove={mainImage.url ? updateZoomLens : undefined}
          >
            {mainImage.url ? (
              <button aria-label="Ampliar imagen" className="storefrontPdpZoomButton" onClick={() => setZoomModalOpen(true)} type="button">
                <Search aria-hidden="true" size={18} />
              </button>
            ) : null}
            {mainImage.url ? (
              <Image
                src={mainImage.url}
                alt={mainImage.alt ?? data.title}
                fill
                sizes="(max-width: 900px) 100vw, 560px"
                unoptimized
              />
            ) : <span>Imagen no disponible</span>}
            {mainImage.url && zoomLens.active ? (
              <span
                aria-hidden="true"
                className="storefrontPdpZoomLens"
                style={{
                  backgroundImage: `url("${mainImage.url}")`,
                  backgroundPosition: `${zoomLens.x}% ${zoomLens.y}%`,
                }}
              />
            ) : null}
          </div>
          {data.variants.length === 0 ? (
            <div className="storefrontPdpThumbs">
              {(selectedImages.length > 0 ? selectedImages.slice(0, 5) : [{ url: "", alt: data.title }]).map((image, index) => (
                <button aria-label={`Imagen ${index + 1}`} key={`${image.url}-${index}`} type="button">
                  {image.url ? (
                    <Image src={image.url} alt={image.alt ?? data.title} fill sizes="74px" unoptimized />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          {data.variants.length > 0 ? (
            <VariantSelector
              selectedVariantId={selectedVariant?.variantId}
              setSelectedVariantId={(variantId) => {
                setSelectedVariantId(variantId);
                setZoomLens({ active: false, x: 50, y: 50 });
              }}
              variants={data.variants}
            />
          ) : null}
        </div>
        <aside className="storefrontPdpBuyBox">
          {data.brand ? <span className="storefrontPdpBrand">{data.brand}</span> : null}
          <h1>{data.title}</h1>
          <StorefrontRichText className="storefrontPdpSummary" html={data.shortDescription} />
          <div className="storefrontPdpPrice">
            {previousPriceDisplay ? <s>{previousPriceDisplay}</s> : null}
            <strong>{priceDisplay ?? "Precio pendiente"}</strong>
            {discountPercent ? <span className="storefrontPdpDiscount">-{discountPercent}%</span> : null}
          </div>
          <p className={available ? "storefrontPdpStockOk" : "storefrontPdpStockWarn"}>
            {available ? `Disponible${availableQuantity ? `: ${availableQuantity}` : ""}` : "No disponible"}
          </p>
          {selectedVariant ? (
            <section className="storefrontPdpSelectedVariant" aria-label="Combinacion seleccionada">
              {selectedVariantImage.url ? (
                <span className="storefrontPdpSelectedVariantImage">
                  <Image src={selectedVariantImage.url} alt={selectedVariantImage.alt ?? selectedVariant.name} fill sizes="112px" unoptimized />
                </span>
              ) : null}
              <span>
                <strong>{selectedVariant.name}</strong>
                {selectedVariantDetails ? <small>{selectedVariantDetails}</small> : null}
              </span>
            </section>
          ) : null}
          <div className="storefrontPdpCart">
            <div className="storefrontPdpQuantity">
              <button aria-label="Reducir cantidad" onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button">
                <Minus aria-hidden="true" size={16} />
              </button>
              <input aria-label="Cantidad" min={1} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} type="number" value={quantity} />
              <button aria-label="Aumentar cantidad" onClick={() => setQuantity((value) => value + 1)} type="button">
                <Plus aria-hidden="true" size={16} />
              </button>
            </div>
            <StorefrontAddToCartButton
              className="storefrontPdpAddToCartButton"
              disabled={!available || (!selectedVariant?.variantId && !reference)}
              onAdded={recordAddToCartEvent}
              quantity={quantity}
              refId={selectedVariant?.refId ?? data.refId}
              variantId={selectedVariant?.variantId}
            />
          </div>
          <PdpServiceBenefits />
          <section className="storefrontPdpProductFacts">
            <dl className="storefrontPdpSummaryList">
              <div><dt>Referencia</dt><dd>{reference}</dd></div>
              {ean ? <div><dt>EAN</dt><dd>{ean}</dd></div> : null}
              {data.brand ? <div><dt>Marca</dt><dd>{data.brand}</dd></div> : null}
              {data.category ? <div><dt>Categoria</dt><dd>{data.category}</dd></div> : null}
            </dl>
            <PdpSpecificationsGrid specifications={data.specifications} />
          </section>
          <PdpShareBox
            copied={copiedShareUrl}
            onCopy={copyShareUrl}
            onShare={shareProduct}
            shareText={data.title}
            shareUrl={shareUrl}
          />
        </aside>
      </section>
      <section className="storefrontPdpTabs">
        <details open>
          <summary>Descripcion</summary>
          <StorefrontRichText
            className="storefrontPdpDescription"
            fallback="Producto disponible en Storefront con datos reales desde BFF."
            html={data.description}
          />
          {data.metaDescription ? <p>{data.metaDescription}</p> : null}
        </details>
      </section>
      {zoomModalOpen && mainImage.url ? (
        <div
          aria-label={`Imagen ampliada de ${data.title}`}
          aria-modal="true"
          className="storefrontPdpZoomModal"
          onClick={() => setZoomModalOpen(false)}
          role="dialog"
        >
          <button aria-label="Cerrar imagen ampliada" className="storefrontPdpZoomModalClose" onClick={() => setZoomModalOpen(false)} type="button">
            <X aria-hidden="true" size={22} />
          </button>
          <div className="storefrontPdpZoomModalImage" onClick={(event) => event.stopPropagation()}>
            <Image
              src={mainImage.url}
              alt={mainImage.alt ?? data.title}
              fill
              sizes="100vw"
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

const allowedStorefrontRichTextTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h2",
  "h3",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "strike",
  "ul",
]);

function StorefrontRichText({
  className,
  fallback,
  html,
}: {
  className: string;
  fallback?: string;
  html?: string;
}) {
  const sanitizedHtml = useMemo(() => sanitizeStorefrontRichTextHtml(html), [html]);

  if (!sanitizedHtml) {
    return fallback ? <p className={className}>{fallback}</p> : null;
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

function sanitizeStorefrontRichTextHtml(html: string | undefined) {
  if (!html?.trim()) {
    return "";
  }

  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?([a-z][a-z0-9]*)(\s[^>]*)?>/gi, (match, rawTagName, rawAttributes = "") => {
      const tagName = String(rawTagName).toLowerCase();
      if (!allowedStorefrontRichTextTags.has(tagName)) {
        return "";
      }

      if (match.startsWith("</")) {
        return `</${tagName}>`;
      }

      if (tagName === "br") {
        return "<br>";
      }

      if (tagName !== "a") {
        return `<${tagName}>`;
      }

      const href = attributeValue(rawAttributes, "href");
      const safeHref = href && isSafeStorefrontRichTextHref(href) ? href.trim() : "";
      const title = attributeValue(rawAttributes, "title")?.trim();
      const attributes = [
        safeHref ? `href="${escapeHtmlAttribute(safeHref)}"` : "",
        title ? `title="${escapeHtmlAttribute(title)}"` : "",
        safeHref ? 'rel="noopener noreferrer"' : "",
      ].filter(Boolean).join(" ");

      return attributes ? `<a ${attributes}>` : "<a>";
    })
    .trim();
}

function attributeValue(attributes: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const match = attributes.match(pattern);
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? "";
}

function isSafeStorefrontRichTextHref(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("/") ||
    normalized.startsWith("#") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:")
  );
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function richTextToPlainText(html: string | undefined) {
  return html
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

function VariantSelector({
  selectedVariantId,
  setSelectedVariantId,
  variants,
}: {
  selectedVariantId?: string;
  setSelectedVariantId: (variantId: string) => void;
  variants: StorefrontPdpData["variants"];
}) {
  return (
    <div className="storefrontPdpVariants" aria-label="Seleccionar variante">
      {variants.slice(0, 10).map((variant) => {
        const isSelected = variant.variantId === selectedVariantId;
        const variantImage = variant.images[0];
        const className = [
          "storefrontPdpVariantButton",
          variantImage ? "storefrontPdpVariantImageButton" : "storefrontPdpVariantTextButton",
          isSelected ? "storefrontPdpVariantActive" : "",
        ].filter(Boolean).join(" ");

        return (
          <button
            aria-label={`Seleccionar ${variant.name}`}
            aria-pressed={isSelected}
            className={className}
            disabled={!variant.available}
            key={variant.variantId}
            onClick={() => setSelectedVariantId(variant.variantId)}
            title={variant.name}
            type="button"
          >
            {variantImage ? (
              <span className="storefrontPdpVariantImage">
                <Image src={variantImage.url} alt={variantImage.alt ?? variant.name} fill sizes="82px" unoptimized />
              </span>
            ) : (
              <>{variant.name}{variant.isDefault ? " · Default" : ""}</>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PdpServiceBenefits() {
  return (
    <section className="storefrontPdpBenefits" aria-label="Servicios de compra">
      <div>
        <Truck aria-hidden="true" size={24} />
        <span><strong>Envio rapido</strong><small>24/48h en peninsula</small></span>
      </div>
      <div>
        <RotateCcw aria-hidden="true" size={24} />
        <span><strong>Devoluciones</strong><small>30 dias para cambios</small></span>
      </div>
      <div>
        <ShieldCheck aria-hidden="true" size={24} />
        <span><strong>Pagos seguros</strong><small>100% protegido</small></span>
      </div>
    </section>
  );
}

function PdpShareBox({
  copied,
  onCopy,
  onShare,
  shareText,
  shareUrl,
}: {
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
  shareText: string;
  shareUrl: string;
}) {
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const shareLinks = [
    {
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      label: "Compartir por WhatsApp",
      text: "W",
    },
    {
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      label: "Compartir en Facebook",
      text: "f",
    },
    {
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      label: "Compartir en X",
      text: "X",
    },
  ];

  return (
    <section className="storefrontPdpShareBox" aria-labelledby="storefront-pdp-share-title">
      <div className="storefrontPdpShareIntro">
        <h2 id="storefront-pdp-share-title">Compartir este producto</h2>
        <button onClick={onShare} type="button">
          <Share2 aria-hidden="true" size={18} />
          Compartir
        </button>
      </div>
      <div className="storefrontPdpShareCopy">
        <label htmlFor="storefront-pdp-share-url">Enlace del producto</label>
        <div>
          <input id="storefront-pdp-share-url" readOnly value={shareUrl} />
          <button aria-label={copied ? "Enlace copiado" : "Copiar enlace"} onClick={onCopy} type="button">
            {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </button>
        </div>
      </div>
      <nav className="storefrontPdpShareLinks" aria-label="Compartir producto">
        {shareLinks.map((link) => (
          <a aria-label={link.label} href={link.href} key={link.label} rel="noreferrer" target="_blank">
            <span aria-hidden="true">{link.text}</span>
          </a>
        ))}
        <a aria-label="Compartir por email" href={`mailto:?subject=${encodedText}&body=${encodedText}%0A${encodedUrl}`}>
          <Mail aria-hidden="true" size={16} />
        </a>
      </nav>
    </section>
  );
}

function PdpSpecificationsGrid({ specifications }: { specifications: StorefrontPdpData["specifications"] }) {
  if (specifications.length === 0) {
    return null;
  }

  return (
    <section className="storefrontPdpSpecsInline" aria-labelledby="storefront-pdp-specs-title">
      <h2 id="storefront-pdp-specs-title">Caracteristicas clave</h2>
      {specifications.map((group) => (
        <dl className="storefrontPdpSpecsGrid" key={group.group}>
          {group.fields.map((field) => (
            <div key={`${group.group}-${field.name}`}>
              <dt>{field.name}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ))}
    </section>
  );
}

function slugFromCategory(value: string | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function discountPercentage(previousAmountMinor: number | undefined, currentAmountMinor: number | undefined) {
  if (!previousAmountMinor || !currentAmountMinor || currentAmountMinor >= previousAmountMinor) {
    return null;
  }

  return Math.round(((previousAmountMinor - currentAmountMinor) / previousAmountMinor) * 100);
}

function copyTextWithFallback(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
