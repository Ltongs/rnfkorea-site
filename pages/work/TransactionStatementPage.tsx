// src/pages/work/TransactionStatementPage.tsx
// 거래명세서 작성 → Excel 다운로드 / 이메일 발송
// 기존 QuotationPage.tsx와 동일한 패턴(클라이언트 SheetJS 조립 + Edge Function 발송)을 따릅니다.
// 의존성: npm install xlsx (이미 QuotationPage에서 설치되어 있음)

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
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
// (설치된 xlsx 버전은 type:'array' 시 Uint8Array가 아니라 ArrayBuffer를 반환하므로 항상 Uint8Array로 감싸서 처리)
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

// ── Excel 생성: 원본 "거래명세서" 양식과 동일한 셀 배치 ──────────────────────────
function buildStatement(form: StatementForm): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {'!ref':'A1:I43'};
  const set = (a:string, v:any) => { ws[a]={v, t:typeof v==='number'?'n':'s'}; };

  const supply = calcSupply(form.items);
  const tax = Math.round(supply*0.1);
  const grand = supply+tax;

  set('A1','거래명세서');
  set('A4','INDUSTRIAL ENERGY & MOBILITY SOLUTION  |  주식회사 알앤에프코리아');

  set('A6','거래처');        set('C6',form.customerName);
  set('F6','공급자');        set('G6','주식회사 알앤에프코리아');
  set('A7','사업자번호');     set('C7',form.customerBizNo);
  set('F7','사업자번호');     set('G7','316-88-02901');
  set('A8','대   표');       set('C8',form.customerCeo);
  set('F8','대   표');       set('G8','서선경');
  set('A9','주   소');       set('C9',form.customerAddress);
  set('F9','주   소');       set('G9','경기도 안산시 단원구 산단로 325');
  set('A10','연   락');      set('C10',form.customerPhone);
  set('F10','연   락');      set('G10','1551-1873');

  set('A12','작성일자'); set('F12','결제조건'); set('H12','담당자');
  set('A13',form.issueDate); set('F13',form.paymentCondition||'현금'); set('H13',form.managerName);

  set('A15','No.'); set('B15','품  목'); set('D15','규  격'); set('E15','수량');
  set('F15','단  가 (원)'); set('G15','공급가액 (원)'); set('H15','세액 (원)'); set('I15','비고');

  form.items.slice(0,MAX_ROWS).forEach((it,i)=>{
    const r = 16+i;
    set(`A${r}`, i+1);
    if(it.name) set(`B${r}`, it.name);
    if(it.spec) set(`D${r}`, it.spec);
    if(it.qty!=='') set(`E${r}`, n0(it.qty));
    if(it.unitPrice!==''){
      const price = n0(it.unitPrice);
      set(`F${r}`, price);
      if(it.qty!==''){
        const amt = price*n0(it.qty);
        set(`G${r}`, amt);
        set(`H${r}`, Math.round(amt*0.1));
      }
    }
  });

  set('A31','합  계'); set('G31',supply); set('H31',tax);
  set('A33','공급가액 합계');       set('F33',supply);
  set('A34','세액 합계 (10%)');    set('F34',tax);
  set('A35','청구 합계 (VAT포함)'); set('F35',grand);

  set('A37','수령 확인');
  set('A38','확인일자'); set('A39','확인자(서명)'); set('A40','비고');
  set('D40',' 기업은행 523-081357-04-016 (주)알앤에프코리아 / admin@rnfkorea.co.kr');
  set('A42','상기와 같이 거래명세서를 제출합니다.');
  set('A43','TEL : 1551-1873  |  FAX : 0504-339-1873  |  주식회사 알앤에프코리아  |  www.rnfkorea.co.kr');

  // 원본과 동일한 셀 병합 배치
  const mergeRanges = [
    'A1:I3','A4:I4',
    'A6:B6','C6:E6','G6:I6', 'A7:B7','C7:E7','G7:I7', 'A8:B8','C8:E8','G8:I8',
    'A9:B9','C9:E9','G9:I9', 'A10:B10','C10:E10','G10:I10',
    'A12:C12','D12:E12','F12:G12','H12:I12',
    'A13:C13','D13:E13','F13:G13','H13:I13',
    'B15:C15',
    ...Array.from({length:MAX_ROWS},(_,i)=>`B${16+i}:C${16+i}`),
    'A31:E31','A33:E33','F33:I33','A34:E34','F34:I34','A35:E35','F35:I35',
    'A37:I37','A38:C38','D38:I38','A39:C39','D39:I39','A40:C40','D40:I40',
    'A42:I42','A43:I43',
  ];
  ws['!merges'] = mergeRanges.map(r => XLSX.utils.decode_range(r));
  ws['!cols'] = [6,14,10,10,9,13,13,13,10].map(w=>({wch:w}));

  XLSX.utils.book_append_sheet(wb,ws,'거래명세서');
  return XLSX.write(wb,{type:'array',bookType:'xlsx'});
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

  const downloadFromHistory = (row:HistoryRow) => {
    try {
      const items = row.items?.length ? row.items : [];
      const bytes = buildStatement({
        customerName: row.customer_name, customerBizNo: row.customer_biz_no ?? '',
        customerCeo: row.customer_ceo ?? '', customerAddress: row.customer_address ?? '',
        customerPhone: row.customer_phone ?? '', customerEmail: row.customer_email ?? '',
        issueDate: row.issue_date, paymentCondition: row.payment_condition ?? '현금',
        managerName: row.manager_name ?? '', extraMessage: '', items,
      });
      const blob = new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `RNF_거래명세서_${row.customer_name}_${row.doc_no}.xlsx`;
      a.click();
    } catch { flash('Excel 재생성 오류'); }
  };

  const download = () => {
    setLoading(true);
    try {
      const bytes = buildStatement(sf);
      const blob = new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `RNF_거래명세서_${sf.customerName||'거래처'}.xlsx`;
      a.click();
    } catch { flash('Excel 생성 오류'); }
    setLoading(false);
  };

  const sendEmail = async () => {
    if(!sf.customerName)  { flash('거래처 상호를 입력해주세요.'); return; }
    if(!sf.customerEmail) { flash('발송 이메일을 입력해주세요.'); return; }
    if(supply<=0)          { flash('품목을 1개 이상 입력해주세요.'); return; }
    setEmailLoading(true);
    try {
      const bytes = buildStatement(sf);
      const b64 = bytesToBase64(bytes);
      const docNo = `TS-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
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
          xlsxBase64: b64, fileName: `RNF_거래명세서_${sf.customerName}.xlsx`,
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0a192f] text-white px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">거래명세서 작성</h1>
            <p className="text-blue-300 text-sm mt-0.5">거래처 정보와 품목을 입력해 원본 양식 그대로 발송합니다</p>
          </div>
          <div className="flex gap-2">
            <button onClick={download} disabled={loading} className="bg-white text-[#0a192f] hover:bg-gray-100 px-4 py-2 rounded text-sm font-medium disabled:opacity-50">📥 Excel 다운로드</button>
            <button onClick={sendEmail} disabled={emailLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50">{emailLoading?'발송 중...':'📧 이메일 발송'}</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {msg && <div className={`text-sm px-4 py-2.5 rounded border ${msg.startsWith('✅')?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>{msg}</div>}

        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 text-sm">거래처 정보</h2>
            <label className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer ${invoiceParsing ? 'bg-gray-100 text-gray-400' : 'bg-gray-800 text-white hover:bg-gray-900'}`}>
              {invoiceParsing ? '인식 중...' : '📄 발송된 계산서 업로드 (자동 인식)'}
              <input type="file" accept="image/*" className="hidden" disabled={invoiceParsing} onChange={handleInvoiceUpload}/>
            </label>
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
            <div><Label>연락처</Label><Input value={sf.customerPhone} onChange={e=>setSf(f=>({...f,customerPhone:e.target.value}))} placeholder="1544-3051"/></div>
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