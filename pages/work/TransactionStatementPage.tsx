// src/pages/work/TransactionStatementPage.tsx
// 거래명세서 작성 → PDF 다운로드 / 이메일 발송
// 기존 QuotationPage.tsx와 동일한 패턴(클라이언트에서 파일 조립 + Edge Function 발송)을 따릅니다.
// 원본 거래명세서 양식(셀 배치)을 그대로 HTML 표로 재현한 뒤 html2canvas + jsPDF로 PDF를 생성합니다.

import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../lib/supabase';

interface Item { name: string; spec: string; qty: number|string; unitPrice: number|string; }

interface StatementForm {
  customerName: string; customerBizNo: string; customerCeo: string;
  customerAddress: string; customerPhone: string; customerEmail: string;
  issueDate: string; paymentCondition: string; managerName: string;
  extraMessage: string;
  items: Item[];
}

const TODAY = new Date().toISOString().slice(0,10);
const EMPTY_ITEM: Item = { name:'', spec:'', qty:'', unitPrice:'' };
const MAX_ROWS = 15; // 원본 템플릿 고정 행수 (16~30행)

const SF0: StatementForm = {
  customerName:'', customerBizNo:'', customerCeo:'', customerAddress:'', customerPhone:'', customerEmail:'',
  issueDate:TODAY, paymentCondition:'현금', managerName:'이 동 수', extraMessage:'',
  items: Array(MAX_ROWS).fill(null).map(()=>({...EMPTY_ITEM})),
};

const n0 = (v:any) => typeof v==='number'?v:Number(v)||0;
const fmt = (n:number) => n.toLocaleString('ko-KR');

// 대용량 결과를 안전하게 base64로 변환
function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as number[]);
  }
  return btoa(binary);
}
const calcSupply = (items:Item[]) => items.reduce((s,it)=> s + n0(it.qty)*n0(it.unitPrice), 0);

// 9개 열(A~I)의 원본 거래명세서 열 너비 비율 (구 xlsx !cols 값을 그대로 사용)
const COL_W = [6,14,10,10,9,13,13,13,10];
const COL_PCT = COL_W.map(w => (w / COL_W.reduce((s,x)=>s+x,0) * 100).toFixed(2) + '%');

