import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, Home, Download, Share2 } from "lucide-react";

import { ProjectConsultForm } from "../../components/ProjectConsultForm";

// ====================================================
// 에셋
// ====================================================
const IMG = "/battery/golfcart-lfp";
const BROCHURE_PDF = `${IMG}/spiderway-lfp-brochure.pdf`;

// ====================================================
// SEO / 구조화 데이터
// ====================================================
const JSON_LD_PRODUCT = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "SPIDERWAY 골프카트용 LFP 배터리 (51.2V 150Ah)",
  description:
    "골프카트 전용 LiFePO4(리튬인산철) 배터리. 51.2V 150Ah, 7.68kWh, 3,000회+ 사이클 수명, 5년(60개월) 무상보증. CE·FCC·UL·RoHS 인증 완료.",
  brand: { "@type": "Brand", name: "SPIDERWAY" },
  manufacturer: {
    "@type": "Organization",
    name: "Anhui Heding Electromechanical Equipment",
  },
  offers: {
    "@type": "Offer",
    priceCurrency: "KRW",
    price: 88000,
    priceValidUntil: "2026-12-31",
    availability: "https://schema.org/InStock",
    seller: { "@type": "Organization", name: "(주)알앤에프코리아" },
    description: "월 렌탈료 88,000원(VAT 별도), 보증금 0%, 최대 36개월, 만기 시 무상 양도",
  },
};

const JSON_LD_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: "https://www.rnfkorea.co.kr/" },
    { "@type": "ListItem", position: 2, name: "배터리 솔루션", item: "https://www.rnfkorea.co.kr/battery" },
    {
      "@type": "ListItem",
      position: 3,
      name: "골프카트용 LFP 배터리",
      item: "https://www.rnfkorea.co.kr/golfcart-battery",
    },
  ],
};

// ====================================================
// 공용 서브 컴포넌트
// ====================================================
const SectionEyebrow: React.FC<{ children: React.ReactNode; tone?: "light" | "dark" }> = ({
  children,
  tone = "light",
}) => (
  <p
    className={`text-[13px] font-semibold tracking-[0.16em] uppercase ${
      tone === "dark" ? "text-brand-lime" : "text-orange-600"
    }`}
  >
    {children}
  </p>
);

