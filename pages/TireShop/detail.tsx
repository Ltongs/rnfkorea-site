import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Phone, Check, Copy } from "lucide-react";
import { fetchTireRows } from "../../lib/tiresCsv";
import type { TireCsvRow } from "../../lib/tiresCsv";
import { TIRE_CSV_URL, buildProductNoMap } from "./config";

function fmtKRW(n?: number) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "가격문의";
  try {
    return `${new Intl.NumberFormat("ko-KR").format(v)}원`;
  } catch {
    return `${v}원`;
  }
}

function safeText(v?: string) {
  return (v ?? "").trim();
}

function toLines(v?: string) {
  const t = safeText(v);
  if (!t) return [];
  return t
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 클립보드 복사: navigator.clipboard 우선, 실패 시 textarea fallback */
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export default function TireShopDetailPage() {
  const { sku } = useParams<{ sku?: string }>();

  const decodedSku = useMemo(() => {
    if (!sku) return "";
    try {
      return decodeURIComponent(sku);
    } catch {
      return sku;
    }
  }, [sku]);

  const [rows, setRows] = useState<TireCsvRow[]>([]);
  const [productNoMap, setProductNoMap] = useState<Map<string, string>>(new Map());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [activeImg, setActiveImg] = useState<string>("");

  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        if (!TIRE_CSV_URL || TIRE_CSV_URL.includes("PASTE_YOUR_CSV_URL_HERE")) {
          throw new Error(
            "TIRE_CSV_URL이 비어있습니다. pages/TireShop/config.ts에 CSV URL을 넣어주세요."
          );
        }

        const data = await fetchTireRows(TIRE_CSV_URL);

        // ✅ 상용차만
        const commercial = data.filter(
          (x) =>
            x.is_active &&
            (x.vehicle_type === "CARGO" ||
              x.vehicle_type === "DUMP" ||
              x.vehicle_type === "BUS" ||
              x.vehicle_type === "TRAILER")
        );

        if (!alive) return;
        setRows(commercial);
        setProductNoMap(buildProductNoMap(commercial));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Load failed");
        setRows([]);
        setProductNoMap(new Map());
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const item = useMemo(() => {
    if (!decodedSku) return undefined;
    return rows.find((r) => r.sku === decodedSku);
  }, [rows, decodedSku]);

  const productNo = useMemo(() => {
    if (!item) return "";
    return productNoMap.get(item.sku) ?? item.sku;
  }, [item, productNoMap]);

  const images = useMemo(() => {
    if (!item) return [];
    const arr: string[] = [];
    const thumb = safeText(item.main_thumb_url);
    if (thumb) arr.push(thumb);
    return arr;
  }, [item]);

  useEffect(() => {
    setActiveImg(images[0] || "");
  }, [images]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-gray-500 font-bold">Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="container mx-auto px-4 py-16 space-y-6">
        <Link
          to="/tires-shop"
          className="inline-flex items-center gap-2 font-extrabold text-navy-900"
        >
          <ArrowLeft size={18} /> 목록으로
        </Link>
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 font-bold">
          {err}
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-16 space-y-6">
        <Link
          to="/tires-shop"
          className="inline-flex items-center gap-2 font-extrabold text-navy-900"
        >
          <ArrowLeft size={18} /> 목록으로
        </Link>
        <div className="text-gray-500 font-bold">상품을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const title =
    safeText(item.shop_title) || `${safeText(item.model_line)} (${safeText(item.size)})`;
  const shortDesc = safeText(item.short_desc);
  const specSummary = safeText(item.spec_summary);
  const features = toLines(item.features);
  const notes = safeText(item.notes);

  const priceForView = item.price ?? item.supply_price;

  return (
    <div className="container mx-auto px-4 py-16 space-y-10">
      <Link
        to="/tires-shop"
        className="inline-flex items-center gap-2 font-extrabold text-navy-900"
      >
        <ArrowLeft size={18} /> 목록으로
      </Link>

      {/* ✅ 소개(상단 전체폭) */}
      <div className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-extrabold text-navy-900">{title}</h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500 font-bold">
          <span>{item.vehicle_type}</span>
          <span>·</span>
          <span>{item.axle}</span>
          <span>·</span>
          <span>{item.ton_class}</span>
          <span>·</span>

          {/* ✅ 상품번호 + 복사 */}
          <button
            type="button"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors"
            onClick={async () => {
              const ok = await copyToClipboard(productNo);
              setToast(ok ? `상품번호 복사됨: ${productNo}` : "복사 실패 (브라우저 권한 확인)");
            }}
            title="클릭하면 상품번호가 복사됩니다"
          >
            <span>상품번호 {productNo}</span>
            <Copy size={14} />
          </button>
        </div>

        <div className="flex items-baseline gap-3">
          <div className="text-2xl md:text-3xl font-extrabold text-orange-600">
            {fmtKRW(priceForView)}
          </div>
          {typeof item.stock_qty === "number" && (
            <div className="text-sm font-bold text-gray-500">재고: {item.stock_qty}</div>
          )}
        </div>

        {shortDesc && <p className="text-gray-700">{shortDesc}</p>}
      </div>

      {/* ✅ 본문: 좌측(2박스) + 우측(이미지 동일높이) */}
<div className="flex flex-col lg:flex-row gap-8 items-stretch">

  {/* 좌측 영역 */}
  <div className="flex-1 flex flex-col gap-6">

    {/* 기본 스펙 */}
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="text-lg font-extrabold text-navy-900 mb-4">기본 스펙</div>

      <div className="text-sm text-gray-700 space-y-2">
        <div><span className="font-bold text-gray-500">브랜드</span> <span className="font-extrabold text-navy-900">금호타이어</span></div>
        <div><span className="font-bold text-gray-500">모델</span> <span className="font-extrabold text-navy-900">{item.model_line}</span></div>
        <div><span className="font-bold text-gray-500">사이즈</span> <span className="font-extrabold text-navy-900">{item.size}</span></div>
        <div><span className="font-bold text-gray-500">차종</span> <span className="font-extrabold text-navy-900">{item.vehicle_type}</span></div>
        <div><span className="font-bold text-gray-500">포지션</span> <span className="font-extrabold text-navy-900">{item.axle}</span></div>
        <div><span className="font-bold text-gray-500">톤급</span> <span className="font-extrabold text-navy-900">{item.ton_class}</span></div>
        <div><span className="font-bold text-gray-500">상품번호</span> <span className="font-extrabold text-navy-900">{productNo}</span></div>
      </div>

      {specSummary && (
        <div className="pt-4 border-t border-gray-100 mt-4 text-sm text-gray-700 whitespace-pre-line">
          {specSummary}
        </div>
      )}
    </div>

    {/* 특징 */}
    <div className="rounded-2xl border border-gray-200 bg-white p-6 flex-1">
      <div className="text-lg font-extrabold text-navy-900 mb-4">특징</div>

      {features.length > 0 ? (
        <ul className="space-y-2 text-sm text-gray-700">
          {features.map((f, i) => (
            <li key={`${f}-${i}`} className="flex items-start gap-2">
              <Check className="mt-0.5 w-4 h-4 text-orange-500 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-gray-500 font-bold">
          등록된 특징이 없습니다.
        </div>
      )}
    </div>
  </div>

  {/* 우측 이미지 영역 */}
  <div className="flex-1">
    <div className="rounded-2xl border border-gray-200 bg-white p-6 h-full flex items-center justify-center">
      {activeImg ? (
        <img
          src={activeImg}
          alt={title}
          className="max-h-full w-full object-contain"
        />
      ) : (
        <div className="text-gray-400 font-extrabold">
          NO IMAGE
        </div>
      )}
    </div>
  </div>

</div>

      {/* CTA */}
      <div className="rounded-2xl border border-gray-200 bg-navy-900 p-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="text-white">
          <div className="text-lg font-extrabold">전화로 바로 상담</div>
          <div className="text-white/70 text-sm mt-1">재고/납기/장착 위치 확인</div>
        </div>

        <a
          href="tel:1551-1873"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 bg-orange-500 text-white font-extrabold hover:bg-orange-600 transition-all"
        >
          <Phone size={18} />
          1551-1873 연결
        </a>
      </div>

      {/* ✅ Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="px-4 py-3 rounded-xl bg-navy-900 text-white font-extrabold shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}