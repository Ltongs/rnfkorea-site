import React from "react";
import { Link } from "react-router-dom";
import { Battery, Check, Truck, Wallet } from "lucide-react";

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

const SectionTitle: React.FC<SectionTitleProps> = ({ eyebrow, title, description }) => (
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
  <div className="mt-auto pt-4 border-t border-gray-100 text-sm text-gray-600 leading-7 break-keep">
    {children}
  </div>
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

export default function FinancePage() {
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

  return (
    <div className="bg-white text-navy-900">
      <section className="pt-16 pb-14 md:pt-20 md:pb-16 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            <div className="lg:col-span-7">
              <div className="text-sm text-gray-500">
                <Link to="/" className="hover:text-orange-500 transition-colors">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <span className="text-gray-700 font-semibold">금융솔루션</span>
              </div>

              <div className="mt-6 text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                Finance Solution
              </div>
              <h1 className="mt-2 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-navy-900 break-keep">
                장비 도입 조건에 맞는 금융 솔루션
              </h1>
              <p className="mt-4 text-base md:text-lg leading-7 text-gray-600 max-w-3xl break-keep">
                장비 도입 비용을 줄이고 운영 효율을 높이기 위한 렌탈·리스·할부금융 구조를 설계합니다.
                현장 조건과 현금흐름에 맞춰 가장 현실적인 선택지를 제안드립니다.
              </p>

              <div className="mt-8">
                
                <div className="w-full">
                  <div className="text-lg font-semibold text-navy-900">협업 파트너</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {partnerPills.map((p) => (
                      <span
                        key={p.label}
                        className="inline-flex items-center px-4 py-3 rounded-full border border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:border-gray-300 transition-colors"
                        title={`${p.label} 파트너: ${p.partnersText}`}
                      >
                        <span className="inline-flex items-center gap-3">
                          <span className="text-gray-500 font-medium text-sm whitespace-nowrap">{p.label}</span>
                          <span className="text-navy-900 font-semibold text-sm">{p.partnersText}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-7">
                <div className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                  Finance Structure
                </div>
                <div className="mt-2 text-xl md:text-2xl font-semibold leading-[1.2] text-navy-900 break-keep">
                  비용 부담을 줄이는 금융 레버리지 제공
                </div>
                <p className="mt-3 text-sm md:text-base leading-7 text-gray-600 break-keep">
                  구매, 렌탈, 할부, 리스 중 어떤 방식이 유리한지<br/>장비 특성과 자금 계획 기준으로 비교해드립니다.
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    ["구조 설계", "렌탈·할부·리스"],
                    ["적용 대상", "상용차 · 건설기계 · 물류장비"],
                    ["협업 방식", "파트너사 연계"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-medium tracking-[0.12em] uppercase text-gray-500">{label}</div>
                      <div className="mt-2 text-sm md:text-base font-semibold leading-6 text-navy-900 break-keep">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <SectionTitle
            eyebrow="Battery Finance"
            title="배터리 전환 금융 구조"
            description="RNF KOREA는 배터리 도입을 위한 금융·렌탈 구조를 설계합니다. 초기 투자 부담을 줄이고, 운영 절감 효과 기반 상환 모델을 제공합니다."
          />

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            <div className={cardBase}>
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-orange-500">
                Finance Point 01
              </div>
              <h3 className="mt-3 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                도입비 분산
              </h3>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="text-sm md:text-base leading-7 text-gray-600 break-keep">
                  구매비용을 렌탈·분할 구조로 전환하여 현금 흐름 부담을 완화합니다. (초기비용 0원)
                </p>
              </div>
            </div>

            <div className={cardBase}>
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-orange-500">
                Finance Point 02
              </div>
              <h3 className="mt-3 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                운영비 절감 기반 상환
              </h3>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="text-sm md:text-base leading-7 text-gray-600 break-keep">
                  LFP 전환으로 절감되는 유지비를 상환 구조에 반영합니다.
                </p>
              </div>
            </div>

            <div className={cardBase}>
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-orange-500">
                Finance Point 03
              </div>
              <h3 className="mt-3 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                프로젝트 연동
              </h3>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="text-sm md:text-base leading-7 text-gray-600 break-keep">
                  배터리 전환 프로젝트와 금융을 하나의 구조로 설계합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <SectionTitle
            eyebrow="Products"
            title="취급상품"
            description="렌탈, 할부금융, 리스 등 목적에 맞는 조달 구조를 한 번에 정리해드립니다."
          />

          <div className="mt-10 grid md:grid-cols-3 gap-6 items-stretch">
            <div className={`${cardBase} flex flex-col h-full`}>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 border border-orange-100">
                <Truck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                렌탈 (건설기계, 고소작업대 등)
              </h3>
              <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                필요한 기간만, 필요한 조건으로. 현장 운영에 맞춘 렌탈 구조를 제안합니다.
              </p>
              <ul className="mt-4 space-y-2 text-sm md:text-base leading-7 text-gray-700">
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
            </div>

            <div className={`${cardBase} flex flex-col h-full`}>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 border border-orange-100">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                할부금융 (상용차, 건설기계, 항만장비)
              </h3>
              <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                초기 부담을 낮추고 현금흐름에 맞춰 분할 상환 구조를 설계합니다.
              </p>
              <ul className="mt-4 space-y-2 text-sm md:text-base leading-7 text-gray-700">
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
                  { ...partnerAssets.ORIX, size: "h-6", opacity: "opacity-90" },
                ]}
              />
              <CardFooterNote>
                추천 고객: 차량(장비) 구입 초기 비용 절감 목적 개인 및 법인
              </CardFooterNote>
            </div>

            <div className={`${cardBase} flex flex-col h-full`}>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 border border-orange-100">
                <Check className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                리스 (개인_개별협회 전용 상품)
              </h3>
              <p className="mt-2 text-sm md:text-base leading-7 text-gray-600 break-keep">
                (주)롯데오토리스와 협업으로 개인(개별)화물협회 전용 우대 조건을 제공합니다.
              </p>
              <ul className="mt-4 space-y-2 text-sm md:text-base leading-7 text-gray-700">
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
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t border-gray-100">
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
            <div className="md:col-span-4 relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 w-full h-full">
              <div className="relative w-full h-full flex flex-col">
                <div className="text-xs font-medium tracking-[0.12em] uppercase text-gray-500 mb-3">협약 네트워크(지도)</div>
                <div className="relative w-full flex-1 min-h-[190px]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[85%] max-w-[380px] mx-auto">
                      <svg viewBox="0 0 240 170" className="w-full h-auto" aria-label="South Korea map">
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
                          cx="108"
                          cy="164"
                          rx="12"
                          ry="5.5"
                          fill="rgba(15,23,42,0.06)"
                          stroke="rgba(15,23,42,0.18)"
                          strokeWidth="1.4"
                        />

                        {[
                          { x: 132, y: 42, label: "서울", tx: 14, ty: 4 },
                          { x: 165, y: 84, label: "경북", tx: 14, ty: 4 },
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
                <div className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                  * 지도는 협약 네트워크 위치를 설명하기 위한 시각화입니다.
                </div>
              </div>
            </div>

            <div className="md:col-span-8 w-full h-full">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 w-full h-full">
                <div className="flex flex-wrap gap-2 w-full mb-4">
                  {[
                    { label: "서울", sub: "협회 MOU" },
                    { label: "광주", sub: "협회 MOU" },
                    { label: "경북", sub: "협회 MOU" },
                  ].map((x) => (
                    <span
                      key={x.label}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-gray-200 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                    >
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
                      <span className="text-sm font-semibold text-navy-900">{x.label}</span>
                      <span className="text-xs font-medium text-gray-500">{x.sub}</span>
                    </span>
                  ))}
                </div>

                <div className="text-sm font-semibold text-navy-900">협약 구조 (운영 방식)</div>
                <div className="mt-3 space-y-2 text-sm text-gray-700 leading-relaxed">
                  <div className="flex gap-2">
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span>
                      <b className="text-navy-900">지역 협회</b>를 통해 대상 고객(개별/개인)을 확보하고,
                      신청–서류–심사 흐름을 표준화합니다.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span>
                      <b className="text-navy-900">RNF KOREA</b>는 상품 안내/조건 비교/서류 준비를 지원하여 진행 속도와 승인 가능성을 높입니다.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-2 font-semibold text-navy-900">
                        <span>롯데오토리스</span>
                      </span>
                      <span>는 최종 심사 및 계약을 수행합니다.</span>
                      <span className="text-gray-500 font-medium text-xs">(금리·한도·기간은 금융사 기준으로 확정)</span>
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-gray-400">* 협약 지역은 지속 확대 예정입니다.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-t border-gray-100">
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
