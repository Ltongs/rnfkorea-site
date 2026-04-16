import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type ApplyModel = {
  label: string;
  dimension: string;
};

type RentalItem = {
  model: string;
  capacity: string;
  month12: number;
  month24: number;
  month36: number;
  applyModels?: ApplyModel[];
};

const forkliftItems: RentalItem[] = [
  {
    model: "VSF4",
    capacity: "48V / 290Ah",
    month12: 271300,
    month24: 149600,
    month36: 109000,
    applyModels: [
      { label: "도요타 7FBR15", dimension: "956*375*555" },
      { label: "니찌유 FBRMA15/18", dimension: "956*375*555" },
      { label: "고마츠 FB13M-12", dimension: "960*375*565" },
      { label: "스미토모 61-FBR15, 8FBR18", dimension: "956*375*555" },
      { label: "클라크 CRX15/18", dimension: "965*375*555" },
      { label: "현대 15BR", dimension: "994*378*581.7" },
    ],
  },
  {
    model: "VSD8AC",
    capacity: "48V / 435Ah",
    month12: 380700,
    month24: 209900,
    month36: 152900,
    applyModels: [
      { label: "도요타 7FB15/7FB18", dimension: "815*740*475" },
      { label: "도요타 7FBH15/7FBH18", dimension: "815*740*555" },
      { label: "니찌유 FB9PN-50", dimension: "660*470*450" },
      { label: "니찌유 FB15/18", dimension: "970*600*470" },
      { label: "고마츠 FB15EX-5~11형", dimension: "980*665*467" },
    ],
  },
  {
    model: "VSF5A",
    capacity: "48V / 350Ah",
    month12: 332500,
    month24: 183300,
    month36: 133600,
    applyModels: [
      { label: "도요타 7FBR20/7FBR25", dimension: "1150*403*570" },
      { label: "니찌유 FBR20/25", dimension: "1125*373*555" },
      { label: "고마츠 FB10-12형", dimension: "970*529*575" },
      { label: "클라크 CRX20/25", dimension: "1125*373*555" },
    ],
  },
  {
    model: "VGD565",
    capacity: "48V / 565Ah",
    month12: 534100,
    month24: 294400,
    month36: 214600,
    applyModels: [
      { label: "도요타 7FB20/7FB25", dimension: "905*815*475" },
      { label: "도요타 7FBH20/7FBH25", dimension: "815*905*545" },
      { label: "니찌유 FB25/28", dimension: "970*730*470" },
      { label: "코마츠 FB20(25)EX-5~11형", dimension: "980*840*465" },
      { label: "클라크 EPX16/18/20S", dimension: "973*733*470" },
    ],
  },
  {
    model: "VGD600",
    capacity: "48V / 600Ah",
    month12: 544800,
    month24: 300400,
    month36: 218900,
    applyModels: [
      { label: "도요타 7FB20/7FB25", dimension: "905*815*475" },
      { label: "도요타 7FBH20/7FBH25", dimension: "815*905*545" },
      { label: "니찌유 FB25/28", dimension: "970*730*470" },
      { label: "코마츠 FB20(25)EX-5~11형", dimension: "980*840*465" },
      { label: "클라크 EPX16/18/20S", dimension: "973*733*470" },
    ],
  },
  {
    model: "VCE650",
    capacity: "48V / 650Ah",
    month12: 601700,
    month24: 331700,
    month36: 241700,
    applyModels: [
      { label: "두산 B20S-3", dimension: "1025*887*525" },
      { label: "클라크 EPX20/25", dimension: "980*785*525" },
      { label: "현대 22B-7", dimension: "1066*796*537" },
      { label: "현대 22B/25B-9", dimension: "1030*796*533" },
    ],
  },
  {
    model: "VCE715",
    capacity: "48V / 715Ah",
    month12: 624200,
    month24: 344100,
    month36: 250700,
    applyModels: [
      { label: "두산 B25S-3", dimension: "1025*887*525" },
      { label: "두산 B20S-5", dimension: "1025*887*525" },
      { label: "두산 B25S-5", dimension: "1025*887*525" },
      { label: "클라크 EPX20/25", dimension: "980*785*525" },
      { label: "현대 25B-7", dimension: "1066*796*537" },
      { label: "현대 25B-9", dimension: "1030*796*533" },
      { label: "현대 30B/35B-9", dimension: "1030*990*533" },
    ],
  },
];

