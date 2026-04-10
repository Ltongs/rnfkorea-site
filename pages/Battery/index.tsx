import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ProjectConsultForm } from "../../components/ProjectConsultForm";

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

function PageHero({ eyebrow, title, description, right }: PageHeroProps) {
  return (
    <section className="pt-6 pb-5 md:pt-8 md:pb-6">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-6 items-start">
          <div className="lg:col-span-7">
            <div className="text-sm text-gray-500">
              <Link to="/" className="hover:text-orange-500 transition-colors">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-700 font-semibold">배터리</span>
            </div>

            {eyebrow && (
              <div className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                {eyebrow}
              </div>
            )}

            <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-navy-900 break-keep">
              {title}
            </h1>

            {description && (
              <p className="mt-4 text-base md:text-lg leading-7 text-neutral-600 max-w-3xl break-keep">
                {description}
              </p>
            )}
          </div>

          {right && <div className="lg:col-span-5">{right}</div>}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="max-w-3xl">
      {eyebrow && (
        <div className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
          {eyebrow}
        </div>
      )}

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
      <div className="grid md:grid-cols-3 gap-4">
        {images.map((src) => (
          <div
            key={src}
            onMouseMove={(e) => handleMove(e, src)}
            onMouseLeave={handleLeave}
            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white hover:shadow-md transition-all"
          >
            <div className={`${thumbClassName} w-full bg-gray-50 overflow-hidden`}>
              <img
                src={src}
                alt={alt}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
          </div>
        ))}
      </div>

      <div
        className={`fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
          hover ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative bg-white p-3 rounded-2xl shadow-2xl">
          <img
            src={activeSrc}
            alt="preview"
            className="block rounded-xl object-contain w-[70vw] max-w-[900px] max-h-[70vh]"
          />
        </div>
      </div>
    </>
  );
};

const supplyCards = [
  {
    title: "배터리 공급",
    accent: "LFP / 납산",
    body: [
      "LFP : 리텐에너지솔루션",
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
      { label: "LFP", desc: "긴 수명 · 유지보수 최소화" },
      { label: "납산 (EXIED)", desc: "아이티앤티전기 · 빠른 납품과 부담 없는 렌탈 공급" },
    ],
  },
  {
    title: "고소작업대",
    subtitle: "AWP Battery Solution",
    image: "/home/awp.jpg",
    lines: [
      { label: "LFP", desc: "충전 효율 향상 · 장비 가동률 개선" },
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
    body: "선수금 0원 구조로 고민을 없애드립니다.",
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

export default function BatteryPage() {
  return (
    <div className="bg-white text-navy-900">
      <PageHero
        eyebrow="Battery Solution"
        title="모든 산업재의 배터리 전환 솔루션"
        description="지게차, 고소작업대, 골프카트까지. 장비 특성과 운영조건에 맞춰 LFP 및 납산 배터리 공급, 렌탈 구조, 전환 프로젝트를 함께 설계합니다."
        right={
          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-6 md:p-7 shadow-sm">
            <div className="space-y-4">
              <div className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                Rental Program
              </div>

              <div className="text-xl md:text-2xl font-semibold leading-[1.2] text-navy-900 break-keep">
                RNF 배터리 렌탈 프로그램
              </div>

              <p className="text-sm md:text-base leading-7 text-gray-600 break-keep">
                초기비용을 없애고, 교체주기와 운용환경까지 고려한<br/>배터리 교체 프로그램을 제안합니다.
              </p>

              <div className="rounded-2xl border border-gray-200 bg-white/90 px-5 py-4 md:px-6 md:py-4">
                <div className="space-y-2.5 text-sm md:text-base">
                  <div className="flex items-start gap-3 leading-6">
                    <div className="shrink-0 text-[11px] md:text-xs font-semibold tracking-[0.12em] uppercase text-orange-500 pt-0.5">
                      공급범위
                    </div>
                    <div className="font-semibold text-navy-900 break-keep">
                      LFP, 납산배터리
                    </div>
                  </div>

                  <div className="flex items-start gap-3 leading-6">
                    <div className="shrink-0 text-[11px] md:text-xs font-semibold tracking-[0.12em] uppercase text-orange-500 pt-0.5">
                      적용장비
                    </div>
                    <div className="font-semibold text-navy-900 break-keep">
                      지게차, 고소작업대, 골프카트
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col sm:flex-row gap-3">
                  <a
                    href="tel:1551-1873"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all shadow-sm hover:shadow-md"
                  >
                    상담 문의 1551-1873
                    <span>→</span>
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

      <section className="py-6 md:py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Program"
            title="RNF Battery Rental Program"
            description="공급사, 렌탈 구조, RNF의 역할을 한 눈에 이해되도록 정리했습니다."
          />

          <div className="grid md:grid-cols-3 gap-6">
            {supplyCards.map((card, idx) => (
              <div
                key={card.title}
                className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                <div className={`px-6 py-5 border-b ${idx === 1 ? "bg-orange-50 border-orange-100" : "bg-gray-50 border-gray-100"}`}>
                  <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-orange-500">
                    {card.accent}
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-navy-900">{card.title}</h3>
                </div>

                <div className="p-6 space-y-3">
                  {card.body.map((line) => (
                    <div
                      key={line}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>


        </div>
      </section>

      <section className="py-6 md:py-8 border-t border-gray-100 bg-gray-50/70">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Application"
            title="장비별 배터리 솔루션"
            description="장비의 종류와 사용환경 등을 감안한 최적의 솔루션."
          />

          <div className="grid md:grid-cols-3 gap-8">
            {productCards.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-all"
              >
                <div className="h-48 overflow-hidden bg-gray-100">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-orange-500 uppercase">
                    {card.subtitle}
                  </p>
                  <h3 className="mt-2 font-semibold text-xl text-gray-900">{card.title}</h3>
                </div>

                <div className="p-6 space-y-4">
                  {card.lines.map((line) => (
                    <div key={line.label} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-4">
                      <span className="text-sm font-semibold text-gray-900">{line.label}</span>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">{line.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-6 md:py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Project"
            title="배터리 전환 프로젝트 프로세스"
            description="현장 확인부터 제안, 렌탈 구조 설계, 설치와 운영까지 하나의 프로젝트 흐름으로 진행합니다."
          />

          <div className="grid md:grid-cols-4 gap-4">
            {[
              ["01", "현장 진단", "장비 사양, 사용 패턴 및 환경 검토"],
              ["02", "배터리 제안", "LFP / 납산 중 최적 스펙 제안"],
              ["03", "렌탈 구조 설계", "BSON 렌탈 적용 및 조건 설계"],
              ["04", "설치 및 운영", "설치 · 검수 · 운영 · A/S 지원"],
            ].map(([step, title, desc]) => (
              <div key={step} className="rounded-2xl border border-gray-200 p-6 md:p-7 bg-white text-left shadow-sm hover:shadow-md transition-all">
                <div className="inline-flex items-center justify-center rounded-full bg-orange-50 border border-orange-100 px-3 py-1.5 text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                  STEP {step}
                </div>
                <h3 className="font-semibold text-lg md:text-xl text-navy-900 mt-4 mb-3 break-keep">{title}</h3>
                <p className="text-sm md:text-base text-gray-600 leading-7 break-keep">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-6 md:py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-6 md:p-7">
            <div className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
              Why Rental
            </div>
            <h2 className="mt-3 text-2xl md:text-3xl font-semibold leading-[1.2] text-navy-900 break-keep">
              왜 렌탈인가
            </h2>
            <p className="mt-3 text-base leading-7 text-neutral-600 break-keep">
              핵심은 현금흐름 개선과 편리성 입니다. 
            </p>

            <div className="mt-8 grid md:grid-cols-3 gap-6">
              {benefitCards.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-orange-200 bg-white p-6 md:p-7 text-left shadow-sm hover:shadow-md transition-all"
              >
                <div className="inline-block px-4 py-1.5 rounded-full bg-orange-500 text-white text-sm font-semibold">
                  {item.title}
                </div>
                <p className="mt-4 text-sm md:text-base text-gray-600 leading-7 break-keep">
                  {item.body}
                </p>
              </div>
            ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 md:py-8 border-t border-gray-100 bg-gray-50 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="Case Study"
            title="골프카트 LFP 배터리 설치 사례"
            description="기존 납산 대비 수명 2~3배, 충전 효율 개선, 유지보수 비용 절감 효과를 기대할 수 있습니다."
          />

          <div className="mt-6 flex flex-wrap gap-2 mb-8">
            {[
              "설치장소 : 타미우스CC",
              "차종 : 골프카트",
              "배터리 : LFP 전환",
              "작업 : 설치 / 배선 / 세팅",
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold border border-gray-200 bg-white text-gray-700"
              >
                {item}
              </span>
            ))}
          </div>

          <HoverPreviewGrid
            images={[
              "/cases/golfcart/1.jpg",
              "/cases/golfcart/2.jpg",
              "/cases/golfcart/3.jpg",
              "/cases/golfcart/4.jpg",
              "/cases/golfcart/5.jpg",
              "/cases/golfcart/6.jpg",
            ]}
            alt="골프카트 배터리 설치사례"
          />
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="CTA"
            title="배터리 전환 프로젝트 상담"
            description="장비별 최적 배터리와 렌탈 구조를 함께 제안드립니다."
          />

          <div className="mt-8 grid md:grid-cols-3 gap-4 mb-8 text-left">
            <a
              href="tel:1551-1873"
              className="rounded-2xl border border-orange-200 bg-orange-50 p-5 hover:shadow-sm transition-all"
            >
              <div className="text-[11px] font-semibold tracking-[0.12em] text-orange-500 uppercase">Call</div>
              <div className="mt-2 text-xl font-semibold text-gray-900">1551-1873</div>
              <div className="mt-1 text-sm text-gray-600">전화로 바로 상담 연결</div>
            </a>

            <a
              href="https://www.retenensol.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-all"
            >
              <div className="text-[11px] font-semibold tracking-[0.12em] text-gray-500 uppercase">LFP Supplier</div>
              <div className="mt-2 text-xl font-semibold text-gray-900">리텐에너지솔루션</div>
              <div className="mt-1 text-sm text-gray-600">LFP 공급 파트너 홈페이지 이동 ↩︎</div>
            </a>

            <a
              href="https://www.exied.co.kr/"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-sm transition-all"
            >
              <div className="text-[11px] font-semibold tracking-[0.12em] text-gray-500 uppercase">Lead Acid Supplier</div>
              <div className="mt-2 text-xl font-semibold text-gray-900">EXIED</div>
              <div className="mt-1 text-sm text-gray-600">납산 공급 파트너 홈페이지 이동 ↩︎</div>
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
