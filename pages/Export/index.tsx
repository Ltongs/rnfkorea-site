import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Truck, Check } from "lucide-react";

// ====================================================
// SEO 설정
// ====================================================
const SEO_TITLE = "노후 지게차 수출 | 중고 디젤 지게차 해외 수출 전문 | RNF KOREA";
const SEO_DESC =
  "국내 노후 디젤 지게차를 매입·정비·등급화(A/B/C)해 신흥국에 안정적으로 수출합니다. 롯데렌탈·현대캐피탈 등 대형 렌탈사 직수출 파트너. 톤수·연식·수량 상담 1551-1873.";
const SEO_CANONICAL = "https://www.rnfkorea.co.kr/export";
const SEO_KEYWORDS =
  "노후지게차수출,중고지게차수출,디젤지게차수출,used forklift export,지게차해외수출,중고장비수출,지게차매입,노후장비수출,신흥국지게차,지게차수출한국";
const SEO_OG_IMAGE = "https://www.rnfkorea.co.kr/og-image.jpg";

/**
 * ✅ JSON-LD: Service — 수출 서비스 구조화 데이터
 * 구글 리치결과, 네이버 스마트블록에 서비스로 노출
 */
const JSON_LD_SERVICE = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "노후 디젤 지게차 해외 수출 서비스",
  alternateName: "Used Forklift Export",
  description:
    "국내 노후 디젤 지게차 매입 후 정비·등급화(A/B/C)하여 신흥국 산업 현장에 수출. 정비 완료 + 부품 패키지 포함 납품 구조.",
  provider: {
    "@type": "Organization",
    name: "(주)알앤에프코리아",
    url: "https://www.rnfkorea.co.kr",
    telephone: "1551-1873",
  },
  areaServed: [
    { "@type": "Country", name: "Korea" },
    { "@type": "Place", name: "신흥국 (동남아·중앙아시아·아프리카)" },
  ],
  serviceType: "중고 산업장비 해외 수출",
  offers: {
    "@type": "Offer",
    description: "연식 8~15년, 디젤, 2.5~7톤 지게차. A/B/C 등급 정비 패키지 포함 수출.",
  },
};

/**
 * ✅ JSON-LD: BreadcrumbList
 */
