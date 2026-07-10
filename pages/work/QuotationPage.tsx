// src/pages/work/QuotationPage.tsx
// 견적서·발주서 작성 → PDF 출력 / 이메일 발송 / SMS 발송 / 이력 관리
// 수신 이메일 2개 + 참조 2개 + 전화번호 2개

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { supabase } from '../../lib/supabase';

// ─── 타입 ───────────────────────────────────────────────────
interface Item { name:string; spec:string; qty:number|string; price:number|string; }

// 공통 발송 정보
interface SendInfo {
  recipient:  string;
  email1:     string; email2:     string;
  cc1:        string; cc2:        string;
  phone1:     string; phone2:     string;
  quoteDate:  string;
  extraMsg:   string;
}

interface BatteryForm extends SendInfo {
  validPeriod:string; paymentTerms:string; deliveryPlace:string;
  items:Item[]; notes:string[];
}
interface ForkliftForm extends SendInfo {
  validPeriod:string; deliveryDate:string; paymentTerms:string;
  items:Item[];
  downPayment:string; balance:string; stampFee:string;
  registrationFee:string; installmentRate:string; installmentPrincipal:string;
  installmentMonths:string;
  notes:string[];
}
interface InstallmentForm extends SendInfo {
  companyName:string; itemName:string; itemSpec:string;
  carPrice:number|string; attachmentPrice:number|string;
  principal:number|string; annualRate:number|string;
  gracePeriod:number|string; installmentMonths:number|string;
  financeCompany:string; startYM:string;
}
interface PurchaseForm extends SendInfo {
  receiverName:string;   // 수신 업체명
  items:Item[];
  note:string;
}

interface HistoryRow {
  id:number; quote_type:string; quote_no:string; quote_date:string;
  recipient:string; recipient_email:string; total_amount:number;
  grand_total:number; created_at:string; email_sent:boolean; items:Item[];
  notes:string[]|null;
}

// ─── 상수 ───────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0,10);
const THIS_YM = new Date().toISOString().slice(0,7);
const EM: Item = { name:'', spec:'', qty:'', price:'' };

const SEND0: SendInfo = {
  recipient:'', email1:'', email2:'',
  cc1:'admin@rnfkorea.co.kr', cc2:'ltongs7@gmail.com',
  phone1:'', phone2:'', quoteDate:TODAY, extraMsg:'',
};

const BF0: BatteryForm = {
  ...SEND0,
  validPeriod:'견적 후 30일', paymentTerms:'현  금', deliveryPlace:'현지 운송도',
  items:[
    {name:'LFP 배터리 (Spiderway)',   spec:'25.6V / 150Ah', qty:1, price:1_800_000},
    {name:'설치비',                   spec:'',               qty:1, price:100_000},
    ...Array(8).fill(null).map(()=>({...EM})),
  ],
  notes:[
    '※ LFP(리튬인산철) 배터리 5년 / 10,000시간 무상 보증 (고객과실 제외)',
    '※ BMS 내장, 과충전·과방전·과열 3중 보호 기능 포함',
    '※ 생산물책임보험 가입 제품 (최대 3억원)',
    '※ 유효기간: 발행일로부터 30일',
  ],
};

const FF0: ForkliftForm = {
  ...SEND0,
  validPeriod:'견적 후 30일', deliveryDate:'계약 후 30일 이내',
  paymentTerms:'현금 또는 할부금융',
  items:[
    {name:'CPD25-A7LIH4-S (80V, 202Ah)', spec:'3.0톤',     qty:1, price:34_040_000},
    {name:'3단 마스트',                   spec:'4,500mm',   qty:1, price:'포함'},
    {name:'고속 충전기',                  spec:'380V/100A', qty:1, price:'포함'},
    {name:'전체 캐빈 + 와이퍼',           spec:'',          qty:'', price:'포함'},
    {name:'자동발 (양개식)',              spec:'',          qty:'', price:'포함'},
    {name:'후방카메라',                   spec:'',          qty:'', price:'포함'},
    {name:'전기팬, 히터',                 spec:'',          qty:'', price:'포함'},
    ...Array(3).fill(null).map(()=>({...EM})),
  ],
  downPayment:'', balance:'', stampFee:'-', registrationFee:'-',
  installmentRate:'6.5', installmentPrincipal:'', installmentMonths:'36',
  notes:[
    '※ 1년/2,000시간 중 선도래분 적용 (소모품/고객과실 제외 무상 A/S)',
    '※ 5년/10,000시간 LFP 배터리 무상 보증 (고객과실 제외)',
    '※ 마스트 기본: 2단 3,300mm (3단 선택 시 추가금)',
    '※ 타이어 기본: 전체 통타이어',
    '※ 유효기간: 발행일로부터 30일',
  ],
};

const IF0: InstallmentForm = {
  ...SEND0,
  companyName:'', itemName:'CPD25-A7LIH4-S (전동지게차)', itemSpec:'3.0톤',
  carPrice:'', attachmentPrice:'', principal:'', annualRate:'6.5',
  gracePeriod:'0', installmentMonths:'36',
  financeCompany:'NH캐피탈', startYM:THIS_YM,
};

const PF0: PurchaseForm = {
  ...SEND0,
  receiverName:'',
  items:[
    {name:'', spec:'', qty:1, price:0},
    ...Array(9).fill(null).map(()=>({...EM})),
  ],
  note:'위와 같은 내용으로 발주하오니 납기를 준수하여 납품해 주시기 바랍니다.',
};

// ─── 유틸 ───────────────────────────────────────────────────
const n0  = (v:any) => typeof v==='number'?v:Number(v)||0;
const fmt = (n:number) => n.toLocaleString('ko-KR');
const calcTotal = (items:Item[]) =>
  items.reduce((s,it)=>{ if(!it.price||it.price==='포함') return s; return s+n0(it.price)*(n0(it.qty)||1); },0);

function pmt(p:number, rate:number, months:number) {
  const r = rate/100/12;
  if(r===0||p===0) return 0;
  return Math.round(p*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1));
}

