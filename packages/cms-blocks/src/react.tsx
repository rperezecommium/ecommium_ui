import {resolveCmsDesignSettings,cmsDesignPresentation,emptyCmsDesign,type CmsDesignSettings,type CmsResolvedDesign} from './design-settings';
import {CmsCompositionLayoutView,type CmsCompositionLayout} from './page-layout';
import { createElement, Fragment, type CSSProperties, type ReactNode } from "react";
import { sanitizeRichTextHtml } from "./rich-text";
import { findCmsIcon } from "./icons";
import { CmsNewsletterForm } from "./newsletter-form";
import {
  cmsStyleSelectorSafe,
  getCmsBlockDefinition,
  getCmsBlockPlacement,
  getCmsBlockPlpTarget,
  getCmsBlockSurface,
  normalizeCmsVisualModuleForRenderer,
  normalizeCmsVisualModuleProps,
  type CmsBlock,
  type CmsVisualAssetRef,
  type CmsVisualBreakpoint,
  type CmsVisualContentSchema,
  type CmsVisualElement,
  type CmsVisualHoverStyleKey,
  type CmsVisualModuleV2Props,
  type CmsVisualNode,
  type CmsVisualResponsiveStyles,
  type CmsVisualNodeStyle,
  type CmsVisualPanel,
  type CmsVisualStyleDeclaration,
  type CmsVisualStylesByScope,
  type CmsPresentation,
} from "./index";

export const maximumItemsPerBlock = 12;
export const maximumBlockDepth = 4;
export const maximumVisualNodeDepth = 8;
export const maximumVisualChildrenPerNode = 24;

export type CmsBlockRendererMode = "storefront" | "admin-preview";

export type CmsBlockLinkRendererProps = {
  href: string;
  label: string;
  className: string;
  children?: ReactNode;
  rel?: string;
  style?: CSSProperties;
  target?: "_blank" | "_self" | "_parent" | "_top";
  title?: string;
};

export type CmsBlockImageRendererProps = {
  alt: string;
  src: string;
  className: string;
  sizes: string;
};

export type CmsBlockRendererProps = {
  block: CmsBlock;
  depth?: number;
  mode?: CmsBlockRendererMode;
  renderLink?: (props: CmsBlockLinkRendererProps) => ReactNode;
  renderImage?: (props: CmsBlockImageRendererProps) => ReactNode;
  visualViewport?: CmsVisualBreakpoint;
};

const systemBlockLabels: Record<string, string> = {
  "store.logo": "Logo de tienda",
  "store.market": "Mercado e idioma",
  "store.assurances": "Servicios y confianza",
  "commerce.search": "Buscador",
  "commerce.cart": "Carrito",
  "customer.account": "Cuenta de cliente",
  "catalog.navigation": "Navegacion de catalogo",
  "content.announcementBar": "Barra de anuncio",
  "footer.navigation": "Enlaces de footer",
  "footer.legal": "Informacion legal",
  "footer.contact": "Contacto",
  "footer.newsletter": "Newsletter",
  "footer.payments": "Metodos de pago",
  "footer.social": "Redes sociales",
};

export function isSupportedCmsBlockType(type: string) {
  return Boolean(getCmsBlockDefinition(type) || systemBlockLabels[type]);
}