const formatKRW = (value: number) => `${value.toLocaleString("ko-KR")}원`;

function formatDimension(value: string): string {
  const [l = "-", w = "-", h = "-"] = value.split("*").map((v) => v.trim());
  return `(L)${l}*(W)${w}*(H)${h}`;
}

function CategoryHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="inline-flex items-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600 md:text-sm">
          {eyebrow}
        </span>
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-gray-900 md:text-3xl">{title}</h2>
      <p className="mt-4 break-keep text-base leading-7 text-gray-600">{desc}</p>
    </div>
  );
}


const forkliftHeroImage = "/home/ITNT_FL.png";
const awpHeroImage = "/home/ITNT_AWP.png";

function CategoryHero({
  eyebrow,
  title,
  desc,
  imageSrc,
  imageAlt,
  imageContent,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  imageSrc?: string;
  imageAlt?: string;
  imageContent?: ReactNode;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_560px] lg:gap-10">
      <CategoryHeader eyebrow={eyebrow} title={title} desc={desc} />

      {imageContent ? (
        <div className="mx-auto w-full max-w-[560px] lg:mx-0 lg:ml-auto">
          {imageContent}
        </div>
      ) : imageSrc ? (
        <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm lg:mx-0 lg:ml-auto">
          <img
            src={imageSrc}
            alt={imageAlt ?? title}
            className="h-[220px] w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : null}
    </div>
  );
}

function ApplyModelsTooltip({ items }: { items: ApplyModel[] }) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleOpen = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const handleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 520);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  return (
    <div
      className="relative z-30 inline-block"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
    >
      <button
        type="button"
        className={`inline-flex items-center rounded-full border px-5 py-2 text-sm font-semibold transition ${
          open
            ? "border-orange-300 bg-orange-50 text-orange-600"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
        }`}
      >
        주요 적용 차종
      </button>

      <div
        className={`absolute left-0 top-full z-40 mt-2 w-[420px] max-w-[calc(100vw-3rem)] rounded-[28px] border border-gray-200 bg-white p-5 shadow-2xl transition-all duration-150 ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible translate-y-1 opacity-0"
        }`}
      >
        <div className="text-lg font-semibold text-gray-900">주요 적용 차종</div>
        <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {items.map((entry) => (
            <div
              key={`${entry.label}-${entry.dimension}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-transparent bg-gray-50 px-4 py-3 transition hover:border-orange-200 hover:bg-orange-50"
            >
              <span className="min-w-0 flex-1 break-keep text-sm font-medium text-gray-800">
                {entry.label}
              </span>
              <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-gray-600">
                {formatDimension(entry.dimension)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RentalCard({ item }: { item: RentalItem }) {
  return (
    <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-[2px] hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-gray-900">{item.model}</div>
          <div className="mt-2 text-sm font-medium text-orange-600">{item.capacity}</div>
        </div>

        <div className="rounded-2xl bg-orange-50 px-3 py-2 text-right">
          <div className="text-xs font-medium text-gray-500">월 렌탈료</div>
          <div className="whitespace-nowrap text-lg font-semibold text-orange-600">
            {formatKRW(item.month36)}~
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div>{!!item.applyModels?.length && <ApplyModelsTooltip items={item.applyModels} />}</div>
      </div>

      <div className="mt-2">
        <div className="mb-2 grid grid-cols-3 gap-3 text-center">
          <div />
          <div />
          <div className="text-right text-xs font-semibold text-red-500">
            (VAT포함)
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white px-3 py-3">
            <div className="text-xs font-medium text-gray-500">12개월</div>
            <div className="mt-1 whitespace-nowrap text-sm font-semibold text-gray-900 md:text-base">
              {formatKRW(item.month12)}
            </div>
          </div>

          <div className="rounded-2xl bg-white px-3 py-3">
            <div className="text-xs font-medium text-gray-500">24개월</div>
            <div className="mt-1 whitespace-nowrap text-sm font-semibold text-gray-900 md:text-base">
              {formatKRW(item.month24)}
            </div>
          </div>

          <div className="rounded-2xl bg-white px-3 py-3">
            <div className="text-xs font-medium text-gray-500">36개월</div>
            <div className="mt-1 whitespace-nowrap text-sm font-semibold text-gray-900 md:text-base">
              {formatKRW(item.month36)}
            </div>
          </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuoteOnlyCard({
  title,
  desc,
  note,
}: {
  title: string;
  desc: string;
  note: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
      <h3 className="text-2xl font-semibold text-gray-900">{title}</h3>
      <p className="mt-4 break-keep text-base leading-7 text-gray-600">{desc}</p>

      <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-5">
        <div className="text-sm font-semibold text-orange-700">맞춤 견적 안내</div>
        <p className="mt-2 break-keep text-sm leading-6 text-gray-700">{note}</p>
      </div>
    </div>
  );
}

function TopCategoryNav({ activeId }: { activeId: string }) {
  const links = [
    { id: "forklift", label: "지게차용 배터리" },
    { id: "awp", label: "고소작업대용 배터리" },
    { id: "golfcart", label: "골프카트용 배터리" },
  ];

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {links.map((link) => {
        const active = activeId === link.id;
        return (
          <a
            key={link.id}
            href={`#${link.id}`}
            className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition md:px-6 md:text-base ${
              active
                ? "border border-orange-500 bg-orange-500 text-white"
                : "border border-gray-300 bg-white text-gray-800 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
            }`}
          >
            {link.label}
          </a>
        );
      })}

      <a
        href="#consultation"
        className="inline-flex items-center justify-center rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:border-gray-400 hover:bg-gray-50 md:px-6 md:text-base"
      >
        상담 문의
      </a>
    </div>
  );
}

export default function BatteryShopPage() {
  const sectionIds = useMemo(() => ["forklift", "awp", "golfcart"], []);
  const [activeSection, setActiveSection] = useState("forklift");

  useEffect(() => {
    const handleScroll = () => {
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= 180) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sectionIds]);

  return (
    <main className="bg-white text-gray-900">
      <section className="border-b border-gray-200 bg-gradient-to-b from-orange-50 via-white to-white">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20">
          <div className="max-w-4xl">
            <div className="inline-flex items-center rounded-2xl border border-orange-200 bg-white px-4 py-2 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 md:text-sm">
                Battery Solution Shop
              </span>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-900 md:text-5xl">
              배터리 쇼핑몰
            </h1>

            <p className="mt-5 break-keep text-base leading-7 text-gray-600 md:text-xl md:leading-9">
              지게차, 고소작업대, 골프카트에 적용 가능한 산업용 배터리를 확인하실 수 있습니다.
              <br />
              지게차 모델별 기본 렌탈료를 바로 확인하시고, 기타 장비는 맞춤 견적을 받아보세요.
            </p>

            <TopCategoryNav activeId={activeSection} />
          </div>
        </div>
      </section>

      <section id="forklift" className="scroll-mt-28 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
          <CategoryHero
            eyebrow="Forklift Battery"
            title="지게차용 배터리 (납산) by ITNT"
            desc="전동지게차용 배터리 기본 렌탈료입니다. 아래에서 모델별 월 렌탈료를 바로 확인하실 수 있습니다."
            imageContent={
              <div className="flex gap-4 justify-end">
                <figure className="w-[260px] rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm">
                  <img
                    src="/home/ITNT_HQ.jpg"
                    alt="ITNT 본사 전경"
                    className="h-[220px] w-full object-cover rounded-xl"
                    loading="lazy"
                  />
                  <figcaption className="mt-3 text-center text-xs text-gray-500">
                    (ITNT 본사전경)
                  </figcaption>
                </figure>
                <figure className="w-[260px] rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm">
                  <img
                    src={forkliftHeroImage}
                    alt="지게차용 납산 배터리"
                    className="h-[220px] w-full object-contain"
                    loading="lazy"
                  />
                  <figcaption className="mt-3 text-center text-xs text-gray-500">
                    (EXMILE 제품이미지)
                  </figcaption>
                </figure>
              </div>
            }
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {forkliftItems.map((item) => (
              <RentalCard key={item.model} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section id="awp" className="scroll-mt-28 border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
          <CategoryHero
            eyebrow="Aerial Work Platform Battery"
            title="고소작업대용 배터리"
            desc="시저리프트 및 붐리프트는 장비별 배터리 사양이 다양하며, 무보수(MF) 타입과 LFP(리튬인산철) 배터리 모두 공급 가능합니다. 모델 확인 후 맞춤 견적을 제공합니다."
            imageSrc={awpHeroImage}
            imageAlt="고소작업대용 배터리"
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <QuoteOnlyCard
              title="시저리프트 / 붐리프트"
              desc="장비 모델, 전압, 용량, 사용시간에 따라 적합한 배터리 사양과 렌탈 조건이 달라집니다."
              note="장비 모델명과 배터리 사양을 알려주시면 적용 가능 여부와 렌탈 조건을 안내드립니다."
            />
            <QuoteOnlyCard
              title="배터리 교체 / 전환 검토"
              desc="기존 무보수(MF) 배터리 교체는 물론, LFP 전환 검토도 가능합니다."
              note="현장 사용환경과 장비 조건을 바탕으로 무보수(MF) 유지 또는 LFP 전환 중 적합한 구조를 제안드립니다."
            />
          </div>
        </div>
      </section>

      <section id="golfcart" className="scroll-mt-28 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
          <CategoryHeader
            eyebrow="Golf Cart Battery"
            title="골프카트용 배터리"
            desc="골프카트 운영 조건에 맞는 LFP 배터리 구조를 제안합니다. 차종과 운행 패턴에 따라 맞춤 견적을 제공합니다."
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <QuoteOnlyCard
              title="골프장 / 리조트 운영"
              desc="운영 대수, 충전 환경, 사용 빈도에 따라 적합한 배터리 용량과 구조가 달라집니다."
              note="차종과 운영 대수, 사용 패턴을 알려주시면 맞춤 렌탈 조건을 검토해드립니다."
            />
            <QuoteOnlyCard
              title="LFP 전환 상담"
              desc="기존 납산 배터리에서 LFP 배터리로의 전환도 검토 가능합니다."
              note="현장 조건을 바탕으로 배터리 전환 효과와 적용 가능 구조를 함께 안내드립니다."
            />
          </div>
        </div>
      </section>

      <section id="consultation" className="scroll-mt-28 bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20">
          <div className="rounded-[2rem] bg-white px-6 py-8 md:px-10 md:py-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600 md:text-sm">
                  Consultation
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-gray-900 md:text-3xl">
                배터리 상담이 필요하신가요?
              </h2>

              <p className="mt-4 break-keep text-base leading-7 text-gray-600">
                장비 모델명, 전압, 용량, 사용환경을 알려주시면 적용 가능 여부와 기본 조건을 검토하여 안내드립니다.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 md:px-6 md:text-base"
                >
                  상담 신청하기
                </a>
                <a
                  href="tel:1551-1873"
                  className="inline-flex items-center justify-center rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:border-gray-400 hover:bg-gray-50 md:px-6 md:text-base"
                >
                  전화 문의
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
