// components/RepaymentScheduleCapture.tsx
// 상환표 문자(MMS) 발송용 캡처 화면 — 현대건기(부산경남)·현대지게차 경기북부·태산통운 페이지가 함께 쓴다.
// 견적서 페이지의 할부견적서 PDF(QuotationPage buildInstallmentHTML)와 같은 양식:
//   남색 머리글 → 인사말 → 조건 요약 + 월 납입액 → 월별 상환 스케줄(25개월 이상은 첫·마지막 12개월만) → 남색 꼬리말
// 각 페이지의 발송 버튼이 이 요소(ref)를 복제해 폭 560px로 html2canvas 캡처한다. 폭을 바꾸면 캡처 코드도 함께 바꿔야 한다.
import React, { forwardRef } from "react";

export type RepaymentRow = {
  no: number; date: string; payment: number; principalPmt: number; interest: number; balance: number;
};

type Props = {
  subtitle: string;          // 예: "현대건기(부산경남) 할부금융"
  recipient?: string;        // 수신인 (입력한 경우만 "○○ 귀중")
  customer: string;          // 고객명
  principal: number;
  annualRate: number;
  periodLabel: string;
  gracePeriod: number;
  financeCompany: string;
  payment: number;
  rows: RepaymentRow[];
};

const EDGE = 12; // 기간이 길면 첫·마지막 12개월만 표시
const NAVY = "#0a192f";
const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const RepaymentScheduleCapture = forwardRef<HTMLDivElement, Props>(function RepaymentScheduleCapture(
  { subtitle, recipient, customer, principal, annualRate, periodLabel, gracePeriod, financeCompany, payment, rows }, ref,
) {
  const skip = rows.length > EDGE * 2 + 1;
  const shown = skip ? [...rows.slice(0, EDGE), null, ...rows.slice(-EDGE)] : rows;
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const totalPayment = rows.reduce((s, r) => s + r.payment, 0);

  // 표 글자는 좌우·상하 가운데, 줄 높이 px 고정 (캡처 시 글자가 칸 아래로 처지지 않게)
  const td: React.CSSProperties = { height: "20px", padding: "0 6px", lineHeight: "20px", fontSize: "10.5px", borderBottom: "1px solid #eef2f7", textAlign: "center", verticalAlign: "middle" };
  const info: [string, string][] = [
    ["고객명", customer || "-"],
    ["할부원금", `${fmt(principal)}원`],
    ["금융사", financeCompany || "-"],
    ["연이율", `${annualRate}%`],
    ["대출기간", periodLabel],
    ["총 이자", `${fmt(totalInterest)}원`],
  ];

  return (
    <div ref={ref} style={{ fontFamily: "'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif", background: "#fff", color: "#1e293b", width: "560px", lineHeight: 1.4 }}>
      {/* 머리글 */}
      <div style={{ background: NAVY, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: "18px", fontWeight: 800 }}>RNF KOREA</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#f97316", fontSize: "17px", fontWeight: 800 }}>할부 상환스케줄</div>
          <div style={{ color: "#94a3b8", fontSize: "10px", marginTop: "2px" }}>{subtitle} · {today()}</div>
        </div>
      </div>

      <div style={{ padding: "16px 22px 12px" }}>
        {recipient && <p style={{ fontSize: "13px", margin: "0 0 6px" }}><strong style={{ color: NAVY }}>{recipient}</strong> 귀중,</p>}
        <p style={{ fontSize: "11.5px", color: "#374151", margin: "0 0 12px", lineHeight: 1.6 }}>
          안녕하세요. 주식회사 알앤에프코리아입니다.<br />요청하신 할부 상환스케줄을 안내드립니다.
        </p>

        {/* 조건 요약 + 월 납입액 */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <div style={{ flex: 1, background: "#f1f5f9", borderRadius: "8px", padding: "10px 14px" }}>
            {info.map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "11px" }}>
                <span style={{ color: "#64748b" }}>{l}</span>
                <span style={{ color: "#0f172a", textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ width: "170px", background: NAVY, borderRadius: "8px", padding: "10px 14px", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "right" }}>
            <div style={{ fontSize: "10.5px", color: "#94a3b8", marginBottom: "4px" }}>{gracePeriod > 0 ? "거치 후 월 납입액" : "월 납입액"}</div>
            <div style={{ fontSize: "21px", fontWeight: 800, color: "#f97316", lineHeight: 1.15 }}>{fmt(payment)}<span style={{ fontSize: "12px" }}>원</span></div>
            {gracePeriod > 0 && <div style={{ fontSize: "9.5px", color: "#94a3b8", marginTop: "4px" }}>거치 {gracePeriod}개월은 이자만 납입</div>}
          </div>
        </div>

        {/* 월별 상환 스케줄 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 0 5px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: NAVY }}>월별 상환 스케줄</span>
          <span style={{ fontSize: "9.5px", color: "#94a3b8" }}>{skip ? `첫 ${EDGE}개월 · 마지막 ${EDGE}개월 표시 (합계는 전체 기간)` : `전체 ${rows.length}개월`}</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["회차", "납입일", "월납입액", "원금", "이자", "잔액"].map((h) => (
                <th key={h} style={{ background: NAVY, color: "#fff", height: "24px", padding: "0 6px", lineHeight: "24px", fontSize: "10px", fontWeight: 600, textAlign: "center", verticalAlign: "middle" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => row === null ? (
              <tr key="skip">
                <td colSpan={6} style={{ ...td, color: "#94a3b8", borderBottom: "none" }}>
                  ⋮ {rows[EDGE].no}회차 ~ {rows[rows.length - EDGE - 1].no}회차 ({rows.length - EDGE * 2}개월) 생략 ⋮
                </td>
              </tr>
            ) : (
              <tr key={row.no} style={{ background: i % 2 ? "#f8fafc" : "#fff", color: row.principalPmt === 0 ? "#94a3b8" : undefined }}>
                <td style={td}>{row.no}</td>
                <td style={{ ...td, color: "#64748b" }}>{row.date}</td>
                <td style={{ ...td, fontWeight: 600 }}>{fmt(row.payment)}</td>
                <td style={td}>{fmt(row.principalPmt)}</td>
                <td style={{ ...td, color: "#64748b" }}>{fmt(row.interest)}</td>
                <td style={td}>{fmt(row.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#e2e8f0", fontWeight: 700 }}>
              <td colSpan={2} style={{ ...td, borderTop: "2px solid #94a3b8" }}>합계</td>
              <td style={{ ...td, borderTop: "2px solid #94a3b8" }}>{fmt(totalPayment)}</td>
              <td style={{ ...td, borderTop: "2px solid #94a3b8" }}>{fmt(principal)}</td>
              <td style={{ ...td, borderTop: "2px solid #94a3b8" }}>{fmt(totalInterest)}</td>
              <td style={{ ...td, borderTop: "2px solid #94a3b8" }}>0</td>
            </tr>
          </tfoot>
        </table>
        <p style={{ margin: "8px 0 0", fontSize: "9.5px", color: "#64748b" }}>
          ※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다.{skip ? " 전체 회차 내역은 요청 시 PDF로 보내드립니다." : ""}
        </p>
      </div>

      {/* 꼬리말 */}
      <div style={{ background: NAVY, padding: "10px 22px", textAlign: "center" }}>
        <div style={{ color: "#fff", fontSize: "11px", fontWeight: 700 }}>주식회사 알앤에프코리아</div>
        <div style={{ color: "#94a3b8", fontSize: "9.5px", marginTop: "2px" }}>TEL: 1551-1873 | rnfkorea.co.kr</div>
      </div>
    </div>
  );
});

export default RepaymentScheduleCapture;
