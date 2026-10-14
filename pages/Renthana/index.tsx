// pages/Renthana/index.tsx
// 렌타나(renthana.com) 제휴 배터리·타이어 렌탈료 계산기 — 로그인 없이 URL로 누구나 접근 가능
// 렌탈료 = (공급가격 × 1.1 부가세 포함) × 103% × 111.7%(12개월) / 135%(36개월)
// 품목은 상단 버튼 또는 URL(?item=tire)로 선택. 품목별 요율이 달라지면 PRODUCTS의 rate12/rate36만 바꾸면 된다.
// PDF로 저장하면 견적번호(RNF-YYMM-NNNNNN)를 발급받아 견적서 발송 이력(tb_quotations, quote_type='renthana')에 남긴다.
//   (로그인 없이도 저장되도록 save_renthana_quote RPC 사용 — supabase/migrations/20261012170000_renthana_quote_history.sql)
// 이력 보기: /renthana?quote=<견적번호> — 관리자로 로그인된 브라우저에서만 저장된 견적을 불러와 그대로 보여주고 다시 받을 수 있다.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { addCanvasToA4 } from "../../lib/pdfFit";
import { supabase } from "../../lib/supabase";

const VAT_RATE = 1.1;          // 부가세 10% 포함
const RATE_12 = 1.03 * 1.117; // 103% × 111.7%
const RATE_36 = 1.03 * 1.35;  // 103% × 135%

type ProductKey = "battery" | "tire";
const PRODUCTS: Record<ProductKey, { label: string; rate12: number; rate36: number }> = {
  battery: { label: "배터리", rate12: RATE_12, rate36: RATE_36 },
  tire:    { label: "타이어", rate12: RATE_12, rate36: RATE_36 },  // 현재 배터리와 동일 요율
};

const RENTHANA_STATS = [
  { n: "5,000+", l: "자산 풀" },
  { n: "23+5y", l: "신뢰 연차" },
  { n: "24h", l: "AI 견적" },
  { n: "100%", l: "무상 A/S" },
  { n: "5y", l: "무사고" },
  { n: "30%", l: "절감" },
];

// 로고를 PNG data URL로 미리 변환한다. SVG 원본은 Safari 등에서 html2canvas가 PDF에 그리지 못하고 빠뜨리는 경우가 있어,
// 견적 카드(PDF 캡처 영역)에는 변환된 PNG를 쓴다. 변환 실패 시 원본 경로를 그대로 쓴다.
async function rasterize(src: string, height: number): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const ratio = (img.naturalWidth || img.width) / (img.naturalHeight || img.height || 1);
  const canvas = document.createElement("canvas");
  canvas.height = height;
  canvas.width = Math.round(height * ratio);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

