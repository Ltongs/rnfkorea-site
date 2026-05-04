import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { ProjectConsultForm } from "../../components/ProjectConsultForm";

// ====================================================
// SEO 설정
// ====================================================
const SEO_TITLE = "LFP 배터리 솔루션 | 지게차·고소작업대·골프카트 배터리 | RNF KOREA";
const SEO_DESC =
  "지게차, 고소작업대, 골프카트 전용 LFP·납산 배터리 공급 및 렌탈 프로그램. 초기비용 0원, 최대 36개월 분납, BSON 렌탈 구조. 배터리 전환 프로젝트 전문 상담 1551-1873.";
const SEO_CANONICAL = "https://www.rnfkorea.co.kr/battery";
const SEO_KEYWORDS =
  "LFP배터리,지게차배터리,고소작업대배터리,골프카트배터리,납산배터리,배터리렌탈,배터리교체,BSON렌탈,리텐에너지솔루션,SPIDERWAY,배터리전환";
const SEO_OG_IMAGE = "https://www.rnfkorea.co.kr/og-image.jpg";

/**
 * ✅ JSON-LD: Service 구조화 데이터
 * → 구글 리치결과, 네이버 스마트블록에 서비스 정보로 노출될 수 있음
 */
const JSON_LD_SERVICE = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "LFP 배터리 렌탈 솔루션",
  alternateName: "RNF Battery Rental Program",
  description:
    "지게차, 고소작업대, 골프카트 전용 LFP 및 납산 배터리 공급·렌탈 서비스. 초기비용 0원, 최대 36개월 분납 구조.",
  provider: {
    "@type": "Organization",
    name: "(주)알앤에프코리아",
    url: "https://www.rnfkorea.co.kr",
    telephone: "1551-1873",
  },
  areaServed: {
    "@type": "Country",
    name: "Korea",
  },
  serviceType: "산업용 배터리 렌탈 및 공급",
  offers: {
    "@type": "Offer",
    priceCurrency: "KRW",
    description: "선수금 0원, 최대 36개월 분납 렌탈 구조",
  },
};

/**
 * ✅ JSON-LD: BreadcrumbList
 * → 구글·네이버 검색결과에 "홈 > 배터리" 경로 표시
 */
const JSON_LD_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "홈",
      item: "https://www.rnfkorea.co.kr/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "배터리 솔루션",
      item: "https://www.rnfkorea.co.kr/battery",
    },
  ],
};

// ====================================================
// 타입 정의
// ====================================================
type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
};

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

// ====================================================
// 공통 컴포넌트
// ====================================================
function PageHero({ eyebrow, title, description, right }: PageHeroProps) {
  return (
    <section
      className="pt-6 pb-5 md:pt-8 md:pb-6"
      aria-label="페이지 헤더"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-6 items-start">
          <div className="lg:col-span-7">
            {/* ✅ Breadcrumb nav — 검색엔진 사이트링크 + 접근성 */}
            <nav aria-label="breadcrumb">
              <ol
                className="flex items-center text-sm text-gray-500"
                itemScope
                itemType="https://schema.org/BreadcrumbList"
              >
                <li
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                >
                  <Link
                    to="/"
                    className="hover:text-orange-500 transition-colors"
                    itemProp="item"
                  >
                    <span itemProp="name">Home</span>
                  </Link>
                  <meta itemProp="position" content="1" />
                </li>
                <li aria-hidden="true" className="mx-2">/</li>
                <li
                  className="text-gray-700 font-semibold"
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                  aria-current="page"
                >
                  <span itemProp="name">배터리</span>
                  <meta itemProp="position" content="2" />
                </li>
              </ol>
            </nav>

            {eyebrow && (
              <p className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                {eyebrow}
              </p>
            )}

            {/* ✅ h1: 페이지당 반드시 1개, 핵심 키워드 포함 */}
            <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-navy-900 break-keep">
              {title}
            </h1>

            {description && (
              <p className="mt-4 text-base md:text-lg leading-7 text-neutral-600 max-w-3xl break-keep">
                {description}
              </p>
            )}
          </div>

          {right && (
            <aside className="lg:col-span-5" aria-label="배터리 렌탈 프로그램 요약">
              {right}
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="max-w-3xl">
      {eyebrow && (
        <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
          {eyebrow}
        </p>
      )}
      {/* ✅ h2 사용: 페이지 내 섹션 계층 구조 명확화 */}
      <h2 className="mt-3 text-2xl md:text-3xl font-semibold leading-[1.2] text-navy-900 break-keep">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-base leading-7 text-neutral-600 break-keep">
          {description}
        </p>
      )}
    </div>
  );
}

