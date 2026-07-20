type PdfInvoicePayload = Record<string, unknown>;

interface PdfInvoiceLine {
  name: string;
  quantity: number;
  unitPriceMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
}

interface PdfInvoiceData {
  invoiceNumber: string;
  issuedAt: string;
  currency: string;
  sellerName: string;
  sellerTaxId: string;
  sellerAddress: string;
  buyerAddress: string;
  lines: PdfInvoiceLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  shippingMinor: number;
  totalMinor: number;
}

interface PdfPage {
  commands: string[];
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const TOP_Y = 790;
const BOTTOM_Y = 58;

export function renderInvoiceDocumentPdf(payload: unknown, fallbackHtml = "") {
  const invoice = normalizeInvoicePayload(payload, fallbackHtml);
  const pages: PdfPage[] = [{ commands: [] }];
  let y = TOP_Y;

  const page = () => pages[pages.length - 1];
  const nextPage = () => {
    pages.push({ commands: [] });
    y = TOP_Y;
  };
  const ensureSpace = (height: number) => {
    if (y - height < BOTTOM_Y) {
      nextPage();
    }
  };
  const text = (value: string, x: number, size = 10, bold = false) => {
    page().commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td ${pdfText(value)} Tj ET`);
    y -= Math.ceil(size * 1.42);
  };
  const textAt = (value: string, x: number, targetY: number, size = 10, bold = false) => {
    page().commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${targetY} Td ${pdfText(value)} Tj ET`);
  };
  const rule = () => {
    page().commands.push(`0.82 0.86 0.89 RG 0.5 w ${MARGIN_X} ${y} m ${PAGE_WIDTH - MARGIN_X} ${y} l S`);
    y -= 18;
  };

  text(`Factura ${invoice.invoiceNumber}`, MARGIN_X, 20, true);
  text(`Fecha: ${invoice.issuedAt}`, MARGIN_X, 10);
  rule();

  ensureSpace(92);
  text("Vendedor", MARGIN_X, 12, true);
  text(invoice.sellerName, MARGIN_X, 10);
  text(invoice.sellerTaxId, MARGIN_X, 10);
  for (const line of wrapText(invoice.sellerAddress, 88)) {
    text(line, MARGIN_X, 10);
  }

  y -= 10;
  ensureSpace(74);
  text("Comprador", MARGIN_X, 12, true);
  for (const line of wrapText(invoice.buyerAddress, 88)) {
    text(line, MARGIN_X, 10);
  }

  y -= 12;
  ensureSpace(84);
  text("Lineas", MARGIN_X, 12, true);
  const headerY = y;
  textAt("Concepto", MARGIN_X, headerY, 9, true);
  textAt("Cant.", 332, headerY, 9, true);
  textAt("Unitario", 382, headerY, 9, true);
  textAt("Imp.", 452, headerY, 9, true);
  textAt("Total", 508, headerY, 9, true);
  y -= 16;
  rule();

  for (const line of invoice.lines) {
    const nameLines = wrapText(line.name, 48).slice(0, 3);
    ensureSpace(Math.max(28, nameLines.length * 13 + 8));
    const rowY = y;
    nameLines.forEach((nameLine, index) => {
      textAt(nameLine, MARGIN_X, rowY - index * 13, 9);
    });
    textAt(String(line.quantity), 336, rowY, 9);
    textAt(formatMoney(line.unitPriceMinor, invoice.currency), 382, rowY, 9);
    textAt(formatMoney(line.taxMinor, invoice.currency), 452, rowY, 9);
    textAt(formatMoney(line.lineTotalMinor, invoice.currency), 508, rowY, 9, true);
    y -= Math.max(28, nameLines.length * 13 + 8);
    page().commands.push(`0.90 0.92 0.94 RG 0.4 w ${MARGIN_X} ${y + 8} m ${PAGE_WIDTH - MARGIN_X} ${y + 8} l S`);
  }

  y -= 10;
  ensureSpace(108);
  const summaryX = 342;
  textAt("Subtotal", summaryX, y, 10);
  textAt(formatMoney(invoice.subtotalMinor, invoice.currency), 470, y, 10);
  y -= 18;
  textAt("Descuento", summaryX, y, 10);
  textAt(formatMoney(invoice.discountMinor, invoice.currency), 470, y, 10);
  y -= 18;
  textAt("Impuestos", summaryX, y, 10);
  textAt(formatMoney(invoice.taxMinor, invoice.currency), 470, y, 10);
  y -= 18;
  textAt("Envio", summaryX, y, 10);
  textAt(formatMoney(invoice.shippingMinor, invoice.currency), 470, y, 10);
  y -= 20;
  textAt("Total", summaryX, y, 12, true);
  textAt(formatMoney(invoice.totalMinor, invoice.currency), 470, y, 12, true);