function calcAmortization(p:number, annualRate:number, months:number, startYM:string, grace=0) {
  const r = annualRate/100/12;
  const im = months - grace;
  const payment = im<=0?0:r===0?p/im:(p*r*Math.pow(1+r,im))/(Math.pow(1+r,im)-1);
  const rows: any[] = [];
  let balance = p;
  const [sy,sm] = startYM.split('-').map(Number);
  for(let i=1;i<=months;i++){
    const interest = balance*r;
    const d = new Date(sy, sm-1+(i-1), 1);
    const date = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.01`;
    if(i<=grace){
      rows.push({no:i,date,payment:Math.round(interest),interest:Math.round(interest),principalPmt:0,balance:Math.round(balance)});
    } else {
      const pp = payment-interest;
      balance = Math.max(0,balance-pp);
      rows.push({no:i,date,payment:Math.round(payment),interest:Math.round(interest),principalPmt:Math.round(pp),balance:Math.round(balance)});
    }
  }
  return { payment:Math.round(payment), rows };
}

// ─── 공통 UI ────────────────────────────────────────────────
const Label = ({children}:{children:React.ReactNode}) =>
  <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>;
const Input = (p:React.InputHTMLAttributes<HTMLInputElement>) =>
  <input autoComplete="off" {...p} className={`w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${p.className??''}`}/>;

// ─── Google People API 실시간 연락처 검색 ──────────────────
async function searchGoogleContacts(query: string): Promise<{name:string;email:string}[]> {
  try {
    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('access_token')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!tokenRow?.access_token) return [];
    const res = await fetch(
      `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(query)}&readMask=names,emailAddresses&pageSize=8`,
      { headers: { Authorization: `Bearer ${tokenRow.access_token}` } }
    );
    if (!res.ok) return [];
    const d = await res.json();
    const results: {name:string;email:string}[] = [];
    for (const p of d.results ?? []) {
      const name = p.person?.names?.[0]?.displayName ?? '';
      for (const e of (p.person?.emailAddresses ?? [])) {
        if (e.value) results.push({ name, email: e.value });
      }
    }
    return results;
  } catch { return []; }
}

// ─── 이메일 칩 입력 (Gmail 스타일 + 실시간 연락처 검색) ────
function EmailChipInput({
  label, emails, onChange, placeholder, staticSuggestions,
}: {
  label: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  staticSuggestions?: string[];
}) {
  const [input, setInput]             = useState('');
  const [showSug, setShowSug]         = useState(false);
  const [suggestions, setSuggestions] = useState<{name:string;email:string}[]>([]);
  const [searching, setSearching]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const addEmail = (raw: string) => {
    const parts = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    const valid = parts.filter(isValidEmail).filter(e => !emails.includes(e));
    if (valid.length) onChange([...emails, ...valid]);
    setInput(''); setSuggestions([]); setShowSug(false);
  };

  const addContact = (email: string) => {
    if (!emails.includes(email)) onChange([...emails, email]);
    setInput(''); setSuggestions([]); setShowSug(false);
    inputRef.current?.focus();
  };

  const removeEmail = (idx: number) => onChange(emails.filter((_, i) => i !== idx));

  const handleChange = (val: string) => {
    setInput(val); setShowSug(true);
    clearTimeout(timerRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    const staticMatches = (staticSuggestions ?? [])
      .filter(s => s.toLowerCase().includes(val.toLowerCase()) && !emails.includes(s))
      .map(e => ({ name: '', email: e }));
    setSuggestions(staticMatches.slice(0, 5));
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      const googleResults = await searchGoogleContacts(val);
      const merged = [
        ...googleResults.filter(g => !emails.includes(g.email)),
        ...staticMatches.filter(s => !googleResults.some(g => g.email === s.email)),
      ].slice(0, 8);
      setSuggestions(merged);
      setSearching(false);
    }, 350);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ';', 'Tab'].includes(e.key)) {
      e.preventDefault();
      if (input.trim()) {
        if (suggestions.length > 0 && !isValidEmail(input)) addContact(suggestions[0].email);
        else addEmail(input);
      }
    } else if (e.key === 'Backspace' && !input && emails.length > 0) {
      removeEmail(emails.length - 1);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div
        className="min-h-[42px] border border-gray-300 rounded px-2 py-1.5 flex flex-wrap gap-1.5 cursor-text focus-within:ring-2 focus-within:ring-orange-400 bg-white"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((e, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
            {e}
            <button type="button" onClick={() => removeEmail(i)} className="text-blue-400 hover:text-blue-800 leading-none">✕</button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKey}
            onBlur={() => { if(input.trim()&&isValidEmail(input)) addEmail(input); setTimeout(()=>setShowSug(false),200); }}
            placeholder={emails.length===0?(placeholder??'이름 또는 이메일 입력'):''}
            autoComplete="new-password"
            className="w-full border-0 outline-none text-sm bg-transparent py-0.5"
          />
          {showSug && input.trim().length > 0 && (
            <div className="absolute left-0 top-full z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[280px] mt-1 overflow-hidden">
              {searching && <div className="px-3 py-2 text-xs text-gray-400">⟳ 연락처 검색 중...</div>}
              {!searching && suggestions.length===0 && <div className="px-3 py-2 text-xs text-gray-400">검색 결과 없음</div>}
              {suggestions.map((s, i) => (
                <button key={i} type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-orange-50 flex items-center gap-2.5 border-b border-gray-50 last:border-0"
                  onMouseDown={() => addContact(s.email)}
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(s.name||s.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {s.name && <div className="text-sm font-medium text-gray-800 truncate">{s.name}</div>}
                    <div className="text-xs text-gray-500 truncate">{s.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-0.5">Enter · 쉼표 → 추가 | Backspace → 삭제</p>
    </div>
  );
}

// ─── 발송 정보 공통 폼 ──────────────────────────────────────
function SendInfoForm({
  v, onSendChange, emailSuggestions,
}: {
  v: SendInfo;
  onSendChange: (patch: Partial<SendInfo>) => void;
  emailSuggestions: string[];
}) {
  // 내부적으로 이메일을 배열로 관리
  const toEmails  = v.email1 ? [v.email1, ...(v.email2 ? [v.email2] : [])] : [];
  const ccEmails  = v.cc1    ? [v.cc1,    ...(v.cc2    ? [v.cc2]    : [])] : [];
  const toPhones  = v.phone1 ? [v.phone1, ...(v.phone2 ? [v.phone2] : [])] : [];

  const setToEmails = (arr: string[]) =>
    onSendChange({ email1: arr[0] ?? '', email2: arr[1] ?? '' });
  const setCcEmails = (arr: string[]) =>
    onSendChange({ cc1: arr[0] ?? '', cc2: arr[1] ?? '' });
  const setPhones = (arr: string[]) =>
    onSendChange({ phone1: arr[0] ?? '', phone2: arr[1] ?? '' });

  return (
    <div className="bg-white rounded-lg border p-5 space-y-4">
      <h2 className="font-semibold text-gray-800 text-sm">발송 정보</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>수신인 *</Label>
          <Input value={v.recipient} onChange={e=>onSendChange({recipient:e.target.value})} placeholder="홍길동 부장님"/>
        </div>
        <div>
          <Label>견적일자</Label>
          <Input type="date" value={v.quoteDate} onChange={e=>onSendChange({quoteDate:e.target.value})}/>
        </div>
      </div>
      <EmailChipInput
        label="수신 이메일 (최대 2개)"
        emails={toEmails.filter(Boolean)}
        onChange={setToEmails}
        staticSuggestions={emailSuggestions}
        placeholder="받는 사람 이메일"
      />
      <EmailChipInput
        label="참조(CC)"
        emails={ccEmails.filter(Boolean)}
        onChange={setCcEmails}
        staticSuggestions={emailSuggestions}
        placeholder="참조 이메일"
      />
      <div>
        <Label>전화번호 (SMS/MMS, 최대 2개)</Label>
        <div className="flex flex-wrap gap-1.5 border border-gray-300 rounded px-2 py-1.5 min-h-[40px] cursor-text bg-white" onClick={()=>{}}>
          {toPhones.map((ph,i)=>(
            <span key={i} className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
              {ph}
              <button type="button" onClick={()=>setPhones(toPhones.filter((_,idx)=>idx!==i))} className="text-green-500 hover:text-green-800">✕</button>
            </span>
          ))}
          {toPhones.length < 2 && (
            <input
              placeholder={toPhones.length===0?'010-0000-0000':'전화번호 2'}
              autoComplete="new-password"
              onKeyDown={e=>{
                const inp = e.currentTarget;
                if(['Enter',','].includes(e.key)&&inp.value.trim()){
                  e.preventDefault();
                  if(toPhones.length<2) setPhones([...toPhones,inp.value.trim()]);
                  inp.value='';
                }
              }}
              onBlur={e=>{
                if(e.target.value.trim()&&toPhones.length<2){
                  setPhones([...toPhones,e.target.value.trim()]);
                  e.target.value='';
                }
              }}
              className="flex-1 min-w-[140px] border-0 outline-none text-sm bg-transparent py-0.5"
            />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Enter 또는 쉼표로 추가</p>
      </div>
      <div>
        <Label>추가 메시지</Label>
        <Input value={v.extraMsg} onChange={e=>onSendChange({extraMsg:e.target.value})} placeholder="이메일 본문 추가 내용"/>
      </div>
    </div>
  );
}

// ─── 품목 테이블 (최상위 컴포넌트 — IME 한글 입력 안정화) ──
function ItemTable({items, upd, total}: {items:Item[]; upd:(i:number,k:keyof Item,v:any)=>void; total:number}) {
  return (
    <>
      <table className="w-full text-sm">
        <thead className="bg-[#0a192f] text-white">
          <tr>{['No.','품명','규격','수량','단가(원) / 포함여부','금액(원)'].map(h=>(
            <th key={h} className="px-3 py-2 text-left text-xs font-medium">{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {items.map((it,i)=>{
            const inc = it.price==='포함';
            const amt = !inc?n0(it.price)*(n0(it.qty)||1):0;
            return (
              <tr key={i} className={`border-b ${i%2===0?'bg-gray-50':'bg-white'}`}>
                <td className="px-3 py-1.5 text-gray-400 text-xs text-center w-8">{i+1}</td>
                <td className="px-2 py-1"><input value={it.name} onChange={e=>upd(i,'name',e.target.value)} className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                <td className="px-2 py-1"><input value={it.spec} onChange={e=>upd(i,'spec',e.target.value)} className="w-28 border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                <td className="px-2 py-1"><input type="number" value={it.qty} onChange={e=>upd(i,'qty',e.target.value)} className="w-14 border-0 bg-transparent text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/></td>
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={inc} onChange={e=>upd(i,'price',e.target.checked?'포함':'')}/>
                    <span className="text-xs text-gray-400">포함</span>
                    {!inc&&<input type="number" value={it.price} onChange={e=>upd(i,'price',e.target.value)} className="w-28 border-0 bg-transparent text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1"/>}
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
}

function NoteEditor({notes,onChange}:{notes:string[];onChange:(n:string[])=>void}) {
  return (
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
}

// ─── PDF 프린트 헬퍼 ───────────────────────────────────────
function printHTML(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => { setTimeout(()=>{ win.print(); }, 400); });
}

// ─── PDF HTML: 배터리/지게차 견적서 ────────────────────────
function buildQuoteHTML(type:'battery'|'forklift', form:BatteryForm|ForkliftForm, quoteNo:string) {
  const ff = form as ForkliftForm;
  const total = calcTotal(form.items);
  const vat   = Math.round(total*.1);
  const grand = total+vat;
  const typeLabel = type==='battery'?'배터리':'지게차';
  const itemRows = [...form.items,...Array(Math.max(0,10-form.items.length)).fill({name:'',spec:'',qty:'',price:''})].map((it,i)=>{
    const inc=it.price==='포함';
    const amt=!inc&&it.price?n0(it.price)*(n0(it.qty)||1):0;
    return `<tr style="background:${i%2===0?'#f8fafc':'#fff'}">
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${i+1}</td>
      <td style="padding:5px;border:1px solid #e2e8f0">${it.name||''}</td>
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${it.spec||''}</td>
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${it.qty||''}</td>
      <td style="padding:5px;text-align:right;border:1px solid #e2e8f0">${inc?'포함':it.price?fmt(n0(it.price)):''}</td>
      <td style="padding:5px;text-align:right;font-weight:600;border:1px solid #e2e8f0">${inc?'-':amt?fmt(amt):''}</td>
    </tr>`;
  }).join('');

  const condRows = type==='forklift'?`
    <tr><td style="padding:5px 8px;background:#f1f5f9;font-weight:600;font-size:11px">선수(계약·인도)금</td><td style="padding:5px 8px;text-align:right">${ff.downPayment?fmt(n0(ff.downPayment))+'원':'-'}</td></tr>
    <tr><td style="padding:5px 8px;background:#f1f5f9;font-weight:600;font-size:11px">부가세 (10%)</td><td style="padding:5px 8px;text-align:right">${fmt(vat)}원</td></tr>
    <tr><td style="padding:5px 8px;background:#f1f5f9;font-weight:600;font-size:11px">잔  금</td><td style="padding:5px 8px;text-align:right">${ff.balance?fmt(n0(ff.balance))+'원':'-'}</td></tr>
    <tr><td style="padding:5px 8px;background:#f1f5f9;font-weight:600;font-size:11px">인 지 대</td><td style="padding:5px 8px;text-align:right">${ff.stampFee||'-'}</td></tr>
    <tr><td style="padding:5px 8px;background:#f1f5f9;font-weight:600;font-size:11px">등 록 비</td><td style="padding:5px 8px;text-align:right">${ff.registrationFee||'-'}</td></tr>
    ${ff.installmentRate&&ff.installmentMonths?`
    <tr><td style="padding:5px 8px;background:#f1f5f9;font-weight:600;font-size:11px">할부이용시 (${ff.installmentRate}%)</td><td style="padding:5px 8px;font-size:11px">
      ${[36,48,60].filter(m=>m<=n0(ff.installmentMonths)).map(m=>`${m}개월: ${fmt(pmt(n0(ff.installmentPrincipal)||grand-n0(ff.downPayment),n0(ff.installmentRate),m))}원`).join(' / ')}
    </td></tr>`:''}
  `:'';

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${typeLabel} 견적서 ${quoteNo}</title>
<style>
  @page{size:A4;margin:15mm 14mm;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
  *{box-sizing:border-box;}
  body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12px;color:#1e293b;margin:0;}
  table{border-collapse:collapse;width:100%;}
</style></head><body>
<div style="background:#0a192f;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:6px;margin-bottom:14px">
  <div><div style="font-size:20px;font-weight:700;color:#fff">RNF KOREA</div>
  <div style="font-size:9px;color:#94a3b8;margin-top:3px">INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION</div></div>
  <div style="text-align:right"><div style="font-size:22px;font-weight:700;color:#f97316">${typeLabel} 견적서</div>
  <div style="font-size:9px;color:#94a3b8">No. ${quoteNo}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div style="background:#f8fafc;border-radius:6px;padding:10px">
    <div style="font-size:9px;color:#64748b;margin-bottom:3px">수 신</div>
    <div style="font-size:13px;font-weight:700;color:#0a192f">${form.recipient} 귀중</div>
    <div style="font-size:10px;color:#374151;margin-top:5px">견적일자: ${form.quoteDate} | 유효기간: ${'validPeriod' in form?(form as BatteryForm).validPeriod:'견적 후 30일'}</div>
  </div>
  <div style="background:#f8fafc;border-radius:6px;padding:10px">
    <div style="font-size:9px;color:#64748b;margin-bottom:3px">발 신</div>
    <div style="font-size:12px;font-weight:700;color:#0a192f">주식회사 알앤에프코리아</div>
    <div style="font-size:10px;color:#374151;margin-top:3px">대표: 이동수 | 사업자: 316-88-02901 | 1551-1873</div>
    <div style="font-size:10px;color:#374151">경기도 안산시 단원구 산단로 325</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">
  ${[['납품일자','deliveryDate' in form?ff.deliveryDate:'계약 시 협의'],['인도장소','deliveryPlace' in form?(form as BatteryForm).deliveryPlace:'현지 운송도'],['거래조건','paymentTerms' in form?form.paymentTerms:'현금']].map(([k,v])=>`
  <div style="background:#0a192f;border-radius:4px;padding:7px 10px;display:flex;justify-content:space-between">
    <span style="font-size:9px;color:#94a3b8">${k}</span>
    <span style="font-size:10px;font-weight:600;color:#fff">${v}</span>
  </div>`).join('')}
</div>
<table style="margin-bottom:12px;font-size:11px">
  <thead><tr style="background:#0a192f">
    ${['No.','품  명','규  격','수량','단  가','금  액'].map(h=>`<th style="color:#fff;padding:7px 6px;text-align:center">${h}</th>`).join('')}
  </tr></thead>
  <tbody>${itemRows}</tbody>
  <tfoot><tr style="background:#0a192f">
    <td colspan="5" style="padding:7px;text-align:center;color:#fff;font-weight:700">합  계</td>
    <td style="padding:7px;text-align:right;color:#fff;font-weight:700">${fmt(total)}</td>
  </tr></tfoot>
</table>
<div style="display:grid;grid-template-columns:${type==='forklift'?'1fr 1fr':'repeat(3,1fr)'};gap:6px;margin-bottom:12px">
  ${type==='forklift'?`
  <table style="font-size:11px;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden">
    ${condRows}
    <tr style="background:#0a192f"><td colspan="2" style="padding:7px;text-align:right;color:#f97316;font-weight:700;font-size:14px">총 액 (VAT포함): ${fmt(grand)}원</td></tr>
  </table>
  <div>
    ${form.notes.map(n=>`<div style="font-size:10px;color:#374151;padding:3px 0">${n}</div>`).join('')}
  </div>
  `:`
  ${[['공급가액 (VAT별도)',fmt(total)+'원',false],['부가세 (10%)',fmt(vat)+'원',false],['총액 (VAT포함)',fmt(grand)+'원',true]].map(([l,v,dk])=>`
  <div style="background:${dk?'#0a192f':'#f1f5f9'};border-radius:6px;padding:10px;text-align:center">
    <div style="font-size:9px;color:${dk?'#94a3b8':'#64748b'};margin-bottom:3px">${l}</div>
    <div style="font-size:13px;font-weight:700;color:${dk?'#f97316':'#0a192f'}">${v}</div>
  </div>`).join('')}
  `}
</div>
${type==='battery'?`<div style="background:#f1f5f9;border-radius:6px;padding:10px;margin-bottom:12px">
  <div style="font-size:10px;font-weight:700;color:#0a192f;margin-bottom:5px">특기사항</div>
  ${form.notes.map(n=>`<div style="font-size:10px;color:#374151;padding:2px 0">${n}</div>`).join('')}
</div>`:''}
<div style="background:#0a192f;padding:12px;text-align:center;border-radius:6px;margin-top:8px">
  <div style="color:#fff;font-size:11px;font-weight:700;margin-bottom:4px">상기와 같이 견적을 제출합니다.</div>
  <div style="color:#94a3b8;font-size:9px">TEL: 1551-1873 | 주식회사 알앤에프코리아 | rnfkorea.co.kr</div>
</div>
</body></html>`;
}