// ── 원본 "거래명세서" 양식과 동일한 셀 배치를 HTML 표로 재현 (PDF 캡처용) ──────────
function buildStatementOriginalHTML(form: StatementForm, docNo: string) {
  const supply = calcSupply(form.items);
  const tax = Math.round(supply*0.1);
  const grand = supply+tax;

  const itemRows = form.items.slice(0,MAX_ROWS).map((it,i)=>{
    const price = it.unitPrice!==''? n0(it.unitPrice) : null;
    const qty = it.qty!==''? n0(it.qty) : null;
    const amt = price!==null && qty!==null ? price*qty : null;
    const taxAmt = amt!==null ? Math.round(amt*0.1) : null;
    return `<tr>
      <td class="c">${i+1}</td>
      <td class="l" colspan="2">${it.name||''}</td>
      <td class="c">${it.spec||''}</td>
      <td class="c">${qty!==null?qty:''}</td>
      <td class="r">${price!==null?fmt(price):''}</td>
      <td class="r">${amt!==null?fmt(amt):''}</td>
      <td class="r">${taxAmt!==null?fmt(taxAmt):''}</td>
      <td></td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>거래명세서 ${docNo}</title>
<style>
  *{box-sizing:border-box;}
  body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12px;color:#111;margin:0;padding:24px;background:#fff;}
  table{border-collapse:collapse;width:100%;table-layout:fixed;}
  td{border:1px solid #333;padding:5px 6px;height:22px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
  .noborder{border:none;}
  .title{font-size:24px;font-weight:700;text-align:center;letter-spacing:10px;border:none;padding:8px 0 2px;}
  .sub{text-align:center;font-size:10px;color:#555;border:none;padding-bottom:10px;}
  .docno{text-align:right;font-size:10px;border:none;padding:0 0 4px;}
  .label{background:#f2f2f2;text-align:center;font-weight:600;}
  .c{text-align:center;} .l{text-align:left;white-space:normal;} .r{text-align:right;}
  .bighead{background:#0a192f;color:#fff;text-align:center;font-weight:700;font-size:14px;border:none;padding:6px 0;}
  .totrow td{font-weight:700;}
  .grand td{background:#f2f2f2;}
</style></head><body>
<table><colgroup>${COL_PCT.map(w=>`<col style="width:${w}">`).join('')}</colgroup>
<tr><td class="docno" colspan="9">No. ${docNo}</td></tr>
<tr><td class="title noborder" colspan="9">거 래 명 세 서</td></tr>
<tr><td class="sub" colspan="9">INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION&nbsp;&nbsp;|&nbsp;&nbsp;주식회사 알앤에프코리아</td></tr>

<tr>
  <td class="label" colspan="2">거래처</td><td colspan="3">${form.customerName}</td>
  <td class="label">공급자</td><td colspan="3">주식회사 알앤에프코리아</td>
</tr>
<tr>
  <td class="label" colspan="2">사업자번호</td><td colspan="3">${form.customerBizNo}</td>
  <td class="label">사업자번호</td><td colspan="3">316-88-02901</td>
</tr>
<tr>
  <td class="label" colspan="2">대&nbsp;&nbsp;&nbsp;표</td><td colspan="3">${form.customerCeo}</td>
  <td class="label">대&nbsp;&nbsp;&nbsp;표</td><td colspan="3">서선경</td>
</tr>
<tr>
  <td class="label" colspan="2">주&nbsp;&nbsp;&nbsp;소</td><td colspan="3">${form.customerAddress}</td>
  <td class="label">주&nbsp;&nbsp;&nbsp;소</td><td colspan="3">경기도 안산시 단원구 산단로 325</td>
</tr>
<tr>
  <td class="label" colspan="2">연&nbsp;&nbsp;&nbsp;락</td><td colspan="3">${form.customerPhone}</td>
  <td class="label">연&nbsp;&nbsp;&nbsp;락</td><td colspan="3">1551-1873</td>
</tr>

<tr>
  <td class="label" colspan="3">작성일자</td><td colspan="2"></td>
  <td class="label" colspan="2">결제조건</td><td class="label" colspan="2">담당자</td>
</tr>
<tr>
  <td colspan="3">${form.issueDate}</td><td colspan="2"></td>
  <td colspan="2">${form.paymentCondition||'현금'}</td><td colspan="2">${form.managerName}</td>
</tr>

<tr class="label">
  <td>No.</td><td colspan="2">품&nbsp;&nbsp;목</td><td>규&nbsp;&nbsp;격</td><td>수량</td>
  <td>단&nbsp;&nbsp;가 (원)</td><td>공급가액 (원)</td><td>세액 (원)</td><td>비고</td>
</tr>
${itemRows}

<tr class="totrow">
  <td colspan="5" class="c">합&nbsp;&nbsp;계</td><td></td>
  <td class="r">${fmt(supply)}</td><td class="r">${fmt(tax)}</td><td></td>
</tr>
<tr class="totrow">
  <td colspan="5" class="label">공급가액 합계</td><td colspan="4" class="r">${fmt(supply)}원</td>
</tr>
<tr class="totrow">
  <td colspan="5" class="label">세액 합계 (10%)</td><td colspan="4" class="r">${fmt(tax)}원</td>
</tr>
<tr class="totrow grand">
  <td colspan="5" class="label">청구 합계 (VAT포함)</td><td colspan="4" class="r">${fmt(grand)}원</td>
</tr>

<tr><td class="bighead" colspan="9">수령 확인</td></tr>
<tr><td class="label" colspan="3">확인일자</td><td colspan="6"></td></tr>
<tr><td class="label" colspan="3">확인자(서명)</td><td colspan="6"></td></tr>
<tr><td class="label" colspan="3">비고</td><td colspan="6">기업은행 523-081357-04-016 (주)알앤에프코리아 / admin@rnfkorea.co.kr</td></tr>

<tr><td class="noborder c" colspan="9" style="padding-top:14px;font-weight:700">상기와 같이 거래명세서를 제출합니다.</td></tr>
<tr><td class="noborder c" colspan="9" style="font-size:9px;color:#666">TEL : 1551-1873&nbsp;&nbsp;|&nbsp;&nbsp;FAX : 0504-339-1873&nbsp;&nbsp;|&nbsp;&nbsp;주식회사 알앤에프코리아&nbsp;&nbsp;|&nbsp;&nbsp;www.rnfkorea.co.kr</td></tr>
</table>
${form.extraMessage?.trim()?`<p style="margin-top:14px;font-size:11px;color:#333;white-space:pre-wrap">${form.extraMessage.trim()}</p>`:''}
</body></html>`;
}

// ── 위 HTML을 캡처해 A4 1페이지 PDF(ArrayBuffer)로 변환 ──────────────────────
async function generateStatementPDF(form: StatementForm, docNo: string): Promise<ArrayBuffer> {
  const html = buildStatementOriginalHTML(form, docNo);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHTML = bodyMatch ? bodyMatch[1] : html;
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styleEl = document.createElement('style');
  styleEl.textContent = styleMatch ? styleMatch[1] : '';
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:#fff;';
  wrapper.innerHTML = bodyHTML;
  document.head.appendChild(styleEl);
  document.body.appendChild(wrapper);
  try {
    await new Promise(r => setTimeout(r, 200));
    const canvas = await html2canvas(wrapper, {
      scale: 2, backgroundColor: '#ffffff',
      useCORS: true, allowTaint: true, logging: false,
      width: wrapper.offsetWidth, windowWidth: wrapper.offsetWidth,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = Math.min(pageHeight, (canvas.height*pageWidth)/canvas.width);
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight);
    return pdf.output('arraybuffer');
  } finally {
    document.body.removeChild(wrapper);
    document.head.removeChild(styleEl);
  }
}

// ── MMS 발송용 HTML: html2canvas로 캡처할 거래명세서 요약 뷰 (QuotationPage의 buildQuoteHTML과 동일한 패턴) ──
function buildStatementHTML(form: StatementForm, docNo: string) {
  const supply = calcSupply(form.items);
  const tax = Math.round(supply*0.1);
  const grand = supply+tax;
  const rows = form.items.filter(it=>it.name).map((it,i)=>{
    const amt = n0(it.qty)*n0(it.unitPrice);
    return `<tr style="background:${i%2===0?'#f8fafc':'#fff'}">
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${i+1}</td>
      <td style="padding:5px;border:1px solid #e2e8f0">${it.name||''}</td>
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${it.spec||''}</td>
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${it.qty||''}</td>
      <td style="padding:5px;text-align:right;border:1px solid #e2e8f0">${it.unitPrice!==''?fmt(n0(it.unitPrice)):''}</td>
      <td style="padding:5px;text-align:right;font-weight:600;border:1px solid #e2e8f0">${amt?fmt(amt):''}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>거래명세서 ${docNo}</title>
<style>
  *{box-sizing:border-box;}
  body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12px;color:#1e293b;margin:0;}
  table{border-collapse:collapse;width:100%;}
</style></head><body>
<div style="background:#0a192f;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:6px;margin-bottom:14px">
  <div><div style="font-size:20px;font-weight:700;color:#fff">RNF KOREA</div>
  <div style="font-size:9px;color:#94a3b8;margin-top:3px">INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION</div></div>
  <div style="text-align:right"><div style="font-size:22px;font-weight:700;color:#f97316">거래명세서</div>
  <div style="font-size:9px;color:#94a3b8">No. ${docNo}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div style="background:#f8fafc;border-radius:6px;padding:10px">
    <div style="font-size:9px;color:#64748b;margin-bottom:3px">거래처</div>
    <div style="font-size:13px;font-weight:700;color:#0a192f">${form.customerName} 귀중</div>
    <div style="font-size:10px;color:#374151;margin-top:5px">작성일자: ${form.issueDate} | 결제조건: ${form.paymentCondition||'현금'}</div>
    ${form.customerCeo?`<div style="font-size:10px;color:#374151">대표: ${form.customerCeo}</div>`:''}
    ${form.customerAddress?`<div style="font-size:10px;color:#374151">${form.customerAddress}</div>`:''}
  </div>
  <div style="background:#f8fafc;border-radius:6px;padding:10px">
    <div style="font-size:9px;color:#64748b;margin-bottom:3px">공급자</div>
    <div style="font-size:12px;font-weight:700;color:#0a192f">주식회사 알앤에프코리아</div>
    <div style="font-size:10px;color:#374151;margin-top:3px">대표: 서선경 | 사업자: 316-88-02901 | 1551-1873</div>
    <div style="font-size:10px;color:#374151">경기도 안산시 단원구 산단로 325</div>
  </div>
</div>
<table style="margin-bottom:12px;font-size:11px">
  <thead><tr style="background:#0a192f">
    ${['No.','품  목','규  격','수량','단  가','공급가액'].map(h=>`<th style="color:#fff;padding:7px 6px;text-align:center">${h}</th>`).join('')}
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr style="background:#0a192f">
    <td colspan="5" style="padding:7px;text-align:center;color:#fff;font-weight:700">합  계</td>
    <td style="padding:7px;text-align:right;color:#fff;font-weight:700">${fmt(supply)}</td>
  </tr></tfoot>
</table>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">
  ${[['공급가액 (VAT별도)',fmt(supply)+'원',false],['세액 (10%)',fmt(tax)+'원',false],['청구 합계 (VAT포함)',fmt(grand)+'원',true]].map(([l,v,dk])=>`
  <div style="background:${dk?'#0a192f':'#f1f5f9'};border-radius:6px;padding:10px;text-align:center">
    <div style="font-size:9px;color:${dk?'#94a3b8':'#64748b'};margin-bottom:3px">${l}</div>
    <div style="font-size:13px;font-weight:700;color:${dk?'#f97316':'#0a192f'}">${v}</div>
  </div>`).join('')}
</div>
${form.extraMessage?.trim()?`<div style="background:#f1f5f9;border-radius:6px;padding:10px;margin-bottom:12px">
  <div style="font-size:10px;color:#374151;white-space:pre-wrap">${form.extraMessage.trim()}</div>
</div>`:''}
<div style="background:#0a192f;padding:12px;text-align:center;border-radius:6px;margin-top:8px">
  <div style="color:#fff;font-size:11px;font-weight:700;margin-bottom:4px">상기와 같이 거래명세서를 제출합니다.</div>
  <div style="color:#94a3b8;font-size:9px">TEL: 1551-1873 | 주식회사 알앤에프코리아 | rnfkorea.co.kr</div>
</div>
</body></html>`;
}

// ── UI 헬퍼 (QuotationPage와 동일) ──────────────────────────────────────────
const Label = ({children}:{children:React.ReactNode}) =>
  <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>;
const Input = (p:React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={`w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${p.className??''}`}/>;

export default function TransactionStatementPage() {
  const [sf, setSf] = useState<StatementForm>(SF0);
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const flash = (m:string) => { setMsg(m); setTimeout(()=>setMsg(''),5000); };
  const supply = calcSupply(sf.items);
  const tax = Math.round(supply*0.1);
  const grand = supply+tax;

  const upd = (i:number, k:keyof Item, v:any) =>
    setSf(f=>{ const items=[...f.items]; items[i]={...items[i],[k]:v}; return {...f,items}; });

  // 사업자번호 입력 중 실시간으로 거래처 후보 목록(Pool) 표시
  interface CustomerSuggestion { name:string; business_no:string; representative:string|null; address:string|null; contact_phone:string|null; }
  const [bizSuggestions, setBizSuggestions] = useState<CustomerSuggestion[]>([]);
  const [bizDropdownOpen, setBizDropdownOpen] = useState(false);
  const [bizSearchLoading, setBizSearchLoading] = useState(false);
  const bizSearchTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    const digitsOnly = sf.customerBizNo.replace(/[^0-9]/g,'');
    if (bizSearchTimer.current) clearTimeout(bizSearchTimer.current);
    if (digitsOnly.length < 2) { setBizSuggestions([]); setBizDropdownOpen(false); return; }
    bizSearchTimer.current = setTimeout(async () => {
      setBizSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('name,business_no,representative,address,contact_phone')
          .ilike('business_no', `%${digitsOnly}%`)
          .limit(8);
        if (!error) { setBizSuggestions(data ?? []); setBizDropdownOpen((data ?? []).length > 0); }
      } finally {
        setBizSearchLoading(false);
      }
    }, 250);
    return () => { if (bizSearchTimer.current) clearTimeout(bizSearchTimer.current); };
  }, [sf.customerBizNo]);

  // 사업자번호로 customers + 과거 발송이력에서 나머지 정보 채우기 (자동완성 선택 / 계산서 인식 공통 사용)
  const fetchCustomerExtras = async (businessNo: string) => {
    let representative = '', address = '', contactPhone = '', email = '';
    try {
      const digitsOnly = businessNo.replace(/[^0-9]/g,'');
      const { data: cust } = await supabase
        .from('customers')
        .select('representative,address,contact_phone')
        .ilike('business_no', `%${digitsOnly}%`)
        .limit(1)
        .maybeSingle();
      representative = cust?.representative ?? '';
      address = cust?.address ?? '';
      contactPhone = cust?.contact_phone ?? '';

      const { data: pastStmt } = await supabase
        .from('tb_transaction_statements')
        .select('customer_email')
        .eq('customer_biz_no', businessNo)
        .order('created_at', { ascending:false })
        .limit(1)
        .maybeSingle();
      email = pastStmt?.customer_email ?? '';
    } catch { /* 부가 정보 조회 실패는 무시 — 계산서/자동완성에서 얻은 기본 정보는 그대로 유지 */ }
    return { representative, address, contactPhone, email };
  };

  const selectCustomer = async (row: CustomerSuggestion) => {
    setBizDropdownOpen(false);
    const extras = await fetchCustomerExtras(row.business_no);
    setSf(f => ({
      ...f,
      customerName: row.name, customerBizNo: row.business_no,
      customerCeo: row.representative ?? extras.representative, customerAddress: row.address ?? extras.address,
      customerPhone: row.contact_phone ?? extras.contactPhone, customerEmail: extras.email || f.customerEmail,
    }));
    flash(`✅ ${row.name} 정보를 불러왔습니다.`);
  };

  // 이미 발송된 계산서 이미지를 업로드하면 AI가 인식해 거래명세서 항목을 자동으로 채움
  const [invoiceParsing, setInvoiceParsing] = useState(false);
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재업로드 가능하도록 초기화
    if (!file) return;
    setInvoiceParsing(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const image_base64 = dataUrl.split(',')[1] ?? '';
      const media_type = file.type || 'image/png';

      const { data, error } = await supabase.functions.invoke('parse-tax-invoice', {
        body: { image_base64, media_type, direction: 'sales' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const businessNo: string = data.business_no ?? '';
      const extras = businessNo ? await fetchCustomerExtras(businessNo) : { representative:'', address:'', contactPhone:'', email:'' };

      const supplyFromInvoice = data.supply_amount ?? 0;
      const detailRows: {name:string; spec:string; qty:number; unit_price:number}[] = Array.isArray(data.items_detail) ? data.items_detail : [];
      const parsedItems = detailRows.length > 0
        ? detailRows.slice(0, MAX_ROWS).map(d => ({ name: d.name, spec: d.spec ?? '', qty: d.qty || 1, unitPrice: d.unit_price || 0 }))
        : [{ name: data.items ?? '', spec:'', qty:1, unitPrice: supplyFromInvoice }];
      const newItems = [
        ...parsedItems,
        ...Array(Math.max(0, MAX_ROWS-parsedItems.length)).fill(null).map(()=>({...EMPTY_ITEM})),
      ];

      setSf(f => ({
        ...f,
        customerName: data.customer_name || f.customerName,
        customerBizNo: businessNo || f.customerBizNo,
        customerCeo: extras.representative || f.customerCeo,
        customerAddress: extras.address || f.customerAddress,
        customerPhone: extras.contactPhone || f.customerPhone,
        customerEmail: extras.email || f.customerEmail,
        issueDate: data.sale_date || f.issueDate,
        items: newItems,
      }));
      flash(`✅ 계산서 인식 완료 (품목 ${parsedItems.length}개) — 내용을 확인 후 필요하면 수정해주세요.`);
    } catch (e:any) {
      flash(`계산서 인식 오류: ${e.message}`);
    }
    setInvoiceParsing(false);
  };

  // 발송 이력
  interface HistoryRow {
    id:number; doc_no:string; issue_date:string; customer_name:string; customer_biz_no:string|null;
    customer_ceo:string|null; customer_address:string|null; customer_phone:string|null; customer_email:string|null;
    payment_condition:string|null; manager_name:string|null; items:Item[]; supply_amount:number; tax_amount:number;
    grand_total:number; sent_at:string|null; created_at:string;
  }
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_transaction_statements')
        .select('id,doc_no,issue_date,customer_name,customer_biz_no,customer_ceo,customer_address,customer_phone,customer_email,payment_condition,manager_name,items,supply_amount,tax_amount,grand_total,sent_at,created_at')
        .order('created_at', { ascending:false })
        .limit(20);
      if (error) throw error;
      setHistory((data ?? []) as HistoryRow[]);
    } catch (e:any) {
      flash(`이력 조회 오류: ${e.message}`);
    }
    setHistoryLoading(false);
  };

  useEffect(() => { if (historyOpen) void loadHistory(); }, [historyOpen]);

  const loadFromHistory = (row:HistoryRow) => {
    const items = row.items?.length ? row.items : SF0.items;
    const padded = [...items, ...Array(Math.max(0, MAX_ROWS-items.length)).fill(null).map(()=>({...EMPTY_ITEM}))].slice(0,MAX_ROWS);
    setSf({
      customerName: row.customer_name, customerBizNo: row.customer_biz_no ?? '',
      customerCeo: row.customer_ceo ?? '', customerAddress: row.customer_address ?? '',
      customerPhone: row.customer_phone ?? '', customerEmail: row.customer_email ?? '',
      issueDate: row.issue_date, paymentCondition: row.payment_condition ?? '현금',
      managerName: row.manager_name ?? '이 동 수', extraMessage: '', items: padded,
    });
    flash(`${row.doc_no} 내용을 폼에 불러왔습니다. 수정 후 재발송하세요.`);
  };

  const downloadFromHistory = async (row:HistoryRow) => {
    try {
      const items = row.items?.length ? row.items : [];
      const bytes = await generateStatementPDF({
        customerName: row.customer_name, customerBizNo: row.customer_biz_no ?? '',
        customerCeo: row.customer_ceo ?? '', customerAddress: row.customer_address ?? '',
        customerPhone: row.customer_phone ?? '', customerEmail: row.customer_email ?? '',
        issueDate: row.issue_date, paymentCondition: row.payment_condition ?? '현금',
        managerName: row.manager_name ?? '', extraMessage: '', items,
      }, row.doc_no);
      const blob = new Blob([bytes],{type:'application/pdf'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `RNF_거래명세서_${row.customer_name}_${row.doc_no}.pdf`;
      a.click();
    } catch { flash('PDF 재생성 오류'); }
  };

  const download = async () => {
    setLoading(true);
    try {
      const bytes = await generateStatementPDF(sf, '(미리보기)');
      const blob = new Blob([bytes],{type:'application/pdf'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `RNF_거래명세서_${sf.customerName||'거래처'}.pdf`;
      a.click();
    } catch { flash('PDF 생성 오류'); }
    setLoading(false);
  };

  const sendEmail = async () => {
    if(!sf.customerName)  { flash('거래처 상호를 입력해주세요.'); return; }
    if(!sf.customerEmail) { flash('발송 이메일을 입력해주세요.'); return; }
    if(supply<=0)          { flash('품목을 1개 이상 입력해주세요.'); return; }
    setEmailLoading(true);
    try {
      const docNo = ((await supabase.rpc('next_rnf_number')).data as string);
      const bytes = await generateStatementPDF(sf, docNo);
      const b64 = bytesToBase64(bytes);
      await supabase.from('tb_transaction_statements').insert({
        doc_no: docNo, issue_date: sf.issueDate,
        customer_name: sf.customerName, customer_biz_no: sf.customerBizNo,
        customer_ceo: sf.customerCeo, customer_address: sf.customerAddress,
        customer_phone: sf.customerPhone, customer_email: sf.customerEmail,
        payment_condition: sf.paymentCondition, manager_name: sf.managerName,
        items: sf.items.filter(it=>it.name), supply_amount: supply, tax_amount: tax, grand_total: grand,
        created_by: 'admin@rnfkorea.co.kr',
      });
      const { error } = await supabase.functions.invoke('send-transaction-statement', {
        body: {
          docNo, recipient: sf.customerName, email: sf.customerEmail,
          supplyAmount: supply, taxAmount: tax, grandTotal: grand,
          pdfBase64: b64, fileName: `RNF_거래명세서_${sf.customerName}.pdf`,
          extraMessage: sf.extraMessage.trim(),
        },
      });
      if(error) {
        let detail = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.clone().json();
            if (body?.error) detail = body.error;
          }
        } catch { /* 본문 파싱 실패 시 기본 메시지 사용 */ }
        throw new Error(detail);
      }
      flash(`✅ ${sf.customerEmail}로 발송 완료 (${docNo})`);
    } catch(e:any) { flash(`발송 오류: ${e.message}`); }
    setEmailLoading(false);
  };

  // 거래명세서를 이미지로 캡처해 MMS로 발송 (QuotationPage.tsx의 handleSMS와 동일한 패턴)
  const sendMMS = async () => {
    if(!sf.customerName)  { flash('거래처 상호를 입력해주세요.'); return; }
    if(!sf.customerPhone) { flash('발송 연락처(거래처 연락처)를 입력해주세요.'); return; }
    if(supply<=0)          { flash('품목을 1개 이상 입력해주세요.'); return; }
    setSmsLoading(true);
    let styleEl: HTMLStyleElement | null = null;
    let wrapper: HTMLDivElement | null = null;
    try {
      const docNo = ((await supabase.rpc('next_rnf_number')).data as string);
      const htmlStr = buildStatementHTML(sf, docNo);
      const bodyMatch = htmlStr.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyHTML = bodyMatch ? bodyMatch[1] : htmlStr;
      const styleMatch = htmlStr.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      styleEl = document.createElement('style');
      styleEl.textContent = styleMatch ? styleMatch[1] : '';
      wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:720px;background:#fff;';
      wrapper.innerHTML = bodyHTML;
      document.head.appendChild(styleEl);
      document.body.appendChild(wrapper);
      await new Promise(r => setTimeout(r, 300));

      const wW = wrapper.offsetWidth || 720;
      const wH = wrapper.scrollHeight || wrapper.offsetHeight;
      let canvas = await html2canvas(wrapper, {
        scale: 1.5, backgroundColor: '#ffffff',
        useCORS: true, allowTaint: true, logging: false,
        width: wW, height: wH,
        windowWidth: wW, windowHeight: wH + 100,
      });
      document.head.removeChild(styleEl); styleEl = null;
      document.body.removeChild(wrapper); wrapper = null;

      const MAX_W=1500, MAX_H=1440;
      if(canvas.width>MAX_W||canvas.height>MAX_H){
        const ratio=Math.min(MAX_W/canvas.width,MAX_H/canvas.height);
        const r=document.createElement('canvas');
        r.width=Math.floor(canvas.width*ratio); r.height=Math.floor(canvas.height*ratio);
        r.getContext('2d')?.drawImage(canvas,0,0,r.width,r.height); canvas=r;
      }
      const MAX_BYTES=200*1024;
      const b64size=(d:string)=>Math.ceil((d.length-d.indexOf(',')-1)*3/4);
      let q=0.9, img=canvas.toDataURL('image/jpeg',q);
      while(b64size(img)>MAX_BYTES&&q>0.2){q-=0.1;img=canvas.toDataURL('image/jpeg',q);}
      if(b64size(img)>MAX_BYTES){flash('이미지 압축 실패'); setSmsLoading(false); return;}

      await supabase.from('tb_transaction_statements').insert({
        doc_no: docNo, issue_date: sf.issueDate,
        customer_name: sf.customerName, customer_biz_no: sf.customerBizNo,
        customer_ceo: sf.customerCeo, customer_address: sf.customerAddress,
        customer_phone: sf.customerPhone, customer_email: sf.customerEmail,
        payment_condition: sf.paymentCondition, manager_name: sf.managerName,
        items: sf.items.filter(it=>it.name), supply_amount: supply, tax_amount: tax, grand_total: grand,
        created_by: 'admin@rnfkorea.co.kr',
      });

      const { data, error } = await supabase.functions.invoke('send-transaction-statement-sms', {
        body: { docNo, recipientPhone: sf.customerPhone, recipientName: sf.customerName, imageBase64: img, grandTotal: grand },
      });
      if(error) {
        let detail = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.clone().json();
            if (body?.error) detail = body.error;
          }
        } catch { /* 본문 파싱 실패 시 기본 메시지 사용 */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      flash(`✅ ${sf.customerPhone}로 MMS 발송 완료 (${docNo})`);
    } catch(e:any) {
      styleEl && document.head.contains(styleEl) && document.head.removeChild(styleEl);
      wrapper && document.body.contains(wrapper) && document.body.removeChild(wrapper);
      flash(`MMS 발송 오류: ${e.message}`);
    }
    setSmsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0a192f] text-white px-6 py-5 sticky top-16 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">거래명세서 작성</h1>
            <p className="text-blue-300 text-sm mt-0.5">거래처 정보와 품목을 입력해 원본 양식 그대로 발송합니다</p>
          </div>
          <div className="flex gap-2">
            <label className={`px-4 py-2 rounded text-sm font-medium cursor-pointer ${invoiceParsing ? 'bg-white/50 text-gray-400' : 'bg-white text-[#0a192f] hover:bg-gray-100'}`}>
              {invoiceParsing ? '인식 중...' : '📄 계산서 업로드 (자동 인식)'}
              <input type="file" accept="image/*,.pdf,application/pdf" className="hidden" disabled={invoiceParsing} onChange={handleInvoiceUpload}/>
            </label>
            <button onClick={download} disabled={loading} className="bg-white text-[#0a192f] hover:bg-gray-100 px-4 py-2 rounded text-sm font-medium disabled:opacity-50">{loading?'생성 중...':'📥 PDF 다운로드'}</button>
            <button onClick={sendEmail} disabled={emailLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">{emailLoading?'발송 중...':'📧 이메일 발송'}</button>
            <button onClick={sendMMS} disabled={smsLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">{smsLoading?'전송 중...':'📱 MMS 발송'}</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {msg && <div className={`text-sm px-4 py-2.5 rounded border ${msg.startsWith('✅')?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{msg}</div>}

        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 text-sm">거래처 정보</h2>
            {invoiceParsing && <span className="text-xs text-gray-400">계산서 인식 중...</span>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>거래처 상호 *</Label><Input value={sf.customerName} onChange={e=>setSf(f=>({...f,customerName:e.target.value}))} placeholder="(주)예일이큅먼트"/></div>
            <div><Label>발송 이메일 *</Label><Input type="email" value={sf.customerEmail} onChange={e=>setSf(f=>({...f,customerEmail:e.target.value}))} placeholder="customer@company.com"/></div>
            <div><Label>작성일자</Label><Input type="date" value={sf.issueDate} onChange={e=>setSf(f=>({...f,issueDate:e.target.value}))}/></div>
            <div className="relative">
              <Label>사업자번호</Label>
              <Input
                value={sf.customerBizNo}
                onChange={e=>setSf(f=>({...f,customerBizNo:e.target.value}))}
                onFocus={()=>{ if (bizSuggestions.length>0) setBizDropdownOpen(true); }}
                onBlur={()=>{ setTimeout(()=>setBizDropdownOpen(false), 150); }}
                placeholder="숫자 2자리 이상 입력하면 거래처 목록이 뜹니다"
              />
              {bizSearchLoading && <p className="text-xs text-gray-400 mt-1">검색 중...</p>}
              {bizDropdownOpen && bizSuggestions.length>0 && (
                <div className="absolute z-20 mt-1 w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {bizSuggestions.map((row,i)=>(
                    <button
                      key={i}
                      type="button"
                      onMouseDown={()=>selectCustomer(row)}
                      className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b last:border-b-0"
                    >
                      <div className="text-sm font-medium text-gray-800">{row.name}</div>
                      <div className="text-xs text-gray-400">{row.business_no}{row.address ? ` · ${row.address}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div><Label>대표자</Label><Input value={sf.customerCeo} onChange={e=>setSf(f=>({...f,customerCeo:e.target.value}))}/></div>
            <div><Label>연락처 (MMS 발송용)</Label><Input value={sf.customerPhone} onChange={e=>setSf(f=>({...f,customerPhone:e.target.value}))} placeholder="010-1234-5678"/></div>
            <div className="col-span-2"><Label>주소</Label><Input value={sf.customerAddress} onChange={e=>setSf(f=>({...f,customerAddress:e.target.value}))}/></div>
            <div><Label>결제조건</Label><Input value={sf.paymentCondition} onChange={e=>setSf(f=>({...f,paymentCondition:e.target.value}))}/></div>
            <div><Label>담당자</Label><Input value={sf.managerName} onChange={e=>setSf(f=>({...f,managerName:e.target.value}))}/></div>
            <div className="col-span-3">
              <Label>이메일 추가 메시지 (선택)</Label>
              <textarea
                value={sf.extraMessage}
                onChange={e=>setSf(f=>({...f,extraMessage:e.target.value}))}
                placeholder="예: 항상 저희 제품을 이용해 주셔서 감사합니다. 문의사항 있으시면 언제든 연락 주세요."
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">품목 (최대 {MAX_ROWS}개 — 템플릿 고정 행수)</h2>
          <table className="w-full text-sm">
            <thead className="bg-[#0a192f] text-white">
              <tr>{['No.','품목','규격','수량','단가(원)','공급가액(원)','세액(원)'].map(h=>(
                <th key={h} className="px-3 py-2 text-left text-xs font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {sf.items.map((it,i)=>{
                const amt = n0(it.qty)*n0(it.unitPrice);
                return (
                  <tr key={i} className={`border-b ${i%2===0?'bg-gray-50':'bg-white'}`}>
                    <td className="px-3 py-1.5 text-gray-400 text-xs text-center w-8">{i+1}</td>
                    <td className="px-2 py-1"><input value={it.name} onChange={e=>upd(i,'name',e.target.value)} className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                    <td className="px-2 py-1"><input value={it.spec} onChange={e=>upd(i,'spec',e.target.value)} className="w-28 border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                    <td className="px-2 py-1"><input type="number" value={it.qty} onChange={e=>upd(i,'qty',e.target.value)} className="w-16 border-0 bg-transparent text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                    <td className="px-2 py-1"><input type="number" value={it.unitPrice} onChange={e=>upd(i,'unitPrice',e.target.value)} className="w-28 border-0 bg-transparent text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                    <td className="px-3 py-1.5 text-right text-gray-700 font-medium w-28">{amt>0?fmt(amt):''}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 text-xs w-24">{amt>0?fmt(Math.round(amt*0.1)):''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex justify-end gap-6 text-sm border-t pt-3">
            <span className="text-gray-500">공급가액: <strong>{fmt(supply)}원</strong></span>
            <span className="text-gray-500">세액: <strong>{fmt(tax)}원</strong></span>
            <span className="text-[#0a192f] font-bold">청구 합계: {fmt(grand)}원</span>
          </div>
        </div>

        {/* 발송 이력 */}
        <div className="bg-white rounded-lg border p-5">
          <button className="flex items-center justify-between w-full" onClick={()=>setHistoryOpen(o=>!o)}>
            <h2 className="font-semibold text-gray-800 text-sm">📜 최근 발송 이력 (최근 20건)</h2>
            <span className="text-xs text-gray-400">{historyOpen ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>
          {historyOpen && (
            <div className="mt-3">
              {historyLoading ? (
                <p className="text-xs text-gray-400">불러오는 중...</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-gray-400">발송 이력이 없습니다.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>{['문서번호','작성일','거래처','청구합계','발송시각',''].map(h=>(
                      <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {history.map(row=>(
                      <tr key={row.id} className="border-b">
                        <td className="px-2 py-1.5">{row.doc_no}</td>
                        <td className="px-2 py-1.5">{row.issue_date}</td>
                        <td className="px-2 py-1.5">{row.customer_name}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(row.grand_total)}원</td>
                        <td className="px-2 py-1.5 text-gray-400">{row.sent_at ? new Date(row.sent_at).toLocaleString('ko-KR') : '-'}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <button onClick={()=>downloadFromHistory(row)} className="text-gray-500 hover:text-gray-800 mr-2">📥</button>
                          <button onClick={()=>loadFromHistory(row)} className="text-orange-500 hover:text-orange-700">불러오기</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}