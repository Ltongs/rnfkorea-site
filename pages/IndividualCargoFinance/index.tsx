// pages/IndividualCargoFinance/index.tsx
import React from "react";
import PageHeader from "../../components/PageHeader";

const IndividualCargoFinancePage: React.FC = () => {
  // 공통 스타일(다른 페이지들과 톤 맞춤)
  const pill =
    "inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold " +
    "bg-orange-50 text-orange-700 border border-orange-100";

  const cardBase =
    "border border-gray-200 rounded-2xl bg-white p-6 " +
    "shadow-[0_10px_30px_rgba(15,23,42,0.06)]";

  const h2 =
    "text-xl md:text-2xl font-extrabold text-navy-900 tracking-tight";

  const p =
    "text-sm md:text-base text-gray-600 font-medium leading-relaxed";

  const li =
    "flex gap-3 items-start text-sm md:text-base text-gray-700 font-medium";

  const dot =
    "mt-[7px] h-2 w-2 rounded-full bg-orange-500 flex-none";

  return (
    <>
      {/* ✅ 헤더: props 절대 넘기지 마세요 (에러 원인) */}
      <PageHeader />

      <div className="container mx-auto px-4 py-16 space-y-12">
        {/* ========================= HERO ========================= */}
        <section className={`${cardBase} overflow-hidden`}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            <div className="min-w-0">
              <div className={pill}>경북개별화물협회 전용 금융서비스</div>

              <h1 className="mt-4 text-2xl md:text-4xl font-extrabold text-navy-900 leading-tight">
                개인(개별)화물협회 전용 금융상품
                <br className="hidden md:block" />
                초기 부담은 낮추고, 운행 수익성은 높이게
              </h1>

              <p className="mt-4 text-gray-600 font-medium leading-relaxed md:text-lg">
                협회 회원 전용 조건으로, 초기 부담을 낮추고 운행 수익성 중심의 조달 구조(할부/리스)를
                제안합니다. 상담부터 심사, 실행까지 RNF KOREA가 동행합니다.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="tel:1551-1873"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-navy-900 text-white font-extrabold text-sm md:text-base hover:opacity-90 transition"
                  title="상담전화 1551-1873"
                >
                  상담전화 1551-1873
                </a>

                <a
                  href="#consult"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-2xl border border-gray-300 bg-white text-navy-900 font-extrabold text-sm md:text-base hover:bg-gray-50 transition"
                >
                  상담 신청하기
                </a>

                <a
                  href="https://www.rnfkorea.co.kr/cargo-finance"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-2xl border border-orange-200 bg-orange-50 text-orange-700 font-extrabold text-sm md:text-base hover:opacity-90 transition"
                >
                  페이지 링크 열기
                </a>
              </div>
            </div>

            {/* 우측 카드(요약) */}
            <div className="w-full md:w-[360px] flex-none">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold text-navy-900">
                  한 번에 보는 전용 혜택
                </div>
                <div className="mt-4 space-y-3">
                  <div className={li}>
                    <span className={dot} />
                    <span>
                      협회 회원 전용 조건(가능 범위 내)로
                      <b className="text-navy-900"> 금리/보증/한도</b> 최적화
                    </span>
                  </div>
                  <div className={li}>
                    <span className={dot} />
                    <span>
                      초기 납입 부담 최소화 구조(상품별 상이)
                    </span>
                  </div>
                  <div className={li}>
                    <span className={dot} />
                    <span>
                      <b className="text-navy-900">차량/장비/운전자금</b> 상황별 맞춤 제안
                    </span>
                  </div>
                  <div className={li}>
                    <span className={dot} />
                    <span>서류/심사/실행까지 원스톱 지원</span>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <div className="text-xs font-extrabold text-gray-500">
                    안내
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-700">
                    실제 조건은 심사 결과 및 협약 내용에 따라 달라질 수 있습니다.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================= 상품 영역 ========================= */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className={cardBase}>
            <div className={pill}>조달</div>
            <div className="mt-3 text-lg font-extrabold text-navy-900">
              차량/장비 할부
            </div>
            <p className="mt-2 text-gray-600 font-medium">
              신차/중고차, 장비 구매에 대한 분할 납부 구조.
              조건은 차종/연식/신용/소득에 따라 달라집니다.
            </p>
          </div>

          <div className={cardBase}>
            <div className={pill}>운용</div>
            <div className="mt-3 text-lg font-extrabold text-navy-900">
              리스(금융/운용)
            </div>
            <p className="mt-2 text-gray-600 font-medium">
              초기 부담과 현금흐름을 고려한 운용 중심 구조.
              비용 처리/회계 관점도 함께 안내 가능합니다.
            </p>
          </div>

          <div className={cardBase}>
            <div className={pill}>유동성</div>
            <div className="mt-3 text-lg font-extrabold text-navy-900">
              운전자금/대환
            </div>
            <p className="mt-2 text-gray-600 font-medium">
              운행자금 확보 또는 기존 고금리 구조의 부담 완화 목적.
              상환 구조는 상황에 맞게 설계합니다.
            </p>
          </div>
        </section>

        {/* ========================= 진행 프로세스 ========================= */}
        <section className={cardBase}>
          <h2 className={h2}>진행 프로세스</h2>
          <p className={`mt-2 ${p}`}>
            상담 → 서류 안내 → 심사 → 조건 확정 → 실행 순으로 진행됩니다.
          </p>

          <div className="mt-6 grid md:grid-cols-5 gap-4">
            {[
              ["1", "상담 접수", "전화/온라인으로 기본 조건 확인"],
              ["2", "서류 안내", "필요 서류 체크리스트 제공"],
              ["3", "심사 진행", "금융사 심사 및 조건 산출"],
              ["4", "조건 확정", "월납/기간/구조 최종 조율"],
              ["5", "실행/출고", "계약 및 실행(출고/지급)"],
            ].map(([num, title, desc]) => (
              <div key={num} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-extrabold text-orange-700 bg-orange-50 border border-orange-100 inline-flex px-2 py-1 rounded-full">
                  STEP {num}
                </div>
                <div className="mt-3 font-extrabold text-navy-900">{title}</div>
                <div className="mt-2 text-sm text-gray-600 font-medium leading-relaxed">
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================= 필요 서류 ========================= */}
        <section className={cardBase}>
          <h2 className={h2}>기본 필요 서류 (예시)</h2>
          <p className={`mt-2 ${p}`}>
            상품/금융사/고객 상황에 따라 추가 서류가 요청될 수 있습니다.
          </p>

          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="font-extrabold text-navy-900">개인/개인사업자</div>
              <ul className="mt-4 space-y-3">
                <li className={li}><span className={dot} />신분증</li>
                <li className={li}><span className={dot} />사업자등록증(해당 시)</li>
                <li className={li}><span className={dot} />소득/매출 증빙(간편/정식)</li>
                <li className={li}><span className={dot} />협회 회원 확인(가능 시)</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="font-extrabold text-navy-900">법인</div>
              <ul className="mt-4 space-y-3">
                <li className={li}><span className={dot} />사업자등록증 / 법인등기</li>
                <li className={li}><span className={dot} />재무제표/부가세/매출 자료</li>
                <li className={li}><span className={dot} />대표자 신분/연대 관련 서류(필요 시)</li>
                <li className={li}><span className={dot} />협회/계약 관련 확인(가능 시)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ========================= 상담 섹션 ========================= */}
        <section id="consult" className={cardBase}>
          <h2 className={h2}>상담 신청</h2>
          <p className={`mt-2 ${p}`}>
            전화 상담이 가장 빠릅니다. 온라인 상담은 아래 링크로 접속해 주세요.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="tel:1551-1873"
              className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-navy-900 text-white font-extrabold text-sm md:text-base hover:opacity-90 transition"
            >
              1551-1873 전화하기
            </a>

            <a
              href="https://www.rnfkorea.co.kr/cargo-finance"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-5 py-3 rounded-2xl border border-gray-300 bg-white text-navy-900 font-extrabold text-sm md:text-base hover:bg-gray-50 transition"
            >
              온라인 상담 페이지 이동
            </a>
          </div>

          {/* QR 안내(이미지 파일 없이도 레이아웃 유지) */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="font-extrabold text-navy-900">전단용 QR 안내</div>
            <p className="mt-2 text-sm text-gray-600 font-medium">
              전단에는 아래 링크를 QR로 제작하여 넣으시면 됩니다:
            </p>
            <div className="mt-3 text-sm font-extrabold text-orange-700 break-all">
              https://www.rnfkorea.co.kr/cargo-finance
            </div>
            <p className="mt-2 text-xs text-gray-500 font-medium">
              (QR 이미지는 별도 생성본을 사용하세요. 스캔 인식이 안 되면 여백/대비/오류정정 레벨을 조정해야 합니다.)
            </p>
          </div>
        </section>
      </div>
    </>
  );
};

export default IndividualCargoFinancePage;