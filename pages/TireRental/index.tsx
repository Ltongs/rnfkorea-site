// pages/TireRental/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, CheckCircle, ChevronRight } from "lucide-react";

// ====================================================
// SEO 설정
// ====================================================
const SEO_TITLE = "화물차 타이어 렌탈 | 월 납입·초기비용 0원 | RNF KOREA";
const SEO_DESC =
  "카고·덤프·버스 화물차 타이어를 월 렌탈료로. 초기비용 없이 12개월 분납. 대한민국 최초 화물차 타이어 렌탈 서비스. 상담 1551-1873.";
const SEO_CANONICAL = "https://www.rnfkorea.co.kr/tire-rental";
const SEO_KEYWORDS =
  "화물차타이어렌탈,카고타이어렌탈,덤프타이어렌탈,타이어월납입,타이어분납,상용차타이어렌탈,화물타이어렌탈,12R22.5렌탈,385/65R22.5렌탈";
const SEO_OG_IMAGE = "https://www.rnfkorea.co.kr/og-image.jpg";

const JSON_LD_SERVICE = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "화물차 타이어 렌탈 서비스",
  description: "카고·덤프·버스용 상용차 타이어 12개월 렌탈. 초기비용 0원, 월 납입 구조.",
  provider: {
    "@type": "Organization",
    name: "(주)알앤에프코리아",
    url: "https://www.rnfkorea.co.kr",
    telephone: "1551-1873",
  },
  areaServed: { "@type": "Country", name: "Korea" },
  serviceType: "화물차 타이어 렌탈",
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
    { "@type": "ListItem", position: 2, name: "화물차 타이어 렌탈", item: "https://www.rnfkorea.co.kr/tire-rental" },
  ],
};

// ====================================================
// CSV 파싱
// ====================================================
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1HCMCm6t1vEYs8bdOInKSMCGuqK5yyWuewElAEefGTPM/pub?gid=306191113&single=true&output=csv";

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

type VehicleTab = "전체" | "카고·트레일러" | "덤프" | "버스";
const VEHICLE_TABS: VehicleTab[] = ["전체", "카고·트레일러", "덤프", "버스"];

