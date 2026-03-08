import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

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

export const ProductCard: React.FC<ProductCardProps> = ({ p }) => {
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
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* 텍스트 */}
      <div className="p-4 space-y-1">
        <div className="text-sm text-gray-500">{p.brand}</div>
        <div className="text-lg font-bold text-navy-900">{p.model}</div>
      </div>

      {/* hover 감지 영역 */}
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

      {/* 내용 */}
      <div className="p-4">
        <div className="text-sm text-gray-600 whitespace-pre-line">{p.use}</div>

        {p.use2 && <div className="h-4" />}
        {p.use2 && <div className="text-sm text-gray-700 font-bold">{p.use2}</div>}

        {p.use2Img && p.use2Img.length > 0 && (
          <div className="flex gap-2 mt-2">
            {p.use2Img.map((img, idx) => (
              <img key={idx} src={img} alt="" className="w-28 h-14 object-contain block" loading="lazy" />
            ))}
          </div>
        )}
      </div>

      {/* 중앙 프리뷰 오버레이 (1개만 유지) */}
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

const TiresPage: React.FC = () => {
  const subImages = useMemo(
    () => ({
      cargo: "/home/cargo.jpg",
      dump: "/home/dump.jpg",
      bus: "/home/bus.jpg",
    }),
    []
  );

  // ✅ 타이어 쇼핑몰(상품) 등록 개수 집계
  const [tireCount, setTireCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!TIRE_CSV_URL) throw new Error("TIRE_CSV_URL is empty");

        // ✅ 캐시 방지(구글시트/CSV 업데이트 즉시 반영용)
        const url = `${TIRE_CSV_URL}${TIRE_CSV_URL.includes("?") ? "&" : "?"}v=${Date.now()}`;

        const rows = await fetchTireRows(url);

        // ✅ CSV 값 흔들림(공백/대소문자/TRUE/1/Y 등) 방어
        const norm = (v: any) => String(v ?? "").trim().toUpperCase();
        const isActive = (v: any) => {
          const s = norm(v);
          return s === "TRUE" || s === "1" || s === "Y" || s === "YES" || s === "T";
        };
        const isCommercialVehicle = (v: any) => {
          const s = norm(v);
          return s === "CARGO" || s === "DUMP" || s === "BUS" || s === "TRAILER";
        };

        const commercial = rows.filter(
          (x: any) => isActive(x.is_active) && isCommercialVehicle(x.vehicle_type)
        );

        if (!alive) return;
        setTireCount(commercial.length);

        // 디버그 필요 시만 사용
        console.log("[TIRE] rows:", rows.length);
        console.log("[TIRE] sample:", rows?.[0]);
      } catch (e) {
        console.warn("[TIRE] count error:", e);
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

  // ✅ 섹션 이동용 ref
  const cargoRef = useRef<HTMLDivElement | null>(null);
  const dumpRef = useRef<HTMLDivElement | null>(null);
  const busRef = useRef<HTMLDivElement | null>(null);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ✅ 산업용 타이어 주요고객
  const industrialKeyClients = [
    { key: "tls", name: "티엘에스코리아", sub: "융하인리히", inlinePair: true, logo: "/logo/TLS.png" },
    { key: "nichiyu", name: "혁신상사", sub: "니찌유 총판", inlinePair: true, logo: "/logo/NICHIYU.jpg" },
    { key: "hyundai_nb", name: "현대지게차경기북부판매", sub: "현대사이트솔루션", inlinePair: true, logo: "/logo/brotherlift.png" },
    { key: "yale", name: "예일이큅먼트", sub: "YALE", inlinePair: true, logo: "/logo/yale.png" },
    { key: "hyster", name: "하이스터코리아", sub: "HYSTER", inlinePair: true, logo: "/logo/Hyster.png" },
    { key: "dpl", name: "DPL", sub: "TOYOTA 총판", inlinePair: true, logo: "/logo/dpl.png" },
  ] as const;

  // ✅ “주요제품 박스” 공통 래퍼(양식 통일)
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
    <section ref={sectionRef} className="space-y-0 scroll-mt-28">
      <div className="border border-gray-200 rounded-xl bg-white p-6 w-full">
        <div className="relative pl-5">
          <div className="absolute left-0 top-1 h-5 w-1.5 rounded bg-orange-500" />

          <h3 className="text-lg md:text-xl font-extrabold text-navy-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-2">{desc}</p>

          <div className="mt-6 grid md:grid-cols-3 gap-6">
            {products.map((p) => (
              <ProductCard key={p.model} p={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="container mx-auto px-4 py-16 space-y-16">
      {/* ===================== 페이지 헤더 + 쇼핑몰 배너 ===================== */}
      <div className="border-b border-gray-200 pb-6">
        <div className="grid md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-7 space-y-3">
            <div className="text-sm text-gray-500">
              <Link to="/" className="hover:text-orange-500 transition-colors">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-700 font-semibold">타이어</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">타이어</h1>

            <p className="text-gray-600 text-base md:text-lg max-w-3xl">
              운송 환경과 산업 현장의 다양한 조건에 최적화된 타이어 솔루션을 제공합니다.
            </p>
          </div>

          <div className="md:col-span-5">
            <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div
                className="
                  absolute inset-0 opacity-70
                  bg-[radial-gradient(circle_at_20%_30%,rgba(249,115,22,0.22),transparent_35%),radial-gradient(circle_at_80%_60%,rgba(14,165,233,0.16),transparent_40%)]
                  animate-[pulse_3s_ease-in-out_infinite]
                "
              />
              <div className="relative p-5 md:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-extrabold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
                      TIRE SHOP
                      <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                      <span className="inline-block w-2 h-2 rounded-full bg-orange-500 -ml-4" />
                    </div>

                    <div className="text-xl md:text-2xl font-extrabold text-navy-900 leading-tight">
                      타이어 쇼핑몰 바로가기
                    </div>

                    <div className="pt-1">
                      <div className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-700">
                        <span className="text-gray-500">등록 상품</span>
                        <span className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
                          {typeof tireCount === "number" ? `${tireCount}개` : "집계중…"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Link
                      to="/tires-shop"
                      className="
                        group inline-flex items-center justify-center gap-2
                        px-4 py-2.5 rounded-2xl
                        bg-orange-500 text-white font-extrabold text-sm
                        hover:bg-orange-600 transition-all
                        shadow-md hover:shadow-lg
                        active:scale-[0.99]
                        whitespace-nowrap
                      "
                    >
                      바로가기
                      <span className="inline-block transform transition-transform group-hover:translate-x-1">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== 타이어 구매 Project ===================== */}
      <section className="space-y-8">
        <div className="grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 min-w-0">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight break-keep">
                  타이어 구매 Project!
                </h2>
                <p className="text-gray-600 mt-3 leading-relaxed break-keep">
                  단순 구매가 아니라 “구매 프로젝트 + 금융”으로 설계합니다.<br />
                  RNF KOREA가 물량/운행조건/교체주기 기반으로 최적의 조합과 결제 구조까지 함께 제안합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 min-w-0">
            <div className="rounded-2xl bg-orange-50 border border-orange-200 p-6">
              <p className="text-navy-900 font-extrabold text-lg break-keep">
                화물차 타이어도 “렌탈”이 가능합니다. <br />
                목돈 아끼시고 1년으로 나눠내세요.
              </p>
              <p className="text-sm text-gray-600 mt-2 break-keep">
                교체주기, 현금흐름까지 포함해 가장 유리한 구조로 설계합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: "STEP 01", title: "운행 조건 진단", desc: "노선/하중/주행거리/도로 조건을 기반으로 교체주기·운영 리스크를 분석합니다." },
            { step: "STEP 02", title: "제품 조합 설계", desc: "차종·축 위치·운행 패턴에 맞는 전/후륜 조합 및 규격을 제안합니다." },
            { step: "STEP 03", title: "금융 결합 구조", desc: "구매와 렌탈 옵션을 결합해 초기 부담을 낮추고 현금흐름을 최적화합니다." },
            { step: "STEP 04", title: "운영 최적화", desc: "교체주기·정비·관리 기준을 함께 잡아 운행 효율성을 높여드립니다." },
          ].map((x) => (
            <div key={x.step} className="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-md transition-all">
              <div className="text-orange-500 font-extrabold text-sm mb-2">{x.step}</div>
              <h3 className="font-extrabold text-navy-900 mb-2">{x.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{x.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-2xl bg-orange-50 border border-orange-200 p-6 text-center">
          <p className="text-navy-900 font-extrabold text-lg">타이어 교체에 큰 비용을 지출할 필요가 없습니다.</p>
          <p className="text-sm text-gray-600 mt-2">소모품 구매비용을 분납 구조로 전환하여 현금흐름 안정화를 설계합니다.</p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="tel:1551-1873"
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-orange-500 text-white font-extrabold text-lg hover:bg-orange-600 transition-all"
          >
            타이어 구매 프로젝트 상담 1551-1873
          </a>

          <Link
            to="/finance"
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-gray-300 bg-white text-navy-900 font-extrabold text-lg hover:shadow-md transition-all"
          >
            금융 결합 구조 보기 →
          </Link>
        </div>
      </section>

      {/* ===================== 화물용 타이어 (상단 이동 버튼 영역) ===================== */}
      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">화물용 타이어</h2>
            <p className="text-gray-600 mt-2 max-w-3xl">
              장거리 운송, 고하중 적재, 내구성 및 경제성을 고려한 상용차 타이어 라인업.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <button
            type="button"
            onClick={() => scrollToRef(cargoRef)}
            className="group border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all overflow-hidden text-left
                       focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
          >
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">카고 & 트레일러용</h3>
                </div>
                <p className="text-sm text-gray-600">마일리지, 연비 효율, 주행 안정성의 균형을 고려한 표준 운송 솔루션.</p>
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
            className="group border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all overflow-hidden text-left
                       focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
          >
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">덤프용</h3>
                </div>
                <p className="text-sm text-gray-600">험로 및 건설 현장 대응을 위한 내절상·내충격 강화 설계.</p>
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
            className="group border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all overflow-hidden text-left
                       focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
          >
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">버스용</h3>
                </div>
                <p className="text-sm text-gray-600">승차감, 소음 저감, 안전성을 중시한 여객 운송 전용 타이어.</p>
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
      </section>

      {/* ===================== 산업용 타이어 ===================== */}
      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">산업용 타이어</h2>
            <p className="text-gray-600 mt-2 max-w-3xl">
              지게차, 물류장비, 특수장비 등 고하중·고내구 환경 대응 산업 특화 솔루션.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: "솔리드 타이어", desc: "펑크 리스크 제거 및 유지보수 최소화를 위한 고내구 구조.", img: "/home/solid.jpg" },
            { title: "공기압 타이어", desc: "충격 흡수 및 승차감 개선에 유리한 범용 산업 장비 대응 타입.", img: "/home/air.jpg" },
            { title: "특수장비용 타이어", desc: "작업 환경 및 장비 특성에 맞춘 맞춤 규격 및 제품 제안 가능.", img: "/home/special.jpg" },
          ].map((x) => (
            <div key={x.title} className="group border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all overflow-hidden">
              <div className="flex h-full">
                <div className="flex-1 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-1 rounded bg-orange-500" />
                    <h3 className="text-lg font-extrabold text-navy-900">{x.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{x.desc}</p>
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
      </section>

      {/* ✅ 산업용 타이어 주요 고객사 (1번만!) */}
      <div className="border border-gray-200 rounded-xl bg-white p-6 w-full">
        <div className="relative pl-5">
          <div className="absolute left-0 top-1 h-5 w-1.5 rounded bg-orange-500" />

          <h3 className="text-lg md:text-xl font-extrabold text-navy-900">산업용 타이어 주요 고객사</h3>
          <p className="text-sm text-gray-600 mt-2">
            산업용 타이어는 주요 물류·장비 운영사 및 공식 유통망을 중심으로 공급합니다.
          </p>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-4">
            {industrialKeyClients.map((c) => (
              <div
                key={c.key}
                className="border border-gray-200 rounded-xl bg-white px-4 py-4 flex flex-col items-center justify-center text-center"
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

                <div className="text-sm font-extrabold text-navy-900">
                  {c.inlinePair ? `${c.name} : ${c.sub}` : c.name}
                </div>
                {!c.inlinePair && <div className="text-xs font-bold text-gray-500 mt-1">{c.sub}</div>}
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-gray-400">
            * 로고 및 상호는 각 사의 상표권을 존중하며, 협업/공급 관계 안내 목적입니다.
          </div>
        </div>
      </div>

      {/* ===================== 주요제품(✅ 고객사 박스 밖 / ✅ 양식 통일) ===================== */}
      <ProductsBlock
        title="카고 & 트레일러용 주요제품"
        desc="장거리 운송 환경에 최적화된 마일리지·연비 효율 중심 제품 라인업."
        sectionRef={cargoRef}
        products={truckProducts.cargo}
      />

      <ProductsBlock
        title="덤프용 주요제품"
        desc="험로 및 건설 현장 대응을 위한 내절상·내충격 강화 라인업."
        sectionRef={dumpRef}
        products={truckProducts.dump}
      />

      <ProductsBlock
        title="버스용 주요제품"
        desc="승차감·정숙성·제동 안정성을 중시한 여객 운송 전용 라인업."
        sectionRef={busRef}
        products={truckProducts.bus}
      />

      {/* ✅ 여기 아래에 “공동 프로젝트 상담 폼(ProjectConsultForm)” 붙이면 끝 */}
      {/* <ProjectConsultForm project="TIRE_PURCHASE" /> */}
    </div>
  );
};



export default TiresPage;