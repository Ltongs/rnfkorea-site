// pages/Renthana/index.tsx
// 렌타나(renthana.com) 제휴 배터리 렌탈료 계산기 — 로그인 없이 URL로 누구나 접근 가능
// 렌탈료 = 가격 × 103% × 111.7%(12개월) / 135%(36개월)

import React, { useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const RATE_12 = 1.03 * 1.117; // 103% × 111.7%
const RATE_36 = 1.03 * 1.35;  // 103% × 135%

const formatWon = (n: number) => Math.round(n).toLocaleString("ko-KR");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export default function RenthanaPage() {
  const [priceInput, setPriceInput] = useState("1,000,000");
  const [downloading, setDownloading] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);

  const price = Number(priceInput.replace(/[^0-9]/g, "")) || 0;
  const fee12 = useMemo(() => price * RATE_12, [price]);
  const fee36 = useMemo(() => price * RATE_36, [price]);

  const onPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setPriceInput(digits ? Number(digits).toLocaleString("ko-KR") : "");
  };

  const downloadPdf = async () => {
    const el = quoteRef.current;
    if (!el) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = Math.min(pageHeight, (canvas.height * pageWidth) / canvas.width);
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeight);
      pdf.save(`렌타나_렌탈료견적_${todayStr().replace(/\./g, "")}.pdf`);
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

      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-xl mx-auto space-y-4">
          {/* 입력 영역 (PDF 캡처 대상 아님) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">장비/배터리 가격 (원)</label>
            <input
              type="text"
              inputMode="numeric"
              value={priceInput}
              onChange={onPriceChange}
              placeholder="예: 1,000,000"
              className="w-full h-12 rounded-xl border border-gray-200 px-4 text-lg font-semibold text-gray-800 focus:outline-none focus:border-orange-400 transition-all"
            />
          </div>

          {/* 견적 카드 — 이 영역만 PDF로 캡처됩니다 */}
          <div ref={quoteRef} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6 pb-5 border-b border-gray-100">
              <a href="https://www.renthana.com" target="_blank" rel="noopener noreferrer">
                <img src="/logo/renthana.svg" alt="RENTHANA" className="h-7 w-auto" />
              </a>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-800">렌탈료 견적</p>
                <p className="text-xs text-gray-400">{todayStr()}</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs text-gray-400 mb-1">기준 가격</p>
              <p className="text-2xl font-bold text-[#1A1612]">{formatWon(price)}원</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-xs text-gray-400 mb-1">12개월 렌탈료</p>
                <p className="text-xl font-bold text-[#C1462B]">{formatWon(fee12)}원</p>
                <p className="text-[11px] text-gray-300 mt-1">월 {formatWon(fee12 / 12)}원 환산</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-xs text-gray-400 mb-1">36개월 렌탈료</p>
                <p className="text-xl font-bold text-[#C1462B]">{formatWon(fee36)}원</p>
                <p className="text-[11px] text-gray-300 mt-1">월 {formatWon(fee36 / 36)}원 환산</p>
              </div>
            </div>

            <p className="text-[11px] text-gray-300 mt-6 leading-relaxed">
              ※ 본 금액은 참고용 자동 계산 결과이며(가격×103%×111.7%/135%), 실제 계약 조건에 따라 달라질 수 있습니다. VAT 별도.
            </p>
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
