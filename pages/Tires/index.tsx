import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "@/src/components/Seo";

import { fetchTireRows } from "../../lib/tiresCsv";
import { TIRE_CSV_URL } from "../TireShop/config";

type TruckCategory = "cargo" | "dump" | "bus";

type TruckProduct = {
  brand: string;
  model: string;
  thumb: string;
  use: string;
  use2?: string;
  use2Img?: string[];
};

type ProductCardProps = { p: TruckProduct };

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

function isInCenterArea(e: React.MouseEvent, ratio = 0.4) {
  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const cx0 = rect.width * (0.5 - ratio / 2);
  const cx1 = rect.width * (0.5 + ratio / 2);
  const cy0 = rect.height * (0.5 - ratio / 2);
  const cy1 = rect.height * (0.5 + ratio / 2);

  return x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1;
}

function PageHero({ eyebrow, title, description, right }: PageHeroProps) {
  return (
    <section className="pt-6 pb-5 md:pt-8 md:pb-6">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-7">
            <div className="text-sm text-gray-500">
              <Link to="/" className="hover:text-orange-500 transition-colors">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-700 font-semibold">타이어</span>
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

      <h2 className="mt-2 text-2xl md:text-3xl font-semibold leading-[1.2] text-navy-900 break-keep">
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

const ProductCard: React.FC<ProductCardProps> = ({ p }) => {
  const [hover, setHover] = useState(false);
  const [activeSrc, setActiveSrc] = useState(p.thumb);

  useEffect(() => {
    setActiveSrc(p.thumb);
  }, [p.thumb]);

  const CENTER_RATIO = 0.3;
  const DIM_MS = 1200;
  const ZOOM_MS = 1500;
  const START_SCALE = 0.99;
  const SOFT_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="p-5 md:p-6">
        <div className="text-sm font-medium text-gray-500">{p.brand}</div>
        <div className="mt-1 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
          {p.model}
        </div>
      </div>

      <div
        className="relative"
        onMouseMove={(e) => {
          const inCenter = isInCenterArea(e, CENTER_RATIO);
          if (inCenter && !hover) setHover(true);
          if (!inCenter && hover) setHover(false);
        }}
        onMouseLeave={() => setHover(false)}
        onMouseEnter={() => setActiveSrc(p.thumb)}
      >
        <img src={p.thumb} alt={`${p.brand} ${p.model}`} className="w-full h-44 object-cover" loading="lazy" />
      </div>

      <div className="p-5 md:p-6 pt-5">
        <div className="text-sm md:text-base leading-7 text-gray-600 whitespace-pre-line break-keep">{p.use}</div>

        {p.use2 && <div className="mt-4 text-sm font-semibold leading-6 text-gray-700">{p.use2}</div>}

        {p.use2Img && p.use2Img.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {p.use2Img.map((img, idx) => (
              <img key={idx} src={img} alt="" className="w-28 h-14 object-contain block" loading="lazy" />
            ))}
          </div>
        )}
      </div>

      <div
        className={`
          fixed inset-0 z-[99999]
          flex items-center justify-center
          pointer-events-none
          transition-opacity
          ${hover ? "opacity-100" : "opacity-0"}
        `}
        style={{
          transitionDuration: `${DIM_MS}ms`,
          transitionTimingFunction: SOFT_EASE,
        }}
      >
        <div className="absolute inset-0 bg-black/30" />

        <div
          className="relative bg-white p-3 rounded-2xl shadow-2xl"
          style={{
            transitionProperty: "transform, opacity",
            transitionDuration: `${ZOOM_MS}ms`,
            transitionTimingFunction: SOFT_EASE,
            transform: hover ? "scale(1)" : `scale(${START_SCALE})`,
            opacity: hover ? 1 : 0,
            willChange: "transform, opacity",
          }}
        >
          <img
            key={activeSrc}
            src={activeSrc}
            alt={`${p.brand} ${p.model} preview`}
            className="block rounded-xl object-contain w-[76vw] max-w-[980px] h-auto max-h-[74vh]"
            style={{
              transitionProperty: "opacity",
              transitionDuration: `${ZOOM_MS}ms`,
              transitionTimingFunction: SOFT_EASE,
              opacity: hover ? 1 : 0,
              willChange: "opacity",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default function TiresPage() {
  const subImages = useMemo(
    () => ({
      cargo: "/home/cargo.jpg",
      dump: "/home/dump.jpg",
      bus: "/home/bus.jpg",
    }),
    []
  );

  const [tireCount, setTireCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!TIRE_CSV_URL) throw new Error("TIRE_CSV_URL is empty");

        const url = `${TIRE_CSV_URL}${TIRE_CSV_URL.includes("?") ? "&" : "?"}v=${Date.now()}`;
        const rows = await fetchTireRows(url);

        if (!alive) return;
        setTireCount(rows.length);
      } catch (e) {
        console.warn("[TIRE COUNT] error:", e);
        if (!alive) return;
        setTireCount(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const truckProducts: Record<TruckCategory, TruckProduct[]> = {
    cargo: [
      {
        brand: "금호타이어",
        model: "KRS55 (12R22.5)",
        thumb: "https://www.kumhotire.com/upload/product/20140326_61217551.jpg?v=",
        use: ` · 특수 컴파운드 적용으로 고(高)마일리지 실현
 · 고속주행 안정성 및 핸들링 성능 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: [
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago1.gif",
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago4.gif",
        ],
      },
      {
        brand: "금호타이어",
        model: "KRA60 (12R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1626918120840_2155353698801451578.png?v=",
        use: ` · 마일리지 및 내구성 향상
 · 신개발 고무 적용으로 컷&칩핑, 뜯김 방지
 · 숄더부 이상 마모 방지와 주행성능 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: [
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago3.gif",
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago6.gif",
        ],
      },
      {
        brand: "금호타이어",
        model: "KRD55 (12R22.5)",
        thumb: "https://www.kumhotire.com/upload/product/20160408_37725649.jpg?v=",
        use: ` · 18PR 적용으로 내구성 및 재생성 향상
 · 신개발 고무 적용
 · 센터부 블럭 강성 증가/굴곡 사이프 적용`,
        use2: `[타이어 위치정보]`,
        use2Img: [
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago2.gif",
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago5.gif",
        ],
      },
    ],
    dump: [
      {
        brand: "금호타이어",
        model: "KXA11 (385/65R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1724736907113_1488323251954799719.png?v=",
        use: ` · 3PMSF 및 M+S에 따른 Allseason 성능
 · 원단 내구성 향상 및 마일리지 향상
 · Wet 및 Winter 성능 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/dump4.gif"],
      },
      {
        brand: "금호타이어",
        model: "KRS50 (385/65R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1724736515408_4036362849833123991.png?v=",
        use: ` · 원단 내구성 및 재생성 향상
 · 특수 컴파운드 적용으로 고(高)마일리지 실현
 · 케이싱 보호`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/dump4.gif"],
      },
      {
        brand: "금호타이어",
        model: "KRA60 (385/65R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1714709713410_606693494195882325.gif?v=",
        use: ` · 마일리지 및 내구성 향상
 · 신개발 고무 적용으로 컷&칩핑,뜯김 방지
 · 접지압 최적화 설계로 편마모 감소/수명증가`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/dump4.gif"],
      },
    ],
    bus: [
      {
        brand: "금호타이어",
        model: "KRA53 (12R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1669793942291_746001193636015016.png?v=",
        use: ` · 마일리지 향상 및 고속주행 안정성 우수
 · 원단 내구성 및 배수성 향상
 · 중·장거리 노선에 최적화`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/bus8.gif"],
      },
      {
        brand: "금호타이어",
        model: "KRA50 (12R22.5)",
        thumb: "https://www.kumhotire.com/upload/product/20160408_37205351.jpg?v=",
        use: ` · 중·단거리 가혹노선 (커브/오르막)에 최적화
 · 신개발 고무 적용으로 마일리지, 내구성 향상
 · 숄더부 이상 마모 방지와 주행성능 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/bus8.gif"],
      },
      {
        brand: "금호타이어",
        model: "KXA10 (12R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1724737012036_4839557132438415813.png?v=",
        use: ` · 물결무늬 적용으로 제동력 향상
 · 가성비 우수, 고(高)마일리지의 중·장거리 버스용
 · 고강도 18PR 적용으로 내구성 및 재생성 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/bus8.gif"],
      },
    ],
  };

  const cargoRef = useRef<HTMLDivElement | null>(null);
  const dumpRef = useRef<HTMLDivElement | null>(null);
  const busRef = useRef<HTMLDivElement | null>(null);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const industrialKeyClients = [
    { key: "tls", name: "티엘에스코리아", sub: "융하인리히", inlinePair: true, logo: "/logo/TLS.png" },
    { key: "nichiyu", name: "혁신상사", sub: "니찌유 총판", inlinePair: true, logo: "/logo/NICHIYU.jpg" },
    { key: "hyundai_nb", name: "현대지게차경기북부판매", sub: "현대사이트솔루션", inlinePair: true, logo: "/logo/brotherlift.png" },
    { key: "yale", name: "예일이큅먼트", sub: "YALE", inlinePair: true, logo: "/logo/yale.png" },
    { key: "hyster", name: "하이스터코리아", sub: "HYSTER", inlinePair: true, logo: "/logo/Hyster.png" },
    { key: "dpl", name: "DPL", sub: "TOYOTA 총판", inlinePair: true, logo: "/logo/dpl.png" },
    { key: "homecenter", name: "홈센타", sub: "레미콘 제조업", inlinePair: true, logo: "/logo/homecenter.jpg" },
    { key: "kbin", name: "경북개인(개별)화물협회", sub: "MOU", inlinePair: true, logo: "/logo/kbin.png" },
    { key: "gjin", name: "광주개인(개별)화물협회", sub: "MOU", inlinePair: true, logo: "/logo/gjin.jpg" },
  ] as const;

  const ProductsBlock = ({
    title,
    desc,
    sectionRef,
    products,
  }: {
    title: string;
    desc: string;
    sectionRef: React.RefObject<HTMLDivElement | null>;
    products: TruckProduct[];
  }) => (
    <section ref={sectionRef} className="scroll-mt-28 py-6 md:py-8">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
          <SectionHeader title={title} description={desc} />

          <div className="mt-4 grid md:grid-cols-3 gap-6">
            {products.map((p) => (
              <ProductCard key={p.model} p={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="bg-white text-navy-900">
      <Seo
        title="산업용 타이어 공급 | RNF KOREA"
        description="지게차·고소작업대 등 산업장비용 타이어를 공급합니다. 현장 운용 조건에 맞는 제품 제안과 상담을 RNF KOREA에서 제공합니다."
        path="/tires"
      />
      <PageHero
        eyebrow="Tire Solution"
        title="상용·산업용 타이어 솔루션"
        description="차종, 운행 조건, 교체 주기를 기준으로 제품 선정부터 구매 구조까지 함께 설계합니다. 상용차와 산업 현장의 실제 운용 조건에 맞춰 가장 안정적인 타이어 조합을 제안합니다."
        right={
          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-6 md:p-7 shadow-sm">
            <div className="space-y-4">
              <div className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                Tire Shop
              </div>

              <div className="text-xl md:text-2xl font-semibold leading-[1.2] text-navy-900 break-keep">
                타이어 쇼핑몰 바로가기
              </div>

              <p className="text-sm md:text-base leading-7 text-gray-600 break-keep">
                등록된 제품을 규격, 용도, 축 위치 기준으로<br/> 즉시 확인할 수 있습니다.
              </p>

              <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="text-gray-500">등록 상품</span>
                <span className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
                  {typeof tireCount === "number" ? `${tireCount}개` : "집계중…"}
                </span>
              </div>

              <div className="pt-2">
                <Link
                  to="/tires-shop"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all shadow-sm hover:shadow-md"
                >
                  쇼핑몰 바로가기
                  <span className="inline-block transform transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </div>
          </div>
        }
      />

      <section className="py-6 md:py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <div className="grid md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-7 min-w-0">
              <SectionHeader
                eyebrow="Project"
                title="타이어 구매 구조 설계"
                description="단순 구매가 아니라 구매 프로젝트와 금융 구조를 함께 설계합니다. RNF KOREA가 물량, 운행조건, 교체주기를 기준으로 최적의 제품 조합과 결제 구조를 함께 제안합니다."
              />
            </div>

            <div className="md:col-span-5 min-w-0">
              <div className="rounded-2xl bg-orange-50 border border-orange-200 p-6 md:p-7">
                <div className="text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                  화물차 타이어도 렌탈이 가능합니다.
                </div>
                <p className="mt-3 text-sm md:text-base leading-7 text-gray-600 break-keep">
                  목돈 부담을 낮추고, 교체주기와 현금흐름까지 포함해 가장 유리한 구조로 설계합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "STEP 01", title: "운행 조건 진단", desc: "노선, 하중, 주행거리, 도로 조건을 기준으로 교체주기와 운영 리스크를 분석합니다." },
              { step: "STEP 02", title: "제품 조합 설계", desc: "차종, 축 위치, 운행 패턴에 맞는 전륜·후륜 조합과 규격을 제안합니다." },
              { step: "STEP 03", title: "금융 결합 구조", desc: "구매와 렌탈 옵션을 결합해 초기 부담을 낮추고 현금흐름을 최적화합니다." },
              { step: "STEP 04", title: "운영 최적화", desc: "교체주기, 정비, 관리 기준을 함께 잡아 운행 효율을 높여드립니다." },
            ].map((x) => (
              <div key={x.step} className="rounded-2xl border border-gray-200 p-6 md:p-7 bg-white hover:shadow-md transition-all">
                <div className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">{x.step}</div>
                <h3 className="mt-3 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">{x.title}</h3>
                <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">{x.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-orange-50 border border-orange-200 p-6 md:p-7 text-center">
            <p className="text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
              타이어 구매는 비용이 아니라 구조입니다.
            </p>
            <p className="mt-3 text-sm md:text-base leading-7 text-gray-600 break-keep">
              소모품 구매비용을 분납 구조로 전환하여 현금흐름 안정화를 설계합니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:1551-1873"
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base md:text-lg hover:bg-orange-600 transition-all"
            >
              타이어 구매 프로젝트 상담 1551-1873
            </a>

            <Link
              to="/finance"
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl border border-gray-300 bg-white text-navy-900 font-semibold text-base md:text-lg hover:shadow-md transition-all"
            >
              금융 결합 구조 보기 →
            </Link>
          </div>
        </div>
      </section>

      <section className="py-6 md:py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Commercial Tire"
            title="화물용 타이어"
            description="장거리 운송, 고하중 적재, 내구성과 경제성을 고려한 상용차 타이어 라인업입니다."
          />

          <div className="grid md:grid-cols-3 gap-6">
            <button
              type="button"
              onClick={() => scrollToRef(cargoRef)}
              className="group border border-gray-200 rounded-2xl bg-white hover:shadow-md transition-all overflow-hidden text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
            >
              <div className="flex h-full">
                <div className="flex-1 p-6 md:p-7">
                  <h3 className="text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">카고 & 트레일러용</h3>
                  <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                    마일리지, 연비 효율, 주행 안정성의 균형을 고려한 표준 운송 솔루션.
                  </p>
                </div>
                <div className="relative w-[40%] min-w-[110px]">
                  <img
                    src={subImages.cargo}
                    alt="카고 & 트레일러용"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => scrollToRef(dumpRef)}
              className="group border border-gray-200 rounded-2xl bg-white hover:shadow-md transition-all overflow-hidden text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
            >
              <div className="flex h-full">
                <div className="flex-1 p-6 md:p-7">
                  <h3 className="text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">덤프용</h3>
                  <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                    험로 및 건설 현장 대응을 위한 내절상·내충격 강화 설계.
                  </p>
                </div>
                <div className="relative w-[40%] min-w-[110px]">
                  <img
                    src={subImages.dump}
                    alt="덤프용"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => scrollToRef(busRef)}
              className="group border border-gray-200 rounded-2xl bg-white hover:shadow-md transition-all overflow-hidden text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
            >
              <div className="flex h-full">
                <div className="flex-1 p-6 md:p-7">
                  <h3 className="text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">버스용</h3>
                  <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                    승차감, 소음 저감, 안전성을 중시한 여객 운송 전용 타이어.
                  </p>
                </div>
                <div className="relative w-[40%] min-w-[110px]">
                  <img
                    src={subImages.bus}
                    alt="버스용"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </section>

      <section className="py-6 md:py-8 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <SectionHeader
            eyebrow="Industrial Tire"
            title="산업용 타이어"
            description="지게차, 물류장비, 특수장비 등 고하중·고내구 환경에 대응하는 산업 특화 솔루션입니다."
          />

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "솔리드 타이어", desc: "펑크 리스크 제거와 유지보수 최소화를 위한 고내구 구조.", img: "/home/solid.jpg" },
              { title: "공기압 타이어", desc: "충격 흡수와 승차감 개선에 유리한 범용 산업 장비 대응 타입.", img: "/home/air.jpg" },
              { title: "특수장비용 타이어", desc: "작업 환경과 장비 특성에 맞춘 맞춤 규격 및 제품 제안 가능.", img: "/home/special.jpg" },
            ].map((x) => (
              <div key={x.title} className="group border border-gray-200 rounded-2xl bg-white hover:shadow-md transition-all overflow-hidden">
                <div className="flex h-full">
                  <div className="flex-1 p-6 md:p-7">
                    <h3 className="text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">{x.title}</h3>
                    <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">{x.desc}</p>
                  </div>

                  <div className="relative w-[40%] min-w-[110px]">
                    <img
                      src={x.img}
                      alt={x.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
            <SectionHeader
              title="산업용 타이어 주요 고객사"
              description="산업용 타이어는 주요 물류·장비 운영사 및 공식 유통망을 중심으로 공급합니다."
            />

            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              {industrialKeyClients.map((c) => (
                <div
                  key={c.key}
                  className="border border-gray-200 rounded-2xl bg-white px-4 py-5 flex flex-col items-center justify-center text-center"
                >
                  <div className="h-14 w-full flex items-center justify-center mb-3">
                    <img
                      src={c.logo}
                      alt={`${c.name} ${c.sub}`}
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  <div className="text-sm md:text-base font-semibold leading-6 text-navy-900 break-keep">
                    {c.inlinePair ? `${c.name} : ${c.sub}` : c.name}
                  </div>
                  {!c.inlinePair && <div className="text-xs font-medium text-gray-500 mt-1">{c.sub}</div>}
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-gray-400 leading-relaxed break-keep">
              * 로고 및 상호는 각 사의 상표권을 존중하며, 협업 및 공급 관계 안내 목적입니다.
            </div>
          </div>
        </div>
      </section>

      <ProductsBlock
        title="카고 & 트레일러용 주요제품"
        desc="장거리 운송 환경에 최적화된 마일리지·연비 효율 중심 제품 라인업입니다."
        sectionRef={cargoRef}
        products={truckProducts.cargo}
      />

      <ProductsBlock
        title="덤프용 주요제품"
        desc="험로 및 건설 현장 대응을 위한 내절상·내충격 강화 라인업입니다."
        sectionRef={dumpRef}
        products={truckProducts.dump}
      />

      <ProductsBlock
        title="버스용 주요제품"
        desc="승차감, 정숙성, 제동 안정성을 중시한 여객 운송 전용 라인업입니다."
        sectionRef={busRef}
        products={truckProducts.bus}
      />

      {/* <ProjectConsultForm project="TIRE_PURCHASE" /> */}
    </div>
  );
}