const formatWon = (n: number) => Math.round(n).toLocaleString("ko-KR");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};
const dotDate = (iso: string) => iso.slice(0, 10).replace(/-/g, ".");
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export default function RenthanaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const productKey: ProductKey = searchParams.get("item") === "tire" ? "tire" : "battery";
  const product = PRODUCTS[productKey];
  const viewQuoteNo = searchParams.get("quote");       // 이력 보기 모드
  const selectProduct = (k: ProductKey) => {
    setQuoteMeta(null);
    setSearchParams(k === "battery" ? {} : { item: k }, { replace: true });
  };
  // 발급된 견적번호/일자 — 이력 보기 중이거나 방금 PDF로 저장한 견적
  const [quoteMeta, setQuoteMeta] = useState<{ no: string; date: string } | null>(null);
  const [viewError, setViewError] = useState("");
  const [priceInput, setPriceInput] = useState("1,000,000");
  const [itemName, setItemName] = useState("");          // 견적서에 표시할 품목명 (선택)
  const [showPrice, setShowPrice] = useState(true);      // 견적서에 공급가격 표시 여부
  const [downloading, setDownloading] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  const [logoSrc, setLogoSrc] = useState({ renthana: "/logo/renthana.svg", rnf: "/logo/RNF_LOGO.png" });

  useEffect(() => {
    rasterize("/logo/renthana.svg", 112).then((renthana) => setLogoSrc((l) => ({ ...l, renthana }))).catch(() => {});
    rasterize("/logo/RNF_LOGO.png", 300).then((rnf) => setLogoSrc((l) => ({ ...l, rnf }))).catch(() => {});
  }, []);

  // 이력 보기: 저장된 견적을 불러와 입력값을 그대로 복원 (tb_quotations는 관리자만 읽을 수 있음)
  useEffect(() => {
    if (!viewQuoteNo) return;
    supabase.from("tb_quotations").select("quote_no,quote_date,items")
      .eq("quote_type", "renthana").eq("quote_no", viewQuoteNo).maybeSingle()
      .then(({ data }) => {
        const it = (data?.items as any[] | null)?.[0];
        if (!data || !it) { setViewError("견적을 찾을 수 없습니다. 관리자 계정으로 로그인한 상태에서 열어주세요."); return; }
        setViewError("");
        setQuoteMeta({ no: data.quote_no, date: dotDate(data.quote_date) });
        setItemName(it.name && it.name !== it.product ? it.name : "");
        setPriceInput(Number(it.price || 0).toLocaleString("ko-KR"));
        setShowPrice(it.show_price !== false);
        const key: ProductKey = it.product === "타이어" ? "tire" : "battery";
        setSearchParams(key === "battery" ? { quote: viewQuoteNo } : { item: key, quote: viewQuoteNo }, { replace: true });
      });
  }, [viewQuoteNo]);

  // 이력 보기 중에 입력값을 바꾸면 새 견적으로 전환 (번호 없이 다시 계산)
  const leaveView = () => {
    if (!viewQuoteNo && !quoteMeta) return;
    setQuoteMeta(null);
    if (viewQuoteNo) setSearchParams(productKey === "battery" ? {} : { item: productKey }, { replace: true });
  };

  const price = Number(priceInput.replace(/[^0-9]/g, "")) || 0;
  const priceWithVat = useMemo(() => price * VAT_RATE, [price]);
  const fee12 = useMemo(() => priceWithVat * product.rate12, [priceWithVat, product]);
  const fee36 = useMemo(() => priceWithVat * product.rate36, [priceWithVat, product]);

  const onPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    leaveView();
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setPriceInput(digits ? Number(digits).toLocaleString("ko-KR") : "");
  };

  const downloadPdf = async () => {
    const el = quoteRef.current;
    if (!el) return;
    setDownloading(true);
    try {
      // 새 견적이면 견적번호를 발급받고 이력에 저장한 뒤, 번호가 찍힌 화면으로 캡처한다.
      // (이력 보기 중이면 기존 번호 그대로 다시 받기만 한다. 저장 실패해도 PDF는 받을 수 있게 한다.)
      let meta = quoteMeta;
      if (!meta) {
        const { data, error } = await supabase.rpc("save_renthana_quote", {
          p_product: product.label, p_item_name: itemName.trim(), p_price: price,
          p_show_price: showPrice, p_fee12: Math.round(fee12 / 12), p_fee36: Math.round(fee36 / 36),
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row) console.error("[렌타나 견적 이력 저장 실패]", error?.message);
        else {
          meta = { no: row.quote_no, date: dotDate(row.quote_date) };
          setQuoteMeta(meta);
          await nextFrame();
        }
      }
      // 로고(SVG) 등 이미지가 아직 로딩 중일 때 캡처되어 PDF에서 빠지는 것을 방지
      await Promise.all(
        Array.from(el.querySelectorAll("img")).map((img) =>
          img.complete ? Promise.resolve() : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          })
        )
      );
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      addCanvasToA4(pdf, canvas);   // 비율 유지 (길면 살짝 축소)
      pdf.save(`렌타나_${product.label}_렌탈료견적_${meta ? meta.no : todayStr().replace(/\./g, "")}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>렌탈료 계산기 | RENTHANA</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Link
        to="/"
        className="fixed top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-600 shadow-sm hover:border-gray-300 hover:text-gray-800 transition-all"
      >
        ← 메인으로
      </Link>

      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="flex items-center justify-center gap-4">
            <a href="https://www.renthana.com" target="_blank" rel="noopener noreferrer">
              <img src="/logo/renthana.svg" alt="RENTHANA" className="h-6 w-auto" />
            </a>
            <span className="text-gray-300 text-sm">×</span>
            <img src="/logo/RNF_LOGO.png" alt="RNF KOREA" className="h-[94px] w-auto object-contain" />
          </div>

          <h1 className="text-xl font-bold text-[#1A1612] text-center">{product.label} 렌탈료 간편 계산기</h1>

          {(viewQuoteNo || quoteMeta || viewError) && (
            <div className={`rounded-xl border px-4 py-2.5 text-xs flex items-center justify-between gap-2 ${viewError ? "bg-red-50 border-red-200 text-red-600" : "bg-blue-50 border-blue-100 text-blue-700"}`}>
              <span>
                {viewError
                  ? viewError
                  : viewQuoteNo
                    ? <>📄 견적 이력 보기 — <b className="font-mono">{quoteMeta?.no ?? viewQuoteNo}</b>{quoteMeta && ` (${quoteMeta.date})`} · 다시 PDF로 받을 수 있습니다</>
                    : <>✅ 견적번호 <b className="font-mono">{quoteMeta?.no}</b>로 견적서 발송 이력에 저장되었습니다</>}
              </span>
              <button type="button" onClick={() => { setViewError(""); leaveView(); }} className="shrink-0 font-semibold underline">
                새 견적
              </button>
            </div>
          )}

          {/* 품목 선택 */}
          <div className="flex justify-center">
            <div className="inline-flex p-1 rounded-xl bg-white border border-gray-200 shadow-sm">
              {(Object.keys(PRODUCTS) as ProductKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => selectProduct(k)}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    productKey === k ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {PRODUCTS[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* 입력 영역 (PDF 캡처 대상 아님) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">품목명 (선택 — 견적서에 표시됩니다)</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => { leaveView(); setItemName(e.target.value); }}
                placeholder={productKey === "tire" ? "예: 11R22.5 16PR 후륜 타이어 × 6본" : "예: 48V 400Ah 리튬이온 배터리"}
                className="w-full h-12 rounded-xl border border-gray-200 px-4 text-base text-gray-800 focus:outline-none focus:border-orange-400 transition-all"
              />
            </div>
            <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{product.label} 가격을 입력하세요 (원, VAT제외)</label>
            <input
              type="text"
              inputMode="numeric"
              value={priceInput}
              onChange={onPriceChange}
              placeholder="예: 1,000,000"
              className="w-full h-12 rounded-xl border border-gray-200 px-4 text-lg font-semibold text-gray-800 focus:outline-none focus:border-orange-400 transition-all"
            />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">견적서에 공급가격 표시</span>
              <div className="inline-flex p-0.5 rounded-lg bg-gray-100 border border-gray-200">
                {[{ v: true, l: "보이기" }, { v: false, l: "가리기" }].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    onClick={() => { leaveView(); setShowPrice(o.v); }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      showPrice === o.v ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 견적 카드 — 이 영역만 PDF로 캡처됩니다 */}
          <div ref={quoteRef} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6 pb-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <a href="https://www.renthana.com" target="_blank" rel="noopener noreferrer">
                  <img src={logoSrc.renthana} alt="RENTHANA" className="h-7 w-auto" />
                </a>
                <span className="text-gray-300 text-sm">×</span>
                <img src={logoSrc.rnf} alt="RNF KOREA" className="h-16 w-auto object-contain" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-800">렌탈 견적 기준일자</p>
                <p className="text-xs text-gray-400">{quoteMeta?.date ?? todayStr()}</p>
                {quoteMeta && <p className="text-[11px] text-gray-400 mt-0.5 font-mono">No. {quoteMeta.no}</p>}
              </div>
            </div>

            {itemName.trim() && (
              <div className="mb-5">
                <p className="text-xs text-gray-400 mb-1">품목명</p>
                <p className="text-lg font-bold text-[#1A1612] break-keep">{itemName.trim()}</p>
              </div>
            )}

            {showPrice && (
              <div className="mb-6">
                <p className="text-xs text-gray-400 mb-1">{product.label} 공급가격</p>
                <p className="text-2xl font-bold text-[#1A1612]">{formatWon(price)}원</p>
                <p className="text-xs text-gray-400 mt-1">부가세 포함 {formatWon(priceWithVat)}원</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-xs text-gray-400 mb-1">12개월 렌탈료</p>
                <p className="text-xl font-bold text-[#C1462B]">{formatWon(fee12 / 12)}원/월</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-xs text-gray-400 mb-1">36개월 렌탈료</p>
                <p className="text-xl font-bold text-[#C1462B]">{formatWon(fee36 / 36)}원/월</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-6 text-center leading-relaxed">
              자세한 내용은 상담원을 통해 확인해주세요{" "}
              <a href="tel:1551-1873" className="font-semibold text-orange-600 hover:underline">
                1551-1873
              </a>{" "}
              (대표번호)
            </p>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <div className="flex items-start justify-between gap-2 mb-4">
                <span className="shrink-0 text-[10px] font-semibold tracking-wide text-gray-400 uppercase whitespace-nowrap">About RENTHANA</span>
                <p className="text-sm font-bold text-[#1A1612] text-right">
                  당신의 자산이 <span className="text-[#C1462B]">일하게</span> 하라.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-y-3 mb-4">
                {RENTHANA_STATS.map((s) => (
                  <div key={s.l}>
                    <p className="text-base font-extrabold text-[#C1462B]">{s.n}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed">
                렌타나(RENTHANA)는 건설장비·의료기기·공작기계 등 8개 카테고리, 5,000여 자산을 신용·벤더·설치환경·금융
                4대 기준으로 검증해 연결하는 자산 렌탈 인프라 플랫폼입니다. RNFKorea 의 렌탈상품은 렌타나와 함께합니다.
              </p>
              <a
                href="https://www.renthana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1.5 text-[11px] font-semibold text-gray-500 hover:text-orange-600 hover:underline"
              >
                www.renthana.com
              </a>
            </div>
          </div>

          <button
            onClick={() => void downloadPdf()}
            disabled={downloading || price <= 0}
            className="w-full h-12 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-all disabled:opacity-40"
          >
            {downloading ? "PDF 생성 중..." : "PDF로 저장"}
          </button>
        </div>
      </div>
    </>
  );
}
