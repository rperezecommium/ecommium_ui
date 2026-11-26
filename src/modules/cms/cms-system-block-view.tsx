import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ChevronDown, CircleHelp, RotateCcw, Star } from "lucide-react";
import type { StorefrontCategoryLink } from "../storefront/plp";
import type { StorefrontCmsBlock } from "../storefront/public-page-contract";
export function CmsSystemBlockView({ block, categories, country, currency, initialQuery, locale, marketLabel, account, cart }: { block: StorefrontCmsBlock; categories: StorefrontCategoryLink[]; country?: string; currency?: string; customerEmail?: string; initialQuery?: string; locale?: string; marketLabel?: string; openCustomerLogin: boolean; account?: ReactNode; cart?: ReactNode }) {
  const props = block.props as Record<string, unknown>;
  if (block.type === "store.logo") {
    const imageUrl = safeImageUrl(props.imageUrl);
    return <Link className="storefrontLogo" href={safeInternalHref(props.href)}>{imageUrl
      ? <Image alt={text(props.imageAlt, text(props.label, "Ecommium"))} height={72} priority={block.placement?.region !== "footer"} src={imageUrl} width={311} />
      : text(props.label, "Ecommium")}</Link>;
  }
  if (block.type === "commerce.search") return <form className="storefrontSearch storefrontSitePartSearch" action="/search" method="get" role="search"><input aria-label="Buscar" name="q" defaultValue={initialQuery ?? ""} placeholder={text(props.placeholder, "Buscar productos")} /></form>;
  if (block.type === "customer.account") return account ?? <span className="storefrontAccount">Cuenta</span>;
  if (block.type === "commerce.cart") return cart ?? <span className="storefrontCart">Carrito · 0</span>;
  if (block.type === "store.market") return <div className="storefrontMarket" aria-label="Preferencias regionales"><span>Enviar a: <strong>{text(props.countryLabel, country ?? "ES")}</strong><ChevronDown aria-hidden="true" size={12} /></span><span>Idioma: <strong>{text(props.languageLabel, localeLabel(locale))}</strong><ChevronDown aria-hidden="true" size={12} /></span><span className="storefrontMarketCurrency">{currency ?? marketLabel}</span></div>;
  if (block.type === "store.assurances") return <div className="storefrontAssurances"><span><CircleHelp aria-hidden="true" size={15} />{text(props.helpLabel, "Ayuda y contacto")}</span><span><RotateCcw aria-hidden="true" size={15} />{text(props.returnsLabel, "Devolucion facil en 30 dias")}</span><span className="storefrontReviews"><strong>{text(props.rating, "4.5/5")}</strong><Star aria-hidden="true" fill="currentColor" size={14} /></span></div>;
  if (block.type === "catalog.navigation") {
    const items = props.dynamic !== false && categories.length > 0
      ? categoryTree(categories)
      : links(props.items).map((item) => ({ ...item, children: [] as CategoryNavigationItem[] }));
    return <nav aria-label="Categorias" className="storefrontSitePartNav"><CategoryNavigation items={items} /></nav>;
  }
  if (block.type === "content.announcementBar") return <p className="storefrontAnnouncement">{text(props.text, "")}</p>;
  if (block.type === "footer.navigation") return <nav className="storefrontFooterLinks" aria-label={text(props.title, "Enlaces de footer")}>{typeof props.title === "string" && props.title.trim() ? <h3>{props.title.trim()}</h3> : null}{links(props.items).map((item) => <Link href={item.href} key={`${item.href}-${item.label}`}>{item.label}</Link>)}</nav>;
  if (block.type === "footer.legal") return <p className="storefrontFooterLegal">{text(props.text, `© ${new Date().getFullYear()} Ecommium`)}</p>;
  if (block.type === "footer.contact") return <div className="storefrontFooterContact"><strong>{text(props.title, "Contacto")}</strong><span>{text(props.text, "Estamos para ayudarte")}</span></div>;
  if (block.type === "footer.payments") return <div className="storefrontFooterPayments" aria-label={text(props.label, "Metodos de pago")}>{labels(props.items).map((item) => <span key={item}>{item}</span>)}</div>;
  if (block.type === "footer.social") return <nav className="storefrontFooterSocial" aria-label={text(props.label, "Redes sociales")}>{links(props.items, true).map((item) => <a href={item.href} key={`${item.href}-${item.label}`} aria-label={item.label} title={item.label} rel="noopener noreferrer" target="_blank"><FooterSocialIcon label={item.label} /><span className="storefrontVisuallyHidden">{item.label}</span></a>)}</nav>;
  if (block.type === "footer.newsletter") return <form className="storefrontFooterNewsletter"><label>{text(props.title, "Newsletter")}<input name="email" type="email" placeholder="tu@email.com" /></label><button type="submit">Suscribirme</button></form>;
  return null;
}

function FooterSocialIcon({label}: {label: string}) {
  const name = label.toLowerCase();
  if (name.includes("instagram")) return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
  if (name.includes("facebook")) return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 22v-9h3l.5-4H14V7c0-1 .4-1.5 1.5-1.5H18V2h-3c-3.2 0-5 1.8-5 5v2H7v4h3v9h4Z" /></svg>;
  if (name.includes("youtube")) return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" /></svg>;
  if (name === "x" || name.includes("twitter")) return <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.9-9L.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.8L6.3 3.9H4.4L17.8 20Z" /></svg>;
  return <CircleHelp size={20} aria-hidden="true" />;
}

const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;
const safeInternalHref = (value: unknown) => {
  const href = text(value, "/");
  return href.startsWith("/") && !href.startsWith("//") ? href : "/";
};
const safeImageUrl = (value: unknown) => {
  const url = text(value, "");
  return url.startsWith("/") && !url.startsWith("//") ? url : "";
};
const links = (value: unknown, allowExternal = false) => Array.isArray(value) ? value.flatMap((item) => { const record = typeof item === "object" && item ? item as Record<string, unknown> : {}; const href = text(record.href, ""); const label = text(record.label, ""); const safe = (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) || (allowExternal && href.startsWith("https://")); return safe && label ? [{ href, label }] : []; }) : [];
const labels = (value: unknown) => Array.isArray(value) ? value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : []) : [];
const localeLabel = (locale?: string) => locale?.toLowerCase().startsWith("es") ? "Español" : locale || "Español";

type CategoryNavigationItem = {
  children: CategoryNavigationItem[];
  href: string;
  label: string;
};

function categoryTree(categories: StorefrontCategoryLink[]) {
  const roots: CategoryNavigationItem[] = [];
  const parents: Array<{ depth: number; item: CategoryNavigationItem }> = [];

  for (const category of categories) {
    const item: CategoryNavigationItem = { children: [], href: category.href, label: category.name };
    while (parents.length > 0 && parents[parents.length - 1].depth >= category.depth) parents.pop();
    const siblings = parents.length > 0 ? parents[parents.length - 1].item.children : roots;
    siblings.push(item);
    parents.push({ depth: category.depth, item });
  }

  return roots;
}

function CategoryNavigation({ items, nested = false }: { items: CategoryNavigationItem[]; nested?: boolean }) {
  return <ul className={nested ? "storefrontCategorySubmenu" : "storefrontCategoryMenu"}>{items.map((item) => <li key={`${item.href}-${item.label}`}><Link href={item.href}>{item.label}</Link>{item.children.length > 0 ? <><ChevronDown aria-hidden="true" className="storefrontCategoryChevron" size={14} /><CategoryNavigation items={item.children} nested /></> : null}</li>)}</ul>;
}
