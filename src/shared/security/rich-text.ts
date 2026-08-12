import sanitizeHtml from "sanitize-html";

const allowedTags = [
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
];

const controlCharacters = /[\u0000-\u001F\u007F]/;

function sanitizeHref(value: string | undefined) {
  const href = value?.trim();
  if (!href || controlCharacters.test(href)) {
    return undefined;
  }

  if (href.startsWith("#")) {
    return href;
  }

  if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\")) {
    return href;
  }

  try {
    const url = new URL(href);
    if (url.username || url.password || !["https:", "mailto:", "tel:"].includes(url.protocol)) {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}

/**
 * Política única de texto enriquecido para las previsualizaciones Admin y el
 * Storefront. `sanitize-html` analiza el HTML antes de reconstruirlo según una
 * allowlist: nunca se aceptan atributos de evento, estilos, SVG ni URLs activas.
 */
export function sanitizeRichTextHtml(value: string | undefined) {
  if (!value?.trim()) {
    return "";
  }

  return sanitizeHtml(value, {
    allowedAttributes: {
      a: ["href", "rel", "title"],
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowedTags,
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "svg", "math"],
    transformTags: {
      a: (_tagName, attributes) => {
        const href = sanitizeHref(attributes.href);
        const title = attributes.title?.trim();

        return {
          tagName: "a",
          attribs: {
            ...(href ? { href, rel: "noopener noreferrer" } : {}),
            ...(title ? { title } : {}),
          },
        };
      },
    },
  }).trim();
}