function getVehicleTab(row: TireRentalRow): Exclude<VehicleTab, "전체"> {
  const vt = (row.vehicle_type || "").toUpperCase();
  if (vt === "DUMP") return "덤프";
  if (vt === "BUS")  return "버스";
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
// 렌탈 상품 카드
// ====================================================
const RentalCard: React.FC<{ row: TireRentalRow }> = ({ row }) => {
  const rental12 = toNumber(row.rental_12);
  const title = row.shop_title || `${row.brand} ${row.model_line} ${row.size}`;

  return (
    <article
      className="border border-gray-200 rounded-2xl bg-white overflow-hidden hover:shadow-md hover:-translate-y-[2px] transition-all duration-200"
      itemScope
      itemType="https://schema.org/Product"
    >
      <div className="h-40 bg-gray-50 flex items-center justify-center overflow-hidden">
        {row.main_thumb_url ? (
          <img
            src={row.main_thumb_url}
            alt={`${title} 타이어`}
            className="h-full w-full object-contain p-3"
            loading="lazy"
            itemProp="image"
          />
        ) : (
          <p className="text-sm text-gray-400 font-semibold">NO IMAGE</p>
        )}
      </div>

      <div className="p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-600 rounded-full">
            {getVehicleTab(row)}
          </span>
          <span className="px-3 py-1 text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-600 rounded-full">
            {getAxleLabel(row.axle)}
          </span>
        </div>

        <div>
          <h3 className="text-lg md:text-xl font-semibold text-navy-900" itemProp="name">
            {row.size}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {row.brand} · {row.model_line}
            {row.pr && ` · ${row.pr}`}
          </p>
        </div>

        {row.oe_fitment && (
          <p className="text-xs text-gray-500 leading-relaxed">
            적용: {normalizeFitment(row.oe_fitment)}
          </p>
        )}

        <div
          className="rounded-xl bg-orange-50 border border-orange-100 p-4 text-center"
          itemProp="offers"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <p className="text-xs font-semibold text-orange-600 mb-1">12개월 렌탈료 (1개 기준)</p>
          <p className="text-xl font-bold text-orange-600">
            {rental12 ? `월 ${rental12.toLocaleString("ko-KR")}원` : "문의"}
          </p>
          <meta itemProp="priceCurrency" content="KRW" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
        </div>

        <a
          href="tel:1551-1873"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all"
          aria-label={`${title} 렌탈 전화 상담`}
        >
          <Phone size={15} aria-hidden="true" />
          렌탈 상담하기
        </a>
      </div>
    </article>
  );
};

// ====================================================
// 메인 페이지
// ====================================================
export default function TireRentalPage() {
  const [rows, setRows] = useState<TireRentalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<VehicleTab>("전체");
  const [consultForm, setConsultForm] = useState({
    name: "", phone: "", vehicle: "", size: "", memo: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(CSV_URL)
      .then((r) => r.text())
      .then((text) => {
        if (!alive) return;
        const all = parseCSV(text);
        const rentalRows = all.filter(
          (r) => r.rental_12 && r.rental_12.trim() !== "" && toNumber(r.rental_12) > 0
        );
        setRows(rentalRows);
      })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === "전체") return rows;
    return rows.filter((r) => getVehicleTab(r) === activeTab);
  }, [rows, activeTab]);

  const handleSubmit = async () => {
    if (!consultForm.phone.trim()) { alert("연락처를 입력해주세요."); return; }
    setSubmitting(true);
    try {
      const memo = [
        "[화물차 타이어 렌탈 상담]",
        `성함: ${consultForm.name || "(미입력)"}`,
        `연락처: ${consultForm.phone}`,
        `차종/톤수: ${consultForm.vehicle || "(미입력)"}`,
        `희망 규격: ${consultForm.size || "(미입력)"}`,
        `문의내용: ${consultForm.memo || "(미입력)"}`,
      ].join("\n");
      const res = await fetch("/.netlify/functions/send-consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: "TIRE_RENTAL",
          name: consultForm.name,
          phone: consultForm.phone,
          email: "",
          memo,
        }),
      });
      if (!res.ok) throw new Error("전송 실패");
      alert("상담 신청이 접수되었습니다.\n담당자가 확인 후 연락드리겠습니다.");
      setConsultForm({ name: "", phone: "", vehicle: "", size: "", memo: "" });
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
                    <span itemProp="name">화물차 타이어 렌탈</span>
                    <meta itemProp="position" content="2" />
                  </li>
                </ol>
              </nav>

              <p className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
                Tire Rental
              </p>

              <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-white break-keep">
                화물차 타이어,<br />
                <span className="text-orange-400">이제 월 납입으로</span>
              </h1>

              <p className="mt-4 text-base md:text-lg leading-7 text-white/75 max-w-3xl break-keep">
                카고·덤프·버스 타이어를 목돈 없이 월 렌탈료로.
                초기비용 0원, 12개월 분납 구조로 현금흐름 부담을 없앱니다.
              </p>

              <ul className="mt-6 space-y-2 list-none p-0" aria-label="핵심 혜택">
                {[
                  "초기비용 0원 — 목돈 부담 없음",
                  "12개월 월 납입 구조",
                  "카고·덤프·버스 전 차종 적용",
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
                  aria-label="화물차 타이어 렌탈 전화 상담 1551-1873"
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
                  대한민국 최초<br />화물차 타이어 렌탈
                </p>
                <p className="mt-3 text-sm md:text-base leading-7 text-white/70 break-keep">
                  승용차에만 있던 타이어 렌탈을<br />
                  화물차로 확장한 RNF KOREA만의 상품입니다.
                </p>

                <dl className="mt-5 space-y-2.5">
                  {[
                    { label: "초기비용",  value: "0원" },
                    { label: "계약 기간", value: "12개월" },
                    { label: "적용 차종", value: "카고·덤프·버스" },
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
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ===== 왜 렌탈인가 ===== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="why-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Why Rental"
            title="왜 화물차 타이어도 렌탈로 해야 할까요?"
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

      {/* ===== 렌탈 상품 목록 ===== */}
      <section className="py-6 md:py-8 border-t border-gray-100 bg-gray-50/70" aria-labelledby="products-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Products"
            title="렌탈 가능 타이어 목록"
            description="아래 목록은 렌탈료가 책정된 상품입니다. 목록에 없는 규격도 상담을 통해 확인 가능합니다."
          />

          {/* 탭 필터 */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="차종별 타이어 필터">
            {VEHICLE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`h-10 px-5 rounded-full text-sm font-semibold border transition-all ${
                  activeTab === tab
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-gray-500" aria-live="polite">상품 정보를 불러오는 중입니다...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border border-gray-200 rounded-2xl bg-white">
              <p className="text-base font-semibold text-gray-700 mb-2">
                해당 차종 렌탈 상품은 상담으로 안내드립니다.
              </p>
              <a href="tel:1551-1873" className="text-orange-500 font-bold hover:underline">
                ☎ 1551-1873
              </a>
            </div>
          ) : (
            <>
              <p className="sr-only" aria-live="polite">{filtered.length}개 상품이 표시됩니다.</p>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 list-none p-0" role="list">
                {filtered.map((row, i) => (
                  <li key={`${row.model_line}-${row.size}-${i}`}>
                    <RentalCard row={row} />
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="rounded-2xl bg-orange-50 border border-orange-200 p-5 text-sm text-orange-800 leading-relaxed">
            ※ 렌탈료는 1개 기준 12개월 월 납입 금액입니다. 수량·규격·배송지에 따라 달라질 수 있으며,
            정확한 조건은 상담을 통해 확인해 드립니다.
          </div>
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
                  서울·광주·경북 개인(개별)화물협회 MOU 체결 기업입니다.
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
                  value={consultForm.name}
                  onChange={(e) => setConsultForm((p) => ({ ...p, name: e.target.value }))}
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
                  value={consultForm.phone}
                  onChange={(e) => setConsultForm((p) => ({ ...p, phone: e.target.value }))}
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
                  value={consultForm.vehicle}
                  onChange={(e) => setConsultForm((p) => ({ ...p, vehicle: e.target.value }))}
                  placeholder="예: 카고 25톤, 덤프 15톤"
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
                  value={consultForm.size}
                  onChange={(e) => setConsultForm((p) => ({ ...p, size: e.target.value }))}
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
                value={consultForm.memo}
                onChange={(e) => setConsultForm((p) => ({ ...p, memo: e.target.value }))}
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
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-base font-bold text-white shadow-lg"
          aria-label="화물차 타이어 렌탈 전화 상담 1551-1873"
        >
          <Phone size={18} aria-hidden="true" />
          타이어 렌탈 상담 1551-1873
        </a>
      </div>
    </div>
  );
}