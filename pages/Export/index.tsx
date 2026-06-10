// pages/Export/ExportShopPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Phone,
  Plus,
  Settings,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ====================================================
// 타입 정의
// ====================================================
type Category = "all" | "forklift" | "mini_excavator" | "excavator";
type ConditionGrade = "A" | "B" | "C";
type Status = "active" | "sold" | "draft";

type Listing = {
  id: string;
  category: "forklift" | "mini_excavator" | "excavator";
  brand: string;
  model: string | null;
  year: number | null;
  tonnage: number | null;
  engine_type: string | null;
  condition_grade: ConditionGrade | null;
  price_usd: number | null;
  price_negotiable: boolean;
  stock_qty: number;
  available_date: string | null;
  description_en: string | null;
  images: string[];
  status: Status;
  created_at: string;
};

// ====================================================
// 상수
// ====================================================
const CATEGORY_LABELS: Record<string, string> = {
  all: "All Equipment",
  forklift: "Forklift",
  mini_excavator: "Mini Excavator",
  excavator: "Excavator",
};

const GRADE_COLOR: Record<ConditionGrade, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
};

const GRADE_DESC: Record<ConditionGrade, string> = {
  A: "Excellent — fully reconditioned",
  B: "Good — PDI complete",
  C: "Fair — functional, minor wear",
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/export-listings`;

// ====================================================
// 유틸
// ====================================================
function imgUrl(path: string) {
  if (!path) return "/placeholder-equipment.jpg";
  if (path.startsWith("http")) return path;
  return `${STORAGE_BASE}/${path}`;
}

function fmtPrice(usd: number | null, negotiable: boolean) {
  if (!usd) return negotiable ? "Price on Request" : "—";
  return `USD ${usd.toLocaleString()}${negotiable ? " (Negotiable)" : ""}`;
}

function fmtTonnage(t: number | null) {
  if (!t) return null;
  return `${t}T`;
}

// ====================================================
// 이미지 라이트박스
// ====================================================
function Lightbox({
  images,
  index,
  onClose,
}: {
  images: string[];
  index: number;
  onClose: () => void;
}) {
  const [cur, setCur] = useState(index);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCur((c) => (c + 1) % images.length);
      if (e.key === "ArrowLeft") setCur((c) => (c - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white"
        onClick={onClose}
      >
        <X size={28} />
      </button>
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
        onClick={(e) => { e.stopPropagation(); setCur((c) => (c - 1 + images.length) % images.length); }}
      >
        <ChevronLeft size={36} />
      </button>
      <img
        src={imgUrl(images[cur])}
        alt={`Photo ${cur + 1}`}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
        onClick={(e) => { e.stopPropagation(); setCur((c) => (c + 1) % images.length); }}
      >
        <ChevronRight size={36} />
      </button>
      <p className="absolute bottom-4 text-white/50 text-sm">
        {cur + 1} / {images.length}
      </p>
    </div>
  );
}

// ====================================================
// 매물 카드
// ====================================================
function ListingCard({ item }: { item: Listing }) {
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const hasImages = item.images.length > 0;

  return (
    <>
      {lbIdx !== null && (
        <Lightbox
          images={item.images}
          index={lbIdx}
          onClose={() => setLbIdx(null)}
        />
      )}

      <article className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
        {/* 이미지 */}
        <div
          className="relative aspect-[4/3] bg-gray-100 cursor-pointer overflow-hidden"
          onClick={() => hasImages && setLbIdx(imgIdx)}
        >
          {hasImages ? (
            <img
              src={imgUrl(item.images[imgIdx])}
              alt={`${item.brand} ${item.model ?? ""}`}
              className="w-full h-full object-cover transition-transform hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
              No photo
            </div>
          )}

          {/* 이미지 썸네일 내비 */}
          {item.images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {item.images.slice(0, 6).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${i === imgIdx ? "bg-white scale-125" : "bg-white/50"}`}
                />
              ))}
            </div>
          )}

          {/* SOLD 뱃지 */}
          {item.status === "sold" && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-bold text-xl tracking-widest">SOLD</span>
            </div>
          )}

          {/* 등급 뱃지 */}
          {item.condition_grade && (
            <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full border ${GRADE_COLOR[item.condition_grade]}`}>
              Grade {item.condition_grade}
            </span>
          )}
        </div>

        {/* 정보 */}
        <div className="p-5 flex flex-col flex-1 gap-3">
          {/* 카테고리 */}
          <p className="text-xs font-semibold tracking-wider text-orange-500 uppercase">
            {CATEGORY_LABELS[item.category]}
          </p>

          {/* 브랜드/모델 */}
          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {item.brand}{item.model ? ` ${item.model}` : ""}
            {item.year ? ` (${item.year})` : ""}
          </h3>

          {/* 스펙 칩 */}
          <div className="flex flex-wrap gap-2">
            {fmtTonnage(item.tonnage) && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">
                {fmtTonnage(item.tonnage)}
              </span>
            )}
            {item.engine_type && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium capitalize">
                {item.engine_type}
              </span>
            )}
            {item.stock_qty > 1 && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">
                Qty: {item.stock_qty}
              </span>
            )}
          </div>

          {/* 등급 설명 */}
          {item.condition_grade && (
            <p className="text-xs text-slate-500">{GRADE_DESC[item.condition_grade]}</p>
          )}

          {/* 설명 */}
          {item.description_en && (
            <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
              {item.description_en}
            </p>
          )}

          {/* 가격 */}
          <div className="mt-auto pt-3 border-t border-gray-100">
            <p className="text-base font-bold text-slate-900">
              {fmtPrice(item.price_usd, item.price_negotiable)}
            </p>
            {item.available_date && (
              <p className="text-xs text-slate-400 mt-1">
                Available from: {item.available_date}
              </p>
            )}
          </div>

          {/* CTA */}
          <Link
            to={`/export-shop/inquiry?ref=${item.id}&model=${encodeURIComponent(`${item.brand} ${item.model ?? ""}`.trim())}`}
            className="mt-2 inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all"
          >
            Request Quote →
          </Link>
        </div>
      </article>
    </>
  );
}

// ====================================================
// 메인 페이지
// ====================================================
const ExportShopPage: React.FC = () => {
  const { isHyundaiCM, isAdmin, isSubAdmin } = useAuth();
  const navigate = useNavigate();
  const canManage = isHyundaiCM || isAdmin || isSubAdmin;

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category>("all");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("export_listings")
        .select("*")
        .in("status", ["active", "sold"])
        .order("created_at", { ascending: false });

      if (err) throw err;
      setListings((data as Listing[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load listings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const filtered = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((l) => l.category === filter);
  }, [listings, filter]);

  const counts = useMemo(() => ({
    all: listings.length,
    forklift: listings.filter((l) => l.category === "forklift").length,
    mini_excavator: listings.filter((l) => l.category === "mini_excavator").length,
    excavator: listings.filter((l) => l.category === "excavator").length,
  }), [listings]);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Used Forklift & Excavator for Export | RNF KOREA</title>
        <meta
          name="description"
          content="Browse RNF KOREA's export-ready used forklifts and excavators. Grade A/B/C certified, PDI complete, parts package available. Contact us for pricing."
        />
      </Helmet>

      {/* ── Hero ── */}
      <section className="relative bg-[#0a192f] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-12 md:py-16">
          <nav className="flex items-center gap-2 text-sm text-white/50 mb-6">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link to="/export" className="hover:text-white transition-colors">Export</Link>
            <span>/</span>
            <span className="text-white/90">Equipment Shop</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400 mb-3">
                Export Shop
              </p>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] break-keep">
                Used Equipment
                <br />for Export
              </h1>
              <p className="mt-4 text-white/70 text-base leading-7 max-w-xl break-keep">
                Grade-certified (A/B/C), PDI-complete used forklifts and excavators.
                Ready to ship worldwide.
              </p>
            </div>

            {/* 관리자 버튼 */}
            {canManage && (
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={() => navigate("/export-shop/listing/new")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all"
                >
                  <Plus size={16} />
                  Add Listing
                </button>
                <button
                  onClick={() => navigate("/export-shop/listing/manage")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/20 transition-all"
                >
                  <Settings size={16} />
                  Manage
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 본문 ── */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-10 space-y-8">

        {/* 필터 탭 */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Equipment category filter">
          {(["all", "forklift", "mini_excavator", "excavator"] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={[
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
                filter === cat
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              {CATEGORY_LABELS[cat]}
              <span className={`ml-1.5 text-xs ${filter === cat ? "text-white/70" : "text-slate-400"}`}>
                ({counts[cat]})
              </span>
            </button>
          ))}
        </div>

        {/* 로딩 / 에러 */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="animate-spin" size={20} />
            <span>Loading listings...</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 매물 없음 */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <p className="text-lg font-semibold">No listings available</p>
            <p className="text-sm">Please check back soon or contact us directly.</p>
            {canManage && (
              <button
                onClick={() => navigate("/export-shop/listing/new")}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all"
              >
                <Plus size={16} />
                Add First Listing
              </button>
            )}
          </div>
        )}

        {/* 매물 그리드 */}
        {!loading && !error && filtered.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0">
            {filtered.map((item) => (
              <li key={item.id}>
                <ListingCard item={item} />
              </li>
            ))}
          </ul>
        )}

        {/* CTA 섹션 */}
        <section className="rounded-3xl bg-[#0a192f] text-white overflow-hidden relative mt-8">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative px-6 md:px-10 py-10 md:py-14 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold tracking-[0.12em] uppercase text-orange-400">
                Can't find what you need?
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold break-keep">
                Tell us your requirements
              </h2>
              <p className="text-white/70 text-sm leading-relaxed">
                Share your specs, quantity and budget — we'll find the right equipment for you.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                to="/export-shop/inquiry"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-all"
              >
                Request a Quote
              </Link>
              <a
                href="tel:15511873"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/30 text-white font-semibold hover:bg-white/10 transition-all"
              >
                <Phone size={16} />
                1551-1873
              </a>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default ExportShopPage;