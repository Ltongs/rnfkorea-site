// src/lib/tiresCsv.ts
export type TireCsvRow = {
  sku: string;
  is_active: boolean;

  brand: string;
  model_line: string;
  size: string;

  axle: "STEER" | "DRIVE" | "ALL" | "TRAILER";
  vehicle_type: "CARGO" | "DUMP" | "BUS" | "TRAILER";
  ton_class: "1T" | "2_5-3_5T" | "5T" | "8-11T" | "15-25T" | "TRAILER";

  main_thumb_url?: string;

  price?: number;
  supply_price?: number;
  stock_qty?: number;

  tags?: string;
  keyword?: string;

  shop_title?: string;
  short_desc?: string;
  spec_summary?: string;
  features?: string;
  notes?: string;
  updated_at?: string;
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.map((r) => r.map((c) => (c ?? "").trim()));
}

function toBool(v: string) {
  const t = (v ?? "").trim().toLowerCase();
  return t === "true" || t === "1" || t === "y" || t === "yes" || t === "on";
}
function toNum(v: string) {
  const n = Number((v ?? "").toString().replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

export async function fetchTireRows(csvUrl: string): Promise<TireCsvRow[]> {
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();

  const grid = parseCSV(text);
  if (grid.length < 2) return [];

  const header = grid[0].map((h) => (h ?? "").trim());
  const idx = (name: string) => header.findIndex((h) => h === name);

  const get = (row: string[], name: string) => {
    const i = idx(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  return grid
    .slice(1)
    .filter((r) => get(r, "sku") !== "")
    .map((r) => {
      const sku = get(r, "sku");
      const is_active = toBool(get(r, "is_active"));

      const axle = (get(r, "axle") || "ALL") as TireCsvRow["axle"];
      const vehicle_type = (get(r, "vehicle_type") || "CARGO") as TireCsvRow["vehicle_type"];
      const ton_class = (get(r, "ton_class") || "15-25T") as TireCsvRow["ton_class"];

      return {
        sku,
        is_active,
        brand: get(r, "brand"),
        model_line: get(r, "model_line"),
        size: get(r, "size"),

        axle,
        vehicle_type,
        ton_class,

        main_thumb_url: get(r, "main_thumb_url") || undefined,

        price: toNum(get(r, "price")),
        supply_price: toNum(get(r, "supply_price")),
        stock_qty: toNum(get(r, "stock_qty")),

        tags: get(r, "tags") || undefined,
        keyword: get(r, "keyword") || undefined,

        shop_title: get(r, "shop_title") || undefined,
        short_desc: get(r, "short_desc") || undefined,
        spec_summary: get(r, "spec_summary") || undefined,
        features: get(r, "features") || undefined,
        notes: get(r, "notes") || undefined,
        updated_at: get(r, "updated_at") || undefined,
      };
    });
}