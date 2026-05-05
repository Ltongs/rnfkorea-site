import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Battery, Check, Truck, Wallet } from "lucide-react";

// ====================================================
// SEO 설정
// ====================================================
const SEO_TITLE = "산업장비 금융솔루션 | 렌탈·할부·리스 | RNF KOREA";
const SEO_DESC =
  "지게차·고소작업대·상용차 등 산업장비 도입을 위한 렌탈·할부금융·리스 구조 설계. BSON 렌탈, 롯데오토리스, 오릭스캐피탈코리아 연계. 초기비용 0원 구조 상담 1551-1873.";
const SEO_CANONICAL = "https://www.rnfkorea.co.kr/finance";
const SEO_KEYWORDS =
  "산업장비금융,지게차렌탈,지게차할부,지게차리스,장비렌탈,건설기계렌탈,고소작업대렌탈,할부금융,BSON렌탈,롯데오토리스,오릭스캐피탈,장비금융솔루션";
const SEO_OG_IMAGE = "https://www.rnfkorea.co.kr/og-image.jpg";

/**
 * ✅ JSON-LD: FinancialService 구조화 데이터
 * 금융 서비스는 FinancialProduct/FinancialService 타입이 리치결과에 유리
 */
const JSON_LD_SERVICE = {
  "@context": "https://schema.org",
  "@type": "FinancialService",
  name: "산업장비 금융솔루션 (렌탈·할부·리스)",
  description:
    "지게차·고소작업대·상용차 등 산업장비 도입을 위한 렌탈·할부금융·리스 구조 설계 및 파트너 금융사 연계 서비스.",
  provider: {
    "@type": "Organization",
    name: "(주)알앤에프코리아",
    url: "https://www.rnfkorea.co.kr",
    telephone: "1551-1873",
  },
  areaServed: { "@type": "Country", name: "Korea" },
  serviceType: "산업장비 렌탈·할부금융·리스 중개 및 구조 설계",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "금융 상품 목록",
    itemListElement: [
      { "@type": "Offer", name: "렌탈 (건설기계·고소작업대)", description: "최대 60개월 장기 렌탈, BSON 연계" },
      { "@type": "Offer", name: "할부금융 (상용차·건설기계·항만장비)", description: "롯데오토리스·오릭스캐피탈코리아 연계" },
      { "@type": "Offer", name: "리스 (개인·개별협회 전용)", description: "롯데오토리스 협약, 개별화물협회 회원 우대" },
    ],
  },
};

/**
 * ✅ JSON-LD: BreadcrumbList
 */
const JSON_LD_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈",      item: "https://www.rnfkorea.co.kr/" },
    { "@type": "ListItem", position: 2, name: "금융솔루션", item: "https://www.rnfkorea.co.kr/finance" },
  ],
};

// ====================================================
// 타입 정의
// ====================================================
type LogoSpec = {
  src: string;
  alt: string;
  size?: string;
  opacity?: string;
  className?: string;
};

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

// ====================================================
// 공통 컴포넌트
// ====================================================
const SectionTitle: React.FC<SectionTitleProps> = ({ eyebrow, title, description }) => (
  <div className="max-w-3xl">
    {eyebrow && (
      <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
        {eyebrow}
      </p>
    )}
    {/* ✅ h2: 섹션 계층 명확화 */}
    <h2 className="mt-2 text-2xl md:text-3xl font-semibold leading-[1.2] text-navy-900 break-keep">
      {title}
    </h2>
    {description && (
      <p className="mt-3 text-base leading-7 text-gray-600 break-keep">
        {description}
      </p>
    )}
  </div>
);

const LogosRow: React.FC<{ logos: LogoSpec[]; gap?: string }> = ({ logos, gap = "gap-4" }) => {
  if (!logos?.length) return null;
  return (
    <div className={`flex items-center ${gap}`}>
      {logos.map((l) => (
        <img
          key={`${l.src}-${l.size ?? ""}-${l.className ?? ""}`}
          src={l.src}
          alt={l.alt}
          className={`${l.size ?? "h-6"} w-auto object-contain ${l.opacity ?? "opacity-80"} ${l.className ?? ""}`}
          loading="lazy"
        />
      ))}
    </div>
  );
};

const cardBase =
  "border border-gray-200 rounded-2xl p-6 md:p-7 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300";

const CardFooterNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-auto pt-4 border-t border-gray-100 text-sm text-gray-600 leading-7 break-keep">
    {children}
  </p>
);

const PartnerLineRight: React.FC<{
  label?: string;
  partnersText: string;
  logos?: LogoSpec[];
}> = ({ label = "Partner", partnersText, logos = [] }) => (
  <div className="mt-5 pt-4 border-t border-gray-100 text-sm">
    <div className="flex items-center gap-2">
      <span className="text-gray-500 font-semibold whitespace-nowrap">{label}:</span>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-navy-900 font-semibold break-keep">{partnersText}</span>
        <LogosRow logos={logos} gap="gap-3" />
      </div>
    </div>
  </div>
);

const PartnerLineBelow: React.FC<{
  label?: string;
  partnersText: string;
  logos?: LogoSpec[];
}> = ({ label = "Partners", partnersText, logos = [] }) => (
  <div className="mt-5 pt-4 border-t border-gray-100 text-sm">
    <div className="flex items-start gap-2">
      <span className="text-gray-500 font-semibold whitespace-nowrap">{label}:</span>
      <div className="flex flex-col">
        <span className="text-navy-900 font-semibold break-keep">{partnersText}</span>
        <div className="mt-2">
          <LogosRow logos={logos} gap="gap-5" />
        </div>
      </div>
    </div>
  </div>
);

