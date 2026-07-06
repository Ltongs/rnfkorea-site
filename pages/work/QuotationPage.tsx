// src/pages/work/QuotationPage.tsx
// 견적서 작성 → Excel 다운로드 / 이메일 발송 / SMS(MMS) 발송
// 의존성: npm install xlsx html2canvas

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';

interface Item { name: string; spec: string; qty: number|string; price: number|string; }
interface BatteryForm { recipient:string; recipientEmail:string; quoteDate:string; validPeriod:string; paymentTerms:string; deliveryPlace:string; items:Item[]; notes:string[]; }
interface ForkliftForm { recipient:string; recipientEmail:string; quoteDate:string; validPeriod:string; deliveryDate:string; paymentTerms:string; items:Item[]; downPayment:string; balance:string; stampFee:string; registrationFee:string; installmentRate:string; installmentPrincipal:string; notes:string[]; }

const TODAY = new Date().toISOString().slice(0,10);
const BEMPTY: Item = { name:'', spec:'', qty:'', price:'' };

const BF0: BatteryForm = {
  recipient:'', recipientEmail:'', quoteDate:TODAY, validPeriod:'견적 후 30일',
  paymentTerms:'현  금', deliveryPlace:'현지 운송도',
  items:[
    {name:'LFP 배터리 (Spiderway / 골프카트)', spec:'25.6V / 150Ah', qty:1, price:1800000},
    {name:'설치비', spec:'', qty:1, price:100000},
    ...Array(8).fill(null).map(()=>({...BEMPTY})),
  ],
  notes:[
    '※ LFP(리튬인산철) 배터리 5년 / 10,000시간 무상 보증 (고객과실 제외)',
    '※ 배터리 관리 시스템(BMS) 내장, 과충전·과방전·과열 3중 보호 기능 포함',
    '※ 생산물책임보험에 가입된 제품입니다. (최대 3억원)',
    '※ 본 견적서의 유효기간은 발행일로부터 30일 입니다.',
    '※ 납품 후 설치 및 초기 세팅 지원 포함 (원거리 출장비 별도 협의)',
  ],
};

const FF0: ForkliftForm = {
  recipient:'', recipientEmail:'', quoteDate:TODAY, validPeriod:'견적 후 30일',
  deliveryDate:'계약 후 30일 이내', paymentTerms:'현금 또는 할부금융',
  items:[
    {name:'CPD25-A7LIH4-S (80V, 202Ah)', spec:'3.0톤', qty:1, price:34040000},
    {name:'3단 마스트', spec:'4,500mm', qty:1, price:'포함'},
    {name:'고속 충전기', spec:'380V/100A', qty:1, price:'포함'},
    {name:'전체 캐빈 + 와이퍼', spec:'', qty:'', price:'포함'},
    {name:'자동발 (양개식)', spec:'', qty:'', price:'포함'},
    {name:'후방카메라', spec:'', qty:'', price:'포함'},
    {name:'전기팬, 히터', spec:'', qty:'', price:'포함'},
    ...Array(3).fill(null).map(()=>({...BEMPTY})),
  ],
  downPayment:'', balance:'', stampFee:'-', registrationFee:'-',
  installmentRate:'6.5', installmentPrincipal:'',
  notes:[
    '※ 1년 / 2,000시간 중 선도래분 적용 (소모품 / 고객과실 제외 무상 A/S 실시)',
    '※ 5년 / 10,000시간 리튬 인산철 배터리 무상 보증 (고객과실 제외)',
    '※ 마스트 기본 옵션은 2단 3,300mm 입니다. (3단 4,500mm 선택 시 추가금 발생)',
    '※ 타이어 기본 전체 통타이어입니다.',
    '※ 본 견적서의 유효기간은 발행일로부터 30일 입니다.',
  ],
};

const n0 = (v:any) => typeof v==='number'?v:Number(v)||0;
const fmt = (n:number) => n.toLocaleString('ko-KR');

// 설치된 xlsx 버전은 type:'array' 시 Uint8Array가 아니라 ArrayBuffer를 반환하므로
// 항상 Uint8Array로 감싸서 청크 단위로 base64 변환 (스프레드 연산자는 이 경우 사용 불가/불안정)
function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as number[]);
  }
  return btoa(binary);
}
const calcTotal = (items:Item[]) =>
  items.reduce((s,it)=>{ if(!it.price||it.price==='포함') return s; return s+n0(it.price)*(n0(it.qty)||1); },0);

function pmt(principal:number, rate:number, months:number){
  const r = rate/100/12;
  if(r===0||principal===0) return 0;
  return Math.round(principal*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1));
}

// ── Excel 생성: 배터리
function buildBattery(form:BatteryForm): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {'!ref':'A1:H42'};
  const set = (a:string, v:any) => { ws[a]={v, t:typeof v==='number'?'n':'s'}; };
  const total=calcTotal(form.items), vat=Math.round(total*.1), grand=total+vat;
  set('A1','RNF KOREA'); set('H1','견  적  서');
  set('A4','INDUSTRIAL ENERGY & MOBILITY SOLUTION  |  주식회사 알앤에프코리아');
  set('A6','수  신'); set('B6',form.recipient);
  set('E6','상  호'); set('F6','주식회사 알앤에프코리아');
  set('A7','견적일자'); set('B7',form.quoteDate);
  set('E7','대  표'); set('F7','이 동 수');
  set('A8','유효기간'); set('B8',form.validPeriod);
  set('E8','사업자'); set('F8','316-88-02901');
  set('A9','거래조건'); set('B9',form.paymentTerms);
  set('E9','연  락'); set('F9','1551-1873');
  set('A10','인도장소'); set('B10',form.deliveryPlace);
  set('E10','주  소'); set('F10','경기도 안산시 단원구 산단로 325');
  set('A12','No.'); set('B12','품  명'); set('C12','규  격');
  set('D12','수량'); set('E12','단  가 (원)'); set('F12','금  액 (원)'); set('G12','비  고');
  form.items.forEach((it,i)=>{
    const r=13+i;
    set(`A${r}`, i+1);
    if(it.name) set(`B${r}`,it.name);
    if(it.spec) set(`C${r}`,it.spec);
    if(it.qty!=='') set(`D${r}`,n0(it.qty));
    if(it.price!==''){
      if(it.price==='포함') set(`E${r}`,'포함');
      else { set(`E${r}`,n0(it.price)); set(`F${r}`,n0(it.price)*(n0(it.qty)||1)); }
    }
  });
  set('A23','합  계'); set('F23',total);
  set('A25','공급가액 (VAT 별도)'); set('C25',total);
  set('A26','부가세 (10%)'); set('C26',vat);
  set('E27','총  액 (VAT 포함)'); set('G27',grand);
  set('A29','특기사항');
  form.notes.forEach((n,i)=>set(`A${30+i}`,n));
  const fr=30+form.notes.length+1;
  set(`A${fr}`,'상기와 같이 견적을 제출합니다.');
  set(`A${fr+1}`,'TEL : 1551-1873  |  주식회사 알앤에프코리아  |  www.rnfkorea.co.kr');
  ws['!cols']=[5,30,14,7,15,15,14,14].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb,ws,'견적서');
  return XLSX.write(wb,{type:'array',bookType:'xlsx'});
}