  pages.forEach((pdfPage, index) => {
    pdfPage.commands.push(`BT /F1 8 Tf ${MARGIN_X} 30 Td ${pdfText(`Pagina ${index + 1} de ${pages.length}`)} Tj ET`);
  });

  return buildPdf(pages);
}

export function invoicePdfFilename(payload: unknown, fallback: string) {
  const invoice = getNestedRecord(getNestedRecord(payload, "contentJson"), "invoice");
  const invoiceNumber = stringValue(invoice?.invoiceNumber);
  return `invoice-${safeFilenamePart(invoiceNumber ?? fallback)}.pdf`;
}

function normalizeInvoicePayload(payload: unknown, fallbackHtml: string): PdfInvoiceData {
  const contentJson = getNestedRecord(payload, "contentJson") ?? getRecord(payload);
  const invoice = getNestedRecord(contentJson, "invoice");
  const seller = getNestedRecord(contentJson, "seller");
  const buyer = getNestedRecord(contentJson, "buyer");
  const totals = getNestedRecord(contentJson, "totals");
  const lines = Array.isArray(contentJson?.lines) ? contentJson.lines : [];
  const plainText = fallbackHtml ? htmlToText(fallbackHtml) : "";

  return {
    invoiceNumber: stringValue(invoice?.invoiceNumber) ?? stringValue(invoice?.invoiceId) ?? "Factura",
    issuedAt: formatDate(stringValue(invoice?.issuedAt)),
    currency: stringValue(invoice?.currency) ?? stringValue(totals?.currency) ?? "USD",
    sellerName: stringValue(seller?.legalName) ?? stringValue(seller?.commercialName) ?? "Ecommium",
    sellerTaxId: stringValue(seller?.taxId) ?? stringValue(seller?.vatNumber) ?? "",
    sellerAddress: formatAddress(getNestedRecord(seller, "fiscalAddress")),
    buyerAddress: formatAddress(getNestedRecord(buyer, "billingAddress")) || plainText.slice(0, 160),
    lines: lines.map(normalizeLine).filter((line): line is PdfInvoiceLine => Boolean(line)),
    subtotalMinor: numberValue(totals?.subtotalMinor),
    discountMinor: numberValue(totals?.discountMinor),
    taxMinor: numberValue(totals?.taxMinor),
    shippingMinor: numberValue(totals?.shippingMinor),
    totalMinor: numberValue(totals?.totalMinor),
  };
}

function normalizeLine(value: unknown): PdfInvoiceLine | null {
  const line = getRecord(value);
  if (!line) {
    return null;
  }

  return {
    name: stringValue(line.name) ?? "Producto",
    quantity: numberValue(line.quantity),
    unitPriceMinor: numberValue(line.unitPriceMinor),
    taxMinor: numberValue(line.taxMinor),
    lineTotalMinor: numberValue(line.lineTotalMinor),
  };
}

function buildPdf(pages: PdfPage[]) {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject("PAGES_PLACEHOLDER");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const pageObjectIds: number[] = [];
  for (const pdfPage of pages) {
    const stream = pdfPage.commands.join("\n");
    const contentId = objects.length + 2;
    const pageId = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageObjectIds.push(pageId);
    addObject(`<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

function pdfText(value: string) {
  return `(${toPdfLiteral(value)})`;
}

function toPdfLiteral(value: string) {
  let output = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === "\\" || char === "(" || char === ")") {
      output += "\\" + char;
    } else if (code === 10) {
      output += "\\n";
    } else if (code === 13) {
      output += "\\r";
    } else if (code === 9) {
      output += "\\t";
    } else if (code < 32 || code > 126) {
      output += toWinAnsiOctal(char);
    } else {
      output += char;
    }
  }
  return output;
}

function toWinAnsiOctal(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fallback = normalized.charCodeAt(0) <= 126 ? normalized[0] : "?";
  return "\\" + fallback.charCodeAt(0).toString(8).padStart(3, "0");
}

function wrapText(value: string, maxChars: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

function formatMoney(amountMinor: number, currency: string) {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

function formatAddress(address: Record<string, unknown> | undefined) {
  if (!address) {
    return "";
  }

  return [
    stringValue(address.street),
    stringValue(address.number),
    stringValue(address.postalCode),
    stringValue(address.city),
    stringValue(address.state),
    stringValue(address.country),
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function htmlToText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "invoice";
}

function getNestedRecord(parent: unknown, key: string) {
  const record = getRecord(parent);
  return getRecord(record?.[key]);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
