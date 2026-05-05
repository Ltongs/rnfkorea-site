import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

// ====================================================
// SEO 설정
// ====================================================
const SEO_TITLE = "개인(개별)화물협회 전용 금융상품 | 할부·리스 우대 조건 | RNF KOREA";
const SEO_DESC =
  "개인화물·개별화물협회 회원 전용 할부금융·리스 우대 상품. 롯데오토리스 협약, 초기 부담 완화, 월 비용 절감. 서울·광주·경북·경남 MOU 체결. 상담 1551-1873.";
const SEO_CANONICAL = "https://www.rnfkorea.co.kr/cargo-finance";
const SEO_KEYWORDS =
  "개인화물협회금융,개별화물협회금융,화물차할부,화물차리스,롯데오토리스,개인화물협회,개별화물협회,화물차금융,협회전용금융,MOU금융,화물차우대금리";
const SEO_OG_IMAGE = "https://www.rnfkorea.co.kr/og-image.jpg";

/**
 * ✅ JSON-LD: FinancialService — 협회 전용 금융상품
 */
const JSON_LD_SERVICE = {
  "@context": "https://schema.org",
  "@type": "FinancialService",
  name: "개인(개별)화물협회 전용 금융상품",
  description:
    "개인화물·개별화물협회 회원 전용 할부금융·리스 우대 상품. 롯데오토리스 MOU 협약 기반, 초기 부담 완화 및 월 비용 절감 구조.",
  provider: {
    "@type": "Organization",
    name: "(주)알앤에프코리아",
    url: "https://www.rnfkorea.co.kr",
    telephone: "1551-1873",
  },
  areaServed: { "@type": "Country", name: "Korea" },
  serviceType: "화물협회 회원 전용 할부금융·리스 중개",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "협회 전용 금융상품",
    itemListElement: [
      {
        "@type": "Offer",
        name: "할부금융 (협회 회원 전용)",
        description: "즉시 소유권, 감가상각·처분 자유. 롯데오토리스 연계.",
      },
      {
        "@type": "Offer",
        name: "리스(운용) (협회 회원 전용)",
        description: "초기비용 부담 완화, 월 비용 절감, 잔존가치 구조. 롯데오토리스 연계.",
      },
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
    { "@type": "ListItem", position: 1, name: "홈",                    item: "https://www.rnfkorea.co.kr/" },
    { "@type": "ListItem", position: 2, name: "개별협회 전용 금융상품", item: "https://www.rnfkorea.co.kr/cargo-finance" },
  ],
};

// ====================================================
// 타입 정의
// ====================================================
type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

type CompareRow = {
  title: string;
  installment: string[];
  lease: string[];
};

// ====================================================
// 스타일 상수
// ====================================================
const cardBase =
  "border border-gray-200 rounded-2xl bg-white p-6 " +
  "shadow-[0_10px_30px_rgba(15,23,42,0.06)] " +
  "hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:border-gray-300 transition-all";

const chip =
  "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold " +
  "bg-white text-navy-900 border border-gray-200";

// ====================================================
// 공통 컴포넌트
// ====================================================
function PageHero({ eyebrow, title, description }: PageHeroProps) {
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
                  <span itemProp="name">개인(개별)화물협회 전용 금융상품</span>
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

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2 text-sm text-gray-700 leading-relaxed">
    <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
    <div>{children}</div>
  </div>
);