// ── Excel 생성: 지게차
function buildForklift(form:ForkliftForm): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {'!ref':'A1:J45'};
  const set = (a:string, v:any) => { ws[a]={v, t:typeof v==='number'?'n':'s'}; };
  const total=calcTotal(form.items), vat=Math.round(total*.1), grand=total+vat;
  const dp=n0(form.downPayment), bal=n0(form.balance)||(grand-dp);
  const ip=n0(form.installmentPrincipal)||bal, rate=n0(form.installmentRate);
  set('A1','RNF KOREA'); set('G1','견  적  서');
  set('A4','INDUSTRIAL ENERGY & MOBILITY SOLUTION  |  주식회사 알앤에프코리아');
  set('A6','수  신'); set('B6',form.recipient);
  set('D6','상  호'); set('E6','주식회사 알앤에프코리아');
  set('A7','견적일자'); set('B7',form.quoteDate);
  set('D7','대  표'); set('E7','이 동 수');
  set('A8','유효기간'); set('B8',form.validPeriod);
  set('D8','사업자'); set('E8','316-88-02901');
  set('A9','납품일자'); set('B9',form.deliveryDate);
  set('D9','연  락  처'); set('E9','1551-1873');
  set('A10','거래조건'); set('B10',form.paymentTerms);
  set('D10','주  소'); set('E10','경기도 안산시 단원구 산단로 325');
  set('A12','No.'); set('B12','품  명'); set('C12','규  격');
  set('D12','수량'); set('E12','단  가 (원)'); set('F12','금  액 (원)'); set('G12','비  고'); set('J12','가격($)');
  form.items.forEach((it,i)=>{
    const r=13+i;
    set(`A${r}`,i+1);
    if(it.name) set(`B${r}`,it.name);
    if(it.spec) set(`C${r}`,it.spec);
    if(it.qty!=='') set(`D${r}`,n0(it.qty));
    if(it.price!==''){
      if(it.price==='포함') set(`E${r}`,'포함');
      else { set(`E${r}`,n0(it.price)); set(`F${r}`,n0(it.price)*(n0(it.qty)||1)); }
    }
  });
  set('A23','합  계'); set('F23',total);
  set('A25','선수(계약·인도)금'); set('C25',dp||'-');
  set('A26','V. A. T'); set('C26',vat);
  set('A27','잔  금'); set('C27',bal);
  set('A28','인 지 대'); set('C28',form.stampFee);
  set('A29','등 록 비'); set('C29',form.registrationFee);
  set('A30',`할부이용시 (금리 ${rate}%)`); set('C30','할부원금');
  set('E30',36); set('F30',48); set('G30',60);
  set('C31',ip); set('E31',pmt(ip,rate,36)); set('F31',pmt(ip,rate,48)); set('G31',pmt(ip,rate,60));
  set('A32','총 액 (VAT 포함)'); set('C32',grand);
  set('A34','특기사항');
  form.notes.forEach((n,i)=>set(`A${35+i}`,n));
  const fr=35+form.notes.length+1;
  set(`A${fr}`,'상기와 같이 견적을 제출합니다.');
  set(`A${fr+1}`,'TEL : 1551-1873  |  주식회사 알앤에프코리아  |  rnfkorea.co.kr');
  ws['!cols']=[5,28,13,7,14,14,12,8,8,10].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb,ws,'견적서');
  return XLSX.write(wb,{type:'array',bookType:'xlsx'});
}

// ── UI 헬퍼
const Label = ({children}:{children:React.ReactNode}) =>
  <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>;