// ─── PDF HTML: 발주서 ───────────────────────────────────────
function buildPurchaseHTML(form:PurchaseForm, poNo:string) {
  const total = calcTotal(form.items);
  const vat   = Math.round(total*.1);
  const grand = total+vat;
  const itemRows = [...form.items,...Array(Math.max(0,15-form.items.length)).fill({name:'',spec:'',qty:'',price:0})].map((it,i)=>{
    const amt = it.price&&it.qty?n0(it.price)*n0(it.qty):0;
    return `<tr style="background:${i%2===0?'#f8fafc':'#fff'}">
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${i+1}</td>
      <td style="padding:5px;border:1px solid #e2e8f0">${it.name||''}</td>
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${it.spec||''}</td>
      <td style="padding:5px;text-align:center;border:1px solid #e2e8f0">${it.qty||''}</td>
      <td style="padding:5px;text-align:right;border:1px solid #e2e8f0">${it.price?fmt(n0(it.price)):''}</td>
      <td style="padding:5px;text-align:right;font-weight:600;border:1px solid #e2e8f0">${amt?fmt(amt):''}</td>
      <td style="padding:5px;text-align:right;border:1px solid #e2e8f0">${amt?fmt(Math.round(amt*.1)):''}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>발주서 ${poNo}</title>
<style>@page{size:A4;margin:15mm 14mm;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}*{box-sizing:border-box;}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12px;color:#1e293b;margin:0;}table{border-collapse:collapse;width:100%;}</style>
</head><body>
<div style="background:#0a192f;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:6px;margin-bottom:14px">
  <div><div style="font-size:20px;font-weight:700;color:#fff">RNF KOREA</div>
  <div style="font-size:9px;color:#94a3b8;margin-top:3px">INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION</div></div>
  <div style="text-align:right"><div style="font-size:22px;font-weight:700;color:#f97316">발  주  서</div>
  <div style="font-size:9px;color:#94a3b8">No. ${poNo} | DATE: ${form.quoteDate}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div style="background:#f8fafc;border-radius:6px;padding:10px">
    <div style="font-size:9px;color:#64748b;margin-bottom:3px">수 신</div>
    <div style="font-size:13px;font-weight:700;color:#0a192f">${form.receiverName||form.recipient} 귀중</div>
    <div style="font-size:10px;color:#374151;margin-top:4px">담당: ${form.recipient}</div>
  </div>
  <div style="background:#f8fafc;border-radius:6px;padding:10px">
    <div style="font-size:9px;color:#64748b;margin-bottom:3px">발 주 자</div>
    <div style="font-size:12px;font-weight:700;color:#0a192f">주식회사 알앤에프코리아</div>
    <div style="font-size:10px;color:#374151;margin-top:3px">대표: 이동수 | 사업자: 316-88-02901</div>
    <div style="font-size:10px;color:#374151">경기도 안산시 단원구 산단로 325 | 1551-1873</div>
  </div>
</div>
<div style="background:#f1f5f9;border-radius:6px;padding:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
  <div style="font-size:11px;color:#374151">합계금액 (세액포함)</div>
  <div style="font-size:16px;font-weight:700;color:#0a192f">${fmt(grand)} 원정</div>
</div>
<table style="margin-bottom:12px;font-size:11px">
  <thead><tr style="background:#0a192f">
    ${['No.','품  목','규  격','수량','단가 (원)','공급가액 (원)','세액 (원)'].map(h=>`<th style="color:#fff;padding:7px 5px;text-align:center">${h}</th>`).join('')}
  </tr></thead>
  <tbody>${itemRows}</tbody>
  <tfoot>
    <tr style="background:#0a192f">
      <td colspan="5" style="padding:7px;text-align:center;color:#fff;font-weight:700">합  계</td>
      <td style="padding:7px;text-align:right;color:#fff;font-weight:700">${fmt(total)}</td>
      <td style="padding:7px;text-align:right;color:#fff;font-weight:700">${fmt(vat)}</td>
    </tr>
  </tfoot>
</table>
${form.note?`<div style="background:#f8fafc;border-radius:6px;padding:10px;margin-bottom:12px;font-size:11px;color:#374151">${form.note}</div>`:''}
<div style="background:#0a192f;padding:12px;text-align:center;border-radius:6px">
  <div style="color:#fff;font-size:11px;font-weight:700;margin-bottom:4px">아래와 같이 발주합니다.</div>
  <div style="color:#94a3b8;font-size:9px">TEL: 1551-1873 | 주식회사 알앤에프코리아 | rnfkorea.co.kr</div>
</div>
</body></html>`;
}

// ─── 메인 페이지 ────────────────────────────────────────────
type TabType = 'battery'|'forklift'|'installment'|'purchase'|'history';

export default function QuotationPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>('battery');
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const t = searchParams.get('type') as TabType;
    if(t && ['battery','forklift','installment','purchase'].includes(t)) setTab(t);
  }, [searchParams]);

  const [bf, setBf]   = useState<BatteryForm>(BF0);
  const [ff, setFf]   = useState<ForkliftForm>(FF0);
  const [iff, setIff] = useState<InstallmentForm>(IF0);
  const [pf, setPf]   = useState<PurchaseForm>(PF0);

  const [loading, setLoading]           = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [smsSending, setSmsSending]     = useState(false);
  const [msg, setMsg]                   = useState('');
  const [previewHtml, setPreviewHtml]   = useState('');
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [history, setHistory]           = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const batteryPreviewRef    = useRef<HTMLDivElement>(null);
  const forkliftPreviewRef   = useRef<HTMLDivElement>(null);
  const installmentPreviewRef= useRef<HTMLDivElement>(null);
  const purchasePreviewRef   = useRef<HTMLDivElement>(null);

  const flash = (m:string) => { setMsg(m); setTimeout(()=>setMsg(''),5000); };

  // ── 이력 → 폼 불러오기
  const loadFromHistory = (row: HistoryRow) => {
    const type = row.quote_type as TabType;
    const baseInfo = {
      recipient: row.recipient || '',
      email1:    row.recipient_email || '',
      email2:    '',
      quoteDate: TODAY,
    };
    if (type === 'battery') {
      setBf(prev => ({
        ...prev, ...baseInfo,
        items: row.items?.length ? row.items : prev.items,
        notes: row.notes?.length ? row.notes : prev.notes,
      }));
      setTab('battery');
    } else if (type === 'forklift') {
      setFf(prev => ({
        ...prev, ...baseInfo,
        items: row.items?.length ? row.items : prev.items,
        notes: row.notes?.length ? row.notes : prev.notes,
      }));
      setTab('forklift');
    } else if (type === 'installment') {
      setIff(prev => ({ ...prev, ...baseInfo }));
      setTab('installment');
    } else if (type === 'purchase') {
      setPf(prev => ({
        ...prev, ...baseInfo,
        items: row.items?.length ? row.items : prev.items,
      }));
      setTab('purchase');
    } else {
      flash('지원하지 않는 유형입니다.');
      return;
    }
    flash(`✅ ${row.recipient} 데이터를 불러왔습니다. 수정 후 발송하세요.`);
  };

  // ── 미리보기 생성
  const handlePreview = () => {
    let html = '';
    const no = genNo(tab==='battery'?'BT':tab==='forklift'?'FL':tab==='installment'?'HL':'PO');
    if(tab==='battery')      html = buildQuoteHTML('battery',  bf, no);
    else if(tab==='forklift')html = buildQuoteHTML('forklift', ff, no);
    else if(tab==='purchase')html = buildPurchaseHTML(pf, no);
    else if(tab==='installment') {
      // 할부는 간단한 요약 미리보기
      const p2=n0(iff.principal),r=n0(iff.annualRate),gp=n0(iff.gracePeriod),im=n0(iff.installmentMonths);
      if(p2&&r&&im){
        const{payment}=calcAmortization(p2,r,gp+im,iff.startYM,gp);
        html=`<div style="font-family:'맑은 고딕',sans-serif;padding:20px;font-size:12px">
          <div style="background:#0a192f;padding:14px 18px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between">
            <div style="color:#fff;font-size:16px;font-weight:700">RNF KOREA</div>
            <div style="color:#f97316;font-size:16px;font-weight:700">할부 견적서</div>
          </div>
          <p style="font-size:13px;margin-bottom:10px">수신: <strong>${iff.recipient||'(수신인 미입력)'}</strong> 귀중</p>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">
            <div style="background:#f1f5f9;border-radius:4px;padding:10px"><div style="font-size:9px;color:#64748b">할부원금</div><div style="font-size:15px;font-weight:700;color:#0a192f">${fmt(p2)}원</div></div>
            <div style="background:#0a192f;border-radius:4px;padding:10px"><div style="font-size:9px;color:#94a3b8">월 납입액 (${iff.financeCompany})</div><div style="font-size:15px;font-weight:700;color:#f97316">${fmt(payment)}원</div></div>
          </div>
          <div style="background:#f8fafc;border-radius:4px;padding:10px;font-size:11px">
            <div>차량/장비: ${iff.itemName} ${iff.itemSpec}</div>
            <div>연이율: ${r}% | 기간: ${gp+im}개월${gp>0?` (거치 ${gp}+할부 ${im})`:''}</div>
          </div>
        </div>`;
      } else { flash('할부원금, 금리, 기간을 먼저 입력해주세요.'); return; }
    }
    if(html){ setPreviewHtml(html); setPreviewOpen(true); }
  };

  const bTotal = calcTotal(bf.items);
  const fTotal = calcTotal(ff.items);
  const pTotal = calcTotal(pf.items);

  // ── 이메일 자동완성 소스 로드 (기존 발송 이력 + 기본값)
  useEffect(() => {
    // 기존 발송 이력에서 이메일 수집
    supabase.from('tb_quotations')
      .select('recipient_email')
      .not('recipient_email','is',null)
      .order('created_at',{ascending:false})
      .limit(50)
      .then(async ({data}) => {
        const base = Array.from(new Set([
          'admin@rnfkorea.co.kr',
          'ltongs7@gmail.com',
          ...(data??[]).map((r:any)=>r.recipient_email).filter(Boolean),
        ]));

        // Google 주소록에서 연락처 이메일 추가 (google-calendar-tokens 재활용)
        try {
          const { data: tokenRow } = await supabase
            .from('google_calendar_tokens')
            .select('access_token')
            .eq('gcal_email','admin@rnfkorea.co.kr')
            .maybeSingle();

          if (tokenRow?.access_token) {
            const res = await fetch(
              'https://people.googleapis.com/v1/people/me/connections?personFields=emailAddresses,names&pageSize=200&sortOrder=LAST_MODIFIED_DESCENDING',
              { headers: { Authorization: `Bearer ${tokenRow.access_token}` } }
            );
            if (res.ok) {
              const d = await res.json();
              const googleEmails = (d.connections ?? [])
                .flatMap((p:any) => (p.emailAddresses ?? []).map((e:any) => e.value))
                .filter(Boolean);
              const merged = Array.from(new Set([...base, ...googleEmails]));
              setEmailSuggestions(merged);
              return;
            }
          }
        } catch { /* Google 연락처 로드 실패 시 기존 이력만 사용 */ }

        setEmailSuggestions(base);
      });
  }, []);

  // ── 공통 발송정보 업데이터
  const updSend = (setter:any) => (patch: Partial<SendInfo>) =>
    setter((f:any) => ({...f, ...patch}));

  // ── 히스토리 로드
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data } = await supabase.from('tb_quotations')
      .select('id,quote_type,quote_no,quote_date,recipient,recipient_email,total_amount,grand_total,created_at,email_sent,items,notes')
      .order('created_at',{ascending:false}).limit(30);
    setHistory((data??[]) as HistoryRow[]);
    setHistoryLoading(false);
  }, []);

  useEffect(() => { if(tab==='history') loadHistory(); }, [tab, loadHistory]);

  // ── 견적번호 생성
  const genNo = (prefix:string) =>
    `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

  // ── 현재 폼 정보 추출
  const currentSend = (): SendInfo =>
    tab==='battery'?bf:tab==='forklift'?ff:tab==='installment'?iff:pf;

  const currentQuoteType = () =>
    tab==='purchase'?'purchase':tab;

  // ── PDF 출력 (인쇄)
  const handlePrint = () => {
    const s = currentSend();
    const no = genNo(tab==='battery'?'BT':tab==='forklift'?'FL':tab==='installment'?'HL':'PO');
    let html = '';
    if(tab==='battery')  html = buildQuoteHTML('battery',  bf, no);
    if(tab==='forklift') html = buildQuoteHTML('forklift', ff, no);
    if(tab==='purchase') html = buildPurchaseHTML(pf, no);
    if(tab==='installment') { downloadInstallmentPDF(); return; }
    if(html) {
      // 히스토리 저장
      const total = tab==='battery'?bTotal:pTotal;
      const vat   = Math.round(total*.1);
      supabase.from('tb_quotations').insert({
        quote_type: currentQuoteType(), quote_no: no,
        quote_date: s.quoteDate, recipient: s.recipient,
        recipient_email: s.email1, items: tab==='battery'?bf.items:pf.items,
        notes: tab==='battery'?bf.notes:null,
        total_amount: total, vat_amount: vat, grand_total: total+vat,
        created_by:'admin@rnfkorea.co.kr',
      }).then(({error})=>{ if(error) console.error('[이력저장오류]', error.message, error.details); });
      printHTML(html);
    }
  };

  // ── 이메일 발송
  const handleEmail = async () => {
    const s = currentSend();
    if(!s.recipient) { flash('수신인을 입력해주세요.'); return; }
    if(!s.email1)    { flash('수신 이메일을 1개 이상 입력해주세요.'); return; }
    if(tab==='installment') { await sendInstallmentEmail(); return; }
    setEmailLoading(true);
    try {
      const no    = genNo(tab==='battery'?'BT':tab==='forklift'?'FL':'PO');
      const total = tab==='battery'?bTotal:tab==='forklift'?fTotal:pTotal;
      const vat   = Math.round(total*.1);
      const grand = total+vat;
      const items = tab==='battery'?bf.items:tab==='forklift'?ff.items:pf.items;
      const notes = tab==='battery'?bf.notes:tab==='forklift'?ff.notes:null;

      // DB 저장
      await supabase.from('tb_quotations').insert({
        quote_type: currentQuoteType(), quote_no: no,
        quote_date: s.quoteDate, recipient: s.recipient,
        recipient_email: s.email1, items, notes,
        total_amount: total, vat_amount: vat, grand_total: grand,
        created_by:'admin@rnfkorea.co.kr',
      });

      // HTML 생성
      let html='';
      if(tab==='battery')  html=buildQuoteHTML('battery', bf, no);
      if(tab==='forklift') html=buildQuoteHTML('forklift',ff, no);
      if(tab==='purchase') html=buildPurchaseHTML(pf, no);

      // 수신 목록
      const toList  = [s.email1, s.email2].filter(Boolean);
      const ccList  = [s.cc1, s.cc2].filter(Boolean);

      const { error } = await supabase.functions.invoke('send-quotation', {
        body: {
          quoteNo: no, quoteType: currentQuoteType(),
          recipient: s.recipient,
          toList, ccList,
          totalAmount: total, vatAmount: vat, grandTotal: grand,
          htmlBody: html,
          extraMessage: s.extraMsg,
          fileName:'',  xlsxBase64:'',  // PDF 방식 — 첨부 없음
        },
      });
      if(error) throw error;

      // 이메일 발송 상태 업데이트
      await supabase.from('tb_quotations')
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq('quote_no', no);

      flash(`✅ ${toList.join(', ')}로 발송 완료 (${no})`);
    } catch(e:any) { flash(`발송 오류: ${e.message}`); }
    setEmailLoading(false);
  };

  // ── SMS(MMS) 발송
  const handleSMS = async () => {
    const s = currentSend();
    const phones = [s.phone1, s.phone2].filter(Boolean);
    if(phones.length===0) { flash('전화번호를 1개 이상 입력해주세요.'); return; }
    const ref = tab==='battery'?batteryPreviewRef:tab==='forklift'?forkliftPreviewRef:
                tab==='installment'?installmentPreviewRef:purchasePreviewRef;
    if(!ref.current) { flash('미리보기 영역을 찾을 수 없습니다.'); return; }
    setSmsSending(true);
    try {
      let canvas = await html2canvas(ref.current,{scale:1.5,backgroundColor:'#ffffff'});
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
      if(b64size(img)>MAX_BYTES){flash('이미지 압축 실패');setSmsSending(false);return;}
      const {data:{session}} = await supabase.auth.getSession();
      const results:string[]=[];
      for(const phone of phones){
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quote-sms`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token??''}`},
          body:JSON.stringify({recipientPhone:phone,recipientName:s.recipient,imageBase64:img,quoteType:tab}),
        });
        const d=await res.json();
        results.push(d.success||!d.error?`${phone} ✅`:`${phone} ❌`);
      }
      flash(`MMS 발송: ${results.join(', ')}`);
    } catch(e:any){flash(`SMS 오류: ${e.message}`);}
    setSmsSending(false);
  };

  // ── 할부견적서 PDF
  const downloadInstallmentPDF = () => {
    const p=n0(iff.principal),r=n0(iff.annualRate),gp=n0(iff.gracePeriod),im=n0(iff.installmentMonths);
    const months=gp+im;
    if(!p||!r||!months){flash('할부원금, 금리, 기간을 입력해주세요.');return;}
    const{payment,rows}=calcAmortization(p,r,months,iff.startYM,gp);
    const totalInterest=rows.reduce((s:number,row:any)=>s+row.interest,0);
    const totalPayment =rows.reduce((s:number,row:any)=>s+row.payment,0);
    const fmtN=(n:number)=>n.toLocaleString('ko-KR');
    const periodLabel=gp>0?`${months}개월 (거치 ${gp}+할부 ${im})`:`${months}개월`;
    const tRows=rows.map((row:any)=>`<tr class="${row.principalPmt===0?'grace':''}">
      <td style="text-align:center">${row.no}</td><td style="text-align:center">${row.date}</td>
      <td style="text-align:right">${fmtN(row.payment)}</td><td style="text-align:right">${fmtN(row.principalPmt)}</td>
      <td style="text-align:right">${fmtN(row.interest)}</td><td style="text-align:right">${fmtN(row.balance)}</td>
    </tr>`).join('');
    const html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>할부견적서</title>
<style>@page{size:A4;margin:15mm 14mm;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}*{box-sizing:border-box;}body{font-family:'맑은 고딕',sans-serif;font-size:11px;color:#1e293b;}
table{border-collapse:collapse;width:100%;}th{background:#0a192f;color:#fff;padding:6px 4px;font-size:10px;}
td{padding:5px 4px;border-bottom:1px solid #f1f5f9;}tr:nth-child(even) td{background:#f8fafc;}
tr.grace td{color:#94a3b8;font-style:italic;}.tfoot td{background:#e2e8f0;font-weight:700;border-top:2px solid #94a3b8;}</style></head><body>
<div style="background:#0a192f;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-radius:6px;margin-bottom:12px">
  <div style="color:#fff;font-size:18px;font-weight:700">RNF KOREA</div>
  <div style="text-align:right"><div style="color:#f97316;font-size:20px;font-weight:700">할부 견적서</div>
  <div style="color:#94a3b8;font-size:9px">${iff.quoteDate}</div></div>
</div>
${iff.recipient?`<p style="font-size:13px;margin-bottom:10px">수신: <strong>${iff.recipient}${iff.companyName?` (${iff.companyName})`:''}</strong> 귀중</p>`:''}
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
  ${[[`할부원금`,fmtN(p)+'원',false],[`월 납입액`,fmtN(payment)+'원',true],[`총 이자`,fmtN(Math.round(totalInterest))+'원',false],[`총 상환액`,fmtN(p+Math.round(totalInterest))+'원',false]].map(([l,v,dk])=>`
  <div style="background:${dk?'#0a192f':'#f1f5f9'};border-radius:6px;padding:8px;text-align:center">
    <div style="font-size:9px;color:${dk?'#94a3b8':'#64748b'};margin-bottom:3px">${l}</div>
    <div style="font-size:12px;font-weight:700;color:${dk?'#f97316':'#0a192f'}">${v}</div>
  </div>`).join('')}
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:#f8fafc;border-radius:6px;padding:10px;margin-bottom:12px">
  ${[['금융사',iff.financeCompany],['연이율',r+'%'],['대출기간',periodLabel],['차량/장비',iff.itemName],['규격',iff.itemSpec],['고객명',iff.recipient]].map(([l,v])=>`
  <div><div style="font-size:9px;color:#94a3b8">${l}</div><div style="font-weight:600;color:#0a192f;font-size:11px">${v}</div></div>`).join('')}
</div>
<table>
  <thead><tr><th>회차</th><th>납입일</th><th>월납입액</th><th>원금</th><th>이자</th><th>잔액</th></tr></thead>
  <tbody>${tRows}</tbody>
  <tfoot><tr class="tfoot">
    <td colspan="2" style="text-align:center">합계</td>
    <td style="text-align:right">${fmtN(totalPayment)}</td>
    <td style="text-align:right">${fmtN(p)}</td>
    <td style="text-align:right">${fmtN(Math.round(totalInterest))}</td>
    <td style="text-align:right">0</td>
  </tr></tfoot>
</table>
<p style="margin-top:10px;font-size:9px;color:#94a3b8;text-align:center">※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다. | 주식회사 알앤에프코리아 | 1551-1873</p>
</body></html>`;
    const no = genNo('HL');
    const {principal:princ,...rest}=iff;
    supabase.from('tb_quotations').insert({
      quote_type:'installment',quote_no:no,quote_date:iff.quoteDate,
      recipient:iff.recipient,recipient_email:iff.email1,
      items:[{name:iff.itemName,spec:iff.itemSpec,qty:1,price:n0(iff.carPrice)||p}],
      notes:[`할부원금:${fmtN(p)}원`,`연이율:${r}%`,`기간:${months}개월`,`월납입:${fmtN(payment)}원`,`금융사:${iff.financeCompany}`],
      total_amount:p,vat_amount:0,grand_total:p,created_by:'admin@rnfkorea.co.kr',
    }).then(()=>{});
    printHTML(html);
  };

  const sendInstallmentEmail = async () => {
    const p=n0(iff.principal),r=n0(iff.annualRate),gp=n0(iff.gracePeriod),im=n0(iff.installmentMonths);
    if(!iff.recipient){flash('수신인을 입력해주세요.');return;}
    if(!iff.email1){flash('수신 이메일을 입력해주세요.');return;}
    if(!p||!r||!im){flash('할부원금, 금리, 기간을 입력해주세요.');return;}
    const months=gp+im;
    const{payment}=calcAmortization(p,r,months,iff.startYM,gp);
    const fmtN=(n:number)=>n.toLocaleString('ko-KR');
    setEmailLoading(true);
    try{
      const no=genNo('HL');
      const toList=[iff.email1,iff.email2].filter(Boolean);
      const ccList=[iff.cc1,iff.cc2].filter(Boolean);
      await supabase.from('tb_quotations').insert({
        quote_type:'installment',quote_no:no,quote_date:iff.quoteDate,
        recipient:iff.recipient,recipient_email:iff.email1,
        items:[{name:iff.itemName,spec:iff.itemSpec,qty:1,price:n0(iff.carPrice)||p}],
        notes:[`할부원금:${fmtN(p)}원`,`연이율:${r}%`,`기간:${months}개월`,`월납입:${fmtN(payment)}원`,`금융사:${iff.financeCompany}`],
        total_amount:p,vat_amount:0,grand_total:p,created_by:'admin@rnfkorea.co.kr',
      });
      const{error}=await supabase.functions.invoke('send-quotation',{
        body:{quoteNo:no,quoteType:'installment',recipient:iff.recipient,toList,ccList,
          totalAmount:p,vatAmount:0,grandTotal:p,htmlBody:'',extraMessage:iff.extraMsg,
          installmentInfo:{itemName:iff.itemName,financeCompany:iff.financeCompany,
            principal:p,annualRate:r,gracePeriod:gp,installmentMonths:im,totalMonths:months,payment}},
      });
      if(error) throw error;
      flash(`✅ ${toList.join(', ')}로 발송 완료 (${no})`);
    }catch(e:any){flash(`발송 오류: ${e.message}`);}
    setEmailLoading(false);
  };

  const updB=(i:number,k:keyof Item,v:any)=>setBf(f=>{const items=[...f.items];items[i]={...items[i],[k]:v};return{...f,items};});
  const updF=(i:number,k:keyof Item,v:any)=>setFf(f=>{const items=[...f.items];items[i]={...items[i],[k]:v};return{...f,items};});
  const updP=(i:number,k:keyof Item,v:any)=>setPf(f=>{const items=[...f.items];items[i]={...items[i],[k]:v};return{...f,items};});

  const TABS:[TabType,string][] = [['battery','🔋 배터리'],['forklift','🚜 지게차'],['installment','💳 할부'],['purchase','📝 발주서'],['history','📋 이력']];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-[#0a192f] text-white px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={()=>navigate('/work/secretary?tab=quotation')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              ← AI비서
            </button>
            <div>
              <h1 className="text-xl font-bold">견적서 · 발주서</h1>
              <p className="text-blue-300 text-sm mt-0.5">PDF 출력 · 이메일 · SMS 발송</p>
            </div>
          </div>
          {tab!=='history' && (
            <div className="flex gap-2 flex-wrap justify-end">
              <button onClick={handlePreview} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded text-sm font-medium">
                👁 미리보기
              </button>
              <button onClick={handlePrint} disabled={loading} className="bg-white text-[#0a192f] hover:bg-gray-100 px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
                🖨️ PDF 출력
              </button>
              <button onClick={handleEmail} disabled={emailLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
                {emailLoading?'발송 중...':'📧 이메일 발송'}
              </button>
              <button onClick={handleSMS} disabled={smsSending} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">
                {smsSending?'발송 중...':'📤 MMS 발송'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto flex">
          {TABS.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-orange-500 text-orange-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {msg && (
          <div className={`text-sm px-4 py-2.5 rounded border ${msg.startsWith('✅')?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{msg}</div>
        )}

        {/* ══ 배터리 탭 ══ */}
        {tab==='battery' && <>
          <SendInfoForm v={bf} onSendChange={updSend(setBf)} emailSuggestions={emailSuggestions}/>
          <div className="bg-white rounded-lg border p-5 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>유효기간</Label><Input value={bf.validPeriod} onChange={e=>setBf(f=>({...f,validPeriod:e.target.value}))}/></div>
              <div><Label>거래조건</Label><Input value={bf.paymentTerms} onChange={e=>setBf(f=>({...f,paymentTerms:e.target.value}))}/></div>
              <div><Label>인도장소</Label><Input value={bf.deliveryPlace} onChange={e=>setBf(f=>({...f,deliveryPlace:e.target.value}))}/></div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">품목</h2>
            <ItemTable items={bf.items} upd={updB} total={bTotal}/>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">특기사항</h2>
            <NoteEditor notes={bf.notes} onChange={n=>setBf(f=>({...f,notes:n}))}/>
          </div>
        </>}

        {/* ══ 지게차 탭 ══ */}
        {tab==='forklift' && <>
          <SendInfoForm v={ff} onSendChange={updSend(setFf)} emailSuggestions={emailSuggestions}/>
          <div className="bg-white rounded-lg border p-5">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>유효기간</Label><Input value={ff.validPeriod} onChange={e=>setFf(f=>({...f,validPeriod:e.target.value}))}/></div>
              <div><Label>납품일자</Label><Input value={ff.deliveryDate} onChange={e=>setFf(f=>({...f,deliveryDate:e.target.value}))}/></div>
              <div><Label>거래조건</Label><Input value={ff.paymentTerms} onChange={e=>setFf(f=>({...f,paymentTerms:e.target.value}))}/></div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">품목</h2>
            <ItemTable items={ff.items} upd={updF} total={fTotal}/>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">구입조건</h2>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>선수금</Label><Input type="number" value={ff.downPayment} onChange={e=>setFf(f=>({...f,downPayment:e.target.value}))} placeholder="0"/></div>
              <div><Label>잔금</Label><Input type="number" value={ff.balance} onChange={e=>setFf(f=>({...f,balance:e.target.value}))}/></div>
              <div><Label>인지대</Label><Input value={ff.stampFee} onChange={e=>setFf(f=>({...f,stampFee:e.target.value}))}/></div>
              <div><Label>등록비</Label><Input value={ff.registrationFee} onChange={e=>setFf(f=>({...f,registrationFee:e.target.value}))}/></div>
              <div><Label>할부금리(%)</Label><Input type="number" value={ff.installmentRate} onChange={e=>setFf(f=>({...f,installmentRate:e.target.value}))}/></div>
              <div><Label>할부원금</Label><Input type="number" value={ff.installmentPrincipal} onChange={e=>setFf(f=>({...f,installmentPrincipal:e.target.value}))}/></div>
            </div>
            {n0(ff.installmentRate)>0&&fTotal>0&&(()=>{
              const ip=n0(ff.installmentPrincipal)||(fTotal+Math.round(fTotal*.1)-n0(ff.downPayment));
              const r=n0(ff.installmentRate);
              return(
                <div className="mt-4 bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500 mb-2">할부 월납입금 (원금 {fmt(ip)}원)</p>
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

        {/* ══ 할부 탭 ══ */}
        {tab==='installment' && <>
          <SendInfoForm v={iff} onSendChange={updSend(setIff)} emailSuggestions={emailSuggestions}/>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">기본 정보</h2>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>업체명</Label><Input value={iff.companyName} onChange={e=>setIff(f=>({...f,companyName:e.target.value}))}/></div>
              <div><Label>차량/장비명</Label><Input value={iff.itemName} onChange={e=>setIff(f=>({...f,itemName:e.target.value}))}/></div>
              <div><Label>규격</Label><Input value={iff.itemSpec} onChange={e=>setIff(f=>({...f,itemSpec:e.target.value}))}/></div>
              <div><Label>차량가격(원)</Label><Input type="number" value={iff.carPrice} onChange={e=>setIff(f=>({...f,carPrice:e.target.value}))}/></div>
              <div><Label>부대비용(원)</Label><Input type="number" value={iff.attachmentPrice} onChange={e=>setIff(f=>({...f,attachmentPrice:e.target.value}))}/></div>
              <div><Label>할부원금(원) *</Label><Input type="number" value={iff.principal} onChange={e=>setIff(f=>({...f,principal:e.target.value}))}/></div>
              <div><Label>할부금융사</Label>
                <select value={iff.financeCompany} onChange={e=>setIff(f=>({...f,financeCompany:e.target.value}))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {['NH캐피탈','현대캐피탈','KB캐피탈','하나캐피탈','우리금융캐피탈','BNK캐피탈','ORIX캐피탈','기타'].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div><Label>연이율(%)</Label><Input type="number" step="0.1" value={iff.annualRate} onChange={e=>setIff(f=>({...f,annualRate:e.target.value}))}/></div>
              <div><Label>시작 년월</Label><Input type="month" value={iff.startYM} onChange={e=>setIff(f=>({...f,startYM:e.target.value}))}/></div>
              <div><Label>거치기간(개월)</Label><Input type="number" value={iff.gracePeriod} onChange={e=>setIff(f=>({...f,gracePeriod:e.target.value}))}/></div>
              <div><Label>할부기간(개월) *</Label><Input type="number" value={iff.installmentMonths} onChange={e=>setIff(f=>({...f,installmentMonths:e.target.value}))}/></div>
            </div>
            {n0(iff.principal)>0&&n0(iff.annualRate)>0&&n0(iff.installmentMonths)>0&&(()=>{
              const p2=n0(iff.principal),r=n0(iff.annualRate),gp=n0(iff.gracePeriod),im=n0(iff.installmentMonths);
              const{payment,rows}=calcAmortization(p2,r,gp+im,iff.startYM,gp);
              const totalInterest=rows.reduce((s:number,row:any)=>s+row.interest,0);
              return(
                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[['할부원금',fmt(p2)+'원',false],['월납입액',fmt(payment)+'원',true],['총이자',fmt(Math.round(totalInterest))+'원',false],['총상환액',fmt(p2+Math.round(totalInterest))+'원',false]].map(([l,v,dk])=>(
                      <div key={l as string} className={`rounded-lg p-3 text-center ${dk?'bg-[#0a192f]':'bg-gray-50 border'}`}>
                        <p className={`text-xs mb-1 ${dk?'text-blue-300':'text-gray-500'}`}>{l}</p>
                        <p className={`font-bold text-sm ${dk?'text-orange-400':'text-gray-800'}`}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#0a192f] text-white sticky top-0">
                        <tr>{['회차','납입일','월납입액','원금','이자','잔액'].map(h=><th key={h} className="px-2 py-2 text-center font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {rows.map((row:any,i:number)=>(
                          <tr key={i} className={`border-b ${i%2===0?'bg-gray-50':'bg-white'} ${row.principalPmt===0?'text-gray-400 italic':''}`}>
                            <td className="px-2 py-1.5 text-center">{row.no}</td>
                            <td className="px-2 py-1.5 text-center">{row.date}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{fmt(row.payment)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.principalPmt)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.interest)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(row.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </>}

        {/* ══ 발주서 탭 ══ */}
        {tab==='purchase' && <>
          <SendInfoForm v={pf} onSendChange={updSend(setPf)} emailSuggestions={emailSuggestions}/>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">기본 정보</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>수신 업체명</Label><Input value={pf.receiverName} onChange={e=>setPf(f=>({...f,receiverName:e.target.value}))} placeholder="(주)제이지이큅먼트"/></div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">발주 품목</h2>
            <ItemTable items={pf.items} upd={updP} total={pTotal}/>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <Label>비고</Label>
            <textarea value={pf.note} onChange={e=>setPf(f=>({...f,note:e.target.value}))}
              rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          </div>
        </>}

        {/* ══ 이력 탭 ══ */}
        {tab==='history' && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold text-gray-800 text-sm">발송 이력 (최근 30건)</h2>
              <button onClick={loadHistory} disabled={historyLoading} className="text-xs border px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50">
                {historyLoading?'로딩 중...':'새로고침'}
              </button>
            </div>
            {historyLoading ? (
              <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">이력이 없습니다.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>{['구분','견적번호','일자','수신인','총액','이메일발송','불러오기','재출력'].map(h=>(
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-xs border-b">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {history.map(row=>(
                    <tr key={row.id} className="border-b hover:bg-orange-50 transition-colors">
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          row.quote_type==='battery'?'bg-green-100 text-green-700':
                          row.quote_type==='forklift'?'bg-blue-100 text-blue-700':
                          row.quote_type==='installment'?'bg-purple-100 text-purple-700':
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {row.quote_type==='battery'?'배터리':row.quote_type==='forklift'?'지게차':row.quote_type==='installment'?'할부':'발주서'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{row.quote_no}</td>
                      <td className="px-3 py-2 text-gray-600">{row.quote_date}</td>
                      <td className="px-3 py-2 font-medium">{row.recipient}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.grand_total||0)}원</td>
                      <td className="px-3 py-2 text-center">
                        {row.email_sent?<span className="text-green-600 text-xs">✅ 발송</span>:<span className="text-gray-400 text-xs">-</span>}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={()=>loadFromHistory(row)}
                          className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded hover:bg-orange-600 transition-colors font-medium"
                        >불러오기</button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={()=>{
                            const type=row.quote_type as any;
                            if(type==='battery'||type==='forklift'){
                              const form = type==='battery'
                                ?{...BF0,recipient:row.recipient,email1:row.recipient_email,quoteDate:row.quote_date,items:row.items??BF0.items,notes:row.notes??BF0.notes}
                                :{...FF0,recipient:row.recipient,email1:row.recipient_email,quoteDate:row.quote_date,items:row.items??FF0.items,notes:row.notes??FF0.notes};
                              const html=buildQuoteHTML(type,form as any,row.quote_no);
                              printHTML(html);
                            } else flash('할부/발주서 재출력은 해당 탭에서 다시 입력해 주세요.');
                          }}
                          className="text-xs text-blue-500 hover:underline"
                        >출력</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══ SMS 캡처용 히든 프리뷰 ══ */}
        {['battery','forklift','purchase','installment'].includes(tab) && (
          <div className="text-xs text-gray-400 text-center pb-2">
            MMS 발송 시 현재 입력 내용이 이미지로 캡처됩니다.
          </div>
        )}
      </div>

      {/* ══ 미리보기 모달 ══ */}
      {previewOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={()=>setPreviewOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-xl">
              <h3 className="font-semibold text-gray-800 text-sm">📄 문서 미리보기</h3>
              <div className="flex gap-2">
                <button
                  onClick={()=>{ handlePrint(); setPreviewOpen(false); }}
                  className="bg-[#0a192f] text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-[#1a3a5f]"
                >
                  🖨️ 인쇄 / PDF 저장
                </button>
                <button onClick={()=>setPreviewOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">✕</button>
              </div>
            </div>
            <div className="p-4 bg-gray-100 rounded-b-xl">
              <div className="bg-white shadow-md rounded" style={{minHeight:'800px'}}>
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0 rounded"
                  style={{height:'800px'}}
                  title="문서 미리보기"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{position:'absolute',left:'-9999px',top:0,width:'600px'}}>
        <div ref={batteryPreviewRef} style={{fontFamily:"'Malgun Gothic',sans-serif",background:'#fff',padding:'20px',width:'600px'}}>
          <div style={{background:'#0a192f',padding:'14px 18px',borderRadius:'6px',marginBottom:'12px',display:'flex',justifyContent:'space-between'}}>
            <div style={{color:'#fff',fontSize:'16px',fontWeight:700}}>RNF KOREA</div>
            <div style={{color:'#f97316',fontSize:'16px',fontWeight:700}}>배터리 견적서</div>
          </div>
          {bf.recipient&&<p style={{fontSize:'12px',marginBottom:'8px'}}>수신: <strong>{bf.recipient}</strong> 귀중</p>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px',marginBottom:'10px'}}>
            {[['공급가액',fmt(bTotal)+'원',false],['VAT',fmt(Math.round(bTotal*.1))+'원',false],['총액',fmt(bTotal+Math.round(bTotal*.1))+'원',true]].map(([l,v,dk])=>(
              <div key={l as string} style={{background:dk?'#0a192f':'#f1f5f9',borderRadius:'4px',padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:'9px',color:dk?'#94a3b8':'#64748b'}}>{l}</div>
                <div style={{fontSize:'12px',fontWeight:700,color:dk?'#f97316':'#0a192f'}}>{v}</div>
              </div>
            ))}
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
            <thead><tr style={{background:'#0a192f'}}>{['품명','규격','수량','금액'].map(h=><th key={h} style={{color:'#fff',padding:'5px',textAlign:'center'}}>{h}</th>)}</tr></thead>
            <tbody>{bf.items.filter(it=>it.name).map((it,i)=>(
              <tr key={i} style={{background:i%2===0?'#f8fafc':'#fff'}}>
                <td style={{padding:'4px'}}>{it.name}</td>
                <td style={{padding:'4px',textAlign:'center'}}>{it.spec}</td>
                <td style={{padding:'4px',textAlign:'center'}}>{it.qty}</td>
                <td style={{padding:'4px',textAlign:'right'}}>{it.price==='포함'?'포함':it.price?fmt(n0(it.price)*(n0(it.qty)||1)):''}</td>
              </tr>
            ))}</tbody>
          </table>
          <p style={{marginTop:'8px',fontSize:'8px',color:'#94a3b8',textAlign:'center'}}>주식회사 알앤에프코리아 | 1551-1873</p>
        </div>
      </div>
      <div style={{position:'absolute',left:'-9999px',top:0,width:'600px'}}>
        <div ref={forkliftPreviewRef} style={{fontFamily:"'Malgun Gothic',sans-serif",background:'#fff',padding:'20px',width:'600px'}}>
          <div style={{background:'#0a192f',padding:'14px 18px',borderRadius:'6px',marginBottom:'12px',display:'flex',justifyContent:'space-between'}}>
            <div style={{color:'#fff',fontSize:'16px',fontWeight:700}}>RNF KOREA</div>
            <div style={{color:'#f97316',fontSize:'16px',fontWeight:700}}>지게차 견적서</div>
          </div>
          {ff.recipient&&<p style={{fontSize:'12px',marginBottom:'8px'}}>수신: <strong>{ff.recipient}</strong> 귀중</p>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px',marginBottom:'10px'}}>
            {[['공급가액',fmt(fTotal)+'원',false],['VAT',fmt(Math.round(fTotal*.1))+'원',false],['총액',fmt(fTotal+Math.round(fTotal*.1))+'원',true]].map(([l,v,dk])=>(
              <div key={l as string} style={{background:dk?'#0a192f':'#f1f5f9',borderRadius:'4px',padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:'9px',color:dk?'#94a3b8':'#64748b'}}>{l}</div>
                <div style={{fontSize:'12px',fontWeight:700,color:dk?'#f97316':'#0a192f'}}>{v}</div>
              </div>
            ))}
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
            <thead><tr style={{background:'#0a192f'}}>{['품명','규격','금액'].map(h=><th key={h} style={{color:'#fff',padding:'5px',textAlign:'center'}}>{h}</th>)}</tr></thead>
            <tbody>{ff.items.filter(it=>it.name).map((it,i)=>(
              <tr key={i} style={{background:i%2===0?'#f8fafc':'#fff'}}>
                <td style={{padding:'4px'}}>{it.name}</td>
                <td style={{padding:'4px',textAlign:'center'}}>{it.spec}</td>
                <td style={{padding:'4px',textAlign:'right'}}>{it.price==='포함'?'포함':it.price?fmt(n0(it.price)*(n0(it.qty)||1)):''}</td>
              </tr>
            ))}</tbody>
          </table>
          <p style={{marginTop:'8px',fontSize:'8px',color:'#94a3b8',textAlign:'center'}}>주식회사 알앤에프코리아 | 1551-1873</p>
        </div>
      </div>
      <div ref={installmentPreviewRef} style={{position:'absolute',left:'-9999px',top:0,width:'600px',fontFamily:"'Malgun Gothic',sans-serif",background:'#fff',padding:'20px'}}>
        <div style={{background:'#0a192f',padding:'14px 18px',borderRadius:'6px',marginBottom:'12px',display:'flex',justifyContent:'space-between'}}>
          <div style={{color:'#fff',fontSize:'16px',fontWeight:700}}>RNF KOREA</div>
          <div style={{color:'#f97316',fontSize:'16px',fontWeight:700}}>할부 견적서</div>
        </div>
        {n0(iff.principal)>0&&n0(iff.annualRate)>0&&n0(iff.installmentMonths)>0&&(()=>{
          const p2=n0(iff.principal),r=n0(iff.annualRate),gp=n0(iff.gracePeriod),im=n0(iff.installmentMonths);
          const{payment}=calcAmortization(p2,r,gp+im,iff.startYM,gp);
          return(
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'6px'}}>
              <div style={{background:'#f1f5f9',borderRadius:'4px',padding:'8px'}}>
                <div style={{fontSize:'9px',color:'#64748b'}}>할부원금</div>
                <div style={{fontSize:'14px',fontWeight:700,color:'#0a192f'}}>{fmt(p2)}원</div>
              </div>
              <div style={{background:'#0a192f',borderRadius:'4px',padding:'8px'}}>
                <div style={{fontSize:'9px',color:'#94a3b8'}}>월납입액 ({iff.financeCompany})</div>
                <div style={{fontSize:'14px',fontWeight:700,color:'#f97316'}}>{fmt(payment)}원</div>
              </div>
            </div>
          );
        })()}
      </div>
      <div style={{position:'absolute',left:'-9999px',top:0,width:'600px'}}>
        <div ref={purchasePreviewRef} style={{fontFamily:"'Malgun Gothic',sans-serif",background:'#fff',padding:'20px',width:'600px'}}>
          <div style={{background:'#0a192f',padding:'14px 18px',borderRadius:'6px',marginBottom:'12px',display:'flex',justifyContent:'space-between'}}>
            <div style={{color:'#fff',fontSize:'16px',fontWeight:700}}>RNF KOREA</div>
            <div style={{color:'#f97316',fontSize:'16px',fontWeight:700}}>발 주 서</div>
          </div>
          {pf.receiverName&&<p style={{fontSize:'12px',marginBottom:'8px'}}>수신: <strong>{pf.receiverName}</strong> 귀중</p>}
          <div style={{background:'#f1f5f9',borderRadius:'4px',padding:'10px',marginBottom:'10px',textAlign:'center'}}>
            <span style={{fontSize:'10px',color:'#64748b'}}>합계금액 (VAT포함) </span>
            <span style={{fontSize:'15px',fontWeight:700,color:'#0a192f'}}>{fmt(pTotal+Math.round(pTotal*.1))}원</span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
            <thead><tr style={{background:'#0a192f'}}>{['품목','규격','수량','금액'].map(h=><th key={h} style={{color:'#fff',padding:'5px',textAlign:'center'}}>{h}</th>)}</tr></thead>
            <tbody>{pf.items.filter(it=>it.name).map((it,i)=>(
              <tr key={i} style={{background:i%2===0?'#f8fafc':'#fff'}}>
                <td style={{padding:'4px'}}>{it.name}</td>
                <td style={{padding:'4px',textAlign:'center'}}>{it.spec}</td>
                <td style={{padding:'4px',textAlign:'center'}}>{it.qty}</td>
                <td style={{padding:'4px',textAlign:'right'}}>{it.price?fmt(n0(it.price)*(n0(it.qty)||1)):''}</td>
              </tr>
            ))}</tbody>
          </table>
          <p style={{marginTop:'8px',fontSize:'8px',color:'#94a3b8',textAlign:'center'}}>주식회사 알앤에프코리아 | 1551-1873</p>
        </div>
      </div>
    </div>
  );
}