import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type {
  StorefrontCmsBlock,
  StorefrontCmsPublishedPage,
} from "./public-page-contract";
import { StorefrontHeader } from "./storefront-header";

const supportedCmsBlockTypes = new Set([
  "banner.hero",
  "slider.fullWidth",
  "plp.categoryIntro",
  "plp.subcategoryTiles",
  "accordion",
  "carousel",
]);
const maximumItemsPerBlock = 12;
const maximumBlockDepth = 4;

export function StorefrontCmsPage({
  page,
  openCustomerLogin = false,
}: {
  page: StorefrontCmsPublishedPage;
  openCustomerLogin?: boolean;
}) {
  const blocks = page.blocks.filter(isFullPageBlock);

  return (
    <main className="storefrontPage">
      <StorefrontHeader openCustomerLogin={openCustomerLogin} />
      <div className="storefrontShell storefrontCmsPage">
        <nav className="storefrontBreadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <span>{page.title}</span>
        </nav>
        <header className="storefrontCmsPageHeader">
          <span>{pageTypeLabel(page.pageType)}</span>
          <h1>{page.title}</h1>
        </header>
        <div className="storefrontCmsPageBlocks">
          {blocks.map((block) => (
            <StorefrontCmsBlockRenderer block={block} key={block.blockId} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function StorefrontCmsBlockRenderer({
  block,
  depth = 0,
}: {
  block: StorefrontCmsBlock;
  depth?: number;
}) {
  if (depth > maximumBlockDepth || !supportedCmsBlockTypes.has(block.type)) return null;

  let content: ReactNode = null;
  if (block.type === "banner.hero") content = <HeroBlock block={block} />;
  if (block.type === "slider.fullWidth") content = <SliderBlock block={block} />;
  if (block.type === "plp.categoryIntro") content = <CategoryIntroBlock block={block} />;
  if (block.type === "plp.subcategoryTiles") content = <SubcategoryTilesBlock block={block} />;
  if (block.type === "accordion") content = <AccordionBlock block={block} />;
  if (block.type === "carousel") content = <CarouselBlock block={block} />;

  const children = (block.children ?? []).slice(0, maximumItemsPerBlock);
  return (
    <>
      {content}
      {children.length > 0 ? (
        <div className="storefrontCmsChildren">
          {children.map((child) => (
            <StorefrontCmsBlockRenderer block={child} depth={depth + 1} key={child.blockId} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function HeroBlock({ block }: { block: StorefrontCmsBlock }) {
  const heading = text(block.props.heading) ?? text(block.props.title);
  const body = text(block.props.body, 2000) ?? text(block.props.description, 2000);
  const imageUrl = safeMediaUrl(block.props.imageUrl);

  return (
    <section className={`storefrontCmsHero${imageUrl ? " storefrontCmsWithMedia" : ""}`}>
      <div className="storefrontCmsCopy">
        {text(block.props.eyebrow, 80) ? <span>{text(block.props.eyebrow, 80)}</span> : null}
        {heading ? <h2>{heading}</h2> : null}
        {body ? <p>{body}</p> : null}
        <CmsAction href={block.props.ctaHref} label={block.props.ctaLabel} />
      </div>
      {imageUrl ? <CmsImage alt={text(block.props.imageAlt, 200) ?? heading ?? ""} src={imageUrl} /> : null}
    </section>
  );
}

function SliderBlock({ block }: { block: StorefrontCmsBlock }) {
  const slides = items(block.props.slides);
  if (slides.length === 0) return null;

  return (
    <section className="storefrontCmsSlider" aria-label={text(block.props.heading) ?? "Contenido destacado"}>
      <div className="storefrontCmsSlides">
        {slides.map((slide, index) => {
          const title = text(slide.title) ?? `Destacado ${index + 1}`;
          const imageUrl = safeMediaUrl(slide.imageUrl);
          return (
            <article className={imageUrl ? "storefrontCmsSlide storefrontCmsWithMedia" : "storefrontCmsSlide"} key={`${title}-${index}`}>
              <div className="storefrontCmsCopy">
                {text(slide.kicker, 80) ? <span>{text(slide.kicker, 80)}</span> : null}
                <h2>{title}</h2>
                {text(slide.body, 2000) ? <p>{text(slide.body, 2000)}</p> : null}
                <CmsAction href={slide.ctaHref} label={slide.ctaLabel} />
              </div>
              {imageUrl ? <CmsImage alt={text(slide.imageAlt, 200) ?? title} src={imageUrl} /> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CategoryIntroBlock({ block }: { block: StorefrontCmsBlock }) {
  const heading = text(block.props.heading) ?? text(block.props.title);
  const imageUrl = safeMediaUrl(block.props.imageUrl);
  return (
    <section className={`storefrontCmsIntro${imageUrl ? " storefrontCmsWithMedia" : ""}`}>
      <div className="storefrontCmsCopy">
        {heading ? <h2>{heading}</h2> : null}
        {text(block.props.body, 2000) ?? text(block.props.description, 2000) ? (
          <p>{text(block.props.body, 2000) ?? text(block.props.description, 2000)}</p>
        ) : null}
      </div>
      {imageUrl ? <CmsImage alt={text(block.props.imageAlt, 200) ?? heading ?? ""} src={imageUrl} /> : null}
    </section>
  );
}

function SubcategoryTilesBlock({ block }: { block: StorefrontCmsBlock }) {
  const blockItems = items(block.props.items);
  if (blockItems.length === 0) return null;
  return (
    <section className="storefrontCmsSection">
      {text(block.props.heading) ? <h2>{text(block.props.heading)}</h2> : null}
      <div className="storefrontCmsTiles">
        {blockItems.map((item, index) => (
          <CmsCard item={item} index={index} key={`${text(item.title) ?? "tile"}-${index}`} />
        ))}
      </div>
    </section>
  );
}

function AccordionBlock({ block }: { block: StorefrontCmsBlock }) {
  const blockItems = items(block.props.items);
  if (blockItems.length === 0) return null;
  return (
    <section className="storefrontCmsAccordion">
      {text(block.props.heading) ? <h2>{text(block.props.heading)}</h2> : null}
      {blockItems.map((item, index) => (
        <details key={`${text(item.title) ?? "item"}-${index}`}>
          <summary>{text(item.title) ?? `Información ${index + 1}`}</summary>
          {text(item.content, 4000) ?? text(item.text, 4000) ? (
            <p>{text(item.content, 4000) ?? text(item.text, 4000)}</p>
          ) : null}
        </details>
      ))}
    </section>
  );
}

function CarouselBlock({ block }: { block: StorefrontCmsBlock }) {
  const blockItems = items(block.props.items);
  if (blockItems.length === 0) return null;
  return (
    <section className="storefrontCmsSection">
      {text(block.props.heading) ? <h2>{text(block.props.heading)}</h2> : null}
      <div className="storefrontCmsCarousel">
        {blockItems.map((item, index) => (
          <CmsCard item={item} index={index} key={`${text(item.title) ?? "card"}-${index}`} />
        ))}
      </div>
    </section>
  );
}

function CmsCard({ item, index }: { item: Record<string, unknown>; index: number }) {
  const title = text(item.title) ?? `Contenido ${index + 1}`;
  const imageUrl = safeMediaUrl(item.imageUrl);
  return (
    <article>
      {imageUrl ? <CmsImage alt={text(item.imageAlt, 200) ?? title} src={imageUrl} /> : null}
      <strong>{title}</strong>
      {text(item.body, 1000) ?? text(item.subtitle, 1000) ? (
        <p>{text(item.body, 1000) ?? text(item.subtitle, 1000)}</p>
      ) : null}
      <CmsAction href={item.href ?? item.ctaHref} label={item.ctaLabel ?? "Ver más"} />
    </article>
  );
}

function CmsImage({ alt, src }: { alt: string; src: string }) {
  return (
    <div className="storefrontCmsMedia">
      <Image alt={alt} fill sizes="(max-width: 680px) 100vw, 50vw" src={src} unoptimized />
    </div>
  );
}

function CmsAction({ href, label }: { href: unknown; label: unknown }) {
  const safeHref = safeLinkHref(href);
  const safeLabel = text(label, 80);
  if (!safeHref || !safeLabel) return null;
  if (safeHref.startsWith("/")) return <Link className="storefrontCmsAction" href={safeHref}>{safeLabel}</Link>;
  return <a className="storefrontCmsAction" href={safeHref} rel="noreferrer">{safeLabel}</a>;
}

function isFullPageBlock(block: StorefrontCmsBlock) {
  return block.props.surface !== "plp" && block.props.placement !== "beforeList" && block.props.placement !== "afterList";
}

function safeLinkHref(value: unknown) {
  const href = text(value, 2048);
  if (!href || href.includes("\\")) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeMediaUrl(value: unknown) {
  return safeLinkHref(value);
}

function text(value: unknown, maximumLength = 300) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximumLength)
    : null;
}

function items(value: unknown) {
  return Array.isArray(value)
    ? value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .slice(0, maximumItemsPerBlock)
    : [];
}

function pageTypeLabel(value: string) {
  if (value === "HOME") return "Inicio";
  if (value === "CONTENT") return "Información";
  return "Página especial";
}