const Input = (p:React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={`w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${p.className??''}`}/>;

// ─── 할부견적서 타입 ─────────────────────────────────────────
interface InstallmentForm {
  recipient: string;
  recipientEmail: string;
  companyName: string;
  itemName: string;
  itemSpec: string;
  carPrice: number | string;       // 차량가격
  attachmentPrice: number | string; // 부대비용
  principal: number | string;      // 할부원금
  annualRate: number | string;     // 연이율(%)
  gracePeriod: number | string;    // 거치기간(개월)
  installmentMonths: number | string; // 할부기간(개월)
  financeCompany: string;
  startYM: string;                 // 시작 년월
  quoteDate: string;
}

const IF0: InstallmentForm = {
  recipient: '', recipientEmail: '', companyName: '',
  itemName: 'CPD25-A7LIH4-S (전동지게차)', itemSpec: '3.0톤',
  carPrice: '', attachmentPrice: '',
  principal: '', annualRate: '6.5',
  gracePeriod: '0', installmentMonths: '36',
  financeCompany: 'NH캐피탈',
  startYM: new Date().toISOString().slice(0, 7),
  quoteDate: new Date().toISOString().slice(0, 10),
};

// ── 상환스케줄 계산 (현대CM과 동일 로직)
function calcAmortization(
  principal: number, annualRate: number, months: number,
  startYM: string, gracePeriod: number = 0
) {
  const r = annualRate / 100 / 12;
  const grace = Math.max(0, Math.min(gracePeriod, months));
  const installmentMonths = months - grace;
  const payment = installmentMonths <= 0 ? 0
    : r === 0 ? principal / installmentMonths
    : (principal * r * Math.pow(1+r, installmentMonths)) / (Math.pow(1+r, installmentMonths) - 1);
  const rows: {no:number;date:string;payment:number;interest:number;principalPmt:number;balance:number}[] = [];
  let balance = principal;
  const [sy, sm] = startYM.split('-').map(Number);
  for (let i = 1; i <= months; i++) {
    const interest = balance * r;
    const d = new Date(sy, sm - 1 + (i - 1), 1);
    const date = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.01`;
    if (i <= grace) {
      rows.push({ no:i, date, payment:Math.round(interest), interest:Math.round(interest), principalPmt:0, balance:Math.round(balance) });
    } else {
      const principalPmt = payment - interest;
      balance = Math.max(0, balance - principalPmt);
      rows.push({ no:i, date, payment:Math.round(payment), interest:Math.round(interest), principalPmt:Math.round(principalPmt), balance:Math.round(balance) });
    }
  }
  return { payment: Math.round(payment), rows, gracePeriod: grace, installmentMonths };
}

export default function QuotationPage() {
  const [tab, setTab] = useState<'battery'|'forklift'|'installment'>('battery');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'forklift' || type === 'battery' || type === 'installment') {
      setTab(type);
    }
  }, [searchParams]);
  const [bf, setBf] = useState<BatteryForm>(BF0);
  const [ff, setFf] = useState<ForkliftForm>(FF0);
  const [iff, setIff] = useState<InstallmentForm>(IF0);
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [extraMessage, setExtraMessage] = useState('');

  // SMS 상태
  const [smsPhone1, setSmsPhone1] = useState('');
  const [smsPhone2, setSmsPhone2] = useState('');
  const [smsSending, setSmsSending] = useState(false);

  // 각 탭 캡처 ref
  const batteryPreviewRef    = useRef<HTMLDivElement>(null);
  const forkliftPreviewRef   = useRef<HTMLDivElement>(null);
  const installmentPreviewRef = useRef<HTMLDivElement>(null);

  // 발송 이력 (탭별로 tb_quotations 조회)
  interface HistoryRow {
    id:number; quote_no:string; quote_date:string; recipient:string; recipient_email:string;
    items:Item[]; notes:string[]|null; total_amount:number; vat_amount:number; grand_total:number;
    created_at:string;
  }
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_quotations')
        .select('id,quote_no,quote_date,recipient,recipient_email,items,notes,total_amount,vat_amount,grand_total,created_at')
        .eq('quote_type', tab)
        .order('created_at', { ascending:false })
        .limit(20);
      if (error) throw error;
      setHistory((data ?? []) as HistoryRow[]);
    } catch (e:any) {
      flash(`이력 조회 오류: ${e.message}`);
    }
    setHistoryLoading(false);
  };

  useEffect(() => { if (historyOpen) void loadHistory(); }, [tab, historyOpen]);

  // 이력에서 폼으로 불러오기 (배터리/지게차만 — 할부는 구조가 달라 재구성하지 않음)
  const loadFromHistory = (row:HistoryRow) => {
    if (tab === 'installment') { flash('할부견적서는 이력에서 다시 불러오기를 지원하지 않습니다.'); return; }
    const patch = {
      recipient: row.recipient, recipientEmail: row.recipient_email,
      quoteDate: row.quote_date, items: row.items?.length ? row.items : (tab==='battery'?BF0.items:FF0.items),
      notes: row.notes ?? (tab==='battery'?BF0.notes:FF0.notes),
    };
    if (tab === 'battery') setBf(f => ({ ...f, ...patch }));
    else setFf(f => ({ ...f, ...patch }));
    flash(`${row.quote_no} 내용을 폼에 불러왔습니다. 수정 후 재발송하세요.`);
  };

  const downloadFromHistory = (row:HistoryRow) => {
    if (tab === 'installment') { flash('할부견적서는 이력에서 다운로드를 지원하지 않습니다.'); return; }
    try {
      const items = row.items?.length ? row.items : [];
      const bytes = tab==='battery'
        ? buildBattery({ ...BF0, recipient:row.recipient, recipientEmail:row.recipient_email, quoteDate:row.quote_date, items, notes: row.notes ?? BF0.notes })
        : buildForklift({ ...FF0, recipient:row.recipient, recipientEmail:row.recipient_email, quoteDate:row.quote_date, items, notes: row.notes ?? FF0.notes });
      const blob = new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `RNF_${tab==='battery'?'배터리':'지게차'}견적서_${row.recipient}_${row.quote_no}.xlsx`;
      a.click();
    } catch { flash('Excel 재생성 오류'); }
  };

  const flash = (m:string) => { setMsg(m); setTimeout(()=>setMsg(''),5000); };
  const bTotal=calcTotal(bf.items), fTotal=calcTotal(ff.items);

  const download = () => {
    if (tab === 'installment') { downloadInstallmentPDF(); return; }
    setLoading(true);
    try {
      const bytes = tab==='battery' ? buildBattery(bf) : buildForklift(ff);
      const blob  = new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a     = document.createElement('a');
      a.href      = URL.createObjectURL(blob);
      a.download  = `RNF_${tab==='battery'?'배터리':'지게차'}견적서_${(tab==='battery'?bf:ff).recipient||'고객'}.xlsx`;
      a.click();
    } catch { flash('Excel 생성 오류'); }
    setLoading(false);
  };

  const sendEmail = async () => {
    if (tab === 'installment') { await sendInstallmentEmail(); return; }
    const form = tab==='battery' ? bf : ff;
    if(!form.recipient)      { flash('수신인을 입력해주세요.'); return; }
    if(!form.recipientEmail) { flash('수신 이메일을 입력해주세요.'); return; }
    setEmailLoading(true);
    try {
      const bytes    = tab==='battery' ? buildBattery(bf) : buildForklift(ff);
      const b64      = bytesToBase64(bytes);
      const total    = tab==='battery' ? bTotal : fTotal;
      const vat      = Math.round(total*.1);
      const grand    = total+vat;
      const quoteNo  = `${tab==='battery'?'BT':'FL'}-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
      await supabase.from('tb_quotations').insert({
        quote_type: tab, quote_no: quoteNo,
        quote_date: form.quoteDate, recipient: form.recipient,
        recipient_email: form.recipientEmail, items: form.items,
        notes: form.notes, total_amount:total, vat_amount:vat, grand_total:grand,
        created_by:'admin@rnfkorea.co.kr',
      });
      const {error} = await supabase.functions.invoke('send-quotation', {
        body: {
          quoteNo, quoteType:tab, recipient:form.recipient,
          email:form.recipientEmail, totalAmount:total, vatAmount:vat, grandTotal:grand,
          xlsxBase64:b64,
          fileName:`RNF_${tab==='battery'?'배터리':'지게차'}견적서_${form.recipient}.xlsx`,
          cc:['admin@rnfkorea.co.kr'],
          extraMessage: extraMessage.trim(),
        },
      });
      if(error) throw error;
      flash(`✅ ${form.recipientEmail}로 발송 완료 (${quoteNo})`);
    } catch(e:any) { flash(`발송 오류: ${e.message}`); }
    setEmailLoading(false);
  };

  const updB = (i:number, k:keyof Item, v:any) =>
    setBf(f=>{ const items=[...f.items]; items[i]={...items[i],[k]:v}; return {...f,items}; });
  const updF = (i:number, k:keyof Item, v:any) =>
    setFf(f=>{ const items=[...f.items]; items[i]={...items[i],[k]:v}; return {...f,items}; });

  const InRow = ({items, upd, total}:{items:Item[],upd:(i:number,k:keyof Item,v:any)=>void,total:number}) => (
    <>
      <table className="w-full text-sm">
        <thead className="bg-[#0a192f] text-white">
          <tr>{['No.','품명','규격','수량','단가(원) / 포함','금액(원)'].map(h=>(
            <th key={h} className="px-3 py-2 text-left text-xs font-medium">{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {items.map((it,i)=>{
            const inc=it.price==='포함';
            const amt=!inc?n0(it.price)*(n0(it.qty)||1):0;
            return (
              <tr key={i} className={`border-b ${i%2===0?'bg-gray-50':'bg-white'}`}>
                <td className="px-3 py-1.5 text-gray-400 text-xs text-center w-8">{i+1}</td>
                <td className="px-2 py-1"><input value={it.name} onChange={e=>upd(i,'name',e.target.value)} className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                <td className="px-2 py-1"><input value={it.spec} onChange={e=>upd(i,'spec',e.target.value)} className="w-28 border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                <td className="px-2 py-1"><input type="number" value={it.qty} onChange={e=>upd(i,'qty',e.target.value)} className="w-14 border-0 bg-transparent text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={inc} onChange={e=>upd(i,'price',e.target.checked?'포함':'')} />
                    <span className="text-xs text-gray-400 mr-1">포함</span>
                    {!inc && <input type="number" value={it.price} onChange={e=>upd(i,'price',e.target.value)} className="w-28 border-0 bg-transparent text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/>}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right text-gray-700 font-medium w-28">
                  {inc?<span className="text-gray-400 text-xs">포함</span>:amt>0?fmt(amt):''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end gap-6 text-sm border-t pt-3">
        <span className="text-gray-500">공급가액: <strong>{fmt(total)}원</strong></span>
        <span className="text-gray-500">VAT: <strong>{fmt(Math.round(total*.1))}원</strong></span>
        <span className="text-[#0a192f] font-bold">총액: {fmt(total+Math.round(total*.1))}원</span>
      </div>
    </>
  );

  const NoteEditor = ({notes,onChange}:{notes:string[],onChange:(n:string[])=>void}) => (
    <div className="space-y-2">
      {notes.map((n,i)=>(
        <div key={i} className="flex gap-2">
          <Input value={n} onChange={e=>{const a=[...notes];a[i]=e.target.value;onChange(a);}}/>
          <button onClick={()=>onChange(notes.filter((_,idx)=>idx!==i))} className="text-red-400 text-xs px-2">삭제</button>
        </div>
      ))}
      <button onClick={()=>onChange([...notes,'※ '])} className="text-xs border px-3 py-1.5 rounded hover:bg-gray-50">+ 추가</button>
    </div>
  );

  // ── 할부견적서 PDF 출력
  const downloadInstallmentPDF = () => {
    const p  = n0(iff.principal);
    const r  = n0(iff.annualRate);
    const gp = n0(iff.gracePeriod);
    const im = n0(iff.installmentMonths);
    const months = gp + im;
    if (!p || !r || !months) { flash('할부원금, 금리, 기간을 입력해주세요.'); return; }
    const { payment, rows } = calcAmortization(p, r, months, iff.startYM, gp);
    const fmtN = (n:number) => n.toLocaleString('ko-KR');
    const totalInterest = rows.reduce((s,row)=>s+row.interest,0);
    const totalPayment  = rows.reduce((s,row)=>s+row.payment,0);
    const carP = n0(iff.carPrice), attP = n0(iff.attachmentPrice);
    const periodLabel = gp > 0 ? `${months}개월 (거치 ${gp} + 할부 ${im})` : `${months}개월`;
    const tableRows = rows.map(row=>`
      <tr class="${row.principalPmt===0?'grace':''}">
        <td style="text-align:center">${row.no}</td>
        <td style="text-align:center">${row.date}</td>
        <td style="text-align:right">${fmtN(row.payment)}</td>
        <td style="text-align:right">${fmtN(row.principalPmt)}</td>
        <td style="text-align:right">${fmtN(row.interest)}</td>
        <td style="text-align:right">${fmtN(row.balance)}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"/>
<title>할부견적서 - ${iff.recipient}</title>
<style>
  @page{size:A4;margin:18mm 14mm;}*{box-sizing:border-box;}
  body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:11px;color:#1e293b;}
  .hdr{background:#0a192f;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:6px;margin-bottom:14px;}
  .hdr h1{font-size:18px;font-weight:700;margin:0;color:#fff;}.hdr .sub{font-size:10px;color:#94a3b8;margin-top:3px;}
  .tr{text-align:right;}.tr .t{font-size:20px;color:#f97316;font-weight:700;}.tr .no{font-size:10px;color:#94a3b8;}
  .rcpt{font-size:13px;margin-bottom:10px;}.rcpt strong{color:#0a192f;}
  .pbox{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;}
  .pc{background:#f1f5f9;border-radius:6px;padding:10px;text-align:center;}
  .pc.dk{background:#0a192f;}.pc label{font-size:9px;color:#64748b;display:block;margin-bottom:3px;}
  .pc.dk label{color:#94a3b8;}.pc span{font-size:13px;font-weight:700;color:#0a192f;}.pc.dk span{color:#f97316;}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#f8fafc;border-radius:6px;padding:12px;margin-bottom:14px;}
  .mi label{font-size:9px;color:#94a3b8;display:block;margin-bottom:2px;}.mi span{font-weight:700;color:#0a192f;font-size:12px;}
  table{width:100%;border-collapse:collapse;font-size:10.5px;}
  th{background:#0a192f;color:#fff;padding:7px 5px;font-size:10px;}
  td{padding:5px;border-bottom:1px solid #f1f5f9;}
  tr:nth-child(even) td{background:#f8fafc;}
  tr.grace td{color:#94a3b8;font-style:italic;}
  .tf td{background:#e2e8f0;font-weight:700;border-top:2px solid #94a3b8;}
  .footer{margin-top:14px;font-size:9px;color:#94a3b8;text-align:center;}
</style></head><body>
<div class="hdr">
  <div><div style="font-size:18px;font-weight:700">RNF KOREA</div><div class="sub">INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION</div></div>
  <div class="tr"><div class="t">할부 견적서</div><div class="no">기준일: ${iff.quoteDate}</div></div>
</div>
${iff.recipient?`<p class="rcpt">수신: <strong>${iff.recipient}${iff.companyName?' ('+iff.companyName+')':''}</strong> 귀중</p>`:''}
<div class="pbox">
  ${carP?`<div class="pc"><label>차량 가격</label><span>${fmtN(carP)}원</span></div>`:''}
  ${attP?`<div class="pc"><label>부대 비용</label><span>${fmtN(attP)}원</span></div>`:''}
  <div class="pc"><label>할부 원금</label><span>${fmtN(p)}원</span></div>
  <div class="pc dk"><label>월 납입액</label><span>${fmtN(payment)}원</span></div>
</div>
<div class="meta">
  <div class="mi"><label>고객명</label><span>${iff.recipient||'-'}</span></div>
  <div class="mi"><label>차량/장비</label><span>${iff.itemName||'-'}</span></div>
  <div class="mi"><label>규격</label><span>${iff.itemSpec||'-'}</span></div>
  <div class="mi"><label>할부금융사</label><span>${iff.financeCompany}</span></div>
  <div class="mi"><label>연이율</label><span>${r}%</span></div>
  <div class="mi"><label>대출기간</label><span>${periodLabel}</span></div>
</div>
<table>
  <thead><tr><th>회차</th><th>납입일</th><th>월납입액</th><th>원금</th><th>이자</th><th>잔액</th></tr></thead>
  <tbody>${tableRows}</tbody>
  <tfoot><tr class="tf">
    <td colspan="2" style="text-align:center">합계</td>
    <td style="text-align:right">${fmtN(totalPayment)}</td>
    <td style="text-align:right">${fmtN(p)}</td>
    <td style="text-align:right">${fmtN(Math.round(totalInterest))}</td>
    <td style="text-align:right">0</td>
  </tr></tfoot>
</table>
<p class="footer">※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다. | 주식회사 알앤에프코리아 | TEL: 1551-1873</p>
</body></html>`;
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const win=window.open(url,'_blank');
    if(win) win.addEventListener('load',()=>{setTimeout(()=>{win.print();URL.revokeObjectURL(url);},500);});
  };

  // ── SMS(MMS) 발송 — 현대CM과 동일 패턴 (수신번호 최대 2개)
  const sendSMS = async () => {
    const phones = [smsPhone1.trim(), smsPhone2.trim()].filter(Boolean);
    if (phones.length === 0) { flash('수신 전화번호를 1개 이상 입력해주세요.'); return; }
    const ref = tab === 'battery' ? batteryPreviewRef
               : tab === 'forklift' ? forkliftPreviewRef
               : installmentPreviewRef;
    if (!ref.current) { flash('미리보기 영역을 찾을 수 없습니다.'); return; }
    setSmsSending(true);
    try {
      // 1. html2canvas 캡처 (한 번만 캡처해서 두 번호에 동일하게 재사용)
      let canvas = await html2canvas(ref.current, { scale: 1.5, backgroundColor: '#ffffff' });

      // 2. Solapi MMS 크기 제한 대응 (가로 1500px, 세로 1440px)
      const MAX_W = 1500, MAX_H = 1440;
      if (canvas.width > MAX_W || canvas.height > MAX_H) {
        const ratio  = Math.min(MAX_W / canvas.width, MAX_H / canvas.height);
        const resized = document.createElement('canvas');
        resized.width  = Math.floor(canvas.width  * ratio);
        resized.height = Math.floor(canvas.height * ratio);
        resized.getContext('2d')?.drawImage(canvas, 0, 0, resized.width, resized.height);
        canvas = resized;
      }

      // 3. 200KB 이하로 JPEG 압축
      const MAX_BYTES = 200 * 1024;
      const b64Size   = (d: string) => Math.ceil((d.length - d.indexOf(',') - 1) * 3 / 4);
      let quality = 0.9;
      let imageBase64 = canvas.toDataURL('image/jpeg', quality);
      while (b64Size(imageBase64) > MAX_BYTES && quality > 0.2) {
        quality -= 0.1;
        imageBase64 = canvas.toDataURL('image/jpeg', quality);
      }
      if (b64Size(imageBase64) > MAX_BYTES) {
        const shrink = document.createElement('canvas');
        const ratio  = Math.sqrt(MAX_BYTES / b64Size(imageBase64)) * 0.9;
        shrink.width  = Math.max(320, Math.floor(canvas.width  * ratio));
        shrink.height = Math.max(200, Math.floor(canvas.height * ratio));
        shrink.getContext('2d')?.drawImage(canvas, 0, 0, shrink.width, shrink.height);
        imageBase64 = shrink.toDataURL('image/jpeg', 0.7);
      }
      if (b64Size(imageBase64) > MAX_BYTES) {
        flash('이미지 압축에 실패했습니다. 잠시 후 다시 시도해주세요.');
        setSmsSending(false); return;
      }

      // 4. Edge Function 호출 — 입력된 번호 수만큼 순차 발송
      const { data: { session } } = await supabase.auth.getSession();
      const recipientName = tab === 'battery' ? bf.recipient : tab === 'forklift' ? ff.recipient : iff.recipient;
      const results: { phone: string; ok: boolean; error?: string }[] = [];
      for (const phone of phones) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quote-sms`,
            {
              method: 'POST',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${session?.access_token ?? ''}`,
              },
              body: JSON.stringify({
                recipientPhone: phone,
                recipientName,
                imageBase64,
                quoteType: tab,
              }),
            }
          );
          const d = await res.json();
          results.push({ phone, ok: res.ok && !d.error, error: d.error });
        } catch (e: any) {
          results.push({ phone, ok: false, error: e?.message ?? String(e) });
        }
      }
      const okList = results.filter(r => r.ok).map(r => r.phone);
      const failList = results.filter(r => !r.ok);
      if (failList.length === 0) {
        flash(`✅ ${okList.join(', ')}으로 MMS가 발송되었습니다.`);
      } else if (okList.length === 0) {
        flash(`SMS 발송 실패: ${failList.map(f=>`${f.phone} (${f.error ?? '알 수 없는 오류'})`).join(', ')}`);
      } else {
        flash(`✅ ${okList.join(', ')} 발송 완료 / ⚠️ ${failList.map(f=>f.phone).join(', ')} 실패`);
      }
    } catch (e: any) {
      flash(`SMS 오류: ${e?.message ?? e}`);
    }
    setSmsSending(false);
  };

  const sendInstallmentEmail = async () => {
    if(!iff.recipient){flash('수신인을 입력해주세요.');return;}
    if(!iff.recipientEmail){flash('수신 이메일을 입력해주세요.');return;}
    const p=n0(iff.principal),r=n0(iff.annualRate),gp=n0(iff.gracePeriod),im=n0(iff.installmentMonths);
    if(!p||!r||!im){flash('할부원금, 금리, 기간을 입력해주세요.');return;}
    const months=gp+im;
    const{payment}=calcAmortization(p,r,months,iff.startYM,gp);
    const fmtN=(n:number)=>n.toLocaleString('ko-KR');
    setEmailLoading(true);
    try{
      const quoteNo=`HL-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
      await supabase.from('tb_quotations').insert({
        quote_type:'installment',quote_no:quoteNo,quote_date:iff.quoteDate,
        recipient:iff.recipient,recipient_email:iff.recipientEmail,company_name:iff.companyName,
        items:[{name:iff.itemName,spec:iff.itemSpec,qty:1,price:n0(iff.carPrice)||p}],
        notes:[`할부원금: ${fmtN(p)}원`,`연이율: ${r}%`,`기간: ${months}개월`,`월납입액: ${fmtN(payment)}원`,`금융사: ${iff.financeCompany}`],
        total_amount:p,vat_amount:0,grand_total:p,created_by:'admin@rnfkorea.co.kr',
      });
      const{error}=await supabase.functions.invoke('send-quotation',{
        body:{quoteNo,quoteType:'installment',recipient:iff.recipient,email:iff.recipientEmail,
          totalAmount:p,vatAmount:0,grandTotal:p,xlsxBase64:'',fileName:'',
          installmentInfo:{itemName:iff.itemName,itemSpec:iff.itemSpec,companyName:iff.companyName,
            financeCompany:iff.financeCompany,principal:p,annualRate:r,gracePeriod:gp,
            installmentMonths:im,totalMonths:months,payment,startYM:iff.startYM},
          cc:['admin@rnfkorea.co.kr'],
          extraMessage: extraMessage.trim()},
      });
      if(error) throw error;
      flash(`✅ ${iff.recipientEmail}로 할부견적서가 발송되었습니다. (${quoteNo})`);
    }catch(e:any){flash(`발송 오류: ${e.message}`);}
    setEmailLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0a192f] text-white px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">견적서 작성</h1>
            <p className="text-blue-300 text-sm mt-0.5">지게차 · 배터리 견적서 생성 및 이메일 발송</p>
          </div>
          <div className="flex gap-2">
            <button onClick={download} disabled={loading} className="bg-white text-[#0a192f] hover:bg-gray-100 px-4 py-2 rounded text-sm font-medium disabled:opacity-50">📥 Excel 다운로드</button>
            <button onClick={sendEmail} disabled={emailLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">{emailLoading?'발송 중...':'📧 이메일 발송'}</button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto flex">
          {(['battery','forklift','installment'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-orange-500 text-orange-600':'border-transparent text-gray-500'}`}>
              {t==='battery'?'🔋 배터리 견적':t==='forklift'?'🚜 지게차 견적':'💳 할부 견적서'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {msg && <div className={`text-sm px-4 py-2.5 rounded border ${msg.startsWith('✅')?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{msg}</div>}

        {tab==='battery' && <>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">기본 정보</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>수신인 *</Label><Input value={bf.recipient} onChange={e=>setBf(f=>({...f,recipient:e.target.value}))} placeholder="홍길동 / (주)고객업체 홍부장님"/></div>
              <div><Label>이메일 *</Label><Input type="email" value={bf.recipientEmail} onChange={e=>setBf(f=>({...f,recipientEmail:e.target.value}))} placeholder="example@company.com"/></div>
              <div><Label>견적일자</Label><Input type="date" value={bf.quoteDate} onChange={e=>setBf(f=>({...f,quoteDate:e.target.value}))}/></div>
              <div><Label>유효기간</Label><Input value={bf.validPeriod} onChange={e=>setBf(f=>({...f,validPeriod:e.target.value}))}/></div>
              <div><Label>거래조건</Label><Input value={bf.paymentTerms} onChange={e=>setBf(f=>({...f,paymentTerms:e.target.value}))}/></div>
              <div><Label>인도장소</Label><Input value={bf.deliveryPlace} onChange={e=>setBf(f=>({...f,deliveryPlace:e.target.value}))}/></div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">품목</h2>
            <InRow items={bf.items} upd={updB} total={bTotal}/>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">특기사항</h2>
            <NoteEditor notes={bf.notes} onChange={n=>setBf(f=>({...f,notes:n}))}/>
          </div>
        </>}

        {tab==='forklift' && <>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">기본 정보</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>수신인 *</Label><Input value={ff.recipient} onChange={e=>setFf(f=>({...f,recipient:e.target.value}))} placeholder="제일중기 서중원 부장님"/></div>
              <div><Label>이메일 *</Label><Input type="email" value={ff.recipientEmail} onChange={e=>setFf(f=>({...f,recipientEmail:e.target.value}))} placeholder="example@company.com"/></div>
              <div><Label>견적일자</Label><Input type="date" value={ff.quoteDate} onChange={e=>setFf(f=>({...f,quoteDate:e.target.value}))}/></div>
              <div><Label>유효기간</Label><Input value={ff.validPeriod} onChange={e=>setFf(f=>({...f,validPeriod:e.target.value}))}/></div>
              <div><Label>납품일자</Label><Input value={ff.deliveryDate} onChange={e=>setFf(f=>({...f,deliveryDate:e.target.value}))}/></div>
              <div><Label>거래조건</Label><Input value={ff.paymentTerms} onChange={e=>setFf(f=>({...f,paymentTerms:e.target.value}))}/></div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">품목</h2>
            <InRow items={ff.items} upd={updF} total={fTotal}/>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">구입조건</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>선수(계약·인도)금</Label><Input type="number" value={ff.downPayment} onChange={e=>setFf(f=>({...f,downPayment:e.target.value}))} placeholder="0"/></div>
              <div><Label>잔  금</Label><Input type="number" value={ff.balance} onChange={e=>setFf(f=>({...f,balance:e.target.value}))} placeholder="총액-선수금 자동계산"/></div>
              <div><Label>인지대</Label><Input value={ff.stampFee} onChange={e=>setFf(f=>({...f,stampFee:e.target.value}))}/></div>
              <div><Label>등록비</Label><Input value={ff.registrationFee} onChange={e=>setFf(f=>({...f,registrationFee:e.target.value}))}/></div>
              <div><Label>할부금리 (%)</Label><Input type="number" value={ff.installmentRate} onChange={e=>setFf(f=>({...f,installmentRate:e.target.value}))}/></div>
              <div><Label>할부원금</Label><Input type="number" value={ff.installmentPrincipal} onChange={e=>setFf(f=>({...f,installmentPrincipal:e.target.value}))} placeholder="미입력 시 잔금 적용"/></div>
            </div>
            {n0(ff.installmentRate)>0 && fTotal>0 && (()=>{
              const ip=n0(ff.installmentPrincipal)||(fTotal+Math.round(fTotal*.1)-n0(ff.downPayment));
              const r=n0(ff.installmentRate);
              return (
                <div className="mt-4 bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500 mb-2">할부 월납입금 (원금 {fmt(ip)}원 기준)</p>
                  <div className="flex gap-8">
                    {[36,48,60].map(m=>(
                      <div key={m} className="text-center">
                        <p className="text-xs text-gray-500">{m}개월</p>
                        <p className="font-bold text-[#0a192f] text-sm">{fmt(pmt(ip,r,m))}원</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">특기사항</h2>
            <NoteEditor notes={ff.notes} onChange={n=>setFf(f=>({...f,notes:n}))}/>
          </div>
        </>}

        {/* ══ 할부견적서 탭 ══ */}
        {tab==='installment' && <>
          {/* 기본정보 */}
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">기본 정보</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>수신인 *</Label><Input value={iff.recipient} onChange={e=>setIff(f=>({...f,recipient:e.target.value}))} placeholder="홍길동 / (주)고객업체"/></div>
              <div><Label>이메일 *</Label><Input type="email" value={iff.recipientEmail} onChange={e=>setIff(f=>({...f,recipientEmail:e.target.value}))} placeholder="example@company.com"/></div>
              <div><Label>업체명</Label><Input value={iff.companyName} onChange={e=>setIff(f=>({...f,companyName:e.target.value}))} placeholder="(주)고객업체"/></div>
              <div><Label>차량/장비명</Label><Input value={iff.itemName} onChange={e=>setIff(f=>({...f,itemName:e.target.value}))} placeholder="CPD25-A7LIH4-S"/></div>
              <div><Label>규격</Label><Input value={iff.itemSpec} onChange={e=>setIff(f=>({...f,itemSpec:e.target.value}))} placeholder="3.0톤"/></div>
              <div><Label>견적일자</Label><Input type="date" value={iff.quoteDate} onChange={e=>setIff(f=>({...f,quoteDate:e.target.value}))}/></div>
            </div>
          </div>

          {/* 가격 정보 */}
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">가격 정보</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>차량 가격 (원)</Label><Input type="number" value={iff.carPrice} onChange={e=>setIff(f=>({...f,carPrice:e.target.value}))} placeholder="34,040,000"/></div>
              <div><Label>부대 비용 (원)</Label><Input type="number" value={iff.attachmentPrice} onChange={e=>setIff(f=>({...f,attachmentPrice:e.target.value}))} placeholder="옵션, 등록비 등"/></div>
              <div><Label>할부 원금 (원) *</Label><Input type="number" value={iff.principal} onChange={e=>setIff(f=>({...f,principal:e.target.value}))} placeholder="할부금융 신청금액"/></div>
            </div>
          </div>

          {/* 할부 조건 */}
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">할부 조건</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>할부금융사</Label>
                <select value={iff.financeCompany} onChange={e=>setIff(f=>({...f,financeCompany:e.target.value}))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {['NH캐피탈','현대캐피탈','KB캐피탈','하나캐피탈','우리금융캐피탈','BNK캐피탈','ORIX캐피탈','기타'].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div><Label>연이율 (%)</Label><Input type="number" step="0.1" value={iff.annualRate} onChange={e=>setIff(f=>({...f,annualRate:e.target.value}))} placeholder="6.5"/></div>
              <div><Label>시작 년월</Label><Input type="month" value={iff.startYM} onChange={e=>setIff(f=>({...f,startYM:e.target.value}))}/></div>
              <div><Label>거치기간 (개월)</Label><Input type="number" value={iff.gracePeriod} onChange={e=>setIff(f=>({...f,gracePeriod:e.target.value}))} placeholder="0"/></div>
              <div><Label>할부기간 (개월) *</Label><Input type="number" value={iff.installmentMonths} onChange={e=>setIff(f=>({...f,installmentMonths:e.target.value}))} placeholder="36"/></div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-gray-500 mb-1">총 기간</p>
                <p className="font-bold text-[#0a192f]">{n0(iff.gracePeriod)+n0(iff.installmentMonths)}개월
                  {n0(iff.gracePeriod)>0 && <span className="text-gray-400 text-xs ml-1">(거치 {n0(iff.gracePeriod)} + 할부 {n0(iff.installmentMonths)})</span>}
                </p>
              </div>
            </div>

            {/* 상환스케줄 미리보기 */}
            {n0(iff.principal)>0 && n0(iff.annualRate)>0 && n0(iff.installmentMonths)>0 && (()=>{
              const p=n0(iff.principal),r=n0(iff.annualRate),gp=n0(iff.gracePeriod),im=n0(iff.installmentMonths);
              const{payment,rows}=calcAmortization(p,r,gp+im,iff.startYM,gp);
              const totalInterest=rows.reduce((s,row)=>s+row.interest,0);
              return (
                <div className="mt-5">
                  {/* 요약 카드 */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      {label:'할부원금',val:fmt(p)+'원',dark:false},
                      {label:'월 납입액',val:fmt(payment)+'원',dark:true},
                      {label:'총 이자',val:fmt(Math.round(totalInterest))+'원',dark:false},
                      {label:'총 상환액',val:fmt(p+Math.round(totalInterest))+'원',dark:false},
                    ].map(c=>(
                      <div key={c.label} className={`rounded-lg p-3 text-center ${c.dark?'bg-[#0a192f]':'bg-gray-50 border'}`}>
                        <p className={`text-xs mb-1 ${c.dark?'text-blue-300':'text-gray-500'}`}>{c.label}</p>
                        <p className={`font-bold text-sm ${c.dark?'text-orange-400':'text-gray-800'}`}>{c.val}</p>
                      </div>
                    ))}
                  </div>
                  {/* 스케줄 테이블 */}
                  <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#0a192f] text-white sticky top-0">
                        <tr>{['회차','납입일','월납입액','원금','이자','잔액'].map(h=>(
                          <th key={h} className="px-2 py-2 text-center font-medium">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {rows.map((row,i)=>(
                          <tr key={i} className={`border-b ${i%2===0?'bg-gray-50':'bg-white'} ${row.principalPmt===0?'text-gray-400 italic':''}`}>
                            <td className="px-2 py-1.5 text-center">{row.no}</td>
                            <td className="px-2 py-1.5 text-center">{row.date}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{fmt(row.payment)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.principalPmt)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.interest)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.balance)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                          <td colSpan={2} className="px-2 py-2 text-center">합계</td>
                          <td className="px-2 py-2 text-right">{fmt(rows.reduce((s,r)=>s+r.payment,0))}</td>
                          <td className="px-2 py-2 text-right">{fmt(p)}</td>
                          <td className="px-2 py-2 text-right">{fmt(Math.round(totalInterest))}</td>
                          <td className="px-2 py-2 text-right">0</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다.</p>
                </div>
              );
            })()}
          </div>
        </>}

        {/* ══ 이메일 추가 메시지 (공통) ══ */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="font-semibold text-gray-800 mb-2 text-sm">✉️ 이메일 추가 메시지 (선택)</h2>
          <textarea
            value={extraMessage}
            onChange={e=>setExtraMessage(e.target.value)}
            placeholder="예: 항상 저희 제품을 이용해 주셔서 감사합니다. 문의사항 있으시면 언제든 연락 주세요."
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <p className="text-xs text-gray-400 mt-1.5">여기 입력한 문구는 이메일 본문에 그대로 추가됩니다 (첨부 견적서 내용과는 별개).</p>
        </div>

        {/* ══ SMS 발송 공통 영역 ══ */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">📤 SMS(MMS) 발송</h2>
          <div className="flex gap-3">
            <input
              value={smsPhone1}
              onChange={e => setSmsPhone1(e.target.value.replace(/[^0-9-]/g,''))}
              placeholder="010-1234-5678"
              inputMode="tel"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              value={smsPhone2}
              onChange={e => setSmsPhone2(e.target.value.replace(/[^0-9-]/g,''))}
              placeholder="010-1234-5678 (선택)"
              inputMode="tel"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={sendSMS}
              disabled={smsSending || (!smsPhone1.trim() && !smsPhone2.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-medium disabled:opacity-40"
            >
              {smsSending ? '발송 중...' : '📤 MMS 발송'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">견적서 요약 이미지를 MMS로 발송합니다 (번호 2개까지 동시 발송 가능). 발신번호: 1551-1873</p>
        </div>

        {/* ══ 발송 이력 ══ */}
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
                    <tr>{['견적번호','발송일','수신인','총액','발송시각',''].map(h=>(
                      <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {history.map(row=>(
                      <tr key={row.id} className="border-b">
                        <td className="px-2 py-1.5">{row.quote_no}</td>
                        <td className="px-2 py-1.5">{row.quote_date}</td>
                        <td className="px-2 py-1.5">{row.recipient}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(row.grand_total)}원</td>
                        <td className="px-2 py-1.5 text-gray-400">{new Date(row.created_at).toLocaleString('ko-KR')}</td>
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

        {/* ══ 캡처용 미리보기 (hidden, 각 탭 ref) ══ */}
        {/* 배터리 미리보기 */}
        <div style={{ position:'absolute', left:'-9999px', top:0, width:'600px' }}>
          <div ref={batteryPreviewRef} style={{ fontFamily:"'Malgun Gothic','맑은 고딕',sans-serif", background:'#fff', padding:'24px', color:'#1e293b', width:'600px' }}>
            <div style={{ background:'#0a192f', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'6px', marginBottom:'14px' }}>
              <div>
                <div style={{ fontSize:'18px', fontWeight:700, color:'#fff' }}>RNF KOREA</div>
                <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'3px' }}>INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'18px', fontWeight:700, color:'#f97316' }}>배터리 견적서</div>
                <div style={{ fontSize:'10px', color:'#94a3b8' }}>{bf.quoteDate}</div>
              </div>
            </div>
            {bf.recipient && <p style={{ fontSize:'13px', marginBottom:'10px' }}>수신: <strong style={{ color:'#0a192f' }}>{bf.recipient}</strong> 귀중</p>}
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px', marginBottom:'12px' }}>
              <thead>
                <tr>{['No.','품명','규격','수량','단가','금액'].map(h=>(
                  <th key={h} style={{ background:'#0a192f', color:'#fff', padding:'6px 5px', textAlign:'center', fontSize:'10px' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {bf.items.filter(it=>it.name).map((it,i)=>{
                  const amt = n0(it.price)*(n0(it.qty)||1);
                  return (
                    <tr key={i} style={{ background: i%2===0?'#f8fafc':'#fff' }}>
                      <td style={{ padding:'5px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>{i+1}</td>
                      <td style={{ padding:'5px', borderBottom:'1px solid #f1f5f9' }}>{it.name}</td>
                      <td style={{ padding:'5px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>{it.spec}</td>
                      <td style={{ padding:'5px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>{it.qty}</td>
                      <td style={{ padding:'5px', textAlign:'right', borderBottom:'1px solid #f1f5f9' }}>{it.price==='포함'?'포함':fmt(n0(it.price))}</td>
                      <td style={{ padding:'5px', textAlign:'right', borderBottom:'1px solid #f1f5f9', fontWeight:600 }}>{it.price==='포함'?'-':fmt(amt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px' }}>
              {[['공급가액',fmt(bTotal)+'원',false],['부가세(10%)',fmt(Math.round(bTotal*.1))+'원',false],['총액(VAT포함)',fmt(bTotal+Math.round(bTotal*.1))+'원',true]].map(([l,v,dk])=>(
                <div key={l as string} style={{ background:dk?'#0a192f':'#f1f5f9', borderRadius:'6px', padding:'10px', textAlign:'center' }}>
                  <div style={{ fontSize:'9px', color:dk?'#94a3b8':'#64748b', marginBottom:'3px' }}>{l}</div>
                  <div style={{ fontSize:'13px', fontWeight:700, color:dk?'#f97316':'#0a192f' }}>{v}</div>
                </div>
              ))}
            </div>
            <p style={{ marginTop:'12px', fontSize:'9px', color:'#94a3b8', textAlign:'center' }}>주식회사 알앤에프코리아 | TEL: 1551-1873 | rnfkorea.co.kr</p>
          </div>
        </div>

        {/* 지게차 미리보기 */}
        <div style={{ position:'absolute', left:'-9999px', top:0, width:'600px' }}>
          <div ref={forkliftPreviewRef} style={{ fontFamily:"'Malgun Gothic','맑은 고딕',sans-serif", background:'#fff', padding:'24px', color:'#1e293b', width:'600px' }}>
            <div style={{ background:'#0a192f', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'6px', marginBottom:'14px' }}>
              <div>
                <div style={{ fontSize:'18px', fontWeight:700, color:'#fff' }}>RNF KOREA</div>
                <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'3px' }}>INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'18px', fontWeight:700, color:'#f97316' }}>지게차 견적서</div>
                <div style={{ fontSize:'10px', color:'#94a3b8' }}>{ff.quoteDate}</div>
              </div>
            </div>
            {ff.recipient && <p style={{ fontSize:'13px', marginBottom:'10px' }}>수신: <strong style={{ color:'#0a192f' }}>{ff.recipient}</strong> 귀중</p>}
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px', marginBottom:'12px' }}>
              <thead>
                <tr>{['No.','품명','규격','수량','단가','금액'].map(h=>(
                  <th key={h} style={{ background:'#0a192f', color:'#fff', padding:'6px 5px', textAlign:'center', fontSize:'10px' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {ff.items.filter(it=>it.name).map((it,i)=>{
                  const inc = it.price==='포함';
                  const amt = !inc?n0(it.price)*(n0(it.qty)||1):0;
                  return (
                    <tr key={i} style={{ background:i%2===0?'#f8fafc':'#fff' }}>
                      <td style={{ padding:'5px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>{i+1}</td>
                      <td style={{ padding:'5px', borderBottom:'1px solid #f1f5f9' }}>{it.name}</td>
                      <td style={{ padding:'5px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>{it.spec}</td>
                      <td style={{ padding:'5px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>{it.qty}</td>
                      <td style={{ padding:'5px', textAlign:'right', borderBottom:'1px solid #f1f5f9' }}>{inc?'포함':fmt(n0(it.price))}</td>
                      <td style={{ padding:'5px', textAlign:'right', borderBottom:'1px solid #f1f5f9', fontWeight:600 }}>{inc?'포함':fmt(amt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'10px' }}>
              {[['공급가액',fmt(fTotal)+'원',false],['VAT(10%)',fmt(Math.round(fTotal*.1))+'원',false],['총액(VAT포함)',fmt(fTotal+Math.round(fTotal*.1))+'원',true]].map(([l,v,dk])=>(
                <div key={l as string} style={{ background:dk?'#0a192f':'#f1f5f9', borderRadius:'6px', padding:'10px', textAlign:'center' }}>
                  <div style={{ fontSize:'9px', color:dk?'#94a3b8':'#64748b', marginBottom:'3px' }}>{l}</div>
                  <div style={{ fontSize:'13px', fontWeight:700, color:dk?'#f97316':'#0a192f' }}>{v}</div>
                </div>
              ))}
            </div>
            {n0(ff.installmentRate)>0 && fTotal>0 && (()=>{
              const ip=n0(ff.installmentPrincipal)||(fTotal+Math.round(fTotal*.1)-n0(ff.downPayment));
              const r=n0(ff.installmentRate);
              return (
                <div style={{ background:'#f8fafc', borderRadius:'6px', padding:'10px', textAlign:'center' }}>
                  <div style={{ fontSize:'10px', color:'#64748b', marginBottom:'6px' }}>할부 월납입금 (금리 {r}%)</div>
                  <div style={{ display:'flex', justifyContent:'center', gap:'24px' }}>
                    {[36,48,60].map(m=>(
                      <div key={m}>
                        <div style={{ fontSize:'9px', color:'#94a3b8' }}>{m}개월</div>
                        <div style={{ fontSize:'13px', fontWeight:700, color:'#0a192f' }}>{fmt(pmt(ip,r,m))}원</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <p style={{ marginTop:'12px', fontSize:'9px', color:'#94a3b8', textAlign:'center' }}>주식회사 알앤에프코리아 | TEL: 1551-1873 | rnfkorea.co.kr</p>
          </div>
        </div>

        {/* 할부 미리보기 */}
        <div style={{ position:'absolute', left:'-9999px', top:0, width:'600px' }}>
          {(() => {
            const p=n0(iff.principal), r=n0(iff.annualRate), gp=n0(iff.gracePeriod), im=n0(iff.installmentMonths);
            const months=gp+im;
            if (!p||!r||!months) return null;
            const { payment, rows } = calcAmortization(p, r, months, iff.startYM, gp);
            const totalInterest = rows.reduce((s,row)=>s+row.interest,0);
            const periodLabel = gp>0?`${months}개월 (거치 ${gp}+할부 ${im})`:`${months}개월`;
            return (
              <div ref={installmentPreviewRef} style={{ fontFamily:"'Malgun Gothic','맑은 고딕',sans-serif", background:'#fff', padding:'24px', color:'#1e293b', width:'600px' }}>
                <div style={{ background:'#0a192f', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'6px', marginBottom:'14px' }}>
                  <div>
                    <div style={{ fontSize:'18px', fontWeight:700, color:'#fff' }}>RNF KOREA</div>
                    <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'3px' }}>INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'18px', fontWeight:700, color:'#f97316' }}>할부 견적서</div>
                    <div style={{ fontSize:'10px', color:'#94a3b8' }}>{iff.quoteDate}</div>
                  </div>
                </div>
                {iff.recipient && <p style={{ fontSize:'13px', marginBottom:'10px' }}>수신: <strong style={{ color:'#0a192f' }}>{iff.recipient}</strong> 귀중</p>}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', background:'#f8fafc', borderRadius:'6px', padding:'12px', marginBottom:'14px' }}>
                  {[['고객명',iff.recipient],['차량/장비',iff.itemName],['금융사',iff.financeCompany],['연이율',r+'%'],['대출기간',periodLabel],['월납입액',fmt(payment)+'원']].map(([l,v])=>(
                    <div key={l as string}><div style={{ fontSize:'9px', color:'#94a3b8' }}>{l}</div><div style={{ fontWeight:600, color:'#0a192f', fontSize:'12px' }}>{v}</div></div>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom:'14px' }}>
                  {[['할부원금',fmt(p)+'원',false],['월납입액',fmt(payment)+'원',true],['총이자',fmt(Math.round(totalInterest))+'원',false],['총상환액',fmt(p+Math.round(totalInterest))+'원',false]].map(([l,v,dk])=>(
                    <div key={l as string} style={{ background:dk?'#0a192f':'#f1f5f9', borderRadius:'6px', padding:'8px', textAlign:'center' }}>
                      <div style={{ fontSize:'9px', color:dk?'#94a3b8':'#64748b', marginBottom:'3px' }}>{l}</div>
                      <div style={{ fontSize:'12px', fontWeight:700, color:dk?'#f97316':'#0a192f' }}>{v}</div>
                    </div>
                  ))}
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px' }}>
                  <thead>
                    <tr>{['회차','납입일','월납입액','원금','이자','잔액'].map(h=>(
                      <th key={h} style={{ background:'#0a192f', color:'#fff', padding:'6px 4px', textAlign:'center', fontSize:'9px' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {(rows.length > 12 ? rows.slice(0,6) : rows).map(row=>(
                      <tr key={row.no} style={{ background:row.no%2===0?'#f8fafc':'#fff' }}>
                        <td style={{ padding:'4px', textAlign:'center', borderBottom:'1px solid #f1f5f9', color:row.principalPmt===0?'#94a3b8':undefined }}>{row.no}</td>
                        <td style={{ padding:'4px', textAlign:'center', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{row.date}</td>
                        <td style={{ padding:'4px', textAlign:'right', borderBottom:'1px solid #f1f5f9', fontWeight:600 }}>{fmt(row.payment)}</td>
                        <td style={{ padding:'4px', textAlign:'right', borderBottom:'1px solid #f1f5f9' }}>{fmt(row.principalPmt)}</td>
                        <td style={{ padding:'4px', textAlign:'right', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{fmt(row.interest)}</td>
                        <td style={{ padding:'4px', textAlign:'right', borderBottom:'1px solid #f1f5f9' }}>{fmt(row.balance)}</td>
                      </tr>
                    ))}
                    {rows.length > 12 && (
                      <tr><td colSpan={6} style={{ padding:'6px', textAlign:'center', fontSize:'10px', color:'#94a3b8' }}>⋮ 중간 {rows.length-12}회차 생략 ⋮</td></tr>
                    )}
                    {rows.length > 12 && rows.slice(-6).map(row=>(
                      <tr key={row.no} style={{ background:row.no%2===0?'#f8fafc':'#fff' }}>
                        <td style={{ padding:'4px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>{row.no}</td>
                        <td style={{ padding:'4px', textAlign:'center', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{row.date}</td>
                        <td style={{ padding:'4px', textAlign:'right', borderBottom:'1px solid #f1f5f9', fontWeight:600 }}>{fmt(row.payment)}</td>
                        <td style={{ padding:'4px', textAlign:'right', borderBottom:'1px solid #f1f5f9' }}>{fmt(row.principalPmt)}</td>
                        <td style={{ padding:'4px', textAlign:'right', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{fmt(row.interest)}</td>
                        <td style={{ padding:'4px', textAlign:'right', borderBottom:'1px solid #f1f5f9' }}>{fmt(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ marginTop:'10px', fontSize:'9px', color:'#94a3b8', textAlign:'center' }}>※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다. | 주식회사 알앤에프코리아 | TEL: 1551-1873</p>
              </div>
            );
          })()}
        </div>

        <div className="flex gap-3 pb-8">
          <button onClick={download} disabled={loading} className="flex-1 bg-[#0a192f] hover:bg-[#1a3a5f] text-white py-3 rounded-lg font-medium text-sm disabled:opacity-50">
            {loading?'생성 중...':tab==='installment'?'🖨️ PDF 출력 (인쇄)':'📥 Excel 다운로드'}
          </button>
          <button onClick={sendEmail} disabled={emailLoading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium text-sm disabled:opacity-50">
            {emailLoading?'발송 중...':'📧 저장 + 이메일 발송'}
          </button>
        </div>
      </div>
    </div>
  );
}