const StatCard: React.FC<{ value: string; label: string; dark?: boolean; compact?: boolean }> = ({
  value,
  label,
  dark,
  compact,
}) => (
  <div className="text-center px-4 py-6">
    <div
      className={`font-black tracking-tight break-keep ${dark ? "text-white" : "text-navy-900"} ${
        compact ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl"
      }`}
    >
      {value}
    </div>
    <div className={`mt-2 text-sm md:text-[15px] font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>
      {label}
    </div>
  </div>
);

const FeatureBlock: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  image: string;
  imageAlt: string;
  reverse?: boolean;
}> = ({ eyebrow, title, description, bullets, image, imageAlt, reverse }) => (
  <div
    className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
      reverse ? "lg:[&>*:first-child]:order-2" : ""
    }`}
  >
    <div className="rounded-3xl overflow-hidden bg-gray-100">
      <img src={image} alt={imageAlt} className="w-full h-full object-cover" loading="lazy" />
    </div>
    <div className="max-w-xl">
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h3 className="mt-3 text-3xl md:text-4xl font-black text-navy-900 tracking-tight break-keep">
        {title}
      </h3>
      <p className="mt-5 text-base md:text-lg text-gray-600 leading-relaxed break-keep">
        {description}
      </p>
      {bullets && (
        <ul className="mt-6 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-[15px] text-gray-700">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
              <span className="break-keep">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

const CertBadge: React.FC<{ src: string; label: string; desc: string }> = ({ src, label, desc }) => (
  <div className="flex flex-col items-center text-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-5 py-6 backdrop-blur-sm">
    <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center overflow-hidden">
      <img src={src} alt={label} className="h-9 w-9 object-contain" loading="lazy" />
    </div>
    <div className="text-sm font-bold text-white">{label}</div>
    <div className="text-xs text-gray-400 leading-relaxed break-keep">{desc}</div>
  </div>
);

const anchorNav = [
  { id: "specs", label: "스펙" },
  { id: "reliability", label: "신뢰성" },
  { id: "warranty", label: "보증" },
  { id: "rental", label: "렌탈" },
  { id: "case", label: "도입사례" },
  { id: "consult", label: "상담" },
];

// ====================================================
// 페이지
// ====================================================
const GolfCartLfpPage: React.FC = () => {
  const [shareCopied, setShareCopied] = React.useState(false);

  const handleShare = async () => {
    const shareData = {
      title: "골프카트용 LFP 배터리 SPIDERWAY | RNF KOREA",
      text: "51.2V 150Ah · 5년 무상보증 · 월 88,000원 렌탈. 골프카트 전용 SPIDERWAY LFP 배터리를 확인해보세요.",
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // 사용자가 공유 시트를 취소한 경우 — 별도 처리 없음
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareData.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // 클립보드 쓰기 권한이 차단된 환경(구형 브라우저, 권한 정책 등) — 수동 복사용 프롬프트로 대체
      window.prompt("아래 링크를 복사해 공유하세요", shareData.url);
    }
  };

  return (
    <div className="bg-white">
      <Helmet>
        <title>골프카트용 LFP 배터리 SPIDERWAY | 51.2V 150Ah | RNF KOREA</title>
        <meta
          name="description"
          content="골프카트 전용 SPIDERWAY LFP 배터리. 51.2V 150Ah, 5년 무상보증, 월 88,000원 렌탈. 타미우스CC 20대 1년 운영 검증. 상담 1551-1873."
        />
        <link rel="canonical" href="https://www.rnfkorea.co.kr/golfcart-battery" />
        <meta property="og:title" content="골프카트용 LFP 배터리 SPIDERWAY | RNF KOREA" />
        <meta
          property="og:description"
          content="51.2V 150Ah · 5년 무상보증 · 월 88,000원 렌탈. 타미우스CC 실증 완료."
        />
        <meta property="og:image" content="https://www.rnfkorea.co.kr/battery/golfcart-lfp/hero.webp" />
        <meta property="og:type" content="product" />
        <script type="application/ld+json">{JSON.stringify(JSON_LD_PRODUCT)}</script>
        <script type="application/ld+json">{JSON.stringify(JSON_LD_BREADCRUMB)}</script>
      </Helmet>

      {/* ── 서브 내비게이션 ───────────────────────────────── */}
      <nav className="sticky top-0 z-[100] bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-5 md:gap-7 whitespace-nowrap">
            {anchorNav.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-[13px] md:text-sm font-medium text-gray-600 hover:text-navy-900 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3 md:gap-4 whitespace-nowrap">
            <Link
              to="/home"
              className="group inline-flex items-center gap-1.5 rounded-full border border-brand-lime/70 bg-navy-900 px-3.5 py-1.5 text-[12px] md:text-sm font-bold text-brand-lime shadow-[0_0_10px_rgba(163,230,53,0.55),0_0_22px_rgba(163,230,53,0.3)] transition-all hover:shadow-[0_0_16px_rgba(163,230,53,0.85),0_0_34px_rgba(163,230,53,0.5)] hover:scale-[1.03] animate-pulse-glow"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">RNF KOREA 홈페이지 바로가기</span>
              <span className="sm:hidden">홈페이지</span>
            </Link>
            <a
              href="tel:1551-1873"
              className="hidden sm:inline-flex items-center gap-1.5 text-[13px] md:text-sm font-semibold text-orange-600 whitespace-nowrap"
            >
              <Phone className="h-3.5 w-3.5" /> 1551-1873
            </a>
          </div>
        </div>
      </nav>

      {/* ── 히어로 ───────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-end overflow-hidden bg-navy-900">
        <picture>
          <source media="(max-width: 768px)" srcSet={`${IMG}/hero-mobile.webp`} />
          <img
            src={`${IMG}/hero.webp`}
            alt="타미우스 CC 골프장에서 운영 중인 SPIDERWAY LFP 배터리 탑재 골프카트"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>
        {/* 텍스트가 걸치는 하단 영역만 살짝 어둡게 — 사진 대부분은 원본 그대로 밝고 선명하게 유지 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 from-0% via-black/0 via-45% to-transparent" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 md:pb-24 pt-40 w-full">
          <p className="text-[13px] md:text-sm font-bold tracking-[0.22em] uppercase text-brand-lime drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            SPIDERWAY LFP BATTERY SYSTEM
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.05] break-keep drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
            골프카트를 위한
            <br />
            최고의 LFP 배터리
          </h1>
          <p className="mt-6 text-lg md:text-2xl text-gray-100 font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            51.2V 150Ah · 정확한 스펙과 검증된 품질
          </p>
          <p className="mt-3 max-w-xl text-[15px] md:text-base text-gray-200 leading-relaxed break-keep drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            골프카트에 실제 장착된 라벨 그대로의 사양과 독보적인 성능을 제공합니다.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#consult"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all"
            >
              상담 신청하기
            </a>
            <a
              href="#specs"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-white/10 border border-white/30 text-white font-bold hover:bg-white/20 transition-all backdrop-blur-sm"
            >
              스펙 자세히 보기 ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── 스펙 스탯 그리드 ─────────────────────────────── */}
      <section id="specs" className="py-20 md:py-28 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <SectionEyebrow>Exact Specification</SectionEyebrow>
            <h2 className="mt-3 text-3xl md:text-5xl font-black text-navy-900 tracking-tight break-keep">
              정확한 배터리 스펙
            </h2>
            <p className="mt-4 text-base md:text-lg text-gray-500 break-keep">
              카탈로그 수치가 아닌, 실제 장착된 제품 라벨 그대로의 성능입니다.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 sm:grid-cols-3 gap-y-12 gap-x-4">
            <StatCard value="51.2V" label="정격 전압 (Voltage)" />
            <StatCard value="150Ah" label="정격 용량 (Current)" />
            <StatCard value="7.6kW" label="배터리 용량 (Capacity)" />
            <StatCard value="730 × 340 × 265" label="제품 치수 [mm]" compact />
            <StatCard value="3,000회+" label="사이클 수명" />
            <StatCard value="10년+" label="사용 가능 기간" />
          </div>
        </div>
      </section>

      {/* ── 기능 상세 1: 라벨/스펙 ───────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <FeatureBlock
            eyebrow="Verified on the label"
            title="라벨에 적힌 그대로, 속이지 않는 스펙"
            description="SPIDERWAY 51.2V 150Ah 배터리는 CE, FCC, UL, RoHS 국제 안전 인증을 모두 획득했으며, 제품 라벨에 표기된 정격 전압·용량·치수가 실측값과 정확히 일치합니다."
            bullets={[
              "정격 전압 51.2V / 정격 용량 150Ah / 배터리 용량 7.6kW",
              "제품 치수 730×340×265mm — 기존 배터리함 그대로 장착 가능",
              "CE · FCC · UL · RoHS 국제 인증 완료",
            ]}
            image={`${IMG}/spec-label.webp`}
            imageAlt="SPIDERWAY LFP 배터리 라벨 - 51.2V 150Ah, CE FCC UL RoHS 인증 표기"
          />
        </div>
      </section>

      {/* ── 기능 상세 2: 실시간 모니터링 ─────────────────── */}
      <section className="py-20 md:py-28 bg-navy-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <FeatureBlock
            reverse
            eyebrow="Real-time Monitoring"
            title="전압·전류를 실시간으로 확인하는 BMS"
            description="내장 BMS(배터리 관리 시스템)가 전압, 전류, 사용 시간, 잔여 충전량을 실시간으로 표시합니다. 골프카트 좌석 하단에 그대로 장착되어 기존 차량 구조 변경 없이 설치가 완료됩니다."
            bullets={[
              "실시간 전압(Voltage) · 전류(Current) 모니터링 화면 내장",
              "기존 배터리함 구조에 맞춘 규격으로 개조 없이 장착",
              "설치부터 A/S까지 RNF KOREA가 현장에서 직접 관리",
            ]}
            image={`${IMG}/installed-bms.webp`}
            imageAlt="골프카트 좌석 하단에 설치된 SPIDERWAY 배터리와 실시간 BMS 모니터링 화면"
          />
        </div>
      </section>

      {/* ── 제조사 신뢰성 ────────────────────────────────── */}
      <section id="reliability" className="relative py-20 md:py-28 overflow-hidden bg-navy-900">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <SectionEyebrow tone="dark">Trusted Manufacturer</SectionEyebrow>
            <h2 className="mt-3 text-3xl md:text-5xl font-black text-white tracking-tight break-keep">
              믿을 수 있는 제조사
            </h2>
            <p className="mt-5 text-base md:text-lg text-gray-300 leading-relaxed break-keep">
              중국 안후이성 허페이 소재의 최고 수준 리튬이온 배터리 전문 제조 파트너,<br></br>{" "}
              <span className="text-white font-semibold">Anhui Heding Electromechanical Equipment</span>
              에서 생산합니다.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-7">
              <p className="text-sm font-bold text-brand-lime uppercase tracking-wide">
                글로벌 선두 제조사들의 합작 투자 법인
              </p>
              <ul className="mt-4 space-y-2 text-[15px] text-gray-200">
                <li>세계 7위권 지게차 대기업 <b className="text-white">Anhui Heli</b> (지분 80%)</li>
                <li>중국 최초 리튬이온 배터리 제조사 <b className="text-white">Tianjin Lishen Battery</b> (지분 20%)</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-7">
              <p className="text-sm font-bold text-brand-lime uppercase tracking-wide">
                글로벌 장비 호환 및 인증 완료
              </p>
              <p className="mt-4 text-[15px] text-gray-200 leading-relaxed break-keep">
                Toyota, Doosan, Hyundai, HELI, Yale 등 글로벌 리딩 브랜드 장비와 최적의 호환성을 자랑하며
                CE, FCC, UL, RoHS 국제 안전 인증을 모두 획득했습니다.
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <CertBadge
              src={`${IMG}/certs/cert-ce.webp`}
              label="CE"
              desc="유럽연합(EU) 안전·건강·환경 요구사항 충족 인증"
            />
            <CertBadge
              src={`${IMG}/certs/cert-fcc.webp`}
              label="FCC"
              desc="미국 연방통신위원회 전자파 적합성 인증"
            />
            <CertBadge
              src={`${IMG}/certs/cert-ul.webp`}
              label="UL"
              desc="미국 화재·감전 등 제품 안전성 시험 인증"
            />
            <CertBadge
              src={`${IMG}/certs/cert-rohs.webp`}
              label="RoHS"
              desc="특정 유해물질 사용 제한지침 준수 인증"
            />
          </div>
        </div>
      </section>

      {/* ── 보증 및 서비스 ───────────────────────────────── */}
      <section id="warranty" className="py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <SectionEyebrow>Warranty &amp; Service</SectionEyebrow>
            <h2 className="mt-3 text-3xl md:text-5xl font-black text-navy-900 tracking-tight break-keep">
              압도적인 5년 무상 보증 프로그램
            </h2>
            <p className="mt-4 text-base md:text-lg text-gray-500 break-keep">
              모든 절차는 RNF KOREA가 현장 사전점검부터 A/S까지 직접 관리합니다.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { label: "무상 보증 기간", value: "5년 (60개월)", sub: "또는 10,000시간 중 먼저 도래하는 시점까지" },
              { label: "PL 보험 가입", value: "최대 2억원", sub: "KB손해보험 생산물 배상책임 보장" },
              { label: "주요 인증", value: "CE·FCC·UL·RoHS", sub: "국제 안전 인증 완료" },
              { label: "설치·A/S", value: "RNF 직접 관리", sub: "사전점검·컨설팅·배송·설치·A/S" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-200 p-7 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <p className="text-xs font-semibold tracking-wide uppercase text-gray-400">{item.label}</p>
                <p className="mt-3 text-2xl font-black text-navy-900">{item.value}</p>
                <p className="mt-2 text-sm text-gray-500 break-keep leading-relaxed">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-3xl overflow-hidden bg-gray-100">
            <img
              src={`${IMG}/installed-under-seat.webp`}
              alt="골프카트 좌석 하단 배터리함에 장착 완료된 SPIDERWAY LFP 배터리"
              className="w-full max-h-[420px] object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ── 렌탈 프로그램 ────────────────────────────────── */}
      <section id="rental" className="py-20 md:py-28 bg-navy-900">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <SectionEyebrow tone="dark">Lease &amp; Rental Program</SectionEyebrow>
            <h2 className="mt-3 text-3xl md:text-5xl font-black text-white tracking-tight break-keep">
              합리적인 리스·렌탈 프로그램
            </h2>
            <p className="mt-4 text-base md:text-lg text-gray-400 break-keep">
              초기 도입 비용 0원의 획기적인 전환. 자본적 지출을 매월 비용으로 바꿉니다.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-10 gap-x-2 rounded-3xl bg-white/5 border border-white/10 py-10">
            <StatCard value="0%" label="보증금" dark />
            <StatCard value="0원" label="잔존 가치" dark />
            <StatCard value="36개월" label="최대 계약 기간" dark />
            <StatCard value="88,000원" label="월 렌탈료 (VAT 별도)" dark compact />
            <StatCard value="무상 양도" label="만기 시 소유권 이전" dark compact />
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: "초기 비용 0원의 획기적인 전환",
                desc: "초기 비용 없이 배터리 교체가 가능합니다. 자본적 지출이 매월 비용으로 전환되어 사업 운영에 도움을 드립니다.",
              },
              {
                title: "납산 대비 성능 2배, 관리 공수 절반",
                desc: "기존 납산 배터리보다 최대 2~3배 이상의 긴 수명을 보장하며 증류수 보충 등 상시 정비 애로사항을 완벽 해소합니다.",
              },
              {
                title: "간편한 매달 비용 절세 처리",
                desc: "일정하고 예측 가능한 월 렌탈료 청구를 통해 간편한 비용 인정 및 자산 관리 리스크를 최소화합니다.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white/5 border border-white/10 p-7">
                <p className="text-lg font-bold text-white break-keep">{item.title}</p>
                <p className="mt-3 text-[15px] text-gray-400 leading-relaxed break-keep">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 도입사례 ─────────────────────────────────────── */}
      <section id="case" className="py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="rounded-3xl overflow-hidden bg-gray-100 order-2 lg:order-1">
              <img
                src={`${IMG}/lineup.webp`}
                alt="출고를 앞둔 SPIDERWAY LFP 배터리들이 나란히 정렬된 모습"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="order-1 lg:order-2 max-w-xl">
              <SectionEyebrow>Case Study</SectionEyebrow>
              <h2 className="mt-3 text-3xl md:text-5xl font-black text-navy-900 tracking-tight break-keep">
                타미우스 CC의
                <br />
                검증된 선택
              </h2>
              <p className="mt-5 text-base md:text-lg text-gray-600 leading-relaxed break-keep">
                혹독하고 까다로운 골프장 경사지 지형의 타미우스 컨트리클럽에서 Spiderway LFP 배터리를 20대,
                1년간 안정적으로 운영하여 기존 리튬이온·납산 배터리 대비 뛰어난 성능을 검증받았습니다.
              </p>

              <div className="mt-8 rounded-2xl border border-gray-200 p-6 space-y-2">
                <p className="text-sm text-gray-500">공급사</p>
                <p className="text-base font-bold text-navy-900">RNF Korea (주)알앤에프코리아</p>
                <div className="pt-3 mt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                  <a href="tel:1551-1873" className="inline-flex items-center gap-1.5 font-semibold text-orange-600">
                    <Phone className="h-3.5 w-3.5" /> 1551-1873
                  </a>
                  <a
                    href="https://www.rnfkorea.co.kr"
                    className="hover:text-navy-900 transition-colors"
                  >
                    www.rnfkorea.co.kr
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 최종 CTA / 상담 ──────────────────────────────── */}
      <section id="consult" className="py-20 md:py-28 bg-navy-50">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <SectionEyebrow>Get in touch</SectionEyebrow>
          <h2 className="mt-3 text-3xl md:text-5xl font-black text-navy-900 tracking-tight break-keep">
            골프카트 배터리 전환,
            <br />
            지금 상담하세요
          </h2>
          <p className="mt-4 text-base md:text-lg text-gray-500 break-keep">
            연락처만 남기셔도 됩니다. RNF KOREA 담당자가 빠르게 연락드립니다.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={BROCHURE_PDF}
              download="SPIDERWAY-LFP-골프카트배터리-브로셔.pdf"
              className="inline-flex items-center gap-2 rounded-full border border-navy-900/15 bg-white px-5 py-2.5 text-sm font-bold text-navy-900 hover:border-navy-900/30 hover:shadow-md transition-all"
            >
              <Download className="h-4 w-4" />
              브로셔 다운로드 (PDF)
            </a>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-full border border-navy-900/15 bg-white px-5 py-2.5 text-sm font-bold text-navy-900 hover:border-navy-900/30 hover:shadow-md transition-all"
            >
              <Share2 className="h-4 w-4" />
              {shareCopied ? "링크가 복사되었습니다" : "친구에게 공유하기"}
            </button>
          </div>
        </div>

        <div className="mt-12 max-w-[560px] mx-auto px-4 sm:px-6 lg:px-8">
          <ProjectConsultForm
            project="BATTERY"
            defaultFinanceType="RENTAL"
            defaultSegment="STANDARD"
            title="골프카트 LFP 배터리 상담"
            subtitle="연락처 또는 이메일만 입력하셔도 접수됩니다."
          />
        </div>
      </section>
    </div>
  );
};

export default GolfCartLfpPage;
