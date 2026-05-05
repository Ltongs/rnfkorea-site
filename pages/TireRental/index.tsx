// pages/TireRental/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, CheckCircle, ChevronRight } from "lucide-react";

// ====================================================
// SEO 설정
// ====================================================
const SEO_TITLE = "타이어렌탈몰 | 화물차·지게차 타이어 월 납입 렌탈 | RNF KOREA";
const SEO_DESC =
  "카고·덤프·버스·지게차 타이어를 월 렌탈료로. 초기비용 없이 12개월 분납. 대한민국 최초 타이어 렌탈 서비스. 상담 1551-1873.";
const SEO_CANONICAL = "https://www.rnfkorea.co.kr/tire-rental";
const SEO_KEYWORDS =
  "타이어렌탈몰,화물차타이어렌탈,지게차타이어렌탈,카고타이어렌탈,덤프타이어렌탈,타이어월납입,타이어분납,상용차타이어렌탈,솔리드타이어렌탈,12R22.5렌탈";
const SEO_OG_IMAGE = "https://www.rnfkorea.co.kr/og-image.jpg";

const JSON_LD_SERVICE = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "타이어렌탈몰 — 화물차·지게차 타이어 렌탈 서비스",
  description: "카고·덤프·버스·지게차용 타이어 12개월 렌탈. 초기비용 0원, 월 납입 구조.",
  provider: {
    "@type": "Organization",
    name: "(주)알앤에프코리아",
    url: "https://www.rnfkorea.co.kr",
    telephone: "1551-1873",
  },
  areaServed: { "@type": "Country", name: "Korea" },
  serviceType: "타이어 렌탈",
  offers: {
    "@type": "Offer",
    description: "12개월 월 렌탈 구조, 초기비용 0원",
    priceCurrency: "KRW",
    availability: "https://schema.org/InStock",
  },
};

const JSON_LD_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: "https://www.rnfkorea.co.kr/" },
    { "@type": "ListItem", position: 2, name: "타이어렌탈몰", item: "https://www.rnfkorea.co.kr/tire-rental" },
  ],
};

const JSON_LD_ITEM_LIST = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "타이어렌탈몰 주요 렌탈 상품",
  url: "https://www.rnfkorea.co.kr/tire-rental",
  itemListElement: [
    {
      "@type": "ListItem", position: 1,
      item: {
        "@type": "Product",
        name: "금호타이어 KRS55 12R22.5 렌탈",
        description: "카고·트레일러 전륜용. 12개월 월 납입 렌탈. 배송비·장착비 포함.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
    {
      "@type": "ListItem", position: 2,
      item: {
        "@type": "Product",
        name: "금호타이어 KRD55 12R22.5 렌탈",
        description: "카고·트레일러 후륜용. 12개월 월 납입 렌탈. 배송비·장착비 포함.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
    {
      "@type": "ListItem", position: 3,
      item: {
        "@type": "Product",
        name: "금호타이어 KXA11 385/65R22.5 렌탈",
        description: "덤프용 올시즌 타이어. 12개월 월 납입 렌탈. 배송비·장착비 포함.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
    {
      "@type": "ListItem", position: 4,
      item: {
        "@type": "Product",
        name: "금호타이어 KRS50 385/65R22.5 렌탈",
        description: "덤프용 고마일리지 타이어. 12개월 월 납입 렌탈. 배송비·장착비 포함.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
    {
      "@type": "ListItem", position: 5,
      item: {
        "@type": "Product",
        name: "금호타이어 KRA53 12R22.5 렌탈 (버스용)",
        description: "버스 중·장거리 노선 최적화 타이어. 12개월 월 납입 렌탈. 배송비·장착비 포함.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
  ],
};

const JSON_LD_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "화물차 타이어 렌탈은 어떻게 진행되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "전화 또는 온라인 상담 신청 후, 차종·규격·수량을 확인해 월 렌탈료를 안내드립니다. 계약 후 지정 장소로 타이어를 배송·장착해드립니다. 배송비와 장착비는 렌탈료에 포함되어 있습니다.",
      },
    },
    {
      "@type": "Question",
      name: "타이어 렌탈 초기비용이 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "초기비용 0원입니다. 목돈 없이 월 납입 구조로 이용 가능하며, 배송비·장착비도 렌탈료에 포함되어 별도 추가 비용이 없습니다.",
      },
    },
    {
      "@type": "Question",
      name: "렌탈 계약 기간은 얼마나 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "기본 계약 기간은 12개월입니다. 매월 고정된 렌탈료만 납입하면 되므로 현금흐름 관리가 쉬워집니다.",
      },
    },
    {
      "@type": "Question",
      name: "어떤 차종의 타이어를 렌탈할 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "카고·트레일러, 덤프, 버스 등 화물차 전 차종과 지게차 타이어 렌탈이 가능합니다. 목록에 없는 규격도 상담을 통해 확인 가능합니다.",
      },
    },
    {
      "@type": "Question",
      name: "개인(개별)화물협회 회원은 혜택이 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "서울·광주·경북·경남 개인(개별)화물협회 MOU 체결 기업으로, 협회 회원에게는 우대 조건과 서류 간소화 프로세스를 제공합니다.",
      },
    },
    {
      "@type": "Question",
      name: "렌탈료는 운영비로 처리할 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "렌탈료는 구매와 달리 운영비(비용)로 처리할 수 있어 세무상 유리한 경우가 있습니다. 정확한 세무 처리는 담당 세무사와 확인하시기 바랍니다.",
      },
    },
  ],
};

