import React from "react";
import PageHeader from "../components/PageHeader";
import { Link } from "react-router-dom";

type CompareRow = {
  title: string;
  installment: string[];
  lease: string[];
};

const cardBase =
  "border border-gray-200 rounded-2xl bg-white p-6 " +
  "shadow-[0_10px_30px_rgba(15,23,42,0.06)] " +
  "hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:border-gray-300 transition-all";

const chip =
  "inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold " +
  "bg-orange-50 text-orange-700 border border-orange-200";

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2 text-sm text-gray-700 leading-relaxed">
    <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
    <div>{children}</div>
  </div>
);



const CompareCard: React.FC<{ rows: CompareRow[] }> = ({ rows }) => (
  <div className={`${cardBase}`}>
    <div className="flex items-start gap-3">
      <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900">
          할부 vs 리스 비교 (예시)
        </h2>
        <p className="text-gray-600 mt-2 max-w-3xl">
          “즉시 소유권”이 필요한지, “월 비용/초기부담”을 우선할지에 따라 선택이 달라집니다.<br/>
          (실제 조건은 심사/차종/기간/잔존가치에 따라 달라질 수 있습니다.)
        </p>
      </div>
    </div>

    <div className="mt-6 grid md:grid-cols-2 gap-4">
      {rows.map((r) => (
        <div key={r.title} className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-lg font-extrabold text-navy-900">{r.title}</div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-extrabold text-gray-700">할부금융</div>
              <div className="mt-2 space-y-2">
                {r.installment.map((x, i) => (
                  <div key={i} className="text-sm text-gray-700 leading-relaxed">
                    • {x}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-extrabold text-gray-700">리스(운용)</div>
              <div className="mt-2 space-y-2">
                {r.lease.map((x, i) => (
                  <div key={i} className="text-sm text-gray-700 leading-relaxed">
                    • {x}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 text-[11px] text-gray-400 leading-relaxed">
            * 예시 근거: 리스는 초기비용 X 및 월 비용 절감,
            잔존가치(예: 최대 37%) 구조 가능.
          </div>
        </div>
      ))}
    </div>
  </div>
);

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
        "명의: 이용자 / 취득: 금융사 (리스사 소유 구조)",
        "초기비용 X",
        "정비·보험 패키지 옵션 가능",
      ],
    },
    {
      title: "월 상환액 비교 (예시)",
      installment: [
        "월 193만원 수준 (예시)",
        "대출원금 9,994만원 / 60개월 / 연 6.0% (예시)",
      ],
      lease: [
        "월 159만원 수준 (예시)",
        "월 비용 약 20% 절감 효과 (예시)",
        "만기시 반납/인수 선택, 잔존가치 구조(예: 최대 37%)",
      ],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16 space-y-12">
      {/* ✅ 타이어/배터리와 동일한 큰 제목 스타일 */}
      <PageHeader
        current="개인(개별)화물협회 금융상품"
        title="개인(개별)화물협회 전용 금융상품"
        desc="협회 회원 전용 조건으로, 초기 부담을 낮추고 운행 수익성 중심의 조달 구조(할부/리스)를 제안합니다."
      />

{/* ===== Partner Banner (롯데오토리스) ===== */}
<section className="rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
  <div className="flex flex-col md:flex-row items-center justify-between gap-6">

    {/* LEFT */}
    <div className="flex flex-col justify-center text-center md:text-left">
      <div className="text-xs font-extrabold text-gray-500 tracking-widest">
        OFFICIAL FINANCE PARTNER
      </div>

      <div className="mt-2 text-xl md:text-2xl font-extrabold text-navy-900">
        롯데오토리스 협회 전용 금융상품
      </div>

      <div className="mt-2 text-sm text-gray-600 max-w-lg">
        본 상품은 롯데오토리스와 협회 간 협약을 기반으로 제공되는
        회원 전용 금융 구조입니다.
      </div>
    </div>

    {/* RIGHT - 로고 */}
    <div className="flex items-center justify-center">
      <img
        src="/logo/lotte.jpg"
        alt="롯데오토리스"
        className="h-20 md:h-24 object-contain"
      />
    </div>

  </div>
</section>

      {/* Hero / Partnership */}
      <section className={`${cardBase} overflow-hidden`}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="min-w-0">
            <div className={chip}>회원 전용 파트너십</div>

            <div className="mt-3 text-2xl md:text-3xl font-extrabold text-navy-900 leading-tight">
              협회 회원님만을 위한 특별한 파트너십으로
              <br className="hidden md:block" />
              운영 부담은 낮추고, 수익 기회는 높이고, 복지는 더 풍성하게
            </div>

            <div className="mt-4 space-y-2">
              <Bullet>
                오직 회원님께만 드리는 <b className="text-navy-900">전용 금융 솔루션</b>
              </Bullet>
              <Bullet>
                수익을 연결하는 <b className="text-navy-900">비즈니스 네트워크</b>
              </Bullet>
              <Bullet>
                함께 나누는 <b className="text-navy-900">상생 장학금</b>
              </Bullet>
              <Bullet>
                협회와 함께하는 <b className="text-navy-900">밀착 복지 지원</b>
              </Bullet>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className={chip}>금융 혜택</span>
              <span className={chip}>일감/네트워크</span>
              <span className={chip}>복지/장학</span>
              <span className={chip}>회원 전용</span>
            </div>
          </div>

          <div className="shrink-0 w-full md:w-[360px]">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-sm font-extrabold text-gray-700">추가 혜택 (회원 한정)</div>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <div>• 차량 소모품(타이어/엔진오일) 특별가 제공</div>
                <div>• 롯데오토리스 이용 회원: 협회비 1년 지원</div>
              </div>
              <div className="mt-3 text-[11px] text-gray-400">
                * 협회/금융사 운영 정책에 따라 세부 조건은 변경될 수 있습니다.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className={`${cardBase}`}>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900">
              진행 방식
            </h2>
            <p className="text-gray-600 mt-2 max-w-3xl">
              협회 회원 확인 → 조건 비교(할부/리스) → 서류 준비 → 심사/계약까지, RNF가 진행을
              빠르게 정리해드립니다.
            </p>
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-500">Step 1</div>
            <div className="mt-1 text-lg font-extrabold text-navy-900">회원 확인</div>
            <div className="mt-2 text-sm text-gray-600 leading-relaxed">
              협회 회원 여부 및 기본 조건(차종/기간/희망 월 납입)을 먼저 정리합니다.
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-500">Step 2</div>
            <div className="mt-1 text-lg font-extrabold text-navy-900">할부 vs 리스 비교</div>
            <div className="mt-2 text-sm text-gray-600 leading-relaxed">
              초기비용/월 비용/소유권/세무처리 관점에서 가장 현실적인 옵션을 선택합니다.
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-extrabold text-gray-500">Step 3</div>
            <div className="mt-1 text-lg font-extrabold text-navy-900">심사/계약</div>
            <div className="mt-2 text-sm text-gray-600 leading-relaxed">
              서류 접수 후 금융사 심사 → 계약 확정(금리/한도/기간/잔존가치 등) 순서로 진행됩니다.
            </div>
          </div>
        </div>
      </section>

      {/* Compare */}
<CompareCard rows={compareRows} />

{/* ===================== MOU 섹션 (Finance에서 이동) ===================== */}
<section className={cardBase}>
  <div className="flex items-start justify-between">
    <div className="flex items-start gap-3">
      <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
          MOU 협약 개인(개별)화물협회
        </h2>
        <p className="text-gray-600 mt-2 leading-relaxed">
          지역 협회와의 협약을 기반으로 금융 지원을 제공합니다.
        </p>
      </div>
    </div>

    <div className="mt-1 shrink-0">
      <span className="inline-flex items-center px-4 py-2 rounded-full bg-orange-50 text-orange-600 text-sm font-extrabold border border-orange-200">
        3개 시도 협약 완료
      </span>
    </div>
  </div>

  <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-4 w-full items-stretch">
    {/* LEFT: Map */}
    <div className="md:col-span-4 relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 w-full h-full">
      <div className="relative w-full h-full flex flex-col">
        <div className="text-xs font-extrabold text-gray-500 mb-3">
          협약 네트워크(지도)
        </div>

        <div className="relative w-full flex-1 min-h-[190px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[85%] max-w-[380px] mx-auto">
              <svg viewBox="0 0 240 170" className="w-full h-auto" aria-label="South Korea map">
                <path
                  d="
                    M126 10
                    C112 14,103 24,102 38
                    C101 50,92 62,88 78
                    C84 95,78 112,86 126
                    C96 145,115 156,134 160
                    C153 164,170 158,182 146
                    C192 135,198 120,192 104
                    C187 90,197 82,198 66
                    C199 50,189 38,178 30
                    C168 22,154 12,126 10 Z
                  "
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

                {(() => {
                  const SEOUL = { x: 132, y: 42, label: "서울", tx: 14, ty: 4 };
                  const GYEONGBUK = { x: 165, y: 84, label: "경북", tx: 14, ty: 4 };
                  const GWANGJU = { x: 118, y: 112, label: "광주", tx: 14, ty: 4 };

                  const PushPin = ({
                    x,
                    y,
                    label,
                    tx,
                    ty,
                  }: {
                    x: number;
                    y: number;
                    label: string;
                    tx: number;
                    ty: number;
                  }) => (
                    <g>
                      <circle cx={x} cy={y} r="7" fill="rgb(239,68,68)" />
                      <circle cx={x - 2.2} cy={y - 2.5} r="2.2" fill="rgba(255,255,255,0.55)" />
                      <path
                        d={`
                          M ${x + 1.2} ${y + 6}
                          L ${x - 1.2} ${y + 6}
                          L ${x - 0.3} ${y + 26}
                          L ${x + 0.3} ${y + 26}
                          Z
                        `}
                        fill="rgba(148,163,184,0.95)"
                      />
                      <path
                        d={`
                          M ${x + 0.35} ${y + 26}
                          L ${x} ${y + 31}
                          L ${x - 0.35} ${y + 26}
                          Z
                        `}
                        fill="rgba(100,116,139,0.95)"
                      />
                      <text x={x + tx} y={y + ty} fontSize="12" fontWeight="800" fill="rgb(15,23,42)">
                        {label}
                      </text>
                    </g>
                  );

                  return (
                    <>
                      <PushPin {...SEOUL} />
                      <PushPin {...GYEONGBUK} />
                      <PushPin {...GWANGJU} />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-gray-400 leading-relaxed">
          * 지도는 협약 네트워크 위치를 설명하기 위한 시각화입니다.
        </div>
      </div>
    </div>

    {/* RIGHT: Structure */}
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
              <span className="text-sm font-extrabold text-navy-900">{x.label}</span>
              <span className="text-xs font-bold text-gray-500">{x.sub}</span>
            </span>
          ))}
        </div>

        <div className="text-sm font-extrabold text-navy-900">협약 구조 (운영 방식)</div>

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
              <b className="text-navy-900">RNF KOREA</b>는 상품 안내/조건 비교/서류 준비를 지원하여
              진행 속도와 승인 가능성을 높입니다.
            </span>
          </div>

          <div className="flex gap-2">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-2 font-extrabold text-navy-900">
                <span>롯데오토리스</span>
              </span>
              <span>는 최종 심사 및 계약을 수행합니다.</span>
              <span className="text-gray-500 font-bold text-xs">(금리·한도·기간은 금융사 기준으로 확정)</span>
            </span>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-gray-400">
          * 협약 지역은 지속 확대 예정입니다.
        </div>
      </div>
    </div>
  </div>
</section>

      {/* CTA */}
      <section className="rounded-3xl border border-gray-200 bg-[#0a192f] p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="min-w-0">
            <div className="text-white text-2xl md:text-3xl font-extrabold">
              협회 전용 조건으로 견적/조건 비교 받기
            </div>
            <div className="mt-2 text-gray-300 leading-relaxed">
              차량/기간/희망 월 납입 기준으로 할부/리스 조건을 빠르게 비교해드립니다.
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <a
              href="tel:1551-1873"
              className="
                inline-flex items-center justify-center
                h-12 px-6 rounded-2xl
                bg-orange-500 text-white font-extrabold
                hover:bg-orange-600 transition-all
              "
            >
              전화 상담 1551-1873
            </a>

            <Link
              to="/finance"
              className="
                inline-flex items-center justify-center
                h-12 px-6 rounded-2xl
                bg-white text-navy-900 font-extrabold
                hover:bg-gray-100 transition-all
              "
            >
              금융솔루션 페이지 보기
            </Link>
          </div>
        </div>

        <div className="mt-6 text-[11px] text-gray-300/80 leading-relaxed">
          * 본 페이지는 안내 목적이며, 최종 심사 및 계약 조건은 금융사 내부 기준에 따라 확정됩니다.
        </div>
      </section>
    </div>
  );
};

export default IndividualCargoFinancePage;