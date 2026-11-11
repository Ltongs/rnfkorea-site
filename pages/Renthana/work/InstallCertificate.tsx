// pages/Renthana/work/InstallCertificate.tsx — 타이어 장착확인서 + 품질보증 안내(A4 2쪽) 자동 작성
// 양식 원본: 바탕화면 "타이어_설치확인서_품질보증서_원본.html" (서명란은 요청에 따라 삭제)
// 케이스 기본정보로 채울 수 있는 칸(차량번호·제조사·규격·수량·장착일·장착점)만 채우고,
// 작업 확인 체크·연락처·주소처럼 RNF가 모르는 칸은 비워 둔다.
// 팩스는 흑백이라 배경색은 옅게, 글자·선은 진하게 둔다.
import React from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "../../../lib/html2canvas";
import jsPDF from "jspdf";

export type CertificateData = {
  caseNo: string | null;
  customerName: string;
  companyName: string | null;
  vehicleNo: string | null;
  tireSpec: string | null;
  qtyFront: number | null;
  qtyRear: number | null;
  installDate: string | null; // YYYY-MM-DD
  installShop: string | null;
};

const PAGE_W = 794;   // A4 @96dpi
const PAGE_H = 1123;

const css = `
.ric-page { width:${PAGE_W}px; height:${PAGE_H}px; padding:49px 53px; background:#fff; color:#111; box-sizing:border-box;
  font-family:"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif; font-size:12.8px; line-height:1.45; }
.ric-page * { box-sizing:border-box; }
.ric-head { border-bottom:3px solid #1f3a68; padding-bottom:9px; margin-bottom:19px; }
.ric-head h1 { font-size:28px; margin:0; letter-spacing:1px; color:#1f3a68; font-weight:800; }
.ric-page h2 { font-size:14.7px; margin:22px 0 8px; color:#1f3a68; font-weight:700; display:flex; align-items:center; gap:8px; }
.ric-page h2::before { content:""; width:3px; height:16px; background:#1f3a68; display:inline-block; }
.ric-page table { width:100%; border-collapse:collapse; table-layout:fixed; }
.ric-page th, .ric-page td { border:1px solid #8a93a3; padding:5px 9px; vertical-align:middle; text-align:left; height:38px; }
.ric-page th { background:#eef2f8; font-weight:700; }
.ric-c { text-align:center !important; }
.ric-fill { font-weight:700; font-size:14px; }
.ric-box { display:inline-block; width:13px; height:13px; border:1.3px solid #333; vertical-align:-2px; margin-right:4px; text-align:center; line-height:10px; font-size:12px; font-weight:800; }
.ric-chk span { margin-right:22px; white-space:nowrap; }
.ric-small { font-size:11px; color:#444; }
.ric-lead { margin:0 0 8px; }
.ric-page ul { margin:0; padding-left:17px; }
.ric-page li { margin:1.5px 0; }
.ric-note { background:#f5f7fb; border:1px solid #9aa6bb; padding:9px 13px; border-radius:6px; font-size:11.7px; }
.ric-two { display:grid; grid-template-columns:1fr 1fr; gap:19px; }
.ric-cs { display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:8px; }
.ric-cs > div { border:1.5px solid #1f3a68; border-radius:8px; padding:13px; text-align:center; }
.ric-cs b { display:block; font-size:14.7px; color:#1f3a68; }
.ric-cs .tel { font-size:21px; font-weight:800; letter-spacing:.5px; margin:4px 0; }
.ric-foot { margin-top:22px; padding-top:9px; border-top:1px solid #8a93a3; font-size:11px; color:#333; display:flex; justify-content:space-between; }
`;

const Box = ({ on }: { on: boolean }) => <i className="ric-box">{on ? "✓" : ""}</i>;

function makerOf(spec: string | null): "hankook" | "kumho" | null {
  if (!spec) return null;
  if (/한국|hankook/i.test(spec)) return "hankook";
  if (/금호|kumho/i.test(spec)) return "kumho";
  return null;
}
// 규격 칸에는 제조사 이름을 뺀 나머지 (예: "한국 195R/15" → "195R/15")
const specOnly = (spec: string | null) =>
  (spec ?? "").replace(/한국타이어|금호타이어|한국|금호|hankook|kumho/gi, "").replace(/^[\s,/·-]+|[\s,/·-]+$/g, "").trim();