// ====================================================
// 메인 페이지 컴포넌트
// ====================================================
export default function FinancePage() {
  const partnerAssets = {
    BSON:  { src: "/logo/bson.jpg",  alt: "BSON 렌탈" },
    ORIX:  { src: "/logo/orix.jpg",  alt: "오릭스캐피탈코리아" },
    LOTTE: { src: "/logo/lotte.jpg", alt: "롯데오토리스" },
  } as const;

  const partnerPills = [
    { label: "렌탈",    partnersText: "BSON" },
    { label: "할부금융", partnersText: "롯데오토리스 · 오릭스캐피탈코리아" },
    { label: "리스",    partnersText: "롯데오토리스" },
  ] as const;

  return (
    <div className="bg-white text-navy-900">

      {/* ========================================================
          ✅ SEO HEAD
          ======================================================== */}
      <Helmet>
        <title>{SEO_TITLE}</title>
        <meta name="description" content={SEO_DESC} />
        <meta name="keywords" content={SEO_KEYWORDS} />
        <link rel="canonical" href={SEO_CANONICAL} />
        <meta name="robots" content="index, follow" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="(주)알앤에프코리아" />
        <meta property="og:title" content={SEO_TITLE} />
        <meta property="og:description" content={SEO_DESC} />
        <meta property="og:url" content={SEO_CANONICAL} />
        <meta property="og:image" content={SEO_OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="ko_KR" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO_TITLE} />
        <meta name="twitter:description" content={SEO_DESC} />
        <meta name="twitter:image" content={SEO_OG_IMAGE} />

        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(JSON_LD_SERVICE)}</script>
        <script type="application/ld+json">{JSON.stringify(JSON_LD_BREADCRUMB)}</script>
      </Helmet>

      {/* ========================================================
          Hero / 페이지 헤더
          ======================================================== */}
      <section className="relative bg-[#0a192f] text-white overflow-hidden" aria-label="페이지 헤더">
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

              {/* ✅ Breadcrumb */}
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
                    <span itemProp="name">금융솔루션</span>
                    <meta itemProp="position" content="2" />
                  </li>
                </ol>
              </nav>

              <p className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
                Finance Solution
              </p>

              {/* ✅ h1: 핵심 키워드 포함 */}
              <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-white break-keep">
                장비 도입 조건에 맞는 금융 솔루션
              </h1>
              <p className="mt-4 text-base md:text-lg leading-7 text-white/75 max-w-3xl break-keep">
                장비 도입 비용을 줄이고 운영 효율을 높이기 위한 렌탈·리스·할부금융 구조를 설계합니다.
                현장 조건과 현금흐름에 맞춰 가장 현실적인 선택지를 제안드립니다.
              </p>

              {/* ✅ 협업 파트너 */}
              <div className="mt-8">
                <p className="text-sm font-semibold text-white/80">협업 파트너</p>
                <ul
                  className="mt-3 flex flex-wrap gap-2 list-none p-0"
                  aria-label="금융 협업 파트너 목록"
                >
                  {partnerPills.map((p) => (
                    <li
                      key={p.label}
                      className="inline-flex items-center px-4 py-3 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition-colors"
                      title={`${p.label} 파트너: ${p.partnersText}`}
                    >
                      <span className="inline-flex items-center gap-3">
                        <span className="text-white/60 font-medium text-sm whitespace-nowrap">{p.label}</span>
                        <span className="text-white font-semibold text-sm">{p.partnersText}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <aside className="lg:col-span-5" aria-label="금융 구조 요약">
              <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm p-6 md:p-7">
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
                  Finance Structure
                </p>
                <p className="mt-2 text-xl md:text-2xl font-semibold leading-[1.2] text-white break-keep">
                  비용 부담을 줄이는 금융 레버리지 제공
                </p>
                <p className="mt-3 text-sm md:text-base leading-7 text-white/70 break-keep">
                  구매, 렌탈, 할부, 리스 중 어떤 방식이 유리한지<br />
                  장비 특성과 자금 계획 기준으로 비교해드립니다.
                </p>

                {/* ✅ dl/dt/dd — 구조 스펙을 key-value로 마크업 */}
                <dl className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: "구조 설계",  value: "렌탈·할부·리스" },
                    { label: "적용 대상",  value: "상용차 · 건설기계 · 물류장비" },
                    { label: "협업 방식",  value: "파트너사 연계" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <dt className="text-xs font-medium tracking-[0.12em] uppercase text-white/50">{label}</dt>
                      <dd className="mt-2 text-sm md:text-base font-semibold leading-6 text-white break-keep">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ========================================================
          배터리 전환 금융 구조
          ======================================================== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="battery-finance-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <SectionTitle
            eyebrow="Battery Finance"
            title="배터리 전환 금융 구조"
            description="RNF KOREA는 배터리 도입을 위한 금융·렌탈 구조를 설계합니다. 초기 투자 부담을 줄이고, 운영 절감 효과 기반 상환 모델을 제공합니다."
          />

          <ul className="mt-10 grid md:grid-cols-3 gap-6 list-none p-0" role="list">
            {[
              {
                point: "Finance Point 01",
                title: "도입비 분산",
                desc: "구매비용을 렌탈·분할 구조로 전환하여 현금 흐름 부담을 완화합니다. (초기비용 0원)",
              },
              {
                point: "Finance Point 02",
                title: "운영비 절감 기반 상환",
                desc: "LFP 전환으로 절감되는 유지비를 상환 구조에 반영합니다.",
              },
              {
                point: "Finance Point 03",
                title: "프로젝트 연동",
                desc: "배터리 전환 프로젝트와 금융을 하나의 구조로 설계합니다.",
              },
            ].map(({ point, title, desc }) => (
              <li key={point} className={cardBase}>
                <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-orange-500">
                  {point}
                </p>
                <h3 className="mt-3 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                  {title}
                </h3>
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <p className="text-sm md:text-base leading-7 text-gray-600 break-keep">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ========================================================
          취급 상품 (렌탈 / 할부금융 / 리스)
          ======================================================== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="products-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <SectionTitle
            eyebrow="Products"
            title="취급상품"
            description="렌탈, 할부금융, 리스 등 목적에 맞는 조달 구조를 한 번에 정리해드립니다."
          />

          <ul className="mt-10 grid md:grid-cols-3 gap-6 items-stretch list-none p-0" role="list">
            {/* 렌탈 */}
            <li className={`${cardBase} flex flex-col h-full`}>
              <div
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 border border-orange-100"
                aria-hidden="true"
              >
                <Truck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                렌탈 (건설기계, 고소작업대 등)
              </h3>
              <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                필요한 기간만, 필요한 조건으로. 현장 운영에 맞춘 렌탈 구조를 제안합니다.
              </p>
              <ul className="mt-4 space-y-2 text-sm md:text-base leading-7 text-gray-700 list-none p-0">
                <li>• 장기 렌탈 (최대 60개월까지)</li>
                <li>• 매월 세금계산서 한 장으로 간편하게 이용</li>
                <li>• 법인/개인사업자 조건별 최적화</li>
                <li>• 모든 건설장비, 물류장비 제공 가능</li>
              </ul>
              <PartnerLineRight
                label="Partner"
                partnersText="BSON"
                logos={[{ ...partnerAssets.BSON, size: "h-11", opacity: "opacity-90" }]}
              />
              <CardFooterNote>추천 고객: 법인고객, 단기간 증차, 재무제표 관리 목적</CardFooterNote>
            </li>

            {/* 할부금융 */}
            <li className={`${cardBase} flex flex-col h-full`}>
              <div
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 border border-orange-100"
                aria-hidden="true"
              >
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                할부금융 (상용차, 건설기계, 항만장비)
              </h3>
              <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                초기 부담을 낮추고 현금흐름에 맞춰 분할 상환 구조를 설계합니다.
              </p>
              <ul className="mt-4 space-y-2 text-sm md:text-base leading-7 text-gray-700 list-none p-0">
                <li>• 취급 상품 : 할부금융, 리스(운용)</li>
                <li>• 장비 평가 및 잔가(Residual) 구조 반영 (리스)</li>
                <li>• 담보/보증 구조 및 리스크 조건 정리</li>
                <li>• 세무관련 상담 서비스 지원</li>
              </ul>
              <PartnerLineBelow
                label="Partners"
                partnersText="롯데오토리스 · 오릭스캐피탈코리아"
                logos={[
                  { ...partnerAssets.LOTTE, size: "h-[55px]", opacity: "opacity-90", className: "-ml-5" },
                  { ...partnerAssets.ORIX,  size: "h-6",      opacity: "opacity-90" },
                ]}
              />
              <CardFooterNote>
                추천 고객: 차량(장비) 구입 초기 비용 절감 목적 개인 및 법인
              </CardFooterNote>
            </li>

            {/* 리스 */}
            <li className={`${cardBase} flex flex-col h-full`}>
              <div
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 border border-orange-100"
                aria-hidden="true"
              >
                <Check className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                리스 (개인_개별협회 전용 상품)
              </h3>
              <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                (주)롯데오토리스와 협업으로 개인(개별)화물협회 전용 우대 조건을 제공합니다.
              </p>
              <ul className="mt-4 space-y-2 text-sm md:text-base leading-7 text-gray-700 list-none p-0">
                <li>• 협회 회원에 한하여 제공 가능</li>
                <li>• 금융상품 이용시 우대 조건 제공</li>
                <li>• 쿠팡 지역협의체 물량 우선 공유</li>
                <li>• 협회 회원 전용 프로세스/서류 간소화</li>
              </ul>
              <PartnerLineRight
                label="Partner"
                partnersText="롯데오토리스"
                logos={[{ ...partnerAssets.LOTTE, size: "h-12", opacity: "opacity-90" }]}
              />
              <CardFooterNote>추천 고객: 개별화물협회 회원 또는 신규(예정)사업자</CardFooterNote>
            </li>
          </ul>
        </div>
      </section>

      {/* ========================================================
          MOU 협약 개인(개별)화물협회
          ======================================================== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="association-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <SectionTitle
              eyebrow="Association Network"
              title="MOU 협약 개인(개별)화물협회"
              description="지역 협회와의 협약을 기반으로 금융 지원을 제공합니다."
            />
            <div className="mt-1 shrink-0">
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-orange-50 text-orange-600 text-sm font-semibold border border-orange-200">
                3개 시도 협약 완료
              </span>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-12 gap-4 w-full items-stretch">
            {/* 지도 */}
            <div className="md:col-span-4 relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 w-full h-full">
              <div className="relative w-full h-full flex flex-col">
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-gray-500 mb-3">
                  협약 네트워크(지도)
                </p>
                <div className="relative w-full flex-1 min-h-[190px]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[85%] max-w-[380px] mx-auto">
                      <svg
                        viewBox="0 0 240 170"
                        className="w-full h-auto"
                        role="img"
                        aria-label="MOU 협약 개인(개별)화물협회 지역 지도 — 서울, 경북, 광주"
                      >
                        <path
                          d="M126 10 C112 14,103 24,102 38 C101 50,92 62,88 78 C84 95,78 112,86 126 C96 145,115 156,134 160 C153 164,170 158,182 146 C192 135,198 120,192 104 C187 90,197 82,198 66 C199 50,189 38,178 30 C168 22,154 12,126 10 Z"
                          fill="rgba(15,23,42,0.06)"
                          stroke="rgba(15,23,42,0.26)"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M168 24 C180 38,186 56,182 74 C178 92,186 104,184 122 C182 138,172 150,160 156"
                          fill="none"
                          stroke="rgba(15,23,42,0.10)"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <ellipse
                          cx="108" cy="164" rx="12" ry="5.5"
                          fill="rgba(15,23,42,0.06)"
                          stroke="rgba(15,23,42,0.18)"
                          strokeWidth="1.4"
                        />
                        {[
                          { x: 132, y: 42,  label: "서울", tx: 14, ty: 4 },
                          { x: 165, y: 84,  label: "경북", tx: 14, ty: 4 },
                          { x: 118, y: 112, label: "광주", tx: 14, ty: 4 },
                        ].map((pin) => (
                          <g key={pin.label}>
                            <circle cx={pin.x} cy={pin.y} r="7" fill="rgb(239,68,68)" />
                            <circle cx={pin.x - 2.2} cy={pin.y - 2.5} r="2.2" fill="rgba(255,255,255,0.55)" />
                            <path
                              d={`M ${pin.x + 1.2} ${pin.y + 6} L ${pin.x - 1.2} ${pin.y + 6} L ${pin.x - 0.3} ${pin.y + 26} L ${pin.x + 0.3} ${pin.y + 26} Z`}
                              fill="rgba(148,163,184,0.95)"
                            />
                            <path
                              d={`M ${pin.x + 0.35} ${pin.y + 26} L ${pin.x} ${pin.y + 31} L ${pin.x - 0.35} ${pin.y + 26} Z`}
                              fill="rgba(100,116,139,0.95)"
                            />
                            <text x={pin.x + pin.tx} y={pin.y + pin.ty} fontSize="12" fontWeight="800" fill="rgb(15,23,42)">
                              {pin.label}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                  * 지도는 협약 네트워크 위치를 설명하기 위한 시각화입니다.
                </p>
              </div>
            </div>

            {/* 협약 구조 */}
            <div className="md:col-span-8 w-full h-full">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 w-full h-full">
                {/* ✅ ul/li — 협약 지역 목록을 텍스트로 크롤링 가능 */}
                <ul
                  className="flex flex-wrap gap-2 w-full mb-4 list-none p-0"
                  aria-label="MOU 협약 지역 목록"
                >
                  {[
                    { label: "서울", sub: "협회 MOU" },
                    { label: "광주", sub: "협회 MOU" },
                    { label: "경북", sub: "협회 MOU" },
                  ].map((x) => (
                    <li
                      key={x.label}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-gray-200 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                    >
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" aria-hidden="true" />
                      <span className="text-sm font-semibold text-navy-900">{x.label}</span>
                      <span className="text-xs font-medium text-gray-500">{x.sub}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="text-sm font-semibold text-navy-900">협약 구조 (운영 방식)</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-700 leading-relaxed list-none p-0">
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
                    <span>
                      <b className="text-navy-900">지역 협회</b>를 통해 대상 고객(개별/개인)을 확보하고,
                      신청–서류–심사 흐름을 표준화합니다.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
                    <span>
                      <b className="text-navy-900">RNF KOREA</b>는 상품 안내/조건 비교/서류 준비를 지원하여 진행 속도와 승인 가능성을 높입니다.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-2 font-semibold text-navy-900">롯데오토리스</span>
                      <span>는 최종 심사 및 계약을 수행합니다.</span>
                      <span className="text-gray-500 font-medium text-xs">(금리·한도·기간은 금융사 기준으로 확정)</span>
                    </span>
                  </li>
                </ul>
                <p className="mt-3 text-[11px] text-gray-400">
                  * 협약 지역은 지속 확대 예정입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          중개 고지 (Notice)
          ======================================================== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-labelledby="notice-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-7">
            <SectionTitle
              eyebrow="Notice"
              title="중개 고지"
              description="RNF Korea는 파트너 금융사/렌탈사 상품을 비교 안내하고, 고객 요청에 따라 서류 준비 및 진행 절차를 지원하는 중개·상담 역할을 수행합니다."
            />
            <p className="mt-4 text-sm md:text-base leading-7 text-gray-600 break-keep">
              최종 심사 및 계약 조건(금리, 한도, 기간, 잔가 등)은 각 금융사/렌탈사의 내부 기준에 따라 확정됩니다.
            </p>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed break-keep">
              ※ 본 페이지의 내용은 안내 목적이며, 실제 조건은 고객 신용도/담보/장비평가 결과 및 시장 상황에 따라 변동될 수 있습니다.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}