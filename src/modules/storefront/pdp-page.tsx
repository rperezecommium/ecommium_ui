import Image from "next/image";
import Link from "next/link";
import type { StorefrontPdpData, StorefrontPdpResult } from "./pdp";

type Props = {
  result: StorefrontPdpResult;
  productSlug: string;
};

export function StorefrontPdpPage({ result, productSlug }: Props) {
  return (
    <main className="storefrontPage">
      <header className="storefrontHeader">
        <div className="storefrontHeaderTop">
          <span>Contactenos</span>
          <span>Iniciar sesion</span>
        </div>
        <div className="storefrontHeaderMain">
          <Link className="storefrontLogo" href="/">Ecommium</Link>
          <label className="storefrontSearch">
            <span>Buscar</span>
            <input placeholder="Buscar en nuestra tienda" />
          </label>
          <nav>
            <Link href="/plp/bike-drivetrain">Catalogo</Link>
            <Link href="/plp/clothes">Clothes</Link>
            <Link href="/plp/accessories">Accessories</Link>
          </nav>
        </div>
      </header>
      <div className="storefrontShell">
        {result.ok && result.data ? (
          <PdpContent data={result.data} />
        ) : (
          <section className="storefrontUnavailable">
            <span>PDP</span>
            <h1>No se pudo cargar el producto</h1>
            <p>{result.error ?? "BFF no disponible para Storefront."}</p>
            <code>{`/pdp/${productSlug}`}</code>
          </section>
        )}
      </div>
    </main>
  );
}

function PdpContent({ data }: { data: StorefrontPdpData }) {
  const backHref = `/plp/${encodeURIComponent(slugFromCategory(data.category) ?? "bike-drivetrain")}`;

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
          <div className="storefrontPdpImage">
            {data.imageUrl ? (
              <Image
                src={data.imageUrl}
                alt={data.imageAlt ?? data.title}
                fill
                sizes="(max-width: 900px) 100vw, 560px"
                unoptimized
              />
            ) : <span>Imagen no disponible</span>}
          </div>
          <div className="storefrontPdpThumbs">
            {(data.images.length > 0 ? data.images.slice(0, 5) : [{ url: "", alt: data.title }]).map((image, index) => (
              <button aria-label={`Imagen ${index + 1}`} key={`${image.url}-${index}`}>
                {image.url ? (
                  <Image src={image.url} alt={image.alt ?? data.title} fill sizes="74px" unoptimized />
                ) : null}
              </button>
            ))}
          </div>
        </div>
        <aside className="storefrontPdpBuyBox">
          {data.brand ? <span className="storefrontPdpBrand">{data.brand}</span> : null}
          <h1>{data.title}</h1>
          {data.shortDescription ? <p className="storefrontPdpSummary">{data.shortDescription}</p> : null}
          <div className="storefrontPdpPrice">
            {data.previousPriceDisplay ? <s>{data.previousPriceDisplay}</s> : null}
            <strong>{data.priceDisplay ?? "Precio pendiente"}</strong>
          </div>
          <p className={data.available ? "storefrontPdpStockOk" : "storefrontPdpStockWarn"}>
            {data.available ? `Disponible${data.availableQuantity ? `: ${data.availableQuantity}` : ""}` : "No disponible"}
          </p>
          {data.variants.length > 0 ? (
            <div className="storefrontPdpVariants">
              <span>Combinaciones</span>
              <div>
                {data.variants.slice(0, 10).map((variant) => (
                  <button disabled={!variant.available} key={variant.variantId}>
                    {variant.name}{variant.isDefault ? " · Default" : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="storefrontPdpCart">
            <input aria-label="Cantidad" defaultValue={1} min={1} type="number" />
          <button type="button">Añadir al carrito</button>
          </div>
          <dl className="storefrontPdpSummaryList">
            <div><dt>Referencia</dt><dd>{data.refId ?? data.productId ?? data.slug}</dd></div>
            {data.ean ? <div><dt>EAN</dt><dd>{data.ean}</dd></div> : null}
            {data.brand ? <div><dt>Marca</dt><dd>{data.brand}</dd></div> : null}
            {data.category ? <div><dt>Categoria</dt><dd>{data.category}</dd></div> : null}
          </dl>
        </aside>
      </section>
      <section className="storefrontPdpTabs">
        <details open>
          <summary>Descripcion</summary>
          <p>{data.description ?? "Producto disponible en Storefront con datos reales desde BFF."}</p>
          {data.metaDescription ? <p>{data.metaDescription}</p> : null}
        </details>
        <details>
          <summary>Detalles del producto</summary>
          <dl>
            <DetailRow label="Product ID" value={data.productId} />
            <DetailRow label="Slug" value={data.slug} />
            <DetailRow label="Link ID" value={data.linkId} />
            <DetailRow label="Referencia" value={data.refId} />
            <DetailRow label="EAN" value={data.ean} />
            <DetailRow label="Marca" value={data.brand} secondary={data.brandId} />
            <DetailRow label="Categoria" value={data.category ?? "Catalogo"} secondary={data.categoryId} />
            <DetailRow label="Tax code" value={data.taxCode} />
            <DetailRow label="Release date" value={data.releaseDate} />
            <DetailRow label="Keywords" value={data.keywords} />
          </dl>
        </details>
        <details>
          <summary>Combinaciones</summary>
          {data.variants.length > 0 ? (
            <div className="storefrontPdpTableScroller">
              <table className="storefrontPdpTable">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Referencia</th>
                    <th>EAN</th>
                    <th>Atributos</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Servicios</th>
                  </tr>
                </thead>
                <tbody>
                  {data.variants.map((variant) => (
                    <tr key={variant.variantId}>
                      <td>{variant.name}{variant.isDefault ? " · Default" : ""}</td>
                      <td>{variant.refId ?? "-"}</td>
                      <td>{variant.ean ?? "-"}</td>
                      <td>{variant.options.length > 0 ? variant.options.map((option) => `${option.attributeCode}: ${option.valueCode}`).join(", ") : "-"}</td>
                      <td>{variant.priceDisplay ?? data.priceDisplay ?? "-"}</td>
                      <td>{variant.available ? `Disponible${variant.availableQuantity ? ` (${variant.availableQuantity})` : ""}` : "No disponible"}</td>
                      <td>{variant.offerings.length > 0 ? variant.offerings.join(", ") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>No hay combinaciones publicadas para este producto.</p>}
        </details>
        <details>
          <summary>Caracteristicas</summary>
          {data.specifications.length > 0 ? data.specifications.map((group) => (
            <div className="storefrontPdpSpecGroup" key={group.group}>
              <h3>{group.group}</h3>
              <dl>
                {group.fields.map((field) => (
                  <div key={`${group.group}-${field.name}`}>
                    <dt>{field.name}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )) : <p>No hay caracteristicas publicadas para este producto.</p>}
        </details>
      </section>
    </>
  );
}

function DetailRow({ label, secondary, value }: { label: string; secondary?: string; value?: string }) {
  if (!value && !secondary) {
    return null;
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}{secondary ? ` (${secondary})` : ""}</dd>
    </div>
  );
}

function slugFromCategory(value: string | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