const fmtKDate = (d: string | null) => {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${y}년 ${Number(m)}월 ${Number(day)}일`;
};
const EMPTY_DATE = <>20&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;일</>;

export function CertificatePages({ d }: { d: CertificateData }) {
  const maker = makerOf(d.tireSpec);
  const total = d.qtyFront != null || d.qtyRear != null ? (d.qtyFront ?? 0) + (d.qtyRear ?? 0) : null;
  const split = d.qtyFront != null || d.qtyRear != null ? `전륜 ${d.qtyFront ?? 0}본 · 후륜 ${d.qtyRear ?? 0}본` : "";
  const installKDate = fmtKDate(d.installDate);
  const issued = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const foot = (
    <div className="ric-foot">
      <span>케이스 {d.caseNo ?? "-"} · 고객 {d.customerName}{d.companyName ? `(${d.companyName})` : ""}</span>
      <span>발행 (주)알앤에프코리아 · {issued}</span>
    </div>
  );

  return (
    <>
      <style>{css}</style>

      {/* ── 1쪽: 장착확인서 ── */}
      <div className="ric-page">
        <div className="ric-head"><h1>타이어 장착확인서</h1></div>
        <p className="ric-lead">아래 차량에 타이어를 장착하였음을 확인합니다.</p>

        <h2>1. 차량</h2>
        <table><tbody>
          <tr><th style={{ width: "22%" }}>차량번호</th><td className="ric-fill">{d.vehicleNo ?? ""}</td></tr>
        </tbody></table>

        <h2>2. 장착 타이어</h2>
        <table><tbody>
          <tr><th style={{ width: "22%" }}>제조사</th><td className="ric-chk">
            <span><Box on={maker === "hankook"} />한국타이어</span>
            <span><Box on={maker === "kumho"} />금호타이어</span>
            <span><Box on={false} />기타 (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span>
          </td></tr>
          <tr><th>제품명</th><td></td></tr>
          <tr><th>규격</th><td className="ric-fill">{specOnly(d.tireSpec)}</td></tr>
          <tr><th>수량</th><td className="ric-chk">
            <span><Box on={total === 2} />2본</span>
            <span><Box on={total === 4} />4본</span>
            <span><Box on={total != null && total !== 2 && total !== 4} />기타 ({total != null && total !== 2 && total !== 4 ? <b>&nbsp;{total}&nbsp;</b> : <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</>})본</span>
            {split && <span className="ric-small">({split})</span>}
          </td></tr>
          <tr><th>장착일</th><td className={installKDate ? "ric-fill" : ""}>{installKDate ?? EMPTY_DATE}</td></tr>
        </tbody></table>

        <h2>3. 작업 확인</h2>
        <table><tbody>
          <tr><th className="ric-c" style={{ width: "58%" }}>항목</th><th className="ric-c">확인</th></tr>
          <tr><td>타이어 장착 및 휠 밸런스</td><td className="ric-c ric-chk"><span><Box on={false} />완료</span></td></tr>
          <tr><td>휠너트 체결 및 공기압 조정</td><td className="ric-c ric-chk"><span><Box on={false} />완료</span></td></tr>
          <tr><td>휠 얼라인먼트</td><td className="ric-c ric-chk"><span><Box on={false} />실시</span><span><Box on={false} />미실시</span></td></tr>
          <tr><td>특이사항</td><td></td></tr>
        </tbody></table>

        <h2>4. 장착 업체</h2>
        <table><tbody>
          <tr><th style={{ width: "22%" }}>상호</th><td className="ric-fill">{d.installShop ?? ""}</td><th style={{ width: "18%" }}>연락처</th><td></td></tr>
          <tr><th>주소</th><td colSpan={3}></td></tr>
        </tbody></table>
        {foot}
      </div>

      {/* ── 2쪽: 품질보증 안내 ── */}
      <div className="ric-page">
        <div className="ric-head"><h1>타이어 품질보증 안내</h1></div>
        <table><tbody>
          <tr>
            <th style={{ width: "15%" }}>차량번호</th><td className="ric-fill">{d.vehicleNo ?? ""}</td>
            <th style={{ width: "11%" }}>제조사</th>
            <td className="ric-chk" style={{ width: "22%" }}><span><Box on={maker === "hankook"} />한국</span><span><Box on={maker === "kumho"} />금호</span></td>
            <th style={{ width: "11%" }}>장착일</th><td className="ric-fill">{d.installDate ? d.installDate.replace(/-/g, ".") : ""}</td>
          </tr>
        </tbody></table>

        <div className="ric-note" style={{ marginTop: 11 }}>
          장착된 타이어의 <b>제조상 결함</b>은 제조사가 품질보증합니다. 한국타이어와 금호타이어는 모두 공정거래위원회 「소비자분쟁해결기준」(고시 제2025-14호)의 타이어 기준에 따라 보증하며, 보상 여부와 금액은 <b>제조사의 판정</b>에 따릅니다.
        </div>

        <h2>1. 보증 기간</h2>
        <table><tbody>
          <tr><th className="ric-c" style={{ width: "34%" }}>구분</th><th className="ric-c" style={{ width: "28%" }}>보증 기간</th><th className="ric-c">보증 조건</th></tr>
          <tr><td>승용 · SUV · 승합 · 1.5톤 이하 경트럭</td><td className="ric-c"><b>제조일로부터 6년</b></td>
            <td rowSpan={2}>제조상 결함으로 판정되고, 홈 깊이가 20% 이상 남아 있을 것<br /><span className="ric-small">(잔여 홈 깊이 1.6mm 이하는 제외)</span></td></tr>
          <tr><td>트럭 · 버스</td><td className="ric-c"><b>구입일로부터 3년</b></td></tr>
        </tbody></table>

        <h2>2. 보상 기준</h2>
        <table><tbody>
          <tr><th className="ric-c" style={{ width: "34%" }}>마모율</th><th className="ric-c">보상 방법</th></tr>
          <tr><td className="ric-c">10% 미만</td><td><b>동일 제품 교환</b> (교환할 수 없으면 환불)</td></tr>
          <tr><td className="ric-c">10% 이상 ~ 80% 미만</td><td><b>환불</b> : 구입가(부가세 포함) × 잔여 홈 깊이 비율</td></tr>
          <tr><td className="ric-c">80% 이상</td><td>보상 대상 아님</td></tr>
        </tbody></table>

        <div className="ric-two">
          <div>
            <h2>3. 보증 제외</h2>
            <ul>
              <li>펑크·외상·코드절상(옆면 혹) 등 외부 충격 손상</li>
              <li>수리 흔적이 있는 타이어</li>
              <li>공기압·얼라인먼트 관리 부족으로 인한 이상 마모</li>
              <li>규격 부적합, 과적, 특수 목적 사용</li>
              <li>사고·화재·천재지변·고의 훼손</li>
              <li>제조번호(DOT) 확인 불가, 보증기간 경과</li>
              <li>견인비·렌트비·영업 손실 등 2차 손실</li>
            </ul>
          </div>
          <div>
            <h2>4. 관리 안내</h2>
            <ul>
              <li>월 1회 이상 공기압 점검</li>
              <li>8,000 ~ 10,000km마다 위치교환</li>
              <li>진동·쏠림·옆면 혹 발견 시 즉시 운행 중지</li>
              <li>보상 청구 시 타이어 현품과 장착 증빙 필요</li>
            </ul>
          </div>
        </div>

        <h2>5. 보상 문의 (제조사 고객센터)</h2>
        <div className="ric-cs">
          <div><b>한국타이어 고객만족센터</b><div className="tel">080-022-8272</div><span className="ric-small">www.hankooktire.com</span></div>
          <div><b>금호타이어 고객만족센터</b><div className="tel">1588-9582</div><span className="ric-small">080-061-1212 · www.kumhotire.com</span></div>
        </div>
        <p className="ric-small" style={{ margin: "8px 0 0" }}>고객센터 접수 후 안내받은 지정점에 타이어를 가져가면 제조사가 결함 여부를 판정합니다. 보상받은 타이어는 제조사에 귀속됩니다.</p>
        {foot}
      </div>
    </>
  );
}

// 화면 밖에 그려서 쪽마다 캡처 → A4 2쪽 PDF
export async function buildCertificatePdf(d: CertificateData): Promise<Blob> {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed; left:-10000px; top:0; width:${PAGE_W}px; background:#fff;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(<CertificatePages d={d} />);
    await new Promise((r) => setTimeout(r, 120)); // 렌더·폰트 적용 대기
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pages = Array.from(host.querySelectorAll<HTMLElement>(".ric-page"));
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W + 64,
        scale: 2, backgroundColor: "#ffffff", logging: false,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
    }
    return pdf.output("blob");
  } finally {
    root.unmount();
    host.remove();
  }
}
