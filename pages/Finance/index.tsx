// pages/Finance/index.tsx
import React from "react";
import { Link } from "react-router-dom";
import PageTitle from "../../components/PageTitle";

type LogoSpec = {
  src: string;
  alt: string;
  size?: string;
  opacity?: string;
  className?: string;
};

const FinancePage: React.FC = () => {
  const partnerAssets = {
    BSON: { src: "/logo/bson.jpg", alt: "BSON" },
    ORIX: { src: "/logo/orix.jpg", alt: "ORIX Capital Korea" },
    LOTTE: { src: "/logo/lotte.jpg", alt: "Lotte Auto Lease" },
  } as const;

  const partnerPills = [
    { label: "렌탈", partnersText: "BSON" },
    { label: "할부금융", partnersText: "롯데오토리스 · 오릭스캐피탈코리아" },
    { label: "리스", partnersText: "롯데오토리스" },
  ] as const;

  const LogosRow: React.FC<{ logos: LogoSpec[]; gap?: string }> = ({
    logos,
    gap = "gap-4",
  }) => {
    if (!logos?.length) return null;
    return (
      <div className={`flex items-center ${gap}`}>
        {logos.map((l) => (
          <img
            key={`${l.src}-${l.size ?? ""}-${l.className ?? ""}`}
            src={l.src}
            alt={l.alt}
            className={`${l.size ?? "h-6"} w-auto object-contain ${
              l.opacity ?? "opacity-80"
            } ${l.className ?? ""}`}
            loading="lazy"
          />
        ))}
      </div>
    );
  };

  const PartnerTrustBar: React.FC = () => (
    <div className="mt-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
        <div className="w-full">
          <div className="text-base font-extrabold text-navy-900">협업 파트너</div>

          <div className="mt-4 flex flex-wrap gap-3">
            {partnerPills.map((p) => (
              <span
                key={p.label}
                className="
                  inline-flex items-center
                  px-4 py-3 rounded-full
                  border border-gray-200 bg-white
                  shadow-[0_1px_0_rgba(0,0,0,0.02)]
                  transition-colors
                  hover:border-gray-300
                "
                title={`${p.label} 파트너: ${p.partnersText}`}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="text-gray-500 font-extrabold text-sm whitespace-nowrap">
                    {p.label}
                  </span>
                  <span className="text-navy-900 font-extrabold text-sm">
                    {p.partnersText}
                  </span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const PartnerLineRight: React.FC<{
    label?: string;
    partnersText: string;
    logos?: LogoSpec[];
  }> = ({ label = "Partner", partnersText, logos = [] }) => (
    <div className="mt-5 pt-4 border-t border-gray-100 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 font-extrabold whitespace-nowrap">
          {label}:
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-navy-900 font-bold">{partnersText}</span>
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
        <span className="text-gray-500 font-extrabold whitespace-nowrap">
          {label}:
        </span>
        <div className="flex flex-col">
          <span className="text-navy-900 font-bold">{partnersText}</span>
          <div className="mt-2">
            <LogosRow logos={logos} gap="gap-5" />
          </div>
        </div>
      </div>
    </div>
  );

  const cardBase =
    "border border-gray-200 rounded-xl p-6 bg-white shadow-sm " +
    "transition-all duration-200 " +
    "hover:shadow-md hover:border-gray-300 hover:-translate-y-[2px]";

  const CardFooterNote: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => (
    <div className="mt-auto pt-4 border-t border-gray-100 text-sm text-gray-600">
      {children}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-16 space-y-12">
      <PageTitle
  title="금융 솔루션"
  desc="장비 도입 비용을 줄이고 운영 효율을 높이기 위한 렌탈·리스·할부금융 구조를 설계합니다. 현장 조건과 현금흐름에 맞춰 가장 현실적인 선택지를 제안드립니다."
/>
      {/* ===================== 페이지 소개 ===================== */}
      <section className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-navy-900 tracking-tight">
              금융 솔루션
            </h1>
            <p className="text-gray-600 mt-3 max-w-3xl leading-relaxed">
              장비 도입 비용을 줄이고 운영 효율을 높이기 위한
              렌탈·리스·할부금융 구조를 설계합니다.
              현장 조건과 현금흐름에 맞춰 가장 현실적인 선택지를 제안드립니다.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== 배터리 전환 금융 구조 ===================== */}
      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900">
              배터리/타이어 교체 금융솔루션
            </h2>
            <p className="text-gray-600 mt-2 max-w-3xl">
              RNF KOREA는 배터리/타이어 교체를 위한 금융·렌탈 구조를 설계합니다.
              <br />
              초기 투자 부담을 줄이고, 운영비를 줄여서 렌탈료로 상환하는 운영 절감 효과 기반 상환 모델을 제공합니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="border rounded-xl p-6 bg-white">
            <h3 className="font-extrabold text-navy-900 mb-2">초기비용 경감</h3>
            <p className="text-sm text-gray-600">
              구매비용을 렌탈·분할 구조로 전환하여 현금 흐름 부담을 완화합니다. (초기비용 0원)
            </p>
          </div>

          <div className="border rounded-xl p-6 bg-white">
            <h3 className="font-extrabold text-navy-900 mb-2">
              줄어든 비용은 렌탈비로 납부
            </h3>
            <p className="text-sm text-gray-600">
              LFP 전환으로 절감되는 유지비를 상환 구조에 반영합니다.
            </p>
          </div>

          <div className="border rounded-xl p-6 bg-white">
            <h3 className="font-extrabold text-navy-900 mb-2">
              배터리 교환 / 금융, 하나의 프로젝트
            </h3>
            <p className="text-sm text-gray-600">
              배터리 전환 프로젝트와 금융을 하나의 구조로 설계합니다.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== 협업 파트너 ===================== */}
      <PartnerTrustBar />

      {/* ===================== 취급상품 ===================== */}
      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              취급상품
            </h2>
            <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
              렌탈 (건설기계, 고소작업대, 각종 물류기기), 할부금융 (상용차, 건설기계, 항만장비), 리스
              (개인_개별화물협회 전용) — 목적에 맞는 조달 구조를 한 번에 정리해드립니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {/* 1) 렌탈 */}
          <div className={`${cardBase} flex flex-col h-full`}>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div>
                <h3 className="text-lg md:text-xl font-extrabold text-navy-900">
                  렌탈 (건설기계, 고소작업대 등)
                </h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  필요한 기간만, 필요한 조건으로. 현장 운영에 맞춘 렌탈 구조를 제안합니다.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
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

            <CardFooterNote>
              추천 고객: 법인고객, 단기간 증차, 재무제표 관리 목적
            </CardFooterNote>
          </div>

          {/* 2) 할부금융 */}
          <div className={`${cardBase} flex flex-col h-full`}>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div>
                <h3 className="text-lg md:text-xl font-extrabold text-navy-900">
                  할부금융 (상용차, 건설기계, 항만장비)
                </h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  초기 부담을 낮추고 현금흐름에 맞춰 분할 상환 구조를 설계합니다.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• 취급 상품 : 할부금융, 리스(운용)</li>
              <li>• 장비 평가 및 잔가(Residual) 구조 반영 (리스)</li>
              <li>• 담보/보증 구조 및 리스크 조건 정리</li>
              <li>• 세무관련 상담 서비스 지원</li>
            </ul>

            <PartnerLineBelow
              label="Partners"
              partnersText="롯데오토리스 · 오릭스캐피탈코리아"
              logos={[
                {
                  ...partnerAssets.LOTTE,
                  size: "h-[55px]",
                  opacity: "opacity-90",
                  className: "-ml-5",
                },
                { ...partnerAssets.ORIX, size: "h-6", opacity: "opacity-90" },
              ]}
            />

            <CardFooterNote>
              추천 고객: 차량(장비) 구입 초기 비용 절감 목적 개인 및 법인
            </CardFooterNote>
          </div>

          {/* 3) 리스 */}
          <Link
            to="/cargo-finance"
            className={`${cardBase} block flex flex-col h-full hover:border-orange-400`}
            aria-label="리스(개인_개별협회 전용 상품) 상세 페이지로 이동"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div>
                <h3 className="text-lg md:text-xl font-extrabold text-navy-900">
                  리스 (개인_개별협회 전용 상품)
                </h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  (주)롯데오토리스와 협업으로 개인(개별)화물협회 전용 우대 조건을 제공합니다.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
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

            <CardFooterNote>
              추천 고객: 개별화물협회 회원 또는 신규(예정)사업자
              <span className="ml-2 text-orange-600 font-extrabold">
                (자세히 보기)
              </span>
            </CardFooterNote>
          </Link>

          
        </div>
      </section>

      {/* ===================== 중개 고지 ===================== */}
      <section className="border-t border-gray-200 pt-10">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
            <div className="space-y-2">
              <div className="text-sm font-extrabold text-navy-900">중개 고지</div>
              <p className="text-sm text-gray-600 leading-relaxed">
                RNF Korea는 파트너 금융사/렌탈사 상품을 비교 안내하고, 고객 요청에 따라 서류 준비 및 진행
                절차를 지원하는 중개·상담 역할을 수행합니다. 최종 심사 및 계약 조건(금리, 한도, 기간,
                잔가 등)은 각 금융사/렌탈사의 내부 기준에 따라 확정됩니다.
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                ※ 본 페이지의 내용은 안내 목적이며, 실제 조건은 고객 신용도/담보/장비평가 결과 및 시장
                상황에 따라 변동될 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FinancePage;