// ====================================================
// 할부 vs 리스 비교 카드
// ====================================================
const CompareCard: React.FC<{ rows: CompareRow[] }> = ({ rows }) => (
  <div className={cardBase}>
    <SectionHeader
      eyebrow="Finance Comparison"
      title="할부 vs 리스 비교 (예시)"
      description="즉시 소유권이 필요한지, 월 비용과 초기부담을 우선할지에 따라 선택이 달라집니다. 실제 조건은 심사, 차종, 기간, 잔존가치에 따라 달라질 수 있습니다."
    />

    {/* ✅ ul/li — 비교 목록을 시맨틱하게 마크업 */}
    <ul className="mt-6 grid md:grid-cols-2 gap-4 list-none p-0" role="list">
      {rows.map((r) => (
        <li key={r.title} className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-navy-900">{r.title}</h3>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 할부금융 */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">할부금융</p>
              <ul className="mt-2 space-y-2 list-none p-0">
                {r.installment.map((x, i) => (
                  <li key={i} className="text-sm text-gray-700 leading-relaxed">• {x}</li>
                ))}
              </ul>
            </div>

            {/* 리스(운용) */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700">리스(운용)</p>
              <ul className="mt-2 space-y-2 list-none p-0">
                {r.lease.map((x, i) => (
                  <li key={i} className="text-sm text-gray-700 leading-relaxed">• {x}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
            * 예시 근거: 할부는 즉시 소유/감가상각·처분 자유, 리스는 초기비용 부담 완화,
            월 비용 절감, 잔존가치 구조 가능.
          </p>
        </li>
      ))}
    </ul>
  </div>
);

// ====================================================
// MOU 협약 섹션
// ====================================================
const MouSection: React.FC = () => (
  <section className="space-y-6" aria-labelledby="mou-heading">
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <SectionHeader
        eyebrow="MOU Network"
        title="MOU 협약 개인(개별)화물협회"
        description="지역 협회와의 협약을 기반으로 금융 지원을 제공합니다."
      />
      <div className="mt-1 shrink-0">
        <span className="inline-flex items-center px-4 py-2 rounded-full bg-orange-50 text-orange-600 text-sm font-semibold border border-orange-200">
          4개 시도 협약 완료
        </span>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full items-stretch">
      {/* 지도 */}
      <div className="md:col-span-4 relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 w-full h-full">
        <div className="relative w-full h-full flex flex-col">
          <p className="text-xs font-semibold text-gray-500 mb-3">협약 네트워크(지도)</p>

          <div className="relative w-full flex-1 min-h-[190px]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[85%] max-w-[380px] mx-auto">
                <svg
                  viewBox="0 0 240 170"
                  className="w-full h-auto"
                  role="img"
                  aria-label="MOU 협약 개인(개별)화물협회 지역 지도 — 서울, 경북, 광주, 경남"
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
                    { x: 158, y: 128, label: "경남", tx: 14, ty: 4 },
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
          {/* ✅ ul/li — 협약 지역 텍스트 크롤링 가능 */}
          <ul
            className="flex flex-wrap gap-2 w-full mb-4 list-none p-0"
            aria-label="MOU 협약 지역 목록"
          >
            {[
              { label: "서울", sub: "협회 MOU" },
              { label: "광주", sub: "협회 MOU" },
              { label: "경북", sub: "협회 MOU" },
              { label: "경남", sub: "협회 MOU" },
            ].map((x) => (
              <li
                key={x.label}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-gray-200 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" aria-hidden="true" />
                <span className="text-sm font-semibold text-navy-900">{x.label}</span>
                <span className="text-xs font-bold text-gray-500">{x.sub}</span>
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
                <b className="text-navy-900">RNF KOREA</b>는 상품 안내/조건 비교/서류 준비를 지원하여
                진행 속도와 승인 가능성을 높입니다.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-2 font-semibold text-navy-900">롯데오토리스</span>
                <span>는 최종 심사 및 계약을 수행합니다.</span>
                <span className="text-gray-500 font-bold text-xs">(금리·한도·기간은 금융사 기준으로 확정)</span>
              </span>
            </li>
          </ul>

          <p className="mt-3 text-[11px] text-gray-400">* 협약 지역은 지속 확대 예정입니다.</p>
        </div>
      </div>
    </div>
  </section>
);

// ====================================================
// 메인 페이지 컴포넌트
// ====================================================
const IndividualCargoFinancePage: React.FC = () => {
  const compareRows: CompareRow[] = [
    {
      title: "핵심 구조",
      installment: [
        "즉시 소유권 (구매 시점부터 법인/개인 소유)",
        "감가상각 및 처분(중고판매) 자유",
        "초기비용: 등록/취득세 등 발생 가능",
      ],
      lease: [
        "명의 사용 / 소유는 금융사 구조 가능",
        "초기비용 부담 완화",
        "정비·보험 패키지 옵션 가능",
      ],
    },
    {
      title: "비용 감각 (예시)",
      installment: [
        "월 193만원 수준 (예시)",
        "대출원금 9,994만원 / 60개월 / 연 6.0% (예시)",
      ],
      lease: [
        "월 159만원 수준 (예시)",
        "월 비용 약 20% 절감 효과 (예시)",
        "만기시 반납/인수 선택, 잔존가치 구조 가능",
      ],
    },
  ];

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
          Hero
          ======================================================== */}
      <PageHero
        eyebrow="Association Finance"
        title="개인(개별)화물협회 전용 금융상품"
        description="협회 회원 전용 조건으로, 초기 부담을 낮추고 운행 수익성 중심의 조달 구조(할부/리스)를 제안합니다."
      />

      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-6 md:py-8 space-y-4">

        {/* ========================================================
            파트너 박스 (롯데오토리스)
            ======================================================== */}
        <section
          className="border border-gray-200 rounded-2xl bg-white px-6 md:px-10 py-10 md:py-12 shadow-sm"
          aria-labelledby="partner-heading"
          itemScope
          itemType="https://schema.org/Organization"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 mb-4">
                <span className="text-xs md:text-sm font-semibold tracking-[0.16em] text-orange-500">
                  Official Finance Partner
                </span>
              </div>

              {/* ✅ h2 — 파트너사명 포함해 검색엔진 노출 */}
              <h2
                id="partner-heading"
                className="text-2xl md:text-3xl font-semibold text-navy-900"
                itemProp="name"
              >
                롯데오토리스 협회 전용 금융상품
              </h2>

              <p className="mt-5 text-base md:text-xl text-gray-600 font-medium leading-relaxed">
                본 상품은 롯데오토리스와 협회 간 협약을 기반으로 제공되는
                회원 전용 금융 구조입니다.
              </p>
            </div>

            <div className="shrink-0 flex items-center md:justify-end">
              <img
                src="/logo/lotte.jpg"
                alt="롯데오토리스 로고"
                className="h-14 md:h-20 w-auto object-contain"
                loading="lazy"
                itemProp="logo"
              />
            </div>
          </div>
        </section>

        {/* ========================================================
            회원 혜택 파트너십 카드
            ======================================================== */}
        <section className={cardBase} aria-labelledby="benefit-heading">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="min-w-0">
              <span className={chip}>회원 전용 파트너십</span>

              <h2
                id="benefit-heading"
                className="mt-3 text-2xl md:text-3xl font-semibold text-navy-900 leading-tight"
              >
                협회 회원님만을 위한 특별한 파트너십으로
                <br className="hidden md:block" />
                운영 부담은 낮추고, 수익 기회는 높이고, 복지는 더 풍성하게
              </h2>

              {/* ✅ ul/li — 혜택 목록 시맨틱 처리 */}
              <ul className="mt-4 space-y-2 list-none p-0" aria-label="협회 회원 혜택">
                <li><Bullet>오직 회원님께만 드리는 <b className="text-navy-900">전용 금융 솔루션</b></Bullet></li>
                <li><Bullet>수익을 연결하는 <b className="text-navy-900">비즈니스 네트워크</b></Bullet></li>
                <li><Bullet>함께 나누는 <b className="text-navy-900">상생 장학금</b></Bullet></li>
                <li><Bullet>협회와 함께하는 <b className="text-navy-900">밀착 복지 지원</b></Bullet></li>
              </ul>

              <ul className="mt-5 flex flex-wrap gap-2 list-none p-0" aria-label="혜택 카테고리">
                <li><span className={chip}>금융 혜택</span></li>
                <li><span className={chip}>일감/네트워크</span></li>
                <li><span className={chip}>복지/장학</span></li>
                <li><span className={chip}>회원 전용</span></li>
              </ul>
            </div>

            <aside className="shrink-0 w-full md:w-[360px]" aria-label="추가 혜택">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-700">추가 혜택 (회원 한정)</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-700 list-none p-0">
                  <li>• 차량 소모품(타이어/엔진오일) 특별가 제공</li>
                  <li>• 롯데오토리스 이용 회원: 협회비 1년 지원</li>
                </ul>
                <p className="mt-3 text-[11px] text-gray-400">
                  * 협회/금융사 운영 정책에 따라 세부 조건은 변경될 수 있습니다.
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* ========================================================
            진행 방식 (Process)
            ======================================================== */}
        <section className={cardBase} aria-labelledby="process-heading">
          <SectionHeader
            eyebrow="Process"
            title="진행 방식"
            description="협회 회원 확인 → 조건 비교(할부/리스) → 서류 준비 → 심사/계약까지, RNF가 진행을 빠르게 정리해드립니다."
          />

          {/* ✅ ol/li — 순서 있는 프로세스로 마크업 */}
          <ol className="mt-6 grid md:grid-cols-3 gap-4 list-none p-0">
            {[
              {
                step: "Step 1",
                title: "회원 확인",
                desc: "협회 회원 여부 및 기본 조건(차종/기간/희망 월 납입)을 먼저 정리합니다.",
              },
              {
                step: "Step 2",
                title: "할부 vs 리스 비교",
                desc: "초기비용, 월 비용, 소유권, 세무처리 관점에서 현실적인 옵션을 선택합니다.",
              },
              {
                step: "Step 3",
                title: "심사/계약",
                desc: "서류 접수 후 금융사 심사 → 계약 확정(금리/한도/기간/잔존가치 등) 순서로 진행됩니다.",
              },
            ].map(({ step, title, desc }) => (
              <li key={step} className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">{step}</p>
                <h3 className="mt-1 text-lg font-semibold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm md:text-base text-gray-600 leading-7 break-keep">{desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ========================================================
            할부 vs 리스 비교
            ======================================================== */}
        <CompareCard rows={compareRows} />

        {/* ========================================================
            CTA
            ======================================================== */}
        <section
          className="rounded-3xl border border-gray-200 bg-[#0a192f] p-8 md:p-10"
          aria-labelledby="cta-heading"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="min-w-0">
              <h2
                id="cta-heading"
                className="text-white text-2xl md:text-3xl font-semibold"
              >
                협회 전용 조건으로 견적/조건 비교 받기
              </h2>
              <p className="mt-2 text-gray-300 leading-relaxed">
                차량/기간/희망 월 납입 기준으로 할부/리스 조건을 빠르게 비교해드립니다.
              </p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3">
              <a
                href="tel:1551-1873"
                className="inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-all"
                aria-label="전화 상담 1551-1873"
              >
                전화 상담 1551-1873
              </a>
              <Link
                to="/finance"
                className="inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-white text-navy-900 font-semibold hover:bg-gray-100 transition-all"
              >
                금융솔루션 페이지 보기
              </Link>
            </div>
          </div>

          <p className="mt-6 text-[11px] text-gray-300/80 leading-relaxed">
            * 본 페이지는 안내 목적이며, 최종 심사 및 계약 조건은 금융사 내부 기준에 따라 확정됩니다.
          </p>
        </section>

        {/* ========================================================
            MOU 협약 섹션
            ======================================================== */}
        <MouSection />

      </div>
    </div>
  );
};

export default IndividualCargoFinancePage;