import React from "react";
import { Link } from "react-router-dom";
import { Phone, Truck, Check } from "lucide-react";


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
    <section className="pt-12 pb-8 md:pt-14 md:pb-10">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-7">
            <div className="text-sm text-gray-500">
              <Link to="/" className="hover:text-orange-500 transition-colors">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-700 font-semibold">노후장비 수출사업</span>
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


const ExportOverviewPage: React.FC = () => {
  const card =
    "border border-gray-200 rounded-2xl bg-white p-6 " +
    "shadow-[0_10px_30px_rgba(15,23,42,0.06)]";

  // ✅ 동일 높이 + 내부 요소 정렬을 위해 flex + h-full 사용
  const stepCard =
    "relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 " +
    "shadow-sm hover:shadow-md transition-all h-full flex flex-col";

  const iconWrap =
    "h-11 w-11 rounded-2xl border border-gray-200 bg-white flex items-center justify-center shadow-sm";

  // ✅ 밸류체인 카드 하단 영역(로고/전화) 높이 고정 (3카드 완전 동일)
  const bottomBar = "mt-auto pt-4 border-t border-gray-100 min-h-[56px] flex items-center";

  return (
    <div className="space-y-12">
      {/* ===================== PAGE HEADER ===================== */}
      <div className="border-b border-gray-200 pb-8">
        <PageHero
          eyebrow="Export Business"
          title="노후장비 수출사업"
          description="한국에서 노후 디젤 지게차를 매입하고, 정비·등급화(A/B/C)한 뒤 신흥국 산업 현장에 안정적으로 공급합니다. “정비 완료 + 부품 패키지”로 품질 불균형 시장을 정면 공략합니다."
          right={
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/export-shop"
                className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow aspect-square"
                aria-label="수출용 쇼핑몰(매물) 보기"
              >
                <div className="h-full flex flex-col">
                  <div className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                    Export Shop
                  </div>

                  <div className="mt-3 text-lg md:text-xl font-semibold leading-[1.2] text-navy-900 break-keep">
                    수출용 쇼핑몰 보기
                  </div>

                  <p className="mt-3 text-sm leading-6 text-gray-600 break-keep">
                    정비·등급화된 매물을 바로 확인할 수 있습니다.
                  </p>

                  <div className="mt-auto pt-4">
                    <div className="inline-flex items-center justify-center px-4 py-2 rounded-2xl bg-orange-500 text-white font-semibold text-sm shadow-sm whitespace-nowrap">
                      쇼핑몰 바로가기 →
                    </div>
                    <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                    </div>
                  </div>
                </div>
              </Link>

              <div className="rounded-3xl border border-gray-200 bg-[#f7f4ee] p-4 md:p-5 shadow-sm aspect-square">
                <div className="h-full flex flex-col">
                  <div className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                    Partner Network
                  </div>

                  <div className="mt-3 text-lg md:text-xl font-semibold leading-6 text-navy-900 break-keep">
                    이 사업은 (주)크린어스와 함께합니다
                  </div>

                

                  <div className="mt-auto pt-4 space-y-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src="/logo/cleanearth.png"
                        alt="(주)크린어스 로고"
                        className="h-8 w-auto object-contain"
                        loading="lazy"
                      />
                    </div>

                    <a
                      href="http://www.cleanearth.kr/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all w-full whitespace-nowrap"
                      title="(주)크린어스 홈페이지로 이동"
                    >
                      파트너사 홈페이지 →
                    </a>

                    <div className="text-[11px] text-gray-500 leading-relaxed">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          } 
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-12">

      {/* ===================== 시장 개요 ===================== */}
      <section className="space-y-6">
        <SectionHeader
          eyebrow="Market Overview"
          title="시장 개요"
          description="국내는 환경규제 강화로 노후 디젤 장비 교체가 가속화되고, 신흥국은 제조·물류 인프라 확대로 지게차 수요가 증가합니다."
        />

        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
            <div className="text-xs font-extrabold tracking-wider text-blue-600 mb-3">
              STEP 1 · 국내 공급
            </div>
            <h3 className="text-lg font-extrabold text-navy-900 mb-3">
              연간 약 1만 대 폐차 대상 발생
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm">
              국내에서 매년 약 1만 대 이상의 노후 지게차가 교체 또는 폐차 대상으로 분류됩니다.
              단순 폐기 시 자원 손실과 비용 부담이 발생합니다.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-orange-400 bg-orange-50 p-6 shadow-md hover:shadow-lg transition-all">
            <div className="text-xs font-extrabold tracking-wider text-orange-600 mb-3">
              STEP 2 · RNF 재상품화
            </div>
            <h3 className="text-lg font-extrabold text-navy-900 mb-3">
              정비 · 등급화 · 수출 표준화
            </h3>
            <p className="text-gray-700 leading-relaxed text-sm">
              전문 정비(PDI) 및 등급화를 통해 수출 가능한 상품으로 재탄생시킵니다.
              가격 경쟁력과 품질 신뢰를 동시에 확보합니다.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
            <div className="text-xs font-extrabold tracking-wider text-green-600 mb-3">
              STEP 3 · 해외 수요
            </div>
            <h3 className="text-lg font-extrabold text-navy-900 mb-3">
              신흥국 산업·물류 인프라 확대
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm">
              제조 및 물류 인프라가 빠르게 성장하는 신흥국 시장에 재공급함으로써
              자원 재생·순환 경제에 기여하는 수출 모델을 구축합니다.
            </p>
            <div className="mt-5 flex items-center gap-2 text-green-600 text-sm font-bold">
              <span className="text-base">♻</span>
              자원 재생 · 순환 경제 기여
            </div>
          </div>
        </div>
      </section>

      {/* ===================== 수출 대상 장비 ===================== */}
      <section className="space-y-6">
        <SectionHeader
          eyebrow="Export Scope"
          title="수출 대상 장비"
          description="국내 사용/유통이 제한된 장비에 새로운 생명력을 부여합니다."
        />

        <div className="grid md:grid-cols-4 gap-4">
          {[
            ["연식", "8년~15년"],
            ["엔진", "디젤"],
            ["톤수", "2.5~7톤"],
            ["브랜드", "현대/두산 중심"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-xs font-extrabold text-gray-500">{k}</div>
              <div className="mt-2 text-lg font-extrabold text-navy-900">{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="text-sm font-extrabold text-navy-900">등급 체계</div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            A/B/C 등급으로 상태를 표준화하고, 정비 리포트/부품 패키지로 “품질 불균형” 문제를 줄입니다.
          </p>
        </div>
      </section>

      {/* ===================== 정비/부품 패키지 ===================== */}
      <section className="space-y-6">
        <SectionHeader
          eyebrow="Service Package"
          title="정비 패키지 & 부품 패키지"
          description="“장비만”이 아니라, 운영 가능 상태로 납품하는 구조입니다."
        />

        <div className="grid md:grid-cols-2 gap-6">
          <div className={card}>
            <div className="text-lg font-extrabold text-navy-900">정비 패키지(예시)</div>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• Basic: 엔진/미션/누유 기본 점검</li>
              <li>• Standard: 유압·브레이크·마스트·전장 (+$700)</li>
              <li>• Premium: 도장·오버홀 (+$1,500)</li>
            </ul>
          </div>

          <div className={card}>
            <div className="text-lg font-extrabold text-navy-900">부품 패키지(예시)</div>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• 소모품 패키지 (+$1,000)</li>
              <li>• 타이어 패키지 (+$600)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== 밸류체인 ===================== */}
<section className="space-y-6">
  <SectionHeader
    eyebrow="Value Chain"
    title="운영 구조(밸류체인)"
    description="매입 → 정비/상품화 → 수출/계약/물류를 하나의 파이프라인으로 묶어 리드타임과 품질 리스크를 줄입니다."
  />

  <div className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
    {/* DESKTOP CONNECTOR */}
    <div className="relative hidden md:block mb-6">
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

    {/* CARDS */}
    <div className="grid md:grid-cols-3 gap-4 items-stretch">
      {/* STEP 1 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm">
            <span className="text-xl">🧲</span>
          </div>
          <div>
            <div className="text-xs font-extrabold text-gray-500">STEP 1</div>
            <div className="text-lg font-extrabold text-navy-900">매입</div>
          </div>
        </div>

        <div className="mt-5 text-base font-extrabold text-navy-900">
          (주)크린어스
        </div>

        <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed">
          <li>• 수출 가능 물량 선별</li>
          <li>• 매입 및 인수 절차 관리</li>
          <li>• 입고 스케줄 통합 관리</li>
        </ul>

        <div className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
          국내 공급 파트너
        </div>
      </div>

      {/* STEP 2 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm">
            <span className="text-xl">🛠️</span>
          </div>
          <div>
            <div className="text-xs font-extrabold text-gray-500">STEP 2</div>
            <div className="text-lg font-extrabold text-navy-900">정비 / 상품화</div>
          </div>
        </div>

        <div className="mt-5 text-base font-extrabold text-navy-900">
          현대지게차경기북부판매 (형제중기)
        </div>

        <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed">
          <li>• A/B/C 등급 구분</li>
          <li>• PDI 및 리컨디션</li>
          <li>• 품질 리포트 및 부품 패키지 구성</li>
        </ul>

        <div className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
          정비 및 품질 관리 파트너
        </div>
      </div>

      {/* STEP 3 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm">
            <span className="text-xl">🚢</span>
          </div>
          <div>
            <div className="text-xs font-extrabold text-gray-500">STEP 3</div>
            <div className="text-lg font-extrabold text-navy-900">수출 / 계약 / 물류</div>
          </div>
        </div>

        <div className="mt-5 text-base font-extrabold text-navy-900">
          RNF KOREA
        </div>

        <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed">
          <li>• 해외 바이어 개발</li>
          <li>• 계약 및 수출 서류 관리</li>
          <li>• 선적 및 클레임 대응</li>
        </ul>

        <div className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
          수출 총괄 운영
        </div>
      </div>
    </div>

    {/* MOBILE CONNECTOR */}
    <div className="md:hidden mt-6 flex flex-col items-center gap-4">
      <div className="w-[2px] h-8 bg-gray-200" />
      <div className="flex gap-2">
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
      </div>
      <div className="w-[2px] h-8 bg-gray-200" />
    </div>

    {/* KPI STRIP */}
    <div className="mt-8 grid md:grid-cols-3 gap-4">
      {[
        ["리드타임", "입고 → 선적", "프로세스 표준화"],
        ["품질", "A/B/C 등급 판정 및 상품화", "정비 리포트 제공"],
        ["신뢰", "부품 패키지 포함", "운영 가능 상태 납품"],
      ].map(([k, v, d]) => (
        <div key={k} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 h-full">
          <div className="text-xs font-extrabold text-gray-500">{k}</div>
          <div className="mt-1 text-sm font-extrabold text-navy-900">{v}</div>
          <div className="mt-1 text-xs text-gray-600">{d}</div>
        </div>
      ))}
    </div>
  </div>
</section>

      {/* ===================== 3개년 로드맵 ===================== */}
      <section className="space-y-6">
        <SectionHeader
          eyebrow="Roadmap"
          title="3개년 확장 로드맵"
        />

        <div className="grid md:grid-cols-3 gap-6">
          {[
            ["[1년차]", "150대/y", "표준화/레퍼런스 확보, 핵심 거래선 구축"],
            ["[2년차]", "300대/y", "현지 파트너십 확장, 운영 효율화"],
            ["[3년차]", "800대/y", "수출국 확대/거점센터, 품목 확장"],
          ].map(([y, n, d]) => (
            <div key={y} className={card}>
              <div className="text-sm font-extrabold text-gray-500">{y}</div>
              <div className="mt-2 text-2xl font-extrabold text-navy-900">{n}</div>
              <div className="mt-3 text-sm text-gray-600 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== (하단) 상담 폼으로 유도 ===================== */}
      <section className="border-t border-gray-200 pt-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
            <div className="space-y-2">
              <div className="text-sm font-extrabold text-navy-900">문의 안내</div>
              <p className="text-sm text-gray-600 leading-relaxed">
                수출 대상 장비(톤수/연식/수량)와 희망 선적 조건을 알려주시면,
                정비 등급/부품 패키지 포함 견적과 리드타임을 함께 제안드립니다.
              </p>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("catalog-form");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-orange-500 text-white font-extrabold hover:bg-orange-600 transition-all"
              >
                상담/견적 폼으로 이동 →
              </button>
            </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
};

export default ExportOverviewPage;
