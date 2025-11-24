import { PDFParse } from "pdf-parse";

export type RawInvoiceLine = {
  sku: string;
  qtyOrdered: number;
  qtyShipped: number;
  invoiceUnit: string;
  packSize?: string;
  brand?: string;
  description: string;
  deptCode?: string;
  unitCost?: number;
  extendedCost?: number;
};

export type InvoiceParseResult = {
  invoiceNumber?: string;
  invoiceDate?: string;
  purchaseOrder?: string;
  rawText: string;
  items: RawInvoiceLine[];
};

export async function parseInvoicePdf(
  buffer: Buffer
): Promise<InvoiceParseResult> {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy().catch(() => undefined);
  const text = (parsed.text || "").replace(/\r/g, "");
  return {
    rawText: text,
    invoiceNumber: matchSingle(text, /Invoice\s+(\d{4,})/i),
    invoiceDate: matchSingle(text, /Invoice Date\s+([0-9/]+)/i),
    purchaseOrder: matchSingle(text, /Purchase Order\s+([A-Z0-9-]+)/i),
    items: extractLineItems(text),
  };
}

function matchSingle(source: string, regex: RegExp) {
  const match = source.match(regex);
  return match?.[1];
}

function extractLineItems(text: string): RawInvoiceLine[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const startIndex = lines.findIndex((line) =>
    /^Item Code\s+Qty/i.test(line)
  );
  const groupSummaryIdx = lines.findIndex((line) =>
    /^Group Summary/i.test(line)
  );
  if (startIndex === -1 || groupSummaryIdx === -1 || groupSummaryIdx <= startIndex) {
    return [];
  }

  const itemLines = lines.slice(startIndex + 1, groupSummaryIdx);
  const rows: string[] = [];
  let current: string[] = [];

  for (const line of itemLines) {
    if (/^\d{5,}/.test(line)) {
      if (current.length) rows.push(current.join(" ").trim());
      current = [line];
      continue;
    }

    if (current.length) {
      current.push(line);
    }
  }
  if (current.length) rows.push(current.join(" ").trim());

  return rows
    .map(parseRow)
    .filter((row): row is RawInvoiceLine => Boolean(row));
}

function parseRow(row: string): RawInvoiceLine | null {
  const tokens = row.split(/\s+/);
  if (tokens.length < 10) return null;

  const extendedPrice = parseCurrency(tokens.pop()!);
  const unitPrice = parseCurrency(tokens.pop()!);
  const deptCode = tokens.pop();

  const sku = tokens.shift();
  const qtyOrdered = safeNumber(tokens.shift());
  const qtyShipped = safeNumber(tokens.shift());
  const invoiceUnit = tokens.shift();

  if (!sku || !invoiceUnit || qtyOrdered === null || qtyShipped === null) {
    return null;
  }

  let packSize: string | undefined;
  if (tokens.length >= 2 && /x/i.test(tokens[0])) {
    packSize = `${tokens.shift()} ${tokens.shift()}`;
  }

  const brand = tokens.shift();
  const description = tokens.join(" ").trim();

  return {
    sku,
    qtyOrdered,
    qtyShipped,
    invoiceUnit,
    packSize,
    brand,
    description,
    deptCode,
    unitCost: unitPrice ?? undefined,
    extendedCost: extendedPrice ?? undefined,
  };
}

function parseCurrency(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeNumber(value?: string) {
  if (!value) return null;
  const num = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}