// ====================================================
// 이미지 호버 프리뷰 그리드
// ====================================================
const HoverPreviewGrid: React.FC<{
  images: string[];
  alt?: string;
  thumbClassName?: string;
  centerRatio?: number;
  openDelayMs?: number;
  closeDelayMs?: number;
}> = ({
  images,
  alt = "설치사례",
  thumbClassName = "h-36 md:h-44",
  centerRatio = 0.28,
  openDelayMs = 250,
  closeDelayMs = 120,
}) => {
  const [hover, setHover] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string>("");

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const isInCenter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx0 = rect.width * (0.5 - centerRatio / 2);
    const cx1 = rect.width * (0.5 + centerRatio / 2);
    const cy0 = rect.height * (0.5 - centerRatio / 2);
    const cy1 = rect.height * (0.5 + centerRatio / 2);
    return x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1;
  };

  const handleMove = (e: React.MouseEvent, src: string) => {
    if (isInCenter(e)) {
      clearTimers();
      openTimer.current = setTimeout(() => {
        setActiveSrc(src);
        setHover(true);
      }, openDelayMs);
    } else {
      clearTimers();
      closeTimer.current = setTimeout(() => {
        setHover(false);
      }, closeDelayMs);
    }
  };

  const handleLeave = () => {
    clearTimers();
    setHover(false);
  };

  return (
    <>
      {/* ✅ role="list" + 각 항목 alt 텍스트 → 이미지 크롤링 가능 */}
      <ul className="grid md:grid-cols-3 gap-4 list-none p-0" role="list">
        {images.map((src, idx) => (
          <li
            key={src}
            onMouseMove={(e) => handleMove(e, src)}
            onMouseLeave={handleLeave}
            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white hover:shadow-md transition-all"
          >
            <div className={`${thumbClassName} w-full bg-gray-50 overflow-hidden`}>
              <img
                src={src}
                alt={`${alt} ${idx + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                width={600}
                height={400}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* 이미지 확대 오버레이 */}
      <div
        className={`fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
          hover ? "opacity-100" : "opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="이미지 확대 보기"
      >
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative bg-white p-3 rounded-2xl shadow-2xl">
          <img
            src={activeSrc}
            alt="확대 미리보기"
            className="block rounded-xl object-contain w-[70vw] max-w-[900px] max-h-[70vh]"
          />
        </div>
      </div>
    </>
  );
};

// ====================================================
// 데이터 상수
// ====================================================
const supplyCards = [
  {
    title: "배터리 공급",
    accent: "LFP / 납산",
    body: [
      "LFP : 리텐에너지솔루션 · SPIDERWAY",
      "납산 : (주)아이티앤티전기 · EXIED",
    ],
  },
  {
    title: "렌탈 구조",
    accent: "BSON 렌탈",
    body: ["최대 36개월 분납", "선수금 0원", "초기 도입 부담 완화"],
  },
  {
    title: "RNF 역할",
    accent: "프로젝트 설계",
    body: ["공급 구조 설계", "고객 연결 및 운영", "장비별 전환 프로젝트 제안"],
  },
];

const productCards = [
  {
    title: "지게차",
    subtitle: "Forklift Battery Solution",
    image: "/home/forklift.jpg",
    lines: [
      { label: "LFP (SPIDERWAY)", desc: "긴 수명 · 유지보수 최소화" },
      { label: "납산 (EXIED)", desc: "아이티앤티전기 · 빠른 납품과 부담 없는 렌탈 공급" },
    ],
  },
  {
    title: "고소작업대",
    subtitle: "AWP Battery Solution",
    image: "/home/awp.jpg",
    lines: [
      { label: "LFP (SPIDERWAY)", desc: "충전 효율 향상 · 장비 가동률 개선" },
      { label: "납산 (EXIED)", desc: "비용 효율 중심 · 대체 공급 가능" },
    ],
  },
  {
    title: "골프카트",
    subtitle: "Golf Cart Battery Solution",
    image: "/home/golfcart.jpg",
    lines: [
      { label: "LFP Only (SPIDERWAY)", desc: "경량화 · 긴 수명 · 관리 편의성" },
      { label: "적용", desc: "골프카트 / 저속 전동차량용 전환 제안" },
    ],
  },
];

const benefitCards = [
  {
    title: "초기비용 제거",
    body: "선수금 0원 구조로 부담을 덜어드립니다.",
  },
  {
    title: "신용부담 최소화",
    body: "고객 신용정보 변동 없이 렌탈상품 이용이 가능합니다.",
  },
  {
    title: "CAPEX → OPEX 전환",
    body: "구매비용을 운영비 구조로 전환해 현금흐름 부담을 완화합니다.",
  },
];

const processSteps = [
  { step: "01", title: "현장 진단", desc: "장비 사양, 사용 패턴 및 환경 검토" },
  { step: "02", title: "배터리 제안", desc: "LFP / 납산 중 최적 스펙 제안" },
  { step: "03", title: "렌탈 구조 설계", desc: "BSON 렌탈 적용 및 조건 설계" },
  { step: "04", title: "설치 및 운영", desc: "설치 · 검수 · 운영 · A/S 지원" },
];

const caseImages = [
  "/cases/golfcart/1.jpg",
  "/cases/golfcart/2.jpg",
  "/cases/golfcart/3.jpg",
  "/cases/golfcart/4.jpg",
  "/cases/golfcart/5.jpg",
  "/cases/golfcart/6.jpg",
];

const caseTags = [
  "설치장소 : 타미우스CC",
  "차종 : 골프카트",
  "배터리 : LFP 전환",
  "작업 : 설치 / 배선 / 세팅",
];

// ====================================================
// 메인 페이지 컴포넌트
// ====================================================
export default function BatteryPage() {
  return (
    <div className="bg-white text-navy-900">

      {/* ========================================================
          ✅ SEO HEAD
          - <title>, <meta description>, <canonical> 주입
          - OG 태그 (카카오·네이버·링크 미리보기)
          - JSON-LD 구조화 데이터 2종
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

        {/* JSON-LD: Service */}
        <script type="application/ld+json">
          {JSON.stringify(JSON_LD_SERVICE)}
        </script>

        {/* JSON-LD: Breadcrumb */}
        <script type="application/ld+json">
          {JSON.stringify(JSON_LD_BREADCRUMB)}
        </script>
      </Helmet>

      {/* ========================================================
          Hero Section
          ======================================================== */}
      <PageHero
        eyebrow="Battery Solution"
        title="모든 산업재의 배터리 전환 솔루션"
        description="지게차, 고소작업대, 골프카트까지. 장비 특성과 운영조건에 맞춰 LFP 및 납산 배터리 공급, 렌탈 구조, 전환 프로젝트를 함께 설계합니다."
        right={
          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-6 md:p-7 shadow-sm">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Link
                  to="/battery-shop"
                  className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600 transition-all hover:border-orange-300 hover:bg-orange-100"
                >
                  배터리 쇼핑몰 바로가기
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                Rental Program
              </p>

              <p className="text-xl md:text-2xl font-semibold leading-[1.2] text-navy-900 break-keep">
                RNF 배터리 렌탈 프로그램
              </p>

              <p className="text-sm md:text-base leading-7 text-gray-600 break-keep">
                초기비용을 없애고, 교체주기와 운용환경까지 고려한
                <br />
                배터리 교체 프로그램을 제안합니다.
              </p>

              <div className="rounded-2xl border border-gray-200 bg-white/90 px-5 py-4 md:px-6 md:py-4">
                <dl className="space-y-2.5 text-sm md:text-base">
                  <div className="flex items-start gap-3 leading-6">
                    <dt className="shrink-0 text-[11px] md:text-xs font-semibold tracking-[0.12em] uppercase text-orange-500 pt-0.5">
                      공급범위
                    </dt>
                    <dd className="font-semibold text-navy-900 break-keep">
                      LFP, 납산배터리
                    </dd>
                  </div>
                  <div className="flex items-start gap-3 leading-6">
                    <dt className="shrink-0 text-[11px] md:text-xs font-semibold tracking-[0.12em] uppercase text-orange-500 pt-0.5">
                      적용장비
                    </dt>
                    <dd className="font-semibold text-navy-900 break-keep">
                      지게차, 고소작업대, 골프카트
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-col sm:flex-row gap-3">
                  <a
                    href="tel:1551-1873"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all shadow-sm hover:shadow-md"
                  >
                    상담 문의 1551-1873
                    <span aria-hidden="true">→</span>
                  </a>
                  <Link
                    to="/finance"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-gray-200 bg-white text-navy-900 font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition-all"
                  >
                    금융솔루션 보기
                  </Link>
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* ========================================================
          렌탈 프로그램 섹션
          ======================================================== */}
      <section
        className="py-6 md:py-8 border-t border-gray-100"
        aria-labelledby="program-heading"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Program"
            title="RNF Battery Rental Program"
            description="공급사, 렌탈 구조, RNF의 역할을 한 눈에 이해되도록 정리했습니다."
          />

          <ul className="grid md:grid-cols-3 gap-6 list-none p-0" role="list">
            {supplyCards.map((card, idx) => (
              <li
                key={card.title}
                className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                <div
                  className={`px-6 py-5 border-b ${
                    idx === 1
                      ? "bg-orange-50 border-orange-100"
                      : "bg-gray-50 border-gray-100"
                  }`}
                >
                  <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-orange-500">
                    {card.accent}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-navy-900">{card.title}</h3>
                </div>
                <ul className="p-6 space-y-3 list-none">
                  {card.body.map((line) => (
                    <li
                      key={line}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ========================================================
          장비별 배터리 솔루션
          ======================================================== */}
      <section
        className="py-6 md:py-8 border-t border-gray-100 bg-gray-50/70"
        aria-labelledby="application-heading"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Application"
            title="장비별 배터리 솔루션"
            description="장비의 종류와 사용환경 등을 감안한 최적의 솔루션."
          />

          <ul className="grid md:grid-cols-3 gap-8 list-none p-0" role="list">
            {productCards.map((card) => (
              <li
                key={card.title}
                className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-all"
              >
                <div className="h-48 overflow-hidden bg-gray-100">
                  <img
                    src={card.image}
                    alt={`${card.title} 배터리 솔루션`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    width={600}
                    height={400}
                  />
                </div>
                <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-orange-500 uppercase">
                    {card.subtitle}
                  </p>
                  <h3 className="mt-2 font-semibold text-xl text-gray-900">{card.title}</h3>
                </div>
                <dl className="p-6 space-y-4">
                  {card.lines.map((line) => (
                    <div
                      key={line.label}
                      className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-4"
                    >
                      <dt className="text-sm font-semibold text-gray-900">{line.label}</dt>
                      <dd className="text-sm text-gray-600 mt-1 leading-relaxed">{line.desc}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ========================================================
          전환 프로젝트 프로세스
          ======================================================== */}
      <section
        className="py-6 md:py-8 border-t border-gray-100"
        aria-labelledby="process-heading"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Project"
            title="배터리 전환 프로젝트 프로세스"
            description="현장 확인부터 제안, 렌탈 구조 설계, 설치와 운영까지 하나의 프로젝트 흐름으로 진행합니다."
          />

          <ol className="grid md:grid-cols-4 gap-4 list-none p-0">
            {processSteps.map(({ step, title, desc }) => (
              <li
                key={step}
                className="rounded-2xl border border-gray-200 p-6 md:p-7 bg-white text-left shadow-sm hover:shadow-md transition-all"
              >
                <div className="inline-flex items-center justify-center rounded-full bg-orange-50 border border-orange-100 px-3 py-1.5 text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                  STEP {step}
                </div>
                <h3 className="font-semibold text-lg md:text-xl text-navy-900 mt-4 mb-3 break-keep">
                  {title}
                </h3>
                <p className="text-sm md:text-base text-gray-600 leading-7 break-keep">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ========================================================
          왜 렌탈인가
          ======================================================== */}
      <section
        className="py-6 md:py-8 border-t border-gray-100"
        aria-labelledby="why-rental-heading"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-6 md:p-7">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
              Why Rental
            </p>
            <h2
              id="why-rental-heading"
              className="mt-3 text-2xl md:text-3xl font-semibold leading-[1.2] text-navy-900 break-keep"
            >
              왜 렌탈인가
            </h2>
            <p className="mt-3 text-base leading-7 text-neutral-600 break-keep">
              핵심은 현금흐름 개선과 편리성입니다.
            </p>

            <ul className="mt-8 grid md:grid-cols-3 gap-6 list-none p-0" role="list">
              {benefitCards.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-orange-200 bg-white p-6 md:p-7 text-left shadow-sm hover:shadow-md transition-all"
                >
                  <div className="inline-block px-4 py-1.5 rounded-full bg-orange-500 text-white text-sm font-semibold">
                    {item.title}
                  </div>
                  <p className="mt-4 text-sm md:text-base text-gray-600 leading-7 break-keep">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ========================================================
          설치 사례 (Case Study)
          ======================================================== */}
      <section
        className="py-6 md:py-8 border-t border-gray-100 bg-gray-50 px-6"
        aria-labelledby="case-study-heading"
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="Case Study"
            title="골프카트 LFP 배터리 설치 사례"
            description="기존 납산 대비 수명 2~3배, 충전 효율 개선, 유지보수 비용 절감 효과를 기대할 수 있습니다."
          />

          {/* ✅ 사례 태그 — 검색엔진이 텍스트로 읽을 수 있도록 ul/li 처리 */}
          <ul
            className="mt-6 flex flex-wrap gap-2 mb-8 list-none p-0"
            aria-label="설치 사례 정보"
          >
            {caseTags.map((item) => (
              <li
                key={item}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold border border-gray-200 bg-white text-gray-700"
              >
                {item}
              </li>
            ))}
          </ul>

          <HoverPreviewGrid
            images={caseImages}
            alt="타미우스CC 골프카트 LFP 배터리 설치사례"
          />
        </div>
      </section>

      {/* ========================================================
          CTA / 상담 섹션
          ======================================================== */}
      <section
        className="py-16 px-6"
        aria-labelledby="cta-heading"
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="CTA"
            title="배터리 전환 프로젝트 상담"
            description="장비별 최적 배터리와 렌탈 구조를 함께 제안드립니다."
          />

          {/* ✅ 연락처 카드에 address 태그 + itemProp 마크업 */}
          <div className="mt-8 grid md:grid-cols-3 gap-4 mb-8 text-left">
            <address className="not-italic">
              <a
                href="tel:1551-1873"
                className="block rounded-2xl border border-orange-200 bg-orange-50 p-5 hover:shadow-sm transition-all"
                aria-label="전화 상담 1551-1873"
              >
                <p className="text-[11px] font-semibold tracking-[0.12em] text-orange-500 uppercase">Call</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">1551-1873</p>
                <p className="mt-1 text-sm text-gray-600">전화로 바로 상담 연결</p>
              </a>
            </address>

            <a
              href="https://www.retenensol.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-all"
              aria-label="LFP 공급사 리텐에너지솔루션 홈페이지 (새 탭)"
            >
              <p className="text-[11px] font-semibold tracking-[0.12em] text-gray-500 uppercase">LFP Supplier</p>
              <p className="mt-2 text-xl font-semibold text-gray-900">리텐에너지솔루션</p>
              <p className="mt-1 text-sm text-gray-600">LFP 공급 파트너 홈페이지 이동 ↩︎</p>
            </a>

            <a
              href="http://www.itntbattery.com"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-all"
              aria-label="납산 공급사 아이티엔티전기 홈페이지 (새 탭)"
            >
              <p className="text-[11px] font-semibold tracking-[0.12em] text-gray-500 uppercase">Lead Acid Supplier</p>
              <p className="mt-2 text-xl font-semibold text-gray-900">(주)아이티엔티전기</p>
              <p className="mt-1 text-sm text-gray-600">납산 공급 파트너 홈페이지 이동 ↩︎</p>
            </a>
          </div>

          <ProjectConsultForm
            project="BATTERY"
            defaultFinanceType="RENTAL"
            defaultSegment="STANDARD"
            title="배터리 전환 프로젝트 상담"
            subtitle="연락처 또는 이메일만 입력하셔도 접수됩니다."
          />
        </div>
      </section>
    </div>
  );
}