const JSON_LD_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈",            item: "https://www.rnfkorea.co.kr/" },
    { "@type": "ListItem", position: 2, name: "중고장비 수출", item: "https://www.rnfkorea.co.kr/export" },
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

            {/* ✅ Breadcrumb — 검색결과 경로 표시 */}
            <nav aria-label="breadcrumb">
              <ol
                className="flex items-center text-sm text-white/60"
                itemScope
                itemType="https://schema.org/BreadcrumbList"
              >
                <li
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                >
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
                  <span itemProp="name">중고장비 수출사업</span>
                  <meta itemProp="position" content="2" />
                </li>
              </ol>
            </nav>

            {eyebrow && (
              <p className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
                {eyebrow}
              </p>
            )}

            {/* ✅ h1: 핵심 키워드 포함 */}
            <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-white break-keep">
              {title}
            </h1>

            {description && (
              <p className="mt-4 text-base md:text-lg leading-7 text-white/75 max-w-3xl break-keep">
                {description}
              </p>
            )}
          </div>

          {right && (
            <aside className="lg:col-span-5" aria-label="수출 쇼핑몰 및 파트너 안내">
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
      {/* ✅ h2: 섹션 계층 명확화 */}
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
// 스타일 상수
// ====================================================
const card =
  "border border-gray-200 rounded-2xl bg-white p-6 " +
  "shadow-[0_10px_30px_rgba(15,23,42,0.06)]";

// ====================================================
// 메인 페이지 컴포넌트
// ====================================================
const ExportOverviewPage: React.FC = () => {
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
          PAGE HEADER
          ======================================================== */}
      <PageHero
        eyebrow="Export Business"
        title="중고장비 수출사업"
        description={'한국에서 중고 디젤 지게차를 매입하고, 정비·등급화(A/B/C)한 뒤 신흥국 산업 현장에 안정적으로 공급합니다. "정비 완료 + 부품 패키지"로 품질 불균형 시장을 정면 공략합니다.'}
        right={
          <div className="grid grid-cols-2 gap-4">
            {/* 수출 쇼핑몰 카드 */}
            <Link
              to="/export-shop"
              className="rounded-3xl bg-white/10 border border-white/20 backdrop-blur-sm p-4 md:p-5 hover:bg-white/20 transition-all aspect-square"
              aria-label="수출용 쇼핑몰(매물) 보기"
            >
              <div className="h-full flex flex-col">
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
                  Export Shop
                </p>
                <p className="mt-3 text-lg md:text-xl font-semibold leading-[1.2] text-white break-keep">
                  수출용 쇼핑몰 보기
                </p>
                <p className="mt-3 text-sm leading-6 text-white/70 break-keep">
                  정비·등급화된 매물을 바로 확인할 수 있습니다.
                </p>
                <div className="mt-auto pt-4">
                  <div className="inline-flex items-center justify-center px-4 py-2 rounded-2xl bg-orange-500 text-white font-semibold text-sm whitespace-nowrap">
                    쇼핑몰 바로가기 →
                  </div>
                </div>
              </div>
            </Link>

            {/* 파트너 카드 */}
            <div className="rounded-3xl bg-white/10 border border-white/20 backdrop-blur-sm p-4 md:p-5 aspect-square">
              <div className="h-full flex flex-col">
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
                  Partner Network
                </p>
                <p className="mt-3 text-lg md:text-xl font-semibold leading-6 text-white break-keep">
                  이 사업은 (주)크린어스와 함께합니다
                </p>
                <div className="mt-auto pt-4 space-y-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src="/logo/cleanearth.png"
                      alt="(주)크린어스 로고"
                      className="h-8 w-auto object-contain brightness-0 invert"
                      loading="lazy"
                    />
                  </div>
                  <a
                    href="http://www.cleanearth.kr/"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-400 transition-all w-full whitespace-nowrap"
                    title="(주)크린어스 홈페이지로 이동"
                    aria-label="파트너사 (주)크린어스 홈페이지 (새 탭)"
                  >
                    파트너사 홈페이지 →
                  </a>
                </div>
              </div>
            </div>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">

        {/* ========================================================
            시장 개요
            ======================================================== */}
        <section className="space-y-6" aria-labelledby="market-heading">
          <SectionHeader
            eyebrow="Market Overview"
            title="시장 개요"
            description="국내는 환경규제 강화로 노후 디젤 장비 교체가 가속화되고, 신흥국은 제조·물류 인프라 확대로 지게차 수요가 증가합니다."
          />

          <ul className="grid md:grid-cols-3 gap-6 list-none p-0" role="list">
            {/* STEP 1 */}
            <li className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
              <p className="text-xs font-semibold tracking-wider text-blue-600 mb-3">
                STEP 1 · 국내 공급
              </p>
              <h3 className="text-lg font-semibold text-navy-900 mb-3">
                연간 약 1만 대 폐차 대상 발생
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                국내에서 매년 약 1만 대 이상의 노후 지게차가 교체 또는 폐차 대상으로 분류됩니다.
                단순 폐기 시 자원 손실과 비용 부담이 발생합니다.
              </p>
            </li>

            {/* STEP 2 */}
            <li className="rounded-2xl border-2 border-orange-400 bg-orange-50 p-6 shadow-md hover:shadow-lg transition-all">
              <p className="text-xs font-semibold tracking-wider text-orange-600 mb-3">
                STEP 2 · RNF 재상품화
              </p>
              <h3 className="text-lg font-semibold text-navy-900 mb-3">
                정비 · 등급화 · 수출 표준화
              </h3>
              <p className="text-gray-700 leading-relaxed text-sm">
                전문 정비(PDI) 및 등급화를 통해 수출 가능한 상품으로 재탄생시킵니다.
                가격 경쟁력과 품질 신뢰를 동시에 확보합니다.
              </p>
            </li>

            {/* STEP 3 */}
            <li className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
              <p className="text-xs font-semibold tracking-wider text-green-600 mb-3">
                STEP 3 · 해외 수요
              </p>
              <h3 className="text-lg font-semibold text-navy-900 mb-3">
                신흥국 산업·물류 인프라 확대
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                제조 및 물류 인프라가 빠르게 성장하는 신흥국 시장에 재공급함으로써
                자원 재생·순환 경제에 기여하는 수출 모델을 구축합니다.
              </p>
              <p className="mt-5 flex items-center gap-2 text-green-600 text-sm font-semibold">
                <span aria-hidden="true">♻</span>
                자원 재생 · 순환 경제 기여
              </p>
            </li>
          </ul>
        </section>

        {/* ========================================================
            수출 대상 장비
            ======================================================== */}
        <section className="space-y-6" aria-labelledby="scope-heading">
          <SectionHeader
            eyebrow="Export Scope"
            title="수출 대상 장비"
            description="국내 사용/유통이 제한된 장비에 새로운 생명력을 부여합니다."
          />

          {/* ✅ dl/dt/dd — 스펙 정보를 검색엔진이 key-value로 인식 */}
          <dl className="grid md:grid-cols-4 gap-4">
            {[
              { label: "연식",   value: "8년~15년" },
              { label: "엔진",   value: "디젤" },
              { label: "톤수",   value: "2.5~7톤" },
              { label: "브랜드", value: "현대/두산 중심" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5">
                <dt className="text-xs font-semibold text-gray-500">{label}</dt>
                <dd className="mt-2 text-lg font-semibold text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-navy-900">등급 체계</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              A/B/C 등급으로 상태를 표준화하고, 정비 리포트/부품 패키지로 "품질 불균형" 문제를 줄입니다.
            </p>
          </div>
        </section>

        {/* ========================================================
            정비 / 부품 패키지
            ======================================================== */}
        <section className="space-y-6" aria-labelledby="package-heading">
          <SectionHeader
            eyebrow="Service Package"
            title="정비 패키지 & 부품 패키지"
            description={'"장비만"이 아니라, 운영 가능 상태로 납품하는 구조입니다.'}
          />

          <div className="grid md:grid-cols-2 gap-6">
            <div className={card}>
              <h3 className="text-lg font-semibold text-navy-900">정비 패키지(예시)</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-700 list-none p-0">
                <li>• Basic: 엔진/미션/누유 기본 점검</li>
                <li>• Standard: 유압·브레이크·마스트·전장 (+$700)</li>
                <li>• Premium: 도장·오버홀 (+$1,500)</li>
              </ul>
            </div>

            <div className={card}>
              <h3 className="text-lg font-semibold text-navy-900">부품 패키지(예시)</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-700 list-none p-0">
                <li>• 소모품 패키지 (+$1,000)</li>
                <li>• 타이어 패키지 (+$600)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ========================================================
            밸류체인 (운영 구조)
            ======================================================== */}
        <section className="space-y-6" aria-labelledby="valuechain-heading">
          <SectionHeader
            eyebrow="Value Chain"
            title="운영 구조(밸류체인)"
            description="매입 → 정비/상품화 → 수출/계약/물류를 하나의 파이프라인으로 묶어 리드타임과 품질 리스크를 줄입니다."
          />

          <div className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
            {/* Desktop 연결선 */}
            <div className="relative hidden md:block mb-6" aria-hidden="true">
              <div className="absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
                <div className="h-[2px] w-16 bg-gray-200" />
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <div className="h-[2px] w-16 bg-gray-200" />
              </div>
              <div className="absolute left-2/3 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
                <div className="h-[2px] w-16 bg-gray-200" />
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <div className="h-[2px] w-16 bg-gray-200" />
              </div>
            </div>

            {/* ✅ ol/li — 순서 있는 프로세스로 마크업 */}
            <ol className="grid md:grid-cols-3 gap-4 items-stretch list-none p-0">
              {/* STEP 1 */}
              <li className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm" aria-hidden="true">
                    <span className="text-xl">🧲</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">STEP 1</p>
                    <h3 className="text-lg font-semibold text-navy-900">매입</h3>
                  </div>
                </div>
                <p className="mt-5 text-base font-semibold text-navy-900">(주)크린어스</p>
                <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed list-none p-0">
                  <li>• 수출 가능 물량 선별</li>
                  <li>• 매입 및 인수 절차 관리</li>
                  <li>• 입고 스케줄 통합 관리</li>
                </ul>
                <p className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
                  국내 공급 파트너
                </p>
              </li>

              {/* STEP 2 */}
              <li className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm" aria-hidden="true">
                    <span className="text-xl">🛠️</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">STEP 2</p>
                    <h3 className="text-lg font-semibold text-navy-900">정비 / 상품화</h3>
                  </div>
                </div>
                <p className="mt-5 text-base font-semibold text-navy-900">
                  현대지게차경기북부판매 (형제중기)
                </p>
                <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed list-none p-0">
                  <li>• A/B/C 등급 구분</li>
                  <li>• PDI 및 리컨디션</li>
                  <li>• 품질 리포트 및 부품 패키지 구성</li>
                </ul>
                <p className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
                  정비 및 품질 관리 파트너
                </p>
              </li>

              {/* STEP 3 */}
              <li className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm" aria-hidden="true">
                    <span className="text-xl">🚢</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">STEP 3</p>
                    <h3 className="text-lg font-semibold text-navy-900">수출 / 계약 / 물류</h3>
                  </div>
                </div>
                <p className="mt-5 text-base font-semibold text-navy-900">RNF KOREA</p>
                <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed list-none p-0">
                  <li>• 해외 바이어 개발</li>
                  <li>• 계약 및 수출 서류 관리</li>
                  <li>• 선적 및 클레임 대응</li>
                </ul>
                <p className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
                  수출 총괄 운영
                </p>
              </li>
            </ol>

            {/* Mobile 연결선 */}
            <div className="md:hidden mt-6 flex flex-col items-center gap-4" aria-hidden="true">
              <div className="w-[2px] h-8 bg-gray-200" />
              <div className="flex gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <div className="h-2 w-2 rounded-full bg-gray-300" />
              </div>
              <div className="w-[2px] h-8 bg-gray-200" />
            </div>

            {/* ✅ KPI 스트립 — dl/dt/dd로 key-value 마크업 */}
            <dl className="mt-8 grid md:grid-cols-3 gap-4">
              {[
                { k: "리드타임", v: "입고 → 선적", d: "프로세스 표준화" },
                { k: "품질",     v: "A/B/C 등급 판정 및 상품화", d: "정비 리포트 제공" },
                { k: "신뢰",     v: "부품 패키지 포함", d: "운영 가능 상태 납품" },
              ].map(({ k, v, d }) => (
                <div key={k} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 h-full">
                  <dt className="text-xs font-semibold text-gray-500">{k}</dt>
                  <dd className="mt-1 text-sm font-semibold text-navy-900">{v}</dd>
                  <p className="mt-1 text-xs text-gray-600">{d}</p>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ========================================================
            3개년 로드맵
            ======================================================== */}
        <section className="space-y-6" aria-labelledby="roadmap-heading">
          <SectionHeader
            eyebrow="Roadmap"
            title="3개년 확장 로드맵"
          />

          <ol className="grid md:grid-cols-3 gap-6 list-none p-0">
            {[
              { year: "[1년차]", target: "150대/y", desc: "표준화/레퍼런스 확보, 핵심 거래선 구축" },
              { year: "[2년차]", target: "300대/y", desc: "현지 파트너십 확장, 운영 효율화" },
              { year: "[3년차]", target: "800대/y", desc: "수출국 확대/거점센터, 품목 확장" },
            ].map(({ year, target, desc }) => (
              <li key={year} className={card}>
                <p className="text-sm font-semibold text-gray-500">{year}</p>
                <p className="mt-2 text-2xl font-semibold text-navy-900">{target}</p>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ========================================================
            문의 안내 CTA
            ======================================================== */}
        <section className="border-t border-gray-200 pt-10" aria-labelledby="contact-heading">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" aria-hidden="true" />
              <div className="space-y-2">
                <h2 id="contact-heading" className="text-sm font-semibold text-navy-900">
                  문의 안내
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  수출 대상 장비(톤수/연식/수량)와 희망 선적 조건을 알려주시면,
                  정비 등급/부품 패키지 포함 견적과 리드타임을 함께 제안드립니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("catalog-form");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-all"
                  >
                    상담/견적 폼으로 이동 →
                  </button>
                  <a
                    href="tel:1551-1873"
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-navy-900 font-semibold hover:bg-gray-50 transition-all gap-2"
                    aria-label="전화 상담 1551-1873"
                  >
                    <Phone size={15} aria-hidden="true" />
                    1551-1873
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default ExportOverviewPage;