export function CmsBlockRenderer({
  block,
  depth = 0,
  mode = "storefront",
  renderLink,
  renderImage,
  visualViewport,
}: CmsBlockRendererProps) {
  if (depth > maximumBlockDepth || !isSupportedCmsBlockType(block.type)) return null;

  const content = mode === "admin-preview"
    ? renderAdminPreviewBlock(block, visualViewport)
    : renderStorefrontBlock(block, renderLink, renderImage, visualViewport);

  const children = (block.children ?? []).slice(0, maximumItemsPerBlock);
  return (
    <>
      {content}
      {children.length > 0 ? (
        <div className={mode === "admin-preview" ? "cmsPreviewChildren" : "storefrontCmsChildren"}>
          {children.map((child) => (
            <CmsBlockRenderer
              block={child}
              depth={depth + 1}
              key={child.blockId}
              mode={mode}
              renderImage={renderImage}
              renderLink={renderLink}
              visualViewport={visualViewport}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function CmsPlpStorefrontPreviewRenderer({ blocks }: { blocks: CmsBlock[] }) {
  const plpBlocks = blocks.filter((block) => getCmsBlockSurface(block) === "plp");
  const beforeList = plpBlocks.filter((block) => getCmsBlockPlacement(block) !== "afterList");
  const afterList = plpBlocks.filter((block) => getCmsBlockPlacement(block) === "afterList");

  return (
    <div className="cmsPlpPrestashopPreview">
      <nav className="cmsPlpBreadcrumb">Inicio / Clothes</nav>
      <div className="cmsPlpPrestashopLayout">
        <aside className="cmsPlpFacetSidebar">
          <section>
            <strong>Clothes</strong>
            <span>Men</span>
            <span>Women</span>
          </section>
          <section>
            <strong>Filtrar por</strong>
            {["Disponibilidad", "Selecciones", "Precio", "Categorias", "Tamaño", "Color"].map((facet) => (
              <label key={facet}>
                <input type="checkbox" readOnly />
                <span>{facet}</span>
              </label>
            ))}
          </section>
        </aside>
        <section className="cmsPlpListingPane">
          {beforeList.length > 0 ? beforeList.map((block) => (
            <CmsBlockRenderer block={block} key={block.blockId} mode="admin-preview" />
          )) : <DefaultCategoryIntro />}
          <div className="cmsPlpProductsTopbar">
            <span>Hay 2 productos.</span>
            <button type="button">Ordenar por: Relevancia</button>
          </div>
          <div className="cmsPlpProductGrid">
            <PreviewProductCard
              name="Hummingbird printed t-shirt"
              oldPrice="28,92 €"
              price="23,14 €"
            />
            <PreviewProductCard
              name="Hummingbird printed sweater"
              oldPrice="43,44 €"
              price="34,75 €"
            />
          </div>
          <div className="cmsPlpPagination">Mostrando 1-2 de 2 articulo(s)</div>
          {afterList.map((block) => (
            <CmsBlockRenderer block={block} key={block.blockId} mode="admin-preview" />
          ))}
        </section>
      </div>
    </div>
  );
}

function renderStorefrontBlock(
  block: CmsBlock,
  renderLink: CmsBlockRendererProps["renderLink"],
  renderImage: CmsBlockRendererProps["renderImage"],
  visualViewport?: CmsVisualBreakpoint,
) {
  if (block.type === "banner.hero") return <HeroBlock block={block} renderImage={renderImage} renderLink={renderLink} />;
  if (block.type === "slider.fullWidth") return <SliderBlock block={block} renderImage={renderImage} renderLink={renderLink} />;
  if (block.type === "category.imageTiles") return <CategoryImageTilesBlock block={block} renderImage={renderImage} renderLink={renderLink} />;
  if (block.type === "plp.categoryIntro") return <CategoryIntroBlock block={block} renderImage={renderImage} />;
  if (block.type === "plp.subcategoryTiles") return <SubcategoryTilesBlock block={block} renderImage={renderImage} renderLink={renderLink} />;
  if (block.type === "accordion") return <AccordionBlock block={block} />;
  if (block.type === "carousel") return <CarouselBlock block={block} renderImage={renderImage} renderLink={renderLink} />;
  if (block.type === "commerce.productGrid") return <CommerceProductGridBlock block={block} renderImage={renderImage} renderLink={renderLink} />;
  if (block.type === "visual.module") return <VisualModuleBlock block={block} renderImage={renderImage} renderLink={renderLink} visualViewport={visualViewport} />;
  return null;
}

function CategoryImageTilesBlock({
  block,
  renderImage,
  renderLink,
}: {
  block: CmsBlock;
  renderImage: CmsBlockRendererProps["renderImage"];
  renderLink: CmsBlockRendererProps["renderLink"];
}) {
  const blockItems = items(block.props.items).slice(0, 6);
  if (blockItems.length === 0) return null;
  const style = {
    "--cms-category-columns": boundedInteger(block.props.columns, 2, 1, 4),
    "--cms-category-gap": `${boundedInteger(block.props.gap, 24, 0, 64)}px`,
    "--cms-category-height": `${boundedInteger(block.props.tileHeight, 320, 180, 560)}px`,
    "--cms-category-overlay": boundedInteger(block.props.overlayOpacity, 24, 0, 70) / 100,
    marginBottom: `${boundedInteger(block.props.marginBottom, 24, 0, 160)}px`,
    marginTop: `${boundedInteger(block.props.marginTop, 24, 0, 160)}px`,
    width: `${boundedInteger(block.props.widthPercent, 90, 60, 100)}%`,
  } as CSSProperties;
  const heading = text(block.props.heading, 120);

  return (
    <section className="storefrontCmsCategoryTiles" style={style}>
      {heading ? <h2>{heading}</h2> : null}
      <div className="storefrontCmsCategoryTilesGrid">
        {blockItems.map((item, index) => {
          const title = text(item.title, 120) ?? `Categoria ${index + 1}`;
          const imageUrl = safeMediaUrl(item.imageUrl);
          const href = safeLinkHref(item.href);
          if (!imageUrl || !href) return null;
          const content = (
            <>
              <CmsImage
                alt={text(item.imageAlt, 200) ?? title}
                className="storefrontCmsCategoryTileMedia"
                renderImage={renderImage}
                sizes={`(max-width: 760px) 90vw, ${Math.round(90 / boundedInteger(block.props.columns, 2, 1, 4))}vw`}
                src={imageUrl}
              />
              <span className="storefrontCmsCategoryTileShade" aria-hidden="true" />
              <strong>{title}</strong>
            </>
          );
          return renderLink ? (
            <Fragment key={`${title}-${index}`}>
              {renderLink({
                children: content,
                className: "storefrontCmsCategoryTile",
                href,
                label: title,
                title: `Ver ${title}`,
              })}
            </Fragment>
          ) : (
            <a className="storefrontCmsCategoryTile" href={href} key={`${title}-${index}`} title={`Ver ${title}`}>
              {content}
            </a>
          );
        })}
      </div>
    </section>
  );
}

function CommerceProductGridBlock({ block, renderImage }: { block: CmsBlock; renderImage: CmsBlockRendererProps["renderImage"]; renderLink: CmsBlockRendererProps["renderLink"] }) {
  const products = productItems(block.props.hydratedProducts);
  const heading = text(block.props.heading, 120);
  const subtitle = text(block.props.subtitle, 240);
  const style = {width: `${boundedInteger(block.props.widthPercent,90,60,100)}%`, "--cms-product-columns": boundedInteger(block.props.columns,4,1,6), "--cms-product-mobile-columns": boundedInteger(block.props.mobileColumns,2,1,2), "--cms-product-gap": `${boundedInteger(block.props.gap,24,0,64)}px`} as CSSProperties;
  return <section className="storefrontCmsProductCollection" style={style} aria-label={heading ?? "Productos"} data-cms-product-source={text(recordValues(block.props.source).kind, 40) ?? "UNKNOWN"}>
    {heading || subtitle ? <header className="cmsProductGridHeading">{heading ? <h2>{heading}</h2> : null}{subtitle ? <p>{subtitle}</p> : null}</header> : null}
    {products.length > 0 ? <div className="cmsCategoryProductGrid">{products.map((product, index) => {
      const name = text(product.name, 200) ?? `Producto ${index + 1}`;
      const imageUrl = safeMediaUrl(product.imageUrl);
      const href = safeLinkHref(product.href);
      const discount = typeof product.discountPercent === "number" && product.discountPercent > 0 && product.discountPercent <= 100 ? product.discountPercent : null;
      const sizes = Array.isArray(product.sizeLabels) ? product.sizeLabels.filter((v): v is string => typeof v === "string").slice(0,12) : [];
      return <article className="cmsCategoryProductCard" key={`${text(product.productId, 100) ?? index}-${text(product.variantId,100) ?? "product"}`}>
        {imageUrl ? (href ? <a className="cmsCategoryProductImage" href={href} aria-label={name}><CmsImage alt={text(product.imageAlt,200) ?? name} renderImage={renderImage} src={imageUrl} sizes="(max-width: 680px) 45vw, (max-width: 1024px) 30vw, 25vw" /></a> : <div className="cmsCategoryProductImage"><CmsImage alt={name} renderImage={renderImage} src={imageUrl} /></div>) : <div className="cmsCategoryProductImage cmsCategoryProductImageEmpty" aria-label="Imagen no disponible" />}
        <div className="cmsCategoryProductDetails">
        {text(product.brand,120) ? <strong className="cmsCategoryProductBrand">{text(product.brand,120)}</strong> : null}
        {href ? <a className="cmsCategoryProductName" href={href}>{name}</a> : <span className="cmsCategoryProductName">{name}</span>}
        <div className="cmsCategoryProductPrices">{text(product.priceLabel,80) ? <strong>{text(product.priceLabel,80)}</strong> : <span>Precio no disponible</span>}{text(product.previousPriceLabel,80) ? <del>{text(product.previousPriceLabel,80)}</del> : null}{discount ? <span className="cmsCategoryProductDiscount">− {discount}%</span> : null}</div>
        {sizes.length ? <p className="cmsCategoryProductSizes"><span>Talla:</span> {sizes.join(" · ")}</p> : null}
        </div>
      </article>;
    })}</div> : <p className="storefrontCmsProductGridEmpty">{recordValues(block.props.hydration).status === "UNAVAILABLE" ? "Los productos no están disponibles ahora. Inténtalo de nuevo en unos instantes." : "No hay productos disponibles para esta seleccion."}</p>}
  </section>;
}

function HeroBlock({
  block,
  renderImage,
  renderLink,
}: {
  block: CmsBlock;
  renderImage: CmsBlockRendererProps["renderImage"];
  renderLink: CmsBlockRendererProps["renderLink"];
}) {
  const heading = text(block.props.heading) ?? text(block.props.title);
  const body = text(block.props.body, 2000) ?? text(block.props.description, 2000);
  const imageUrl = safeMediaUrl(block.props.imageUrl);

  return (
    <section className={`storefrontCmsHero${imageUrl ? " storefrontCmsWithMedia" : ""}`}>
      <div className="storefrontCmsCopy">
        {text(block.props.eyebrow, 80) ? <span>{text(block.props.eyebrow, 80)}</span> : null}
        {heading ? <h2>{heading}</h2> : null}
        {body ? <p>{body}</p> : null}
        <CmsAction href={block.props.ctaHref} label={block.props.ctaLabel} renderLink={renderLink} />
      </div>
      {imageUrl ? (
        <CmsImage
          alt={text(block.props.imageAlt, 200) ?? heading ?? ""}
          renderImage={renderImage}
          src={imageUrl}
        />
      ) : null}
    </section>
  );
}

function SliderBlock({
  block,
  renderImage,
  renderLink,
}: {
  block: CmsBlock;
  renderImage: CmsBlockRendererProps["renderImage"];
  renderLink: CmsBlockRendererProps["renderLink"];
}) {
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
                <CmsAction href={slide.ctaHref} label={slide.ctaLabel} renderLink={renderLink} />
              </div>
              {imageUrl ? (
                <CmsImage
                  alt={text(slide.imageAlt, 200) ?? title}
                  renderImage={renderImage}
                  src={imageUrl}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CategoryIntroBlock({
  block,
  renderImage,
}: {
  block: CmsBlock;
  renderImage: CmsBlockRendererProps["renderImage"];
}) {
  const heading = text(block.props.heading) ?? text(block.props.title);
  const imageUrl = safeMediaUrl(block.props.imageUrl);
  if (block.props.backgroundMode === true) {
    const color = text(block.props.textColor);
    const position = text(block.props.backgroundPosition);
    const Heading = block.props.headingLevel === 1 ? "h1" : "h2";
    return <section className="storefrontCmsCategoryBanner" style={{
      minHeight: boundedInteger(block.props.height, 240, 160, 600),
      color: color && /^#[a-f0-9]{3,8}$/i.test(color) ? color : "#ffffff",
      backgroundImage: imageUrl ? `linear-gradient(rgba(0,0,0,${boundedInteger(block.props.overlayOpacity, 55, 0, 90) / 100}),rgba(0,0,0,${boundedInteger(block.props.overlayOpacity, 55, 0, 90) / 100})),url(${JSON.stringify(imageUrl)})` : undefined,
      backgroundPosition: position && /^(center|top|bottom|left|right)( (center|top|bottom|left|right))?$/.test(position) ? position : "center",
    }}><div className="storefrontCmsCopy">{heading ? <Heading>{heading}</Heading> : null}{text(block.props.body, 2000) ? <p>{text(block.props.body, 2000)}</p> : null}</div></section>;
  }

  return (
    <section className={`storefrontCmsIntro${imageUrl ? " storefrontCmsWithMedia" : ""}`}>
      <div className="storefrontCmsCopy">
        {heading ? <h2>{heading}</h2> : null}
        {text(block.props.body, 2000) ?? text(block.props.description, 2000) ? (
          <p>{text(block.props.body, 2000) ?? text(block.props.description, 2000)}</p>
        ) : null}
      </div>
      {imageUrl ? (
        <CmsImage
          alt={text(block.props.imageAlt, 200) ?? heading ?? ""}
          renderImage={renderImage}
          src={imageUrl}
        />
      ) : null}
    </section>
  );
}

function SubcategoryTilesBlock({
  block,
  renderImage,
  renderLink,
}: {
  block: CmsBlock;
  renderImage: CmsBlockRendererProps["renderImage"];
  renderLink: CmsBlockRendererProps["renderLink"];
}) {
  const blockItems = items(block.props.items);
  if (blockItems.length === 0) return null;
  return (
    <section className="storefrontCmsSection">
      {text(block.props.heading) ? <h2>{text(block.props.heading)}</h2> : null}
      <div className="storefrontCmsTiles">
        {blockItems.map((item, index) => (
          <CmsCard item={item} index={index} key={`${text(item.title) ?? "tile"}-${index}`} renderImage={renderImage} renderLink={renderLink} />
        ))}
      </div>
    </section>
  );
}

function AccordionBlock({ block }: { block: CmsBlock }) {
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

function CarouselBlock({
  block,
  renderImage,
  renderLink,
}: {
  block: CmsBlock;
  renderImage: CmsBlockRendererProps["renderImage"];
  renderLink: CmsBlockRendererProps["renderLink"];
}) {
  const blockItems = items(block.props.items);
  if (blockItems.length === 0) return null;
  return (
    <section className="storefrontCmsSection">
      {text(block.props.heading) ? <h2>{text(block.props.heading)}</h2> : null}
      <div className="storefrontCmsCarousel">
        {blockItems.map((item, index) => (
          <CmsCard item={item} index={index} key={`${text(item.title) ?? "card"}-${index}`} renderImage={renderImage} renderLink={renderLink} />
        ))}
      </div>
    </section>
  );
}

function VisualModuleBlock({
  block,
  renderImage,
  renderLink,
  visualViewport,
}: {
  block: CmsBlock;
  renderImage?: CmsBlockRendererProps["renderImage"];
  renderLink?: CmsBlockRendererProps["renderLink"];
  visualViewport?: CmsVisualBreakpoint;
}) {
  const moduleProps = normalizeCmsVisualModuleForRenderer(block.props);
  if (moduleProps.schemaVersion === 2) {
    return (
      <VisualModuleV2Block
        blockProps={block.props}
        moduleProps={moduleProps}
        renderImage={renderImage}
        renderLink={renderLink}
        visualViewport={visualViewport}
      />
    );
  }

  const legacyModuleProps = normalizeCmsVisualModuleProps(block.props);
  const legacyContentValues = {
    ...recordValues(legacyModuleProps.contentValues),
    ...recordValues(block.props.contentValues),
  };
  const legacyTree = visualNodeWithModuleContentStyleOverrides(
    legacyModuleProps.tree,
    legacyModuleProps.contentSchema,
    legacyContentValues,
    legacyModuleProps.assetRefs ?? [],
  );
  return (
    <section
      aria-label={text(legacyModuleProps.name, 120) ?? "Modulo visual CMS"}
      className="cmsVisualModule storefrontCmsSection"
      data-cms-visual-module={block.blockId}
    >
      <VisualNodeRenderer
        assetRefs={legacyModuleProps.assetRefs ?? []}
        contentValues={legacyContentValues}
        node={legacyTree}
        renderImage={renderImage}
        renderLink={renderLink}
        visualViewport={visualViewport}
      />
    </section>
  );
}

function VisualModuleV2Block({
  independentIdentity = false,
  blockProps,
  moduleProps,
  renderImage,
  renderLink,
  visualViewport,
}: {
  independentIdentity?: boolean;
  blockProps: Record<string, unknown>;
  moduleProps: CmsVisualModuleV2Props;
  renderImage?: CmsBlockRendererProps["renderImage"];
  renderLink?: CmsBlockRendererProps["renderLink"];
  visualViewport?: CmsVisualBreakpoint;
}) {
  const contentValues = {
    ...recordValues(moduleProps.contentValues),
    ...recordValues(blockProps.contentValues),
  };
  const rootNode = visualModuleV2RootNode(moduleProps, blockProps);
  if (independentIdentity) {
    const mark = (node: CmsVisualNode) => { (node as CmsVisualNode & { renderDomId: string }).renderDomId = node.nodeId; node.children?.forEach(mark); };
    mark(rootNode);
  }
  return (
    <section
      aria-label={text(moduleProps.name, 120) ?? "Modulo visual CMS"}
      className="cmsVisualModule storefrontCmsSection"
      data-cms-visual-module={moduleProps.moduleId}
      data-cms-visual-schema-version="2"
    >
      <VisualNodeRenderer
        assetRefs={moduleProps.assetRefs ?? []}
        contentValues={contentValues}
        node={rootNode}
        renderImage={renderImage}
        renderLink={renderLink}
        visualViewport={visualViewport}
      />
    </section>
  );
}

function visualModuleV2RootNode(moduleProps: CmsVisualModuleV2Props, blockProps: Record<string, unknown>): CmsVisualNode {
  const assetRefs = moduleProps.assetRefs ?? [];
  const contentValues = {
    ...recordValues(moduleProps.contentValues),
    ...recordValues(blockProps.contentValues),
  };
  const rootStyleOverrides = visualModuleContentStyleOverrides(
    moduleProps.contentSchema,
    contentValues,
    visualNodeStylesByScopeForRender(moduleProps.styles)?.base,
    assetRefs,
  );
  return {
    nodeId: moduleProps.moduleId,
    type: visualNodeTypeFromValue(moduleProps.type, "container"),
    ...(text(moduleProps.name, 120) ? { label: text(moduleProps.name, 120) ?? undefined } : {}),
    ...(moduleProps.visibility ? { visibility: moduleProps.visibility } : {}),
    ...(moduleProps.animation ? { animation: moduleProps.animation } : {}),
    ...(moduleProps.interactions ? { interactions: moduleProps.interactions } : {}),
    ...visualStylesToNodeStyles(moduleProps.styles, assetRefs),
    ...(Object.keys(rootStyleOverrides).length ? {
      styles: {
        ...visualNodeStylesByScopeForRender(moduleProps.styles)?.base,
        ...rootStyleOverrides,
      },
    } : {}),
    children: [
      ...moduleProps.panels.map((panel) => visualPanelToNode(panel, contentValues, assetRefs)),
      ...(moduleProps.elements ?? []).map((element) => visualElementToNode(element, contentValues, assetRefs)),
    ],
  };
}

function visualNodeStylesByScopeForRender(styles: CmsVisualStylesByScope | undefined): CmsVisualStylesByScope {
  return styles ?? {};
}

function visualModuleContentStyleOverrides(
  contentSchema: CmsVisualContentSchema | undefined,
  contentValues: Record<string, unknown>,
  currentRootStyles: CmsVisualStyleDeclaration | undefined,
  assetRefs: CmsVisualAssetRef[],
): CmsVisualStyleDeclaration {
  const nextStyles: CmsVisualStyleDeclaration = {};
  for (const [contentKey, field] of Object.entries(contentSchema ?? {})) {
    const targetStyle = visualModuleStyleKeyFromContentField(contentKey, field.label);
    if (!targetStyle || currentRootStyles?.[targetStyle]?.startsWith("binding:")) continue;
    const value = contentValues[contentKey] ?? field.defaultValue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    const styleValue = String(value).trim();
    if (!styleValue || !visualStyleValueForCss(targetStyle, styleValue, assetRefs, contentValues)) continue;
    nextStyles[targetStyle] = styleValue;
  }
  return nextStyles;
}

function visualNodeWithModuleContentStyleOverrides(
  node: CmsVisualNode,
  contentSchema: CmsVisualContentSchema | undefined,
  contentValues: Record<string, unknown>,
  assetRefs: CmsVisualAssetRef[],
): CmsVisualNode {
  const rootStyleOverrides = visualModuleContentStyleOverrides(
    contentSchema,
    contentValues,
    node.styles,
    assetRefs,
  );
  if (Object.keys(rootStyleOverrides).length === 0) return node;
  return {
    ...node,
    styles: {
      ...(node.styles ?? {}),
      ...rootStyleOverrides,
    },
  };
}

function visualModuleStyleKeyFromContentField(
  contentKey: string,
  label: string | null | undefined,
): "backgroundColor" | "margin" | null {
  const normalized = `${contentKey} ${label ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase();
  const mentionsModule = /\b(module|modulo)\b/.test(normalized);
  if (!mentionsModule) return null;
  if (/\b(background|fondo)\b/.test(normalized)) return "backgroundColor";
  if (/\b(margin|margen)\b/.test(normalized)) return "margin";
  return null;
}

function visualPanelToNode(
  panel: CmsVisualPanel,
  contentValues: Record<string, unknown>,
  assetRefs: NonNullable<CmsVisualModuleV2Props["assetRefs"]>,
): CmsVisualNode {
  return {
    nodeId: panel.panelId,
    type: "section",
    ...(text(panel.label, 120) ? { label: text(panel.label, 120) ?? undefined } : {}),
    ...(panel.visibility ? { visibility: panel.visibility } : {}),
    ...(panel.animation ? { animation: panel.animation } : {}),
    ...(panel.interactions ? { interactions: panel.interactions } : {}),
    props: visualNodePropsFromRecord(panel.props),
    ...visualStylesToNodeStyles(panel.styles, assetRefs),
    children: [
      ...(panel.elements ?? []).map((element) => visualElementToNode(element, contentValues, assetRefs)),
      ...(panel.panels ?? []).map((childPanel) => visualPanelToNode(childPanel, contentValues, assetRefs)),
    ],
  };
}

function visualElementToNode(
  element: CmsVisualElement,
  contentValues: Record<string, unknown>,
  assetRefs: NonNullable<CmsVisualModuleV2Props["assetRefs"]>,
): CmsVisualNode {
  return {
    nodeId: element.elementId,
    type: element.elementType,
    ...(text(element.label, 120) ? { label: text(element.label, 120) ?? undefined } : {}),
    ...(element.visibility ? { visibility: element.visibility } : {}),
    ...(element.animation ? { animation: element.animation } : {}),
    ...(element.interactions ? { interactions: element.interactions } : {}),
    props: {
      ...visualNodePropsFromRecord(element.props),
      ...visualBoundProps(element, contentValues),
    },
    ...visualStylesToNodeStyles(element.styles, assetRefs),
    children: (element.children ?? element.elements ?? []).map((child) => visualElementToNode(child, contentValues, assetRefs)),
  };
}

export function CmsPresentationView({ presentation, children, visualViewport }: { presentation?: CmsPresentation; children: ReactNode; visualViewport?: CmsVisualBreakpoint }) {
  if (!presentation) return <>{children}</>;
  const node: CmsVisualNode = { nodeId: "presentation", type: "container",
    ...visualStylesToNodeStyles(presentation.styles, presentation.assetRefs ?? []),
    visibility: presentation.visibility, animation: presentation.animation, interactions: presentation.interactions };
  return <VisualNodeRenderer node={node} assetRefs={presentation.assetRefs} visualViewport={visualViewport} content={children} />;
}

function visualStyleId(node: CmsVisualNode, assetRefs: CmsVisualAssetRef[] = [], contentValues = {}) {
  const raw = JSON.stringify([node.nodeId, node.styles, node.responsiveStyles, assetRefs, contentValues]);
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return `cms-${(hash >>> 0).toString(36)}`;
}

function VisualNodeRenderer(props: Parameters<typeof VisualNodeContentRenderer>[0]) {
  const { node, visualViewport, assetRefs = [], contentValues = {} } = props;
  let css = "";
  if (!visualViewport && node.responsiveStyles) {
    for (const [viewport, width] of [["tablet", 1023], ["mobile", 767]] as const) {
      const declarations = visualStyleVariableKeys.flatMap(key => {
        const raw = visualViewportStyleValue(node.styles, node.responsiveStyles, viewport, key);
        const value = raw ? visualStyleValueForCss(key, raw, assetRefs, contentValues) : null;
        return value ? [`${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${value} !important`] : [];
      });
      css += `@media(max-width:${width}px){[data-cms-style-id="${visualStyleId(node, assetRefs, contentValues)}"]{${declarations.join(";")}}}`;
    }
  }
  return <>{css ? <style>{css}</style> : null}<VisualNodeContentRenderer {...props} /></>;
}

function VisualNodeContentRenderer({
  assetRefs = [],
  contentValues = {},
  depth = 0,
  node,
  renderImage,
  renderLink,
  visualViewport,
  content,
  spaceAttributes,
}: {
  assetRefs?: CmsVisualAssetRef[];
  contentValues?: Record<string, unknown>;
  depth?: number;
  node: CmsVisualNode;
  renderImage?: CmsBlockRendererProps["renderImage"];
  renderLink?: CmsBlockRendererProps["renderLink"];
  visualViewport?: CmsVisualBreakpoint;
  content?: ReactNode;
  spaceAttributes?: {id:string;"data-cms-node-id":string;"data-cms-space-owner":string};
}) {
  if (depth > maximumVisualNodeDepth) return null;

  const boundProps = visualNodeBoundProps(node, contentValues);
  const renderNode = Object.keys(boundProps).length
    ? { ...node, props: { ...(node.props ?? {}), ...boundProps } }
    : node;
  if (visualViewport && renderNode.visibility?.[visualViewport] === false) {
    return null;
  }
  const children = renderVisualNodeChildren(renderNode, depth, renderImage, renderLink, visualViewport, assetRefs, contentValues);
  const className = visualNodeClassName(visualViewport ? { ...renderNode, visibility: undefined } : renderNode);
  const style = {
    ...visualNodeStyle(renderNode.styles, renderNode.responsiveStyles, visualViewport, assetRefs, contentValues),
    ...visualAnimationStyleVariables(renderNode.animation),
    ...visualInteractionStyleVariables(renderNode.interactions, assetRefs, contentValues),
  };
  const accessibilityProps = { ...visualAccessibilityProps(renderNode), "data-cms-style-id": visualStyleId(node, assetRefs, contentValues) };
  if (content !== undefined) {
    // Structural/inherited spacing must not erase the system block's own type scale.
    const declares = (key: "color" | "fontFamily" | "fontSize") =>
      [renderNode.styles, ...Object.values(renderNode.responsiveStyles ?? {})].some(values => values?.[key] !== undefined);
    return <div className={`${className} cmsVisualPresentation`} style={style}
      data-cms-presentation-color={declares("color") || undefined}
      data-cms-presentation-font-family={declares("fontFamily") || undefined}
      data-cms-presentation-font-size={declares("fontSize") || undefined}
      {...accessibilityProps} {...spaceAttributes}>{content}</div>;
  }

  if (renderNode.type === "newsletterForm") {
    const part = (name: string) => renderNode.children?.find(child => child.props?.newsletterPart === name);
    const partStyle = (name: string) => {
      const child = part(name);
      return child ? visualNodeStyle(child.styles, child.responsiveStyles, visualViewport, assetRefs, contentValues) : undefined;
    };
    const newsletter = <CmsNewsletterForm label={text(renderNode.props?.ariaLabel, 160) ?? "Correo electrónico"} placeholder={text(renderNode.props?.title, 160) ?? "Tu correo electrónico"} submitLabel={text(renderNode.props?.text, 160) ?? "SUSCRIBIR"} style={style} inputStyle={partStyle("email")} consentStyle={partStyle("consent")} privacyStyle={partStyle("privacy")} feedbackStyle={partStyle("feedback")} privacyLabel={text(part("privacy")?.props?.text,160) ?? "Política de Privacidad"} />;
    return (renderNode as CmsVisualNode & {renderDomId?:string}).renderDomId ? <div {...accessibilityProps}>{newsletter}</div> : newsletter;
  }

  if (renderNode.type === "heading") {
    return createElement(
      visualHeadingTag(renderNode.props),
      { className, style, ...accessibilityProps },
      text(renderNode.props?.text, 500) ?? text(renderNode.props?.title, 500) ?? text(renderNode.label, 120) ?? children,
    );
  }

  if (renderNode.type === "paragraph") {
    return (
      <p className={className} style={style} {...accessibilityProps}>
        {text(renderNode.props?.text, 4000) ?? children}
      </p>
    );
  }

  if (renderNode.type === "richText") {
    const html = typeof renderNode.props?.html === "string" ? renderNode.props.html : undefined;
    return html !== undefined ? (
      <div className={className} style={style} {...accessibilityProps}
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }} />
    ) : (
      <div className={className} style={style} {...accessibilityProps}>
        {text(renderNode.props?.text, 4000) ?? children}
      </div>
    );
  }

  if (renderNode.type === "image") {
    return <VisualImage assetRefs={assetRefs} node={renderNode} renderImage={renderImage} style={style} styleId={accessibilityProps["data-cms-style-id"]} />;
  }

  if (renderNode.type === "button" || renderNode.type === "link") {
    return (
      <VisualAction
        node={renderNode}
        renderLink={renderLink}
        style={style}
      />
    );
  }

  if (renderNode.type === "icon") {
    const icon = findCmsIcon(renderNode.props?.text);
    if (icon) {
      const Icon = icon.Icon;
      return <span className={className} style={style} {...accessibilityProps}>
        <Icon width="1em" height="1em" aria-hidden="true" style={{ verticalAlign: "middle" }} />
      </span>;
    }
    return (
      <span className={className} style={style} {...accessibilityProps}>
        {text(renderNode.props?.text, 80) ?? text(renderNode.props?.title, 80)}
      </span>
    );
  }

  if (renderNode.type === "spacer") {
    return <div aria-hidden="true" className={className} style={style} {...accessibilityProps} />;
  }

  if (renderNode.type === "video") {
    return <VisualMediaLink node={renderNode} style={style} />;
  }

  if (renderNode.type === "htmlEmbed") {
    return (
      <div className={className} style={style} {...accessibilityProps}>
        {text(renderNode.props?.html, 6000) ?? text(renderNode.props?.text, 6000)}
      </div>
    );
  }

  if (renderNode.type === "section" || renderNode.type === "container") {
    return (
      <section className={className} style={style} {...accessibilityProps}>
        {children}
      </section>
    );
  }

  return (
    <div className={className} style={style} {...accessibilityProps}>
      {children}
    </div>
  );
}

function renderVisualNodeChildren(
  node: CmsVisualNode,
  depth: number,
  renderImage: CmsBlockRendererProps["renderImage"] | undefined,
  renderLink: CmsBlockRendererProps["renderLink"] | undefined,
  visualViewport: CmsVisualBreakpoint | undefined,
  assetRefs: CmsVisualAssetRef[],
  contentValues: Record<string, unknown>,
) {
  const children = (node.children ?? []).slice(0, maximumVisualChildrenPerNode);
  if (children.length === 0) return null;
  return children.map((child) => (
    <VisualNodeRenderer
      assetRefs={assetRefs}
      contentValues={contentValues}
      depth={depth + 1}
      key={child.nodeId}
      node={child}
      renderImage={renderImage}
      renderLink={renderLink}
      visualViewport={visualViewport}
    />
  ));
}

function VisualImage({
  assetRefs,
  node,
  renderImage,
  style,
  styleId,
}: {
  assetRefs: CmsVisualAssetRef[];
  node: CmsVisualNode;
  renderImage?: CmsBlockRendererProps["renderImage"];
  style: CSSProperties;
  styleId: string;
}) {
  const src = visualAssetUrl(node.props?.src, assetRefs);
  const alt = text(node.props?.alt, 200) ?? text(node.props?.title, 200) ?? "";
  if (!src) return null;
  // Keep image geometry when the legacy variable rules resolve to initial values.
  // Explicit module styles and the generated responsive rules still take precedence.
  const imageStyle: CSSProperties = {
    display: "block", position: "relative", overflow: "hidden", width: "100%",
    minHeight: "180px", height: "490px", backgroundPosition: "center",
    backgroundRepeat: "no-repeat", backgroundSize: "cover", ...style,
  };

  if (renderImage) {
    return (
      <span data-cms-style-id={styleId} {...((node as CmsVisualNode & {renderDomId?:string}).renderDomId ? visualAccessibilityProps(node) : {})} className={visualNodeClassName(node)} style={imageStyle}>
        {renderImage({
          alt,
          className: "cmsVisualImageMedia",
          sizes: "(max-width: 680px) 100vw, 50vw",
          src,
        })}
      </span>
    );
  }

  return (
    <span
      data-cms-style-id={styleId}
      {...((node as CmsVisualNode & {renderDomId?:string}).renderDomId ? visualAccessibilityProps(node) : {})}
      aria-label={alt}
      className={`${visualNodeClassName(node)} cmsVisualImageMedia`}
      role="img"
      style={{ ...imageStyle, backgroundImage: `url(${src})` }}
    />
  );
}

function VisualAction({
  node,
  renderLink,
  style,
}: {
  node: CmsVisualNode;
  renderLink?: CmsBlockRendererProps["renderLink"];
  style: CSSProperties;
}) {
  const independent = Boolean((node as CmsVisualNode & {renderDomId?:string}).renderDomId);
  const href = independent && /^#cms-[A-Za-z0-9_-]+$/.test(node.props?.href ?? '') ? node.props!.href! : safeLinkHref(node.props?.href);
  const accessibility = independent ? visualAccessibilityProps(node) : {};
  const label = text(node.props?.text, 160) ?? text(node.props?.title, 160);
  const className = visualNodeClassName(node);
  if (!label) return null;

  if (href && renderLink) {
    return renderLink({
      className,
      href,
      label,
      rel: safeRel(node.props?.rel, node.props?.target),
      style,
      target: node.props?.target,
      title: text(node.props?.title, 200) ?? undefined,
    });
  }

  if (href) {
    return (
      <a
        {...accessibility}
        className={className}
        href={href}
        rel={safeRel(node.props?.rel, node.props?.target)}
        style={style}
        target={node.props?.target}
        title={text(node.props?.title, 200) ?? undefined}
      >
        {label}
      </a>
    );
  }

  return (
    <span {...accessibility} className={`${className} cmsVisualActionStatic`} style={style}>
      {label}
    </span>
  );
}

function VisualMediaLink({ node, style }: { node: CmsVisualNode; style: CSSProperties }) {
  const href = safeMediaUrl(node.props?.src);
  const label = text(node.props?.title, 120) ?? text(node.props?.text, 120) ?? "Video";
  if (!href) return null;
  return (
    <a
      {...((node as CmsVisualNode & {renderDomId?:string}).renderDomId ? visualAccessibilityProps(node) : {})}
      className={visualNodeClassName(node)}
      href={href}
      rel="noreferrer"
      style={style}
      target="_blank"
    >
      {label}
    </a>
  );
}

function visualNodeClassName(node: CmsVisualNode) {
  const typeClass = `${node.type.slice(0, 1).toUpperCase()}${node.type.slice(1)}`
    .replace(/[^A-Za-z0-9]/g, "");
  return [
    "cmsVisualNode",
    `cmsVisual${typeClass}`,
    ...visualVisibilityClassNames(node.visibility),
    ...visualAnimationClassNames(node.animation),
    ...visualInteractionClassNames(node.interactions),
  ].join(" ");
}

function visualAccessibilityProps(node: CmsVisualNode) {
  const domId = (node as CmsVisualNode & { renderDomId?: string }).renderDomId;
  return {
    id: domId,
    "aria-labelledby": domId ? node.props?.ariaLabelledBy : undefined,
    "aria-describedby": domId ? node.props?.ariaDescribedBy : undefined,
    "aria-label": text(node.props?.ariaLabel, 200) ?? undefined,
    "data-cms-node-id": node.nodeId,
    "data-cms-node-type": node.type,
    "data-cms-animation": node.animation?.preset && node.animation.preset !== "none" ? node.animation.preset : undefined,
    "data-cms-hover": node.interactions?.hover?.styles && Object.keys(node.interactions.hover.styles).length ? "true" : undefined,
    title: text(node.props?.title, 200) ?? undefined,
  };
}

type VisualHeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function visualHeadingTag(props: CmsVisualNode["props"]): VisualHeadingTag {
  const extendedProps = props as (CmsVisualNode["props"] & {
    as?: unknown;
    headingLevel?: unknown;
    level?: unknown;
  }) | undefined;
  const rawLevel = extendedProps?.level ?? extendedProps?.headingLevel;
  if (typeof rawLevel === "number" && Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 6) {
    return `h${rawLevel}` as VisualHeadingTag;
  }
  if (typeof rawLevel === "string" && /^h?[1-6]$/.test(rawLevel.trim())) {
    return `h${rawLevel.trim().replace(/^h/, "")}` as VisualHeadingTag;
  }
  const rawAs = extendedProps?.as;
  if (typeof rawAs === "string" && /^h[1-6]$/.test(rawAs.trim())) {
    return rawAs.trim() as VisualHeadingTag;
  }
  return "h2";
}

function visualVisibilityClassNames(visibility: CmsVisualNode["visibility"]) {
  if (!visibility) return [];
  return (["mobile", "tablet", "desktop"] as const)
    .filter((breakpoint) => visibility[breakpoint] === false)
    .map((breakpoint) => `cmsVisualHidden${breakpoint.slice(0, 1).toUpperCase()}${breakpoint.slice(1)}`);
}

function visualAnimationClassNames(animation: CmsVisualNode["animation"]) {
  if (!animation || animation.preset === "none") return [];
  const preset = animation.preset.slice(0, 1).toUpperCase() + animation.preset.slice(1);
  const trigger = animation.trigger === "inView" ? "InView" : "Load";
  return ["cmsVisualAnimated", `cmsVisualAnimation${preset}`, `cmsVisualAnimationTrigger${trigger}`];
}

const visualHoverStyleKeys = [
  "backgroundColor",
  "borderColor",
  "boxShadow",
  "color",
  "opacity",
  "transform",
] as const satisfies readonly CmsVisualHoverStyleKey[];

function visualInteractionClassNames(interactions: CmsVisualNode["interactions"]) {
  const hoverStyles = interactions?.hover?.styles;
  if (!hoverStyles || Object.keys(hoverStyles).length === 0) return [];
  return [
    "cmsVisualHoverable",
    ...visualHoverStyleKeys
      .filter((key) => Boolean(hoverStyles[key]))
      .map((key) => `cmsVisualHover${key.slice(0, 1).toUpperCase()}${key.slice(1)}`),
  ];
}

const visualStyleVariableKeys = [
  "alignItems",
  "backgroundColor",
  "backgroundImage",
  "backgroundPosition",
  "backgroundSize",
  "border",
  "borderColor",
  "borderRadius",
  "borderStyle",
  "borderWidth",
  "boxShadow",
  "color",
  "columnGap",
  "display",
  "aspectRatio",
  "flexDirection",
  "flexWrap",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "gap",
  "gridTemplateColumns",
  "height",
  "justifyContent",
  "left",
  "letterSpacing",
  "lineHeight",
  "margin",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginTop",
  "maxHeight",
  "maxWidth",
  "minHeight",
  "minWidth",
  "objectFit",
  "opacity",
  "overflow",
  "padding",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "position",
  "rowGap",
  "textAlign",
  "top",
  "transform",
  "width",
] as const;
const visualStyleVariableKeyAliases = visualStyleVariableKeys.reduce<Record<string, typeof visualStyleVariableKeys[number]>>((aliases, key) => {
  aliases[key] = key;
  aliases[key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)] = key;
  return aliases;
}, {});

function visualNodeStyle(
  styles: CmsVisualNodeStyle | undefined,
  responsiveStyles: CmsVisualResponsiveStyles | undefined,
  visualViewport?: CmsVisualBreakpoint,
  assetRefs: CmsVisualAssetRef[] = [],
  contentValues: Record<string, unknown> = {},
): CSSProperties {
  const style: Record<string, string> = {};
  for (const key of visualStyleVariableKeys) {
    const baseValue = styles?.[key];
    const resolvedBaseValue = baseValue ? visualStyleValueForCss(key, baseValue, assetRefs, contentValues) : null;
    if (resolvedBaseValue) style[key] = resolvedBaseValue;
    const scopedValue = visualViewport
      ? visualViewportStyleValue(styles, responsiveStyles, visualViewport, key)
      : responsiveStyles?.desktop?.[key];
    const resolvedScopedValue = scopedValue ? visualStyleValueForCss(key, scopedValue, assetRefs, contentValues) : null;
    if (resolvedScopedValue) style[key] = resolvedScopedValue;
  }
  return style as CSSProperties;
}

function visualAnimationStyleVariables(animation: CmsVisualNode["animation"]): CSSProperties {
  if (!animation || animation.preset === "none") return {};
  const easingValue = animation.easing === "linear"
    ? "linear"
    : animation.easing === "emphasized"
      ? "cubic-bezier(0.2, 0, 0, 1)"
      : "cubic-bezier(0.2, 0, 0.2, 1)";
  return {
    "--cms-visual-animation-duration": `${animation.durationMs ?? 600}ms`,
    "--cms-visual-animation-delay": `${animation.delayMs ?? 0}ms`,
    "--cms-visual-animation-easing": easingValue,
  } as CSSProperties;
}

function visualInteractionStyleVariables(
  interactions: CmsVisualNode["interactions"],
  assetRefs: CmsVisualAssetRef[] = [],
  contentValues: Record<string, unknown> = {},
): CSSProperties {
  const hover = interactions?.hover;
  if (!hover?.styles || Object.keys(hover.styles).length === 0) return {};
  const style: Record<string, string> = {};
  for (const key of visualHoverStyleKeys) {
    const value = hover.styles[key];
    const resolvedValue = value ? visualStyleValueForCss(key, value, assetRefs, contentValues) : null;
    if (resolvedValue) {
      style[`--cms-visual-hover-${key}`] = resolvedValue;
    }
  }
  if (Object.keys(style).length === 0) return {};
  const easingValue = hover.transition?.easing === "linear"
    ? "linear"
    : hover.transition?.easing === "emphasized"
      ? "cubic-bezier(0.2, 0, 0, 1)"
      : "cubic-bezier(0.2, 0, 0.2, 1)";
  style["--cms-visual-hover-transition-duration"] = `${hover.transition?.durationMs ?? 160}ms`;
  style["--cms-visual-hover-transition-delay"] = `${hover.transition?.delayMs ?? 0}ms`;
  style["--cms-visual-hover-transition-easing"] = easingValue;
  return style as CSSProperties;
}

function visualStylesToNodeStyles(
  styles: CmsVisualStylesByScope | undefined,
  assetRefs: NonNullable<CmsVisualModuleV2Props["assetRefs"]>,
): Pick<CmsVisualNode, "responsiveStyles" | "styles"> {
  const base = visualStyleDeclarationToNodeStyle(styles?.base, assetRefs);
  const responsiveStyles: CmsVisualResponsiveStyles = {};
  for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
    const scoped = visualStyleDeclarationToNodeStyle(styles?.[breakpoint], assetRefs);
    if (Object.keys(scoped).length) responsiveStyles[breakpoint] = scoped;
  }
  return {
    ...(Object.keys(base).length ? { styles: base } : {}),
    ...(Object.keys(responsiveStyles).length ? { responsiveStyles } : {}),
  };
}

function visualStyleDeclarationToNodeStyle(
  declaration: CmsVisualStyleDeclaration | undefined,
  assetRefs: NonNullable<CmsVisualModuleV2Props["assetRefs"]>,
): CmsVisualNodeStyle {
  const style: CmsVisualNodeStyle = {};
  for (const [rawKey, rawValue] of Object.entries(declaration ?? {})) {
    const key = visualStyleVariableKeyAliases[rawKey];
    if (key && rawValue.startsWith("binding:")) {
      style[key] = rawValue;
      continue;
    }
    const cssValue = visualStyleValueForCss(key, rawValue, assetRefs);
    if (key && cssValue) style[key] = cssValue;
  }
  return style;
}

function visualStyleValueForCss(
  key: typeof visualStyleVariableKeys[number] | undefined,
  value: string,
  assetRefs: NonNullable<CmsVisualModuleV2Props["assetRefs"]>,
  contentValues: Record<string, unknown> = {},
) {
  if (!key) return null;
  const resolvedValue = value.startsWith("binding:")
    ? visualStyleBindingValue(value, contentValues)
    : value;
  if (!resolvedValue || /(?:javascript:|expression\s*\(|@import|[{};<>\\\x00-\x1f])/i.test(resolvedValue)) return null;
  if (/url\s*\(/i.test(resolvedValue)) {
    const match = /^url\(["']?([^()"']+)["']?\)$/.exec(resolvedValue);
    if (key !== "backgroundImage" || !match || !safeMediaUrl(match[1])) return null;
  }
  if (key === "gridTemplateColumns" && value.startsWith("binding:")) {
    const leftRatio = Number(resolvedValue);
    if (Number.isFinite(leftRatio) && leftRatio >= 20 && leftRatio <= 80) {
      return `minmax(0, ${leftRatio}fr) minmax(0, ${100 - leftRatio}fr)`;
    }
  }
  if (key === "backgroundImage" && resolvedValue.startsWith("asset:")) {
    const src = visualAssetUrl(resolvedValue, assetRefs);
    const cssSrc = src?.replace(/[\s"'()\\{};<>]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return cssSrc ? `url(${cssSrc})` : null;
  }
  if (resolvedValue.startsWith("var:")) return visualTokenValueForCss(resolvedValue);
  if (value.startsWith("binding:") && !visualRuntimeStyleValueIsSafe(key, resolvedValue)) return null;
  return resolvedValue;
}

function visualStyleBindingValue(value: string, contentValues: Record<string, unknown>) {
  const key = value.slice("binding:".length).trim();
  if (!/^[a-zA-Z0-9_.:-]+$/.test(key)) return null;
  const boundValue = contentValues[key];
  if (typeof boundValue === "string") return boundValue.trim() || null;
  if (typeof boundValue === "number" && Number.isFinite(boundValue)) return String(boundValue);
  return null;
}

function visualRuntimeStyleValueIsSafe(key: typeof visualStyleVariableKeys[number], value: string) {
  if (key === "backgroundImage") return value.startsWith("asset:");
  return !/(url\s*\(|javascript:|expression\s*\(|@import|<\/?[a-z]|[{};])/i.test(value);
}

function visualAssetUrl(value: unknown, assetRefs: CmsVisualAssetRef[]) {
  const rawValue = text(value, 2048);
  if (rawValue?.startsWith("asset:")) {
    const asset = assetRefs.find((candidate) => candidate.assetKey === rawValue.slice("asset:".length));
    return safeMediaUrl(asset?.src ?? asset?.url ?? visualAssetPreviewUrl(asset?.mediaAssetId));
  }
  return safeMediaUrl(rawValue);
}

function visualAssetPreviewUrl(mediaAssetId: string | undefined) {
  return mediaAssetId
    ? `/api/admin/media-assets/${encodeURIComponent(mediaAssetId)}/content?variant=large_default`
    : undefined;
}

const visualTokenValues: Record<string, Record<string, string>> = {
  color: {
    background: "var(--admin-surface, #ffffff)",
    border: "var(--admin-border-subtle, #dbe2ea)",
    muted: "var(--admin-text-muted, #667085)",
    primary: "var(--admin-accent, #25b9d7)",
    surface: "var(--admin-surface-soft, #f8fafc)",
    text: "var(--admin-text, #1d232b)",
  },
  fontFamily: {
    body: "var(--admin-font-body, Inter, system-ui, sans-serif)",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    sans: "var(--admin-font-body, Inter, system-ui, sans-serif)",
  },
  fontSize: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px",
    "4xl": "40px",
    "5xl": "56px",
  },
  radius: {
    none: "0",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "999px",
  },
  shadow: {
    none: "none",
    sm: "0 1px 2px rgb(15 23 42 / 0.08)",
    md: "0 10px 30px rgb(15 23 42 / 0.12)",
    lg: "0 20px 45px rgb(15 23 42 / 0.16)",
  },
  spacing: {
    none: "0",
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
    "3xl": "64px",
  },
};

function visualTokenValueForCss(value: string) {
  const [scale, token] = value.slice("var:".length).split(".");
  return visualTokenValues[scale]?.[token] ?? null;
}

function visualNodeTypeFromValue(value: string, fallback: CmsVisualNode["type"]): CmsVisualNode["type"] {
  if (value === "container" || value === "section" || value === "div" || value === "grid" || value === "flex" || value === "heading" || value === "paragraph" || value === "richText" || value === "image" || value === "button" || value === "link" || value === "icon" || value === "spacer" || value === "video" || value === "htmlEmbed") {
    return value;
  }
  return fallback;
}

function visualNodePropsFromRecord(value: unknown): NonNullable<CmsVisualNode["props"]> {
  const record = recordValues(value);
  return {
    ...(["email", "consent", "privacy", "feedback"].includes(String(record.newsletterPart)) ? { newsletterPart: String(record.newsletterPart) } : {}),
    ...(text(record.alt, 200) ? { alt: text(record.alt, 200) ?? undefined } : {}),
    ...(text(record.ariaLabelledBy, 2048) ? { ariaLabelledBy: text(record.ariaLabelledBy, 2048)! } : {}),
    ...(text(record.ariaDescribedBy, 2048) ? { ariaDescribedBy: text(record.ariaDescribedBy, 2048)! } : {}),
    ...(text(record.ariaLabel, 200) ? { ariaLabel: text(record.ariaLabel, 200) ?? undefined } : {}),
    ...(text(record.headingLevel, 2) ? { headingLevel: text(record.headingLevel, 2) ?? undefined } : {}),
    ...(text(record.href, 2048) ? { href: text(record.href, 2048) ?? undefined } : {}),
    ...(text(record.html, 6000) ? { html: text(record.html, 6000) ?? undefined } : {}),
    ...(text(record.level, 2) ? { level: text(record.level, 2) ?? undefined } : {}),
    ...(text(record.rel, 120) ? { rel: text(record.rel, 120) ?? undefined } : {}),
    ...(text(record.src, 2048) ? { src: text(record.src, 2048) ?? undefined } : {}),
    ...(text(record.text, 4000) ? { text: text(record.text, 4000) ?? undefined } : {}),
    ...(text(record.title, 200) ? { title: text(record.title, 200) ?? undefined } : {}),
    ...(record.target === "_blank" || record.target === "_self" || record.target === "_parent" || record.target === "_top" ? { target: record.target } : {}),
  };
}

function visualBoundProps(element: CmsVisualElement, contentValues: Record<string, unknown>): NonNullable<CmsVisualNode["props"]> {
  if (!element.contentBinding) return {};
  const value = contentValues[element.contentBinding];
  if (typeof value === "string") {
    if (element.elementType === "image" || element.elementType === "video") return { src: value };
    if (element.elementType === "htmlEmbed" || element.elementType === "richText") return { html: value };
    return { text: value };
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return visualNodePropsFromRecord(value);
  }
  return {};
}

function visualNodeBoundProps(node: CmsVisualNode, contentValues: Record<string, unknown>): NonNullable<CmsVisualNode["props"]> {
  if (!node.contentBinding) return {};
  const value = contentValues[node.contentBinding];
  if (typeof value === "string") {
    if (node.type === "image" || node.type === "video") return { src: value };
    if (node.type === "htmlEmbed" || node.type === "richText") return { html: value };
    if (node.type === "button" || node.type === "link") return { text: value };
    return { text: value };
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return visualNodePropsFromRecord(value);
  }
  return {};
}

function recordValues(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function visualViewportStyleValue(
  styles: CmsVisualNodeStyle | undefined,
  responsiveStyles: CmsVisualResponsiveStyles | undefined,
  visualViewport: CmsVisualBreakpoint,
  key: typeof visualStyleVariableKeys[number],
) {
  if (visualViewport === "mobile") {
    return responsiveStyles?.mobile?.[key]
      ?? responsiveStyles?.tablet?.[key]
      ?? responsiveStyles?.desktop?.[key]
      ?? styles?.[key]
      ?? null;
  }
  if (visualViewport === "tablet") {
    return responsiveStyles?.tablet?.[key]
      ?? responsiveStyles?.desktop?.[key]
      ?? styles?.[key]
      ?? null;
  }
  return responsiveStyles?.desktop?.[key] ?? styles?.[key] ?? null;
}

function CmsCard({
  item,
  index,
  renderImage,
  renderLink,
}: {
  item: Record<string, unknown>;
  index: number;
  renderImage: CmsBlockRendererProps["renderImage"];
  renderLink: CmsBlockRendererProps["renderLink"];
}) {
  const title = text(item.title) ?? `Contenido ${index + 1}`;
  const imageUrl = safeMediaUrl(item.imageUrl);
  return (
    <article>
      {imageUrl ? (
        <CmsImage
          alt={text(item.imageAlt, 200) ?? title}
          renderImage={renderImage}
          src={imageUrl}
        />
      ) : null}
      <strong>{title}</strong>
      {text(item.body, 1000) ?? text(item.subtitle, 1000) ? (
        <p>{text(item.body, 1000) ?? text(item.subtitle, 1000)}</p>
      ) : null}
      <CmsAction href={item.href ?? item.ctaHref} label={item.ctaLabel ?? "Ver más"} renderLink={renderLink} />
    </article>
  );
}

function CmsImage({
  alt,
  className = "storefrontCmsMedia",
  renderImage,
  sizes = "(max-width: 680px) 100vw, 50vw",
  src,
}: {
  alt: string;
  className?: string;
  renderImage: CmsBlockRendererProps["renderImage"];
  sizes?: string;
  src: string;
}) {
  if (renderImage) {
    return renderImage({
      alt,
      className,
      sizes,
      src,
    });
  }
  return (
    <div
      aria-label={alt}
      className={className}
      role="img"
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}

function CmsAction({
  href,
  label,
  renderLink,
}: {
  href: unknown;
  label: unknown;
  renderLink: CmsBlockRendererProps["renderLink"];
}) {
  const safeHref = safeLinkHref(href);
  const safeLabel = text(label, 80);
  if (!safeHref || !safeLabel) return null;
  if (renderLink) {
    return renderLink({
      className: "storefrontCmsAction",
      href: safeHref,
      label: safeLabel,
    });
  }
  return <a className="storefrontCmsAction" href={safeHref} rel="noreferrer">{safeLabel}</a>;
}

function renderAdminPreviewBlock(block: CmsBlock, visualViewport?: CmsVisualBreakpoint) {
  const surface = getCmsBlockSurface(block);
  const placement = getCmsBlockPlacement(block);
  const target = getCmsBlockPlpTarget(block);
  const wrapperClass = surface === "plp" ? "cmsPreviewBlock cmsPreviewBlockPlp" : "cmsPreviewBlock";
  const wrapperLabel = surface === "plp"
    ? `${placement === "beforeList" ? "Antes PLP" : "Despues PLP"} · ${target.routePath || target.categorySlug || "sin target"}`
    : "Pagina CMS";

  if (systemBlockLabels[block.type]) {
    const detail = previewTextProp(block, "label")
      || previewTextProp(block, "title")
      || previewTextProp(block, "text")
      || previewTextProp(block, "placeholder");
    return <section className={`${wrapperClass} cmsPreviewSystemBlock`}><small>Modulo de sistema</small><h3>{systemBlockLabels[block.type]}</h3>{detail ? <p>{detail}</p> : null}</section>;
  }

  if (block.type === "commerce.productGrid") {
    const source = recordValues(block.props.source);
    return <section className={`${wrapperClass} cmsPreviewProductGrid`}><small>{wrapperLabel}</small><h3 style={{textAlign:"center"}}>{previewTextProp(block, "heading", "Productos destacados")}</h3><p style={{textAlign:"center"}}>{previewTextProp(block,"subtitle")}</p><p>{String(source.kind ?? "CATEGORY")} · maximo {Math.min(20, Number(block.props.limit) || 20)} productos</p><div className="cmsPlpProductGrid"><PreviewProductCard name="Producto dinamico" oldPrice="" price="--" /><PreviewProductCard name="Hidratado por BFF" oldPrice="" price="--" /></div></section>;
  }

  if (block.type === "banner.hero") {
    return (
      <section className={`${wrapperClass} cmsPreviewHero`}>
        <small>{wrapperLabel}</small>
        <div>
          <span>{previewTextProp(block, "eyebrow", "Hero")}</span>
          <h3>{previewTextProp(block, "heading", "Titulo hero")}</h3>
          <p>{previewTextProp(block, "body", "Texto de apoyo")}</p>
          <strong>{previewTextProp(block, "ctaLabel", "CTA")}</strong>
        </div>
        <PreviewMedia label="Hero image" value={previewTextProp(block, "imageUrl")} />
      </section>
    );
  }

  if (block.type === "slider.fullWidth") {
    const slides = previewArrayProp(block, "slides");
    return (
      <section className={`${wrapperClass} cmsPreviewSlider`}>
        <small>{wrapperLabel}</small>
        {slides.map((slide, index) => {
          const record = typeof slide === "object" && slide !== null ? slide as Record<string, unknown> : {};
          return (
            <div key={index}>
              <strong>{String(record.title ?? `Slide ${index + 1}`)}</strong>
              <p>{String(record.body ?? "")}</p>
            </div>
          );
        })}
      </section>
    );
  }

  if (block.type === "category.imageTiles") {
    const blockItems = previewArrayProp(block, "items");
    return (
      <section className={`${wrapperClass} cmsPreviewCategoryTiles`}>
        <small>{wrapperLabel}</small>
        {previewTextProp(block, "heading") ? <h3>{previewTextProp(block, "heading")}</h3> : null}
        <div style={{ gridTemplateColumns: `repeat(${boundedInteger(block.props.columns, 2, 1, 4)}, minmax(0, 1fr))` }}>
          {blockItems.map((item, index) => {
            const record = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
            return (
              <article key={index}>
                <PreviewMedia label="Category tile image" value={String(record.imageUrl ?? "")} />
                <strong>{String(record.title ?? `Categoria ${index + 1}`)}</strong>
                <span>{String(record.href ?? "/")}</span>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (block.type === "plp.categoryIntro") {
    if (block.props.backgroundMode === true) return <div className={wrapperClass}><small>{wrapperLabel}</small><CategoryIntroBlock block={block} renderImage={undefined} /></div>;
    return (
      <section className={`${wrapperClass} cmsPreviewCategoryIntro`}>
        <small>{wrapperLabel}</small>
        <div>
          <h3>{previewTextProp(block, "heading", "Categoria")}</h3>
          <p>{previewTextProp(block, "body", "Descripcion de categoria")}</p>
        </div>
        <PreviewMedia label="Category image" value={previewTextProp(block, "imageUrl")} />
      </section>
    );
  }

  if (block.type === "plp.subcategoryTiles") {
    const blockItems = previewArrayProp(block, "items");
    return (
      <section className={`${wrapperClass} cmsPreviewSubcategories`}>
        <small>{wrapperLabel}</small>
        <h3>{previewTextProp(block, "heading", "Subcategorias")}</h3>
        <div>
          {blockItems.map((item, index) => {
            const record = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
            return (
              <article key={index}>
                <PreviewMedia label="Subcategory image" value={String(record.imageUrl ?? "")} />
                <strong>{String(record.title ?? `Subcategoria ${index + 1}`)}</strong>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (block.type === "accordion") {
    const blockItems = previewArrayProp(block, "items");
    return (
      <section className={`${wrapperClass} cmsPreviewAccordion`}>
        <small>{wrapperLabel}</small>
        <h3>{previewTextProp(block, "heading", "Acordeon")}</h3>
        {blockItems.map((item, index) => {
          const record = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
          return (
            <details key={index}>
              <summary>{String(record.title ?? `Item ${index + 1}`)}</summary>
              <p>{String(record.content ?? "")}</p>
            </details>
          );
        })}
      </section>
    );
  }

  if (block.type === "visual.module") {
    return (
      <section className={`${wrapperClass} cmsPreviewVisualModule`}>
        <small>{wrapperLabel}</small>
        <div className="cmsPreviewVisualModuleCanvas">
          <VisualModuleBlock block={block} visualViewport={visualViewport} />
        </div>
      </section>
    );
  }

  const blockItems = previewArrayProp(block, "items");
  return (
    <section className={`${wrapperClass} cmsPreviewCarousel`}>
      <small>{wrapperLabel}</small>
      <h3>{previewTextProp(block, "heading", "Carousel")}</h3>
      <div>
        {blockItems.map((item, index) => {
          const record = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
          return (
            <article key={index}>
              <PreviewMedia label="Card image" value={String(record.imageUrl ?? "")} />
              <strong>{String(record.title ?? `Card ${index + 1}`)}</strong>
              <p>{String(record.body ?? "")}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DefaultCategoryIntro() {
  return (
    <section className="cmsPreviewCategoryIntro">
      <div>
        <h3>Clothes</h3>
        <p>Discover our favorites fashionable discoveries, a selection of cool items to integrate in your wardrobe.</p>
      </div>
      <PreviewMedia label="Category image" value="" />
    </section>
  );
}

function PreviewProductCard({ name, oldPrice, price }: { name: string; oldPrice: string; price: string }) {
  return (
    <article className="cmsPlpProductCard">
      <div className="cmsPlpProductImage">Vista rapida</div>
      <strong>{name}</strong>
      <div>
        <s>{oldPrice}</s>
        <span>{price}</span>
      </div>
      <small>-20% · Nuevo</small>
    </article>
  );
}

function PreviewMedia({ label, value }: { label: string; value: string }) {
  if (value) {
    return (
      <div
        className="cmsPreviewMediaImage"
        role="img"
        aria-label={label}
        style={{ backgroundImage: `url(${value})` }}
      />
    );
  }
  return <div className="cmsPreviewMediaPlaceholder">{label}</div>;
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

function safeRel(value: unknown, target: unknown) {
  const rel = text(value, 120);
  if (rel && /^[a-z\s-]+$/i.test(rel)) return rel;
  return target === "_blank" ? "noreferrer" : undefined;
}

function text(value: unknown, maximumLength = 300) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximumLength)
    : null;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, Math.round(parsed)))
    : fallback;
}

function items(value: unknown) {
  return Array.isArray(value)
    ? value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .slice(0, maximumItemsPerBlock)
    : [];
}

function productItems(value: unknown) {
  return Array.isArray(value)
    ? value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .slice(0, 20)
    : [];
}

function previewTextProp(block: CmsBlock, key: string, fallback = "") {
  const value = block.props[key];
  return typeof value === "string" ? value : fallback;
}

function previewArrayProp(block: CmsBlock, key: string) {
  const value = block.props[key];
  return Array.isArray(value) ? value : [];
}

/** Render a block stylesheet through the same value resolver as visual modules. */
export function cmsBlockStyleSheetCss(sheet: import("./index").CmsScopedStyleSheet, id: string, viewport?: CmsVisualBreakpoint, spaceOwner?: string) {
  const order = ["base", "desktop", "tablet", "mobile"] as const;
  return order.map(scope => {
    if (viewport === "desktop" && (scope === "tablet" || scope === "mobile")) return "";
    if (viewport === "tablet" && scope === "mobile") return "";
    const rules = (sheet[scope] ?? []).map(rule => {
      if (!cmsStyleSelectorSafe(rule.selector)) return "";
      const target = rule.selector + (spaceOwner ? `[data-cms-space-owner="${spaceOwner}"]` : "");
      const selector = target.startsWith(":scope") ? `#${id}${target.slice(6)}` : `#${id} ${target}`;
      const declarations = Object.entries(rule.styles).flatMap(([key, raw]) => {
        if (!visualStyleVariableKeys.includes(key as typeof visualStyleVariableKeys[number]) || typeof raw !== "string") return [];
        const value = visualStyleValueForCss(key as typeof visualStyleVariableKeys[number], raw, []);
        return value ? [`${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${value} !important`] : [];
      });
      return `${selector}{${declarations.join(";")}}`;
    }).join("");
    return !viewport && (scope === "tablet" || scope === "mobile") ? `@media(max-width:${scope === "tablet" ? 1023 : 767}px){${rules}}` : rules;
  }).join("");
}

// The independent editor and future composition renderer share this view.
export type CmsRegisteredModuleRenderer = (block: CmsBlock) => ReactNode;
export function CmsIndependentModuleView({ document, visualViewport, renderRegistered, inheritedDesign = emptyCmsDesign }: {
  inheritedDesign?: CmsResolvedDesign;
  renderRegistered?: CmsRegisteredModuleRenderer;
  document: {designSettings?:CmsDesignSettings;instanceId:string;name:string;body:{kind:'visual';value:CmsVisualModuleV2Props}|{kind:'registered';type:string;props:Record<string,unknown>};styleSheet?:import('./index').CmsScopedStyleSheet};
  visualViewport?:CmsVisualBreakpoint;
}) {
  const scoped = scopeIndependentModule(document);
  const design = cmsDesignPresentation(resolveCmsDesignSettings(inheritedDesign,document.designSettings));
  // Color naturally inherits through the DOM unless this module customizes it.
  for (const values of Object.values(design)) for (const key of ['color','backgroundColor'])
    if (!Object.values(document.designSettings??{}).some(value=>value?.[key as 'color'|'backgroundColor']!==undefined)) delete values[key];
  if(scoped.body.kind==='visual') {
    const own = scoped.body.value.styles;
    scoped.body.value.styles = Object.fromEntries(['base','desktop','tablet','mobile'].map(scope=>[scope,{...design[scope as keyof typeof design],...own?.base,...own?.[scope as keyof typeof own]}]));
  }
  const ownPresentation=scoped.body.kind==='registered'?scoped.body.props.presentation as CmsPresentation|undefined:undefined;
  const registeredPresentation={...ownPresentation,styles:Object.fromEntries(['base','desktop','tablet','mobile'].map(scope=>[scope,{...design[scope as keyof typeof design],...ownPresentation?.styles?.base,...ownPresentation?.styles?.[scope as keyof CmsVisualStylesByScope]}]))};
  const scopeId = `cms-piece-${safeIdentity(document.instanceId)}`;
  return <section id={scopeId} aria-label={`Módulo: ${document.name}`}>
    <style>{cmsBlockStyleSheetCss(scoped.styleSheet ?? {}, scopeId, visualViewport)}</style>
    {scoped.body.kind === 'visual'
      ? <VisualModuleV2Block independentIdentity blockProps={scoped.body.value as unknown as Record<string,unknown>} moduleProps={scoped.body.value} visualViewport={visualViewport} />
      : <CmsPresentationView presentation={registeredPresentation} visualViewport={visualViewport}>{renderRegistered ? renderRegistered({blockId:scoped.instanceId,type:scoped.body.type,props:scoped.body.props}) : <CmsBlockRenderer block={{blockId:scoped.instanceId,type:scoped.body.type,props:scoped.body.props}} visualViewport={visualViewport} />}</CmsPresentationView>}
  </section>;
}
function safeIdentity(value:string) { return value.replace(/[^A-Za-z0-9-]/g,char=>`_${char.charCodeAt(0).toString(16)}_`); }
function scopeIndependentModule<T extends {instanceId:string;body:{kind:'visual';value:CmsVisualModuleV2Props}|{kind:'registered';type:string;props:Record<string,unknown>};styleSheet?:import('./index').CmsScopedStyleSheet}>(document:T):T {
  const copy=structuredClone(document), ids=new Map<string,string>();
  const visit=(node:Record<string,unknown>,fn:(node:Record<string,unknown>)=>void)=>{fn(node);for(const key of ['panels','elements','children'])if(Array.isArray(node[key]))(node[key] as Record<string,unknown>[]).forEach(child=>visit(child,fn));};
  if(copy.body.kind==='visual'){
    const value=copy.body.value as unknown as Record<string,unknown>;
    visit(value,node=>{for(const key of ['moduleId','panelId','elementId'])if(typeof node[key]==='string')ids.set(node[key],`cms-${safeIdentity(copy.instanceId)}--${safeIdentity(node[key])}`);});
    const fragment=(value:string)=>value.startsWith('#')&&ids.has(value.slice(1))?'#'+ids.get(value.slice(1)):value;
    visit(value,node=>{
      for(const key of ['moduleId','panelId','elementId'])if(typeof node[key]==='string')node[key]=ids.get(node[key]);
      const props=node.props as Record<string,unknown>|undefined;
      if(props){for(const key of ['ariaLabelledBy','ariaDescribedBy'])if(typeof props[key]==='string')props[key]=props[key].split(' ').map(id=>ids.get(id)??id).join(' ');if(typeof props.href==='string')props.href=fragment(props.href);}
    });
    for(const [key,field] of Object.entries(copy.body.value.contentSchema))if(field.type==='url'){
      const values=copy.body.value.contentValues;if(values&&typeof values[key]==='string')values[key]=fragment(values[key]);
      if(typeof field.defaultValue==='string')field.defaultValue=fragment(field.defaultValue);
    }
  }
  if(copy.styleSheet)for(const rules of Object.values(copy.styleSheet))for(const rule of rules??[])rule.selector=rule.selector.replace(/\[[^\]]+\]|#[\w-]+/g,token=>token===`#${copy.instanceId}`?':scope':token.startsWith('#')?'#'+(ids.get(token.slice(1))??token.slice(1)):token.replace(/^(\[(?:data-cms-node-id|data-cms-visual-module|aria-labelledby|aria-describedby|id)=)(["']?)([\w.:-]+)\2\]$/,(_,start,quote,id)=>start==='[id='&&id===copy.instanceId?':scope':`${start}${quote}${ids.get(id)??id}${quote}]`));
  return copy;
}


export type CmsSectionViewDocument = {
 placement?:import('./index').CmsBlockModulePlacement;
 sectionId:string;name:string;designSettings?:CmsDesignSettings;styleSheet?:import('./index').CmsScopedStyleSheet;
 root:CmsSectionViewNode;
};
export type CmsSectionViewNode = {nodeId:string;kind:'container';layout:'stack'|'flex'|'grid';presentation:CmsPresentation;children:CmsSectionViewNode[]}|{nodeId:string;kind:'module';module:Parameters<typeof CmsIndependentModuleView>[0]['document']};
export function CmsSectionView({document,visualViewport,renderRegistered,inheritedDesign=emptyCmsDesign}:{document:CmsSectionViewDocument;visualViewport?:CmsVisualBreakpoint;renderRegistered?:CmsRegisteredModuleRenderer;inheritedDesign?:CmsResolvedDesign}) {
 const design=resolveCmsDesignSettings(inheritedDesign,document.designSettings);
 const inheritedStyles=cmsDesignPresentation(design);
 for(const values of Object.values(inheritedStyles))for(const key of ['color','backgroundColor'])
  if(!Object.values(document.designSettings??{}).some(value=>value?.[key as 'color'|'backgroundColor']!==undefined))delete values[key];
 const scopeId=`cms-space-${safeIdentity(document.sectionId)}`;
 const ids=new Map<string,string>([[document.sectionId,scopeId]]);
 const collect=(node:CmsSectionViewNode)=>{ids.set(node.nodeId,`${scopeId}-${safeIdentity(node.nodeId)}`);if(node.kind==='container')node.children.forEach(collect);};collect(document.root);
 const sheet=structuredClone(document.styleSheet??{});
 for(const rules of Object.values(sheet))for(const rule of rules??[])rule.selector=rule.selector.replace(/\[[^\]]+\]|#[\w-]+/g,token=>token.startsWith('#')?'#'+(ids.get(token.slice(1))??token.slice(1)):token);
 const render=(node:CmsSectionViewNode):ReactNode=>{
  const attributes={id:ids.get(node.nodeId)!,"data-cms-node-id":node.nodeId,"data-cms-space-owner":scopeId};
  if(node.kind==='module')return <div key={node.nodeId} {...attributes} style={{minWidth:0}} data-cms-block-type={node.module.body.kind==='registered'?node.module.body.type:'visual.module'}><CmsIndependentModuleView document={node.module} visualViewport={visualViewport} renderRegistered={renderRegistered} inheritedDesign={design}/></div>;
  const presentation=node.presentation;
  const base={display:node.layout==='grid'?'grid':'flex',flexDirection:node.layout==='stack'?'column':'row',...(node.layout==='grid'?{gridTemplateColumns:'repeat(2, minmax(0, 1fr))'}:{}),...(design.desktop.moduleGap!==undefined?{gap:design.desktop.moduleGap}:{}),...(node.layout==='grid'&&design.desktop.columnGap!==undefined?{columnGap:design.desktop.columnGap}:{}),...presentation.styles?.base};
  const visual:CmsVisualNode={nodeId:attributes.id,type:'container',...visualStylesToNodeStyles({...Object.fromEntries(['desktop','tablet','mobile'].map(scope=>[scope,{...(design[scope as keyof CmsResolvedDesign].moduleGap!==undefined?{gap:design[scope as keyof CmsResolvedDesign].moduleGap}:{}),...(node.layout==='grid'&&design[scope as keyof CmsResolvedDesign].columnGap!==undefined?{columnGap:design[scope as keyof CmsResolvedDesign].columnGap}:{}),...presentation.styles?.base,...presentation.styles?.[scope as keyof CmsVisualStylesByScope]}])),base} as CmsVisualStylesByScope,presentation.assetRefs??[]),visibility:presentation.visibility,animation:presentation.animation,interactions:presentation.interactions};
  return <VisualNodeRenderer key={node.nodeId} node={visual} assetRefs={presentation.assetRefs} visualViewport={visualViewport} spaceAttributes={attributes} content={node.children.map(render)}/>;
 };
 return <CmsPresentationView presentation={{styles:inheritedStyles}} visualViewport={visualViewport}><section id={scopeId} data-cms-space-owner={scopeId} aria-label={document.name}><style>{cmsBlockStyleSheetCss(sheet,scopeId,visualViewport,scopeId)}</style>{render(document.root)}</section></CmsPresentationView>;
}

// Page CSS owns only the composition root and section wrappers, never module internals.
export function CmsPageCompositionView({document,visualViewport,identity='preview',inheritedDesign=emptyCmsDesign,renderRegistered}:{renderRegistered?:CmsRegisteredModuleRenderer;inheritedDesign?:CmsResolvedDesign;document:{layout?:CmsCompositionLayout;designSettings?:CmsDesignSettings;compositionSchemaVersion:1;sections:CmsSectionViewDocument[];styleSheet?:import('./index').CmsScopedStyleSheet};visualViewport?:CmsVisualBreakpoint;identity?:string}) {
 const design=resolveCmsDesignSettings(inheritedDesign,document.designSettings);
 const scopeId=`cms-page-${safeIdentity(identity)}`;
 const ids=new Map(document.sections.map(section=>[section.sectionId,`${scopeId}-${safeIdentity(section.sectionId)}`]));
 const renderSection=(section:CmsSectionViewDocument)=><div key={section.sectionId} id={ids.get(section.sectionId)} data-cms-node-id={section.sectionId} data-cms-space-owner={scopeId}><CmsSectionView document={section} visualViewport={visualViewport} inheritedDesign={design} renderRegistered={renderRegistered}/></div>;
 const sheet=structuredClone(document.styleSheet??{});
 for(const rules of Object.values(sheet))for(const rule of rules??[])rule.selector=rule.selector.replace(/\[[^\]]+\]|#[\w-]+/g,token=>token.startsWith('#')?'#'+(ids.get(token.slice(1))??token.slice(1)):token);
 return <CmsPresentationView presentation={{styles:cmsDesignPresentation(design)}} visualViewport={visualViewport}><div id={scopeId} data-cms-space-owner={scopeId}><style>{cmsBlockStyleSheetCss(sheet,scopeId,visualViewport,scopeId)}</style>{document.layout?.styleSheet?<style>{cmsBlockStyleSheetCss(document.layout.styleSheet,scopeId,visualViewport,scopeId)}</style>:null}{document.layout?<CmsCompositionLayoutView ownerId={scopeId} layout={document.layout} sections={document.sections} renderSection={renderSection} viewport={visualViewport} moduleGap={design[visualViewport??'desktop'].moduleGap} columnGap={design[visualViewport??'desktop'].columnGap}/>:document.sections.map(renderSection)}</div></CmsPresentationView>;
}