// ====================================================
// CSV 파싱
// ====================================================
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=306191113&single=true&output=csv";

type TireRentalRow = {
  brand: string;
  model_line: string;
  size: string;
  axle: string;
  oe_fitment: string;
  vehicle_type: string;
  ton_class: string;
  pr: string;
  price: string;
  rental_12: string;
  shop_title: string;
  main_thumb_url: string;
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      result.push(current); current = "";
    } else { current += char; }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

function parseCSV(text: string): TireRentalRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row as TireRentalRow;
  });
}

function toNumber(v: string) {
  const n = Number(String(v || "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function getAxleLabel(axle: string) {
  const a = axle.toUpperCase();
  if (a === "STEER") return "전륜";
  if (a === "DRIVE") return "후륜";
  return "All";
}

function normalizeFitment(v: string) {
  return (v || "")
    .replace(/^11T\s*카고/i, "11~25T 카고")
    .replace(/^11톤\s*카고/i, "11~25T 카고");
}

type VehicleTab = "전체" | "카고·트레일러" | "덤프" | "버스" | "지게차";
const VEHICLE_TABS: VehicleTab[] = ["전체", "카고·트레일러", "덤프", "버스", "지게차"];

function getVehicleTab(row: TireRentalRow): Exclude<VehicleTab, "전체"> {
  const vt = (row.vehicle_type || "").toUpperCase();
  if (vt === "DUMP")     return "덤프";
  if (vt === "BUS")      return "버스";
  if (vt === "FORKLIFT" || vt === "FL" || vt === "지게차") return "지게차";
  return "카고·트레일러";
}

// ====================================================
// 공통 컴포넌트 (타 페이지와 동일 구조)
// ====================================================
function SectionHeader({
  eyebrow, title, description,
}: {
  eyebrow?: string; title: string; description?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow && (
        <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 text-2xl md:text-3xl font-semibold leading-[1.2] text-navy-900 break-keep">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-base leading-7 text-neutral-600 break-keep">{description}</p>
      )}
    </div>
  );
}

// ====================================================
// 렌탈 상품 카드 (타이어쇼핑몰 스타일)
// ====================================================
const RentalCard: React.FC<{ row: TireRentalRow; onSelect: (row: TireRentalRow) => void }> = ({ row, onSelect }) => {
  const rental12 = toNumber(row.rental_12);
  const title = row.shop_title || `${row.brand} ${row.model_line} ${row.size}`;

  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
      itemScope
      itemType="https://schema.org/Product"
      onClick={() => onSelect(row)}
    >
      {/* 이미지 */}
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        {row.main_thumb_url ? (
          <img
            src={row.main_thumb_url}
            alt={`${title} 타이어`}
            className="h-full w-full object-contain p-3"
            loading="lazy"
            itemProp="image"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-400">
            NO IMAGE
          </div>
        )}
      </div>

      {/* 내용 */}
      <div className="flex flex-1 flex-col p-4 space-y-3">

        {/* 뱃지 */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-600 rounded-full">
            {getVehicleTab(row)}
          </span>
          <span className="px-3 py-1 text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600 rounded-full">
            {getAxleLabel(row.axle)}
          </span>
        </div>

        {/* 규격 + PR */}
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-semibold text-navy-900 leading-tight" itemProp="name">
            {row.size}
          </h3>
          {row.pr && (
            <span className="text-sm font-semibold text-gray-500">{row.pr}</span>
          )}
        </div>

        {/* 브랜드·모델·적용차종 스펙 */}
        <dl className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-700 space-y-1.5">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">브랜드</dt>
            <dd className="font-semibold text-right">{row.brand || "-"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">모델</dt>
            <dd className="font-semibold text-right">{row.model_line || "-"}</dd>
          </div>
          {row.oe_fitment && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">적용차종</dt>
              <dd className="font-semibold text-right">{normalizeFitment(row.oe_fitment)}</dd>
            </div>
          )}
        </dl>

        {/* 렌탈료 */}
        <div
          className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-center"
          itemProp="offers"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <p className="text-xs font-semibold text-orange-600 mb-1">12개월 월 렌탈료 (1개 기준)</p>
          <p className="text-xl font-semibold text-orange-600">
            {rental12 ? `월 ${rental12.toLocaleString("ko-KR")}원` : "문의"}
          </p>
          <p className="mt-1 text-[11px] text-orange-500">배송비·장착비 포함</p>
          <meta itemProp="priceCurrency" content="KRW" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
        </div>

        {/* 상세보기 버튼 */}
        <div className="mt-auto block text-center bg-gray-900 text-white rounded-xl py-3 font-semibold text-sm">
          상세보기 / 렌탈 상담하기
        </div>
      </div>
    </article>
  );
};

// ====================================================
// FAQ 아코디언 컴포넌트
// ====================================================
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm md:text-base font-semibold text-navy-900 break-keep">
          Q. {question}
        </span>
        <span className={`shrink-0 text-orange-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-gray-100">
          <p className="mt-4 text-sm md:text-base text-gray-600 leading-7 break-keep">
            A. {answer}
          </p>
        </div>
      )}
    </div>
  );
}

// ====================================================
// 메인 페이지
// ====================================================
export default function TireRentalPage() {
  const [rows, setRows] = useState<TireRentalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<VehicleTab>("전체");
  const [axleFilter, setAxleFilter] = useState<"전체" | "전륜" | "후륜" | "All">("전체");
  const [sizeFilter, setSizeFilter] = useState("ALL");

  // 모달
  const [selectedRow, setSelectedRow] = useState<TireRentalRow | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [modalForm, setModalForm] = useState({ name: "", phone: "", email: "", vehicle: "", memo: "" });

  const consultForm = modalForm;
  const setConsultForm = setModalForm;

  useEffect(() => {
    let alive = true;
    fetch(CSV_URL)
      .then((r) => r.text())
      .then((text) => {
        if (!alive) return;
        const all = parseCSV(text);
        const rentalRows = all.filter(
          (r) => r.model_line && r.model_line.trim() !== "" &&
                 r.size && r.size.trim() !== "" &&
                 r.vehicle_type && r.vehicle_type.trim() !== ""
        );
        setRows(rentalRows);
      })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const sizeOptions = useMemo(() => {
    const scoped = rows.filter((r) => {
      if (activeTab !== "전체" && getVehicleTab(r) !== activeTab) return false;
      if (axleFilter !== "전체") {
        const code = r.axle.toUpperCase();
        if (axleFilter === "전륜" && code !== "STEER") return false;
        if (axleFilter === "후륜" && code !== "DRIVE") return false;
        if (axleFilter === "All" && code !== "ALL") return false;
      }
      return true;
    });
    const seen = new Map<string, string>();
    scoped.forEach((r) => {
      const key = r.size.trim().replace(/\s+/g, "").toUpperCase();
      if (key && !seen.has(key)) seen.set(key, r.size.trim());
    });
    return [{ key: "ALL", label: "전체" }, ...Array.from(seen.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, "ko"))];
  }, [rows, activeTab, axleFilter]);

  const filtered = useMemo(() => {
    let result = [...rows];
    if (activeTab !== "전체") result = result.filter((r) => getVehicleTab(r) === activeTab);
    if (axleFilter !== "전체") {
      result = result.filter((r) => {
        const code = r.axle.toUpperCase();
        if (axleFilter === "전륜") return code === "STEER";
        if (axleFilter === "후륜") return code === "DRIVE";
        if (axleFilter === "All") return code === "ALL";
        return true;
      });
    }
    if (sizeFilter !== "ALL") {
      result = result.filter((r) => r.size.trim().replace(/\s+/g, "").toUpperCase() === sizeFilter);
    }
    return result;
  }, [rows, activeTab, axleFilter, sizeFilter]);

  // 모달 렌탈 상담 메모 빌더
  const buildRentalMemo = (row: TireRentalRow, qty: number) => {
    const rental12 = toNumber(row.rental_12);
    const monthlyTotal = rental12 * qty;
    const title = row.shop_title || `${row.brand} ${row.model_line} ${row.size}`;
    return [
      `[타이어렌탈몰 상담] ${title} / ${qty}개`, "",
      "[상품 정보]",
      `상품명: ${title}`,
      `브랜드: ${row.brand || "-"}`,
      `모델: ${row.model_line || "-"}`,
      `사이즈: ${row.size || "-"}`,
      `PR: ${row.pr || "-"}`,
      `위치: ${getAxleLabel(row.axle)}`,
      `적용차종: ${normalizeFitment(row.oe_fitment) || "-"}`, "",
      "[렌탈 조건]",
      `수량: ${qty}개`,
      `월 렌탈료(1개): ${rental12 ? `${rental12.toLocaleString("ko-KR")}원` : "미정"}`,
      `월 렌탈료(합계): ${monthlyTotal ? `${monthlyTotal.toLocaleString("ko-KR")}원` : "미정"}`,
      `배송비·장착비: 포함`,
    ].join("\n");
  };

  const handleModalSubmit = async () => {
    if (!selectedRow) return;
    if (!modalForm.phone.trim() && !modalForm.email.trim()) {
      alert("연락처 또는 이메일 중 하나는 필수입니다."); return;
    }
    setIsSubmittingModal(true);
    try {
      const productMemo = buildRentalMemo(selectedRow, quantity);
      const customerMemo = [
        "", "[고객 입력 정보]",
        `성함: ${modalForm.name || "(미입력)"}`,
        `연락처: ${modalForm.phone || "(미입력)"}`,
        `이메일: ${modalForm.email || "(미입력)"}`,
        `차종/톤수: ${modalForm.vehicle || "(미입력)"}`,
        `문의 내용: ${modalForm.memo || "(미입력)"}`,
      ].join("\n");
      const res = await fetch("/.netlify/functions/send-consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: "TIRE_RENTAL",
          name: modalForm.name,
          phone: modalForm.phone,
          email: modalForm.email,
          memo: `${productMemo}${customerMemo}`,
        }),
      });
      if (!res.ok) throw new Error("전송 실패");
      alert("상담 신청이 접수되었습니다.\n담당자가 확인 후 연락드리겠습니다.");
      setModalForm({ name: "", phone: "", email: "", vehicle: "", memo: "" });
      setSelectedRow(null);
    } catch {
      alert("전송에 실패했습니다.\n대표번호 1551-1873으로 문의 부탁드립니다.");
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", vehicle: "", size: "", memo: "" });

  const handleSubmit = async () => {
    if (!formData.phone.trim()) { alert("연락처를 입력해주세요."); return; }
    setSubmitting(true);
    try {
      const memo = [
        "[타이어렌탈몰 상담]",
        `성함: ${formData.name || "(미입력)"}`,
        `연락처: ${formData.phone}`,
        `차종/톤수: ${formData.vehicle || "(미입력)"}`,
        `희망 규격: ${formData.size || "(미입력)"}`,
        `문의내용: ${formData.memo || "(미입력)"}`,
      ].join("\n");
      const res = await fetch("/.netlify/functions/send-consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: "TIRE_RENTAL",
          name: formData.name,
          phone: formData.phone,
          email: "",
          memo,
        }),
      });
      if (!res.ok) throw new Error("전송 실패");
      alert("상담 신청이 접수되었습니다.\n담당자가 확인 후 연락드리겠습니다.");
      setFormData({ name: "", phone: "", vehicle: "", size: "", memo: "" });
    } catch {
      alert("전송에 실패했습니다.\n대표번호 1551-1873으로 문의 부탁드립니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-navy-900">

      {/* ===== SEO Head ===== */}
      <Helmet>
        <title>{SEO_TITLE}</title>
        <meta name="description" content={SEO_DESC} />
        <meta name="keywords" content={SEO_KEYWORDS} />
        <link rel="canonical" href={SEO_CANONICAL} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="(주)알앤에프코리아" />
        <meta property="og:title" content={SEO_TITLE} />
        <meta property="og:description" content={SEO_DESC} />
        <meta property="og:url" content={SEO_CANONICAL} />
        <meta property="og:image" content={SEO_OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="ko_KR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO_TITLE} />
        <meta name="twitter:description" content={SEO_DESC} />
        <meta name="twitter:image" content={SEO_OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(JSON_LD_SERVICE)}</script>
        <script type="application/ld+json">{JSON.stringify(JSON_LD_BREADCRUMB)}</script>
        <script type="application/ld+json">{JSON.stringify(JSON_LD_ITEM_LIST)}</script>
        <script type="application/ld+json">{JSON.stringify(JSON_LD_FAQ)}</script>
      </Helmet>

      {/* ===== Hero — 네이비 배경 ===== */}
      <section
        className="relative bg-[#0a192f] text-white overflow-hidden"
        aria-label="페이지 헤더"
      >
        {/* 배경 패턴 */}
        <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
          <div className="absolute inset-0" style={{
            backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
            backgroundSize: "24px 24px",
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-12 md:py-16">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-6 items-start">
            <div className="lg:col-span-7">

              {/* Breadcrumb */}
              <nav aria-label="breadcrumb">
                <ol
                  className="flex items-center text-sm text-white/60"
                  itemScope
                  itemType="https://schema.org/BreadcrumbList"
                >
                  <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                    <Link to="/" className="hover:text-white transition-colors" itemProp="item">
                      <span itemProp="name">Home</span>
                    </Link>
                    <meta itemProp="position" content="1" />
                  </li>
                  <li aria-hidden="true" className="mx-2">/</li>
                  <li
                    className="text-white/90 font-semibold"
                    itemProp="itemListElement"
                    itemScope
                    itemType="https://schema.org/ListItem"
                    aria-current="page"
                  >
                    <span itemProp="name">타이어렌탈몰</span>
                    <meta itemProp="position" content="2" />
                  </li>
                </ol>
              </nav>

              <p className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
                Tire Rental
              </p>

              <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-white break-keep">
                타이어렌탈몰,<br />
                <span className="text-orange-400">월 납입으로 부담 없이</span>
              </h1>

              <p className="mt-4 text-base md:text-lg leading-7 text-white/75 max-w-3xl break-keep">
                화물차(카고·덤프·버스)와 지게차 타이어를 목돈 없이 월 렌탈료로.
                초기비용 0원, 12개월 분납 구조로 현금흐름 부담을 없앱니다.
              </p>

              <ul className="mt-6 space-y-2 list-none p-0" aria-label="핵심 혜택">
                {[
                  "초기비용 0원 — 목돈 부담 없음",
                  "12개월 월 납입 구조",
                  "배송비·장착비 포함 — 추가 비용 없음",
                  "화물차·지게차 전 차종 적용",
                  "개인(개별)화물협회 회원 우대 조건",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm md:text-base text-white/85">
                    <CheckCircle size={16} className="text-orange-400 shrink-0" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="tel:1551-1873"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-400 transition-all shadow-sm"
                  aria-label="전화 상담 1551-1873"
                >
                  <Phone size={15} aria-hidden="true" />
                  상담 문의 1551-1873
                </a>
                <a
                  href="#consult-form"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/20 transition-all"
                >
                  온라인 상담 신청
                  <ChevronRight size={15} aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* 우측 요약 카드 */}
            <aside className="lg:col-span-5" aria-label="렌탈 조건 요약">
              <div className="rounded-3xl bg-white/10 border border-white/20 backdrop-blur-sm p-6 md:p-7">
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
                  Rental Condition
                </p>
                <p className="mt-2 text-xl md:text-2xl font-semibold leading-[1.2] text-white break-keep">
                  대한민국 최초<br />타이어 렌탈몰
                </p>
                <p className="mt-3 text-sm md:text-base leading-7 text-white/70 break-keep">
                  화물차에서 지게차까지,<br />
                  RNF KOREA만의 타이어 렌탈 상품입니다.
                </p>

                <dl className="mt-5 space-y-2.5">
                  {[
                    { label: "초기비용",  value: "0원" },
                    { label: "계약 기간", value: "12개월" },
                    { label: "적용 차종", value: "화물차·지게차" },
                    { label: "대표번호",  value: "1551-1873" },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between border-b border-white/10 pb-2.5 last:border-0 last:pb-0"
                    >
                      <dt className="text-sm text-white/60">{label}</dt>
                      <dd className="text-sm font-semibold text-white">{value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-5 text-xs text-white/40 leading-relaxed">
                  ※ 실제 렌탈료는 타이어 규격·차종·수량에 따라 다릅니다.
                </p>

                <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
                  <span className="text-xs text-white/70 break-keep shrink-0">렌탈 전문 파트너</span>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1">
                    <span className="text-xs font-semibold text-gray-700 break-keep">(주)비에스온</span>
                    <img
                      src="/logo/bson.jpg"
                      alt="비에스온(BSON) 로고"
                      className="h-5 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <span className="text-xs text-white/70 break-keep">과 함께합니다.</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ===== 렌탈 상품 목록 ===== */}
      <section className="py-6 md:py-8 border-t border-gray-100 bg-gray-50/70" aria-labelledby="products-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Products"
            title="렌탈 가능 타이어 목록"
            description="아래 목록은 렌탈료가 책정된 상품입니다. 목록에 없는 규격도 상담을 통해 확인 가능합니다."
          />

          <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
            {/* 차종 탭 */}
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="차종별 타이어 필터">
              {VEHICLE_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => { setActiveTab(tab); setSizeFilter("ALL"); }}
                  className={`h-10 px-5 rounded-full text-sm font-semibold border transition-all ${
                    activeTab === tab
                      ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-600"
                  }`}
                >
                  {tab}
                </button>
              ))}

              <div className="w-px h-6 self-center bg-gray-300 mx-1" aria-hidden="true" />

              {/* 전/후륜 필터 */}
              {(["전체", "전륜", "후륜", "All"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={axleFilter === v}
                  onClick={() => { setAxleFilter(v); setSizeFilter("ALL"); }}
                  className={`h-10 px-4 rounded-full text-sm font-semibold border transition-all ${
                    axleFilter === v
                      ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* 사이즈 필터 */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="타이어 규격 필터">
              {sizeOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={sizeFilter === opt.key}
                  onClick={() => setSizeFilter(opt.key)}
                  className={`h-10 px-4 rounded-full text-sm font-semibold border transition-all ${
                    sizeFilter === opt.key
                      ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500" aria-live="polite">상품 정보를 불러오는 중입니다...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border border-gray-200 rounded-2xl bg-white">
              <p className="text-base font-semibold text-gray-700 mb-2">
                해당 조건의 렌탈 상품은 상담으로 안내드립니다.
              </p>
              <a href="tel:1551-1873" className="text-orange-500 hover:underline">
                ☎ 1551-1873
              </a>
            </div>
          ) : (
            <>
              <p className="sr-only" aria-live="polite">{filtered.length}개 상품이 표시됩니다.</p>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 list-none p-0" role="list">
                {filtered.map((row, i) => (
                  <li key={`${row.model_line}-${row.size}-${i}`}>
                    <RentalCard row={row} onSelect={(r) => { setSelectedRow(r); setQuantity(1); }} />
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="rounded-2xl bg-orange-50 border border-orange-200 p-5 text-sm text-orange-800 leading-relaxed">
            ※ 렌탈료에는 <strong>배송비·장착비가 포함</strong>되어 있습니다. 별도 추가 비용 없이 월 납입 금액만으로 이용 가능합니다.
            수량·규격·배송지에 따라 달라질 수 있으며, 정확한 조건은 상담을 통해 확인해 드립니다.
          </div>
        </div>
      </section>

      {/* ===== 왜 렌탈인가 ===== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="why-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Why Rental"
            title="왜 타이어도 렌탈로 해야 할까요?"
            description="타이어 교체 비용은 예고 없이 목돈이 나갑니다. 렌탈 구조로 전환하면 현금흐름이 안정됩니다."
          />
          <ul className="grid md:grid-cols-3 gap-6 list-none p-0" role="list">
            {[
              {
                title: "목돈 부담 제거",
                desc: "화물차 타이어 전체 교체 시 한 번에 200~500만 원이 나갑니다. 렌탈로 전환하면 이 비용이 월 납입으로 분산됩니다.",
              },
              {
                title: "현금흐름 예측 가능",
                desc: "매달 고정된 렌탈료만 나가므로 현금흐름 계획이 쉬워집니다. 갑작스러운 목돈 지출이 없습니다.",
              },
              {
                title: "운영비 처리 가능",
                desc: "렌탈료는 구매와 달리 운영비(비용)로 처리할 수 있어 세무상 유리한 경우가 있습니다.",
              },
            ].map(({ title, desc }) => (
              <li key={title} className="border border-gray-200 rounded-2xl bg-white p-6 md:p-7 hover:shadow-md transition-all">
                <h3 className="text-lg md:text-xl font-semibold text-navy-900 mb-3">{title}</h3>
                <p className="text-sm md:text-base text-gray-600 leading-7 break-keep">{desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== 프로세스 ===== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="process-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Process"
            title="렌탈 진행 3단계"
          />
          <ol className="grid md:grid-cols-3 gap-6 list-none p-0">
            {[
              { step: "STEP 01", title: "상담 신청",   desc: "전화·온라인 폼으로 차종, 타이어 규격, 수량을 알려주세요." },
              { step: "STEP 02", title: "렌탈료 안내", desc: "규격과 수량 기준으로 월 렌탈료와 조건을 안내드립니다." },
              { step: "STEP 03", title: "계약·납품",   desc: "계약 후 지정 장소로 타이어를 배송해드립니다." },
            ].map(({ step, title, desc }) => (
              <li key={step} className="border border-gray-200 rounded-2xl bg-white p-6 md:p-7 hover:shadow-md transition-all">
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">{step}</p>
                <h3 className="mt-3 text-lg md:text-xl font-semibold text-navy-900 break-keep">{title}</h3>
                <p className="mt-2 text-sm md:text-base text-gray-600 leading-7 break-keep">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== 개별화물협회 우대 ===== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="association-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white text-orange-600 border border-orange-200">
                  협회 회원 전용
                </span>
                <h2
                  id="association-heading"
                  className="mt-4 text-2xl md:text-3xl font-semibold text-navy-900 break-keep"
                >
                  개인(개별)화물협회 회원이라면<br />
                  <span className="text-orange-600">우대 조건</span>을 받으세요
                </h2>
                <p className="mt-3 text-base text-gray-600 leading-7 break-keep">
                  서울·광주·경북·경남 개인(개별)화물협회 MOU 체결 기업입니다.
                  협회 회원 확인 후 렌탈 우대 조건을 별도 안내드립니다.
                </p>
                <ul className="mt-4 space-y-2 list-none p-0">
                  {[
                    "협회 회원 전용 우대 조건 제공",
                    "서류 간소화 프로세스 적용",
                    "타이어 소모품 특별가 제공",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle size={15} className="text-orange-500 shrink-0" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Link
                    to="/cargo-finance"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all"
                  >
                    협회 전용 금융상품 보기
                    <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-white p-6">
                <p className="text-sm font-semibold text-orange-500 mb-4">MOU 협약 완료 협회</p>
                <ul className="space-y-3 list-none p-0">
                  {[
                    "서울 개인(개별)화물협회",
                    "광주 개인(개별)화물협회",
                    "경북 개인(개별)화물협회",
                    "경남 개인(개별)화물협회",
                  ].map((name) => (
                    <li key={name} className="flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-3">
                      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" aria-hidden="true" />
                      <span className="text-sm font-semibold text-navy-900">{name}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-gray-400">* 협약 지역 지속 확대 예정</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="faq-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="FAQ"
            title="자주 묻는 질문"
            description="타이어렌탈몰 이용 전 궁금한 점을 확인하세요."
          />
          <dl className="space-y-3">
            {[
              {
                q: "화물차 타이어 렌탈은 어떻게 진행되나요?",
                a: "전화 또는 온라인 상담 신청 후, 차종·규격·수량을 확인해 월 렌탈료를 안내드립니다. 계약 후 지정 장소로 타이어를 배송·장착해드립니다. 배송비와 장착비는 렌탈료에 포함되어 있습니다.",
              },
              {
                q: "타이어 렌탈 초기비용이 있나요?",
                a: "초기비용 0원입니다. 목돈 없이 월 납입 구조로 이용 가능하며, 배송비·장착비도 렌탈료에 포함되어 별도 추가 비용이 없습니다.",
              },
              {
                q: "렌탈 계약 기간은 얼마나 되나요?",
                a: "기본 계약 기간은 12개월입니다. 매월 고정된 렌탈료만 납입하면 되므로 현금흐름 관리가 쉬워집니다.",
              },
              {
                q: "어떤 차종의 타이어를 렌탈할 수 있나요?",
                a: "카고·트레일러, 덤프, 버스 등 화물차 전 차종과 지게차 타이어 렌탈이 가능합니다. 목록에 없는 규격도 상담을 통해 확인 가능합니다.",
              },
              {
                q: "개인(개별)화물협회 회원은 혜택이 있나요?",
                a: "서울·광주·경북·경남 개인(개별)화물협회 MOU 체결 기업으로, 협회 회원에게는 우대 조건과 서류 간소화 프로세스를 제공합니다.",
              },
              {
                q: "렌탈료는 운영비로 처리할 수 있나요?",
                a: "렌탈료는 구매와 달리 운영비(비용)로 처리할 수 있어 세무상 유리한 경우가 있습니다. 정확한 세무 처리는 담당 세무사와 확인하시기 바랍니다.",
              },
            ].map(({ q, a }, i) => (
              <FaqItem key={i} question={q} answer={a} />
            ))}
          </dl>
        </div>
      </section>

      {/* ===== 온라인 상담 폼 ===== */}
      <section
        id="consult-form"
        className="py-6 md:py-8 border-t border-gray-100 scroll-mt-20"
        aria-labelledby="form-heading"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <SectionHeader
            eyebrow="Consultation"
            title="렌탈 상담 신청"
            description="연락처만 남겨주셔도 담당자가 확인 후 연락드립니다."
          />

          <div className="mt-8 max-w-3xl border border-gray-200 rounded-3xl bg-white p-6 md:p-8 shadow-sm space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rental-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  성함
                </label>
                <input
                  id="rental-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  disabled={submitting}
                />
              </div>
              <div>
                <label htmlFor="rental-phone" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  연락처 <span className="text-orange-500">*</span>
                </label>
                <input
                  id="rental-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  disabled={submitting}
                  required
                />
              </div>
              <div>
                <label htmlFor="rental-vehicle" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  차종/톤수
                </label>
                <input
                  id="rental-vehicle"
                  type="text"
                  value={formData.vehicle}
                  onChange={(e) => setFormData((p) => ({ ...p, vehicle: e.target.value }))}
                  placeholder="예: 카고 25톤, 덤프 15톤, 지게차 3톤"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  disabled={submitting}
                />
              </div>
              <div>
                <label htmlFor="rental-size" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  희망 타이어 규격
                </label>
                <input
                  id="rental-size"
                  type="text"
                  value={formData.size}
                  onChange={(e) => setFormData((p) => ({ ...p, size: e.target.value }))}
                  placeholder="예: 12R22.5, 385/65R22.5"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="rental-memo" className="block text-sm font-semibold text-gray-700 mb-1.5">
                문의 내용
              </label>
              <textarea
                id="rental-memo"
                value={formData.memo}
                onChange={(e) => setFormData((p) => ({ ...p, memo: e.target.value }))}
                placeholder="수량, 장착 지역, 기타 문의사항을 자유롭게 적어주세요."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 resize-none"
                disabled={submitting}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "전송 중..." : "상담 신청하기"}
              </button>
              <a
                href="tel:1551-1873"
                className="flex items-center justify-center gap-2 h-12 rounded-2xl border border-gray-200 bg-white text-navy-900 font-semibold hover:border-gray-300 hover:bg-gray-50 transition-all"
                aria-label="전화 상담 1551-1873"
              >
                <Phone size={16} aria-hidden="true" />
                1551-1873 전화 상담
              </a>
            </div>

            <p className="text-xs text-gray-400 text-center leading-relaxed">
              ※ 입력하신 정보는 상담 목적으로만 사용되며, 제3자에게 제공되지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 모바일 하단 고정 전화 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-orange-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <a
          href="tel:1551-1873"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-base font-semibold text-white shadow-lg"
          aria-label="타이어렌탈몰 전화 상담 1551-1873"
        >
          <Phone size={18} aria-hidden="true" />
          타이어 렌탈 상담 1551-1873
        </a>
      </div>

      {/* ===== 상품 상세 모달 ===== */}
      {selectedRow && (() => {
        const rental12 = toNumber(selectedRow.rental_12);
        const monthlyTotal = rental12 * quantity;
        const title = selectedRow.shop_title || `${selectedRow.brand} ${selectedRow.model_line} ${selectedRow.size}`;
        return (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 px-4 py-4 md:items-center"
            onClick={() => setSelectedRow(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${title} 렌탈 상담`}
          >
            <div
              className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur md:px-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-500">Tire Rental</p>
                  <h2 className="mt-1 text-xl font-semibold text-navy-900 md:text-2xl">{title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-xl text-gray-500 hover:bg-gray-50"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>

              <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.1fr] md:p-7">
                {/* 좌측: 이미지 + 스펙 */}
                <div className="space-y-4">
                  <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                    {selectedRow.main_thumb_url ? (
                      <img
                        src={selectedRow.main_thumb_url}
                        alt={title}
                        className="h-56 w-full object-contain md:h-72"
                      />
                    ) : (
                      <div className="flex h-56 items-center justify-center text-sm text-gray-400 md:h-72">NO IMAGE</div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
                    <p className="text-sm font-semibold text-navy-900 mb-3">상품 정보</p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {[
                        ["사이즈", selectedRow.size || "-"],
                        ["PR",     selectedRow.pr   || "-"],
                        ["브랜드", selectedRow.brand || "-"],
                        ["모델",   selectedRow.model_line || "-"],
                        ["위치",   getAxleLabel(selectedRow.axle)],
                        ["적용차종", normalizeFitment(selectedRow.oe_fitment) || "-"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-gray-50 p-3">
                          <dt className="text-xs font-semibold text-gray-500">{label}</dt>
                          <dd className="mt-1 font-semibold text-navy-900 break-keep">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                {/* 우측: 수량 + 렌탈료 + 상담 폼 */}
                <div className="space-y-5">
                  {/* 수량 선택 + 렌탈료 계산 */}
                  <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4 md:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">수량 선택</p>
                        <p className="mt-1 text-xs text-gray-500">월 렌탈료 합계를 자동 계산합니다.</p>
                      </div>
                      <div className="flex items-center overflow-hidden rounded-2xl border border-orange-200 bg-white">
                        <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-11 w-11 text-xl font-semibold text-gray-600 hover:bg-gray-50" aria-label="수량 감소">−</button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantity}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            setQuantity(Math.max(1, Number(v) || 1));
                          }}
                          className="h-11 w-16 border-x border-orange-100 text-center font-semibold outline-none"
                          aria-label="렌탈 수량"
                        />
                        <button type="button" onClick={() => setQuantity((q) => q + 1)} className="h-11 w-11 text-xl font-semibold text-gray-600 hover:bg-gray-50" aria-label="수량 증가">+</button>
                      </div>
                    </div>

                    <dl className="mt-4 space-y-2 rounded-2xl bg-white p-4 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">월 렌탈료 (1개)</dt>
                        <dd className="font-semibold">{rental12 ? `${rental12.toLocaleString("ko-KR")}원` : "문의"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">수량</dt>
                        <dd className="font-semibold">{quantity}개</dd>
                      </div>
                      <div className="border-t border-gray-100 pt-3 flex justify-between gap-3 text-base">
                        <dt className="font-semibold text-navy-900">월 렌탈료 합계</dt>
                        <dd className="font-semibold text-orange-600">
                          {monthlyTotal ? `${monthlyTotal.toLocaleString("ko-KR")}원/월` : "문의"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-orange-700 leading-relaxed">
                      ✓ 배송비·장착비 포함 금액입니다. 별도 추가 비용 없습니다.
                    </p>
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <span className="text-xs text-gray-500 break-keep shrink-0">렌탈 전문 파트너</span>
                      <div className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-100 px-2 py-1">
                        <span className="text-xs font-semibold text-gray-700 break-keep">(주)비에스온</span>
                        <img
                          src="/logo/bson.jpg"
                          alt="비에스온(BSON) 로고"
                          className="h-5 w-auto object-contain"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-xs text-gray-500 break-keep">과 함께합니다.</span>
                    </div>
                  </div>

                  {/* 상담 정보 입력 */}
                  <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
                    <p className="text-sm font-semibold text-navy-900 mb-3">상담 정보 입력</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={modalForm.name}
                        onChange={(e) => setModalForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="성함"
                        className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400"
                        disabled={isSubmittingModal}
                        aria-label="성함"
                      />
                      <input
                        value={modalForm.phone}
                        onChange={(e) => setModalForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="연락처"
                        className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400"
                        disabled={isSubmittingModal}
                        aria-label="연락처"
                      />
                      <input
                        type="email"
                        value={modalForm.email}
                        onChange={(e) => setModalForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="이메일"
                        className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400"
                        disabled={isSubmittingModal}
                        aria-label="이메일"
                      />
                      <input
                        value={modalForm.vehicle}
                        onChange={(e) => setModalForm((p) => ({ ...p, vehicle: e.target.value }))}
                        placeholder="차종/톤수"
                        className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400"
                        disabled={isSubmittingModal}
                        aria-label="차종 및 톤수"
                      />
                      <textarea
                        value={modalForm.memo}
                        onChange={(e) => setModalForm((p) => ({ ...p, memo: e.target.value }))}
                        placeholder="장착 지역, 기타 문의사항"
                        rows={3}
                        className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-orange-400 sm:col-span-2"
                        disabled={isSubmittingModal}
                        aria-label="요청사항"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">연락처 또는 이메일 중 하나는 필수입니다.</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleModalSubmit}
                      disabled={isSubmittingModal}
                      className="flex h-12 items-center justify-center rounded-2xl bg-orange-500 px-5 text-center font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmittingModal ? "전송 중..." : "렌탈 상담 신청"}
                    </button>
                    <a
                      href="tel:1551-1873"
                      className="flex h-12 items-center justify-center rounded-2xl bg-gray-900 px-5 text-center font-semibold text-white shadow-sm hover:bg-gray-800"
                      aria-label="전화 상담 1551-1873"
                    >
                      <Phone size={15} className="mr-2" aria-hidden="true" />
                      전화 상담 1551-1873
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}