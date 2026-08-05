// src/pages/work/WithholdingPage.tsx
// 원천징수 관리 페이지 — /work/withholding
// isAdmin 전용

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

// ─── 타입 ──────────────────────────────────────────────────
const AGENTS = ['RNF Korea', '수Company'] as const;
type WithholdingAgent = typeof AGENTS[number];

interface Contractor {
  id: string;
  name: string;
  rrn_masked: string;
  phone: string;
  bank_name: string;
  account_no: string;
  contract_date: string;
  is_active: boolean;
  note: string;
  withholding_agent: WithholdingAgent;
}

interface Payment {
  id: string;
  contractor_id: string;
  contractor_name?: string;
  contractor_agent?: WithholdingAgent;
  pay_date: string;
  pay_amount: number;
  withholding_amount: number;
  net_amount: number;
  pay_reason: string;
  pay_method: string;
  transfer_ref: string;
  gift_card_included: boolean;
  note: string;
}

interface MonthlyRow {
  month_label: string;
  count: number;
  total_pay: number;
  total_withholding: number;
  total_net: number;
  due_date: string;
  withholding_agent: WithholdingAgent;
}

interface AnnualRow {
  pay_year: number;
  name: string;
  rrn_masked: string;
  pay_count: number;
  annual_pay: number;
  annual_withholding: number;
  annual_net: number;
  withholding_agent: WithholdingAgent;
}

interface GiftCardEntry {
  id: string;
  entry_date: string;
  entry_type: 'purchase' | 'distribution';
  denomination: number;
  quantity: number;
  unit_price: number | null;
  total_amount: number;
  vendor: string | null;
  recipient_name: string | null;
  contractor_id: string | null;
  contractor_name?: string;
  reason: string | null;
  note: string | null;
}

interface OrixRecipientRow {
  id: string;
  confirmed_date: string | null;
  customer_name: string;
  loan_principal: number | null;
  product_type: string | null;
  vehicle_type: string | null;
  incentive_rate: number | null;
  incentive_total: number | null;
  cm_incentive_rate: number | null;
  cm_paid_incentive: number | null;
  paid_at: string | null;
  note: string | null;
}

interface LotteIncentive {
  id: string;
  contract_date: string;
  contract_no: string | null;
  customer_name: string;
  contract_amount: number;
  collateral_set: boolean;
  incentive_amount: number;
  note: string | null;
}

// ─── 유틸 ──────────────────────────────────────────────────
const fmt = (n: number) => n?.toLocaleString('ko-KR') ?? '0';
const RATE = 0.033;
const calcWithholding = (amount: number) => Math.floor(amount * RATE);
const LOTTE_RATE = 0.005;
const calcLotteIncentive = (amount: number) => Math.floor(amount * LOTTE_RATE);

// '지급대상' 탭은 수Company 선택 시에만 노출 — 오릭스 인센티브 중 수익자가 수Company인
// 항목을 그대로 보여주는 읽기전용 탭 (자체 데이터 없이 orix_incentives를 조회)
const TABS = ['지급내역', '지급대상', '수탁인 관리', '상품권 관리', '월별 현황', '연간 집계'] as const;
type Tab = typeof TABS[number];

// 상단 원천징수자/제휴사 선택 — RNF Korea·수Company는 기존 5개 탭을 공유하고,
// 롯데오토리스는 별도의 단일 화면(계약별 인센티브 목록)을 사용한다.
const TOP_TABS = [...AGENTS, '롯데오토리스 인센티브 관리'] as const;
type TopTab = typeof TOP_TABS[number];

const PAY_REASONS = [
  '업무위탁 인센티브',
  '할부금융 모집 수수료',
  '판촉 지원금',
  '명절 판촉비',
  '실적 우수 격려금',
  '기타',
];

// ─── 메인 컴포넌트 ─────────────────────────────────────────
export default function WithholdingPage() {
  const [tab, setTab] = useState<Tab>('지급내역');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCardEntry[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [annual, setAnnual] = useState<AnnualRow[]>([]);
  const [lotteIncentives, setLotteIncentives] = useState<LotteIncentive[]>([]);
  const [orixRecipients, setOrixRecipients] = useState<OrixRecipientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 필터
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  // 상단 선택: RNF Korea / 수Company (기존 5개 탭 공유) / 롯데오토리스 인센티브 관리(독립 화면)
  const [topTab, setTopTab] = useState<TopTab>('RNF Korea');
  const agent: WithholdingAgent = topTab === '롯데오토리스 인센티브 관리' ? 'RNF Korea' : topTab;
  const showLotte = topTab === '롯데오토리스 인센티브 관리';

  // ── 데이터 로딩 ──
  const loadContractors = useCallback(async () => {
    const { data } = await supabase
      .from('tb_contractors')
      .select('*')
      .order('name');
    setContractors(data ?? []);
  }, []);

  const loadPayments = useCallback(async () => {
    const { data } = await supabase
      .from('tb_withholding_payments')
      .select(`*, tb_contractors(name, withholding_agent)`)
      .order('pay_date', { ascending: false });
    const rows = (data ?? []).map((r: any) => ({
      ...r,
      contractor_name: r.tb_contractors?.name ?? '',
      contractor_agent: r.tb_contractors?.withholding_agent ?? 'RNF Korea',
    }));
    setPayments(rows);
  }, []);

  const loadGiftCards = useCallback(async () => {
    const { data } = await supabase
      .from('tb_gift_card_stock')
      .select(`*, tb_contractors(name)`)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });
    const rows = (data ?? []).map((r: any) => ({
      ...r,
      contractor_name: r.tb_contractors?.name ?? '',
    }));
    setGiftCards(rows);
  }, []);

  const loadLotteIncentives = useCallback(async () => {
    const { data } = await supabase
      .from('tb_lotte_lease_incentives')
      .select('*')
      .order('contract_date', { ascending: false });
    setLotteIncentives(data ?? []);
  }, []);

  const loadOrixRecipients = useCallback(async () => {
    const { data } = await supabase
      .from('orix_incentives_sucompany_view')
      .select('*')
      .order('confirmed_date', { ascending: false });
    setOrixRecipients(data ?? []);
  }, []);

  const loadMonthly = useCallback(async () => {
    const { data } = await supabase
      .from('v_withholding_monthly')
      .select('*')
      .ilike('month_label', `${filterYear}%`)
      .eq('withholding_agent', agent);
    setMonthly(data ?? []);
  }, [filterYear, agent]);

  const loadAnnual = useCallback(async () => {
    const { data } = await supabase
      .from('v_withholding_annual')
      .select('*')
      .eq('pay_year', Number(filterYear))
      .eq('withholding_agent', agent);
    setAnnual(data ?? []);
  }, [filterYear, agent]);

  useEffect(() => {
    loadContractors();
    loadPayments();
    loadLotteIncentives();
  }, [loadContractors, loadPayments, loadLotteIncentives]);

  useEffect(() => {
    if (showLotte) return;
    if (tab === '월별 현황') loadMonthly();
    if (tab === '연간 집계') loadAnnual();
    if (tab === '상품권 관리' && giftCards.length === 0) loadGiftCards();
    if (tab === '지급대상') loadOrixRecipients();
  }, [tab, filterYear, showLotte, loadMonthly, loadAnnual, loadGiftCards, giftCards.length, loadOrixRecipients]);

  // '지급대상' 탭은 수Company 선택 시에만 존재하므로, RNF Korea 등으로 전환하면 지급내역으로 되돌린다.
  useEffect(() => {
    if (tab === '지급대상' && agent !== '수Company') setTab('지급내역');
  }, [agent, tab]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  };

  // ── Excel 내보내기 (현재 선택된 원천징수자/제휴사 기준) ──
  const exportExcel = async () => {
    const wb = XLSX.utils.book_new();

    if (showLotte) {
      const { data: lotteRows } = await supabase
        .from('tb_lotte_lease_incentives')
        .select('*')
        .gte('contract_date', `${filterYear}-01-01`)
        .lte('contract_date', `${filterYear}-12-31`)
        .order('contract_date', { ascending: false });
      const rows = (lotteRows ?? []).map((r: LotteIncentive) => ({
        계약일자: r.contract_date,
        계약번호: r.contract_no ?? '',
        고객명: r.customer_name,
        계약금액: r.contract_amount,
        담보설정: r.collateral_set ? 'Y' : 'N',
        '인센티브(0.5%)': r.incentive_amount,
        비고: r.note ?? '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [10, 14, 14, 12, 8, 12, 20].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, '롯데오토리스인센티브');
      XLSX.writeFile(wb, `롯데오토리스_인센티브관리_${filterYear}.xlsx`);
      return;
    }

    // 상품권 관리 탭을 방문하지 않았으면 giftCards state가 비어있을 수 있으므로 직접 조회
    const { data: giftCardRows } = await supabase
      .from('tb_gift_card_stock')
      .select(`*, tb_contractors(name)`)
      .order('entry_date', { ascending: false });
    const giftCardData: GiftCardEntry[] = (giftCardRows ?? []).map((r: any) => ({
      ...r,
      contractor_name: r.tb_contractors?.name ?? '',
    }));

    // 월별/연간 집계도 현재 탭 방문 여부와 무관하게 선택된 원천징수자 기준으로 직접 조회
    const [{ data: monthlyRows }, { data: annualRows }]: [{ data: MonthlyRow[] | null }, { data: AnnualRow[] | null }] = await Promise.all([
      supabase.from('v_withholding_monthly').select('*').ilike('month_label', `${filterYear}%`).eq('withholding_agent', agent),
      supabase.from('v_withholding_annual').select('*').eq('pay_year', Number(filterYear)).eq('withholding_agent', agent),
    ]);

    // 시트1: 지급내역 전체
    const payRows = payments
      .filter(p => p.pay_date?.startsWith(filterYear) && p.contractor_agent === agent)
      .map(p => ({
        지급일자: p.pay_date,
        수탁인: p.contractor_name,
        지급사유: p.pay_reason,
        지급방법: p.pay_method,
        세전금액: p.pay_amount,
        원천징수액: p.withholding_amount,
        실지급액: p.net_amount,
        상품권포함: p.gift_card_included ? '예' : '아니오',
        이체확인번호: p.transfer_ref,
        비고: p.note,
      }));
    const ws1 = XLSX.utils.json_to_sheet(payRows);
    ws1['!cols'] = [10,14,16,10,12,12,12,10,16,16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, '지급내역');

    // 시트2: 월별 집계
    const mRows = (monthlyRows ?? []).map(m => ({
      월: m.month_label,
      지급건수: m.count,
      세전지급합계: m.total_pay,
      원천징수합계: m.total_withholding,
      실지급합계: m.total_net,
      납부기한: m.due_date,
    }));
    const ws2 = XLSX.utils.json_to_sheet(mRows);
    ws2['!cols'] = [10,8,14,14,12,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, '월별집계(신고용)');

    // 시트3: 지급명세서 (세무사 제출용)
    const aRows = (annualRows ?? []).map(a => ({
      귀속연도: a.pay_year,
      성명: a.name,
      주민등록번호: a.rrn_masked,
      지급건수: a.pay_count,
      연간지급액: a.annual_pay,
      원천징수액: a.annual_withholding,
      차감지급액: a.annual_net,
      소득구분: '사업소득(940)',
    }));
    const ws3 = XLSX.utils.json_to_sheet(aRows);
    ws3['!cols'] = [8,10,14,8,12,12,12,14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws3, '지급명세서(세무사용)');

    // 시트4: 상품권 관리 (구매·지급 전체 내역)
    const gRows = giftCardData
      .filter(g => g.entry_date?.startsWith(filterYear))
      .map(g => ({
        일자: g.entry_date,
        구분: g.entry_type === 'purchase' ? '구매' : '지급',
        액면가: g.denomination,
        수량: g.quantity,
        금액: g.total_amount,
        '구매처/대상자': g.entry_type === 'purchase' ? (g.vendor ?? '') : (g.recipient_name ?? ''),
        연결수탁인: g.contractor_name ?? '',
        사유: g.reason ?? '',
        비고: g.note ?? '',
      }));
    const ws4 = XLSX.utils.json_to_sheet(gRows);
    ws4['!cols'] = [10,8,10,8,12,16,10,16,16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws4, '상품권관리');

    XLSX.writeFile(wb, `원천징수관리_${agent}_${filterYear}.xlsx`);
  };

  // 현재 선택된 원천징수자(甲) 기준으로 수탁인·지급내역을 분리
  const visibleContractors = useMemo(
    () => contractors.filter(c => c.withholding_agent === agent),
    [contractors, agent]
  );
  const visiblePayments = useMemo(
    () => payments.filter(p => p.contractor_agent === agent),
    [payments, agent]
  );

  // ─── UI ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-[#0a192f] text-white px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">원천징수 관리</h1>
            <p className="text-blue-300 text-sm mt-0.5">업무위수탁자 인센티브 · 사업소득 3.3%</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="bg-white/10 text-white border border-white/20 rounded px-3 py-1.5 text-sm"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <button
              onClick={exportExcel}
              className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1.5 rounded flex items-center gap-1.5"
            >
              <span>📥</span> Excel 내보내기
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-4 flex items-center gap-2">
          <span className="text-xs text-blue-300">원천징수자(甲) / 제휴사</span>
          <div className="inline-flex bg-white/10 border border-white/20 rounded-full p-1">
            {TOP_TABS.map(t => (
              <button
                key={t}
                onClick={() => setTopTab(t)}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
                  topTab === t ? 'bg-white text-[#0a192f]' : 'text-blue-200 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 — 롯데오토리스는 별도 화면이라 5개 탭 미표시 */}
      {!showLotte && (
        <div className="bg-white border-b">
          <div className="max-w-6xl mx-auto flex">
            {TABS.filter(t => t !== '지급대상' || agent === '수Company').map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className="max-w-6xl mx-auto mt-3 px-4">
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded">
            {msg}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {showLotte ? (
          <LotteLeaseTab
            entries={lotteIncentives.filter(r => r.contract_date?.startsWith(filterYear))}
            loading={loading}
            setLoading={setLoading}
            onSaved={() => { loadLotteIncentives(); flash('저장되었습니다.'); }}
            flash={flash}
          />
        ) : (
          <>
            {tab === '지급내역' && (
              <PaymentTab
                payments={visiblePayments.filter(p => p.pay_date?.startsWith(filterYear))}
                contractors={visibleContractors}
                loading={loading}
                setLoading={setLoading}
                onSaved={() => { loadPayments(); flash('저장되었습니다.'); }}
                flash={flash}
              />
            )}
            {tab === '지급대상' && agent === '수Company' && (
              <OrixRecipientTab
                rows={orixRecipients.filter(r => r.confirmed_date?.startsWith(filterYear))}
                year={filterYear}
              />
            )}
            {tab === '수탁인 관리' && (
              <ContractorTab
                contractors={visibleContractors}
                agent={agent}
                loading={loading}
                setLoading={setLoading}
                onSaved={() => { loadContractors(); flash('저장되었습니다.'); }}
                flash={flash}
              />
            )}
            {tab === '상품권 관리' && (
              <GiftCardTab
                entries={giftCards}
                contractors={contractors}
                loading={loading}
                setLoading={setLoading}
                onSaved={() => { loadGiftCards(); flash('저장되었습니다.'); }}
                flash={flash}
              />
            )}
            {tab === '월별 현황' && (
              <MonthlyTab monthly={monthly} year={filterYear} />
            )}
            {tab === '연간 집계' && (
              <AnnualTab annual={annual} year={filterYear} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── 지급내역 탭 ────────────────────────────────────────────
function PaymentTab({
  payments, contractors, loading, setLoading, onSaved, flash,
}: {
  payments: Payment[];
  contractors: Contractor[];
  loading: boolean;
  setLoading: (v: boolean) => void;
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  const empty = {
    contractor_id: '',
    pay_date: new Date().toISOString().slice(0, 10),
    pay_amount: '',
    pay_reason: '업무위탁 인센티브',
    pay_method: '계좌이체',
    transfer_ref: '',
    gift_card_included: false,
    note: '',
  };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const withholding = form.pay_amount ? calcWithholding(Number(form.pay_amount)) : 0;
  const net = form.pay_amount ? Number(form.pay_amount) - withholding : 0;

  const handleSave = async () => {
    if (!form.contractor_id || !form.pay_amount) {
      flash('수탁인과 지급금액은 필수입니다.');
      return;
    }
    setLoading(true);
    const payload = {
      contractor_id: form.contractor_id,
      pay_date: form.pay_date,
      pay_amount: Number(form.pay_amount),
      withholding_amount: withholding,
      net_amount: net,
      pay_reason: form.pay_reason,
      pay_method: form.pay_method,
      transfer_ref: form.transfer_ref,
      gift_card_included: form.gift_card_included,
      note: form.note,
    };
    if (editId) {
      await supabase.from('tb_withholding_payments').update(payload).eq('id', editId);
    } else {
      await supabase.from('tb_withholding_payments').insert(payload);
    }
    setLoading(false);
    setForm(empty);
    setEditId(null);
    setShowForm(false);
    onSaved();
  };

  const handleEdit = (p: Payment) => {
    setForm({
      contractor_id: p.contractor_id,
      pay_date: p.pay_date,
      pay_amount: p.pay_amount.toString(),
      pay_reason: p.pay_reason,
      pay_method: p.pay_method,
      transfer_ref: p.transfer_ref ?? '',
      gift_card_included: p.gift_card_included,
      note: p.note ?? '',
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await supabase.from('tb_withholding_payments').delete().eq('id', id);
    onSaved();
  };

  const totalPay = payments.reduce((s, p) => s + p.pay_amount, 0);
  const totalWh  = payments.reduce((s, p) => s + p.withholding_amount, 0);
  const totalNet = payments.reduce((s, p) => s + p.net_amount, 0);

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '세전 지급 합계', value: totalPay, color: 'text-gray-800' },
          { label: '원천징수 합계 (3.3%)', value: totalWh, color: 'text-red-600' },
          { label: '실지급 합계', value: totalNet, color: 'text-blue-700' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{fmt(c.value)}원</p>
          </div>
        ))}
      </div>

      {/* 등록 버튼 */}
      {!showForm && (
        <button
          onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }}
          className="bg-[#0a192f] text-white px-4 py-2 rounded text-sm"
        >
          + 지급 등록
        </button>
      )}

      {/* 입력 폼 */}
      {showForm && (
        <div className="bg-white border rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">
            {editId ? '지급내역 수정' : '지급내역 등록'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-style">수탁인(乙) *</label>
              <select
                value={form.contractor_id}
                onChange={e => setForm({ ...form, contractor_id: e.target.value })}
                className="input-style"
              >
                <option value="">선택</option>
                {contractors.filter(c => c.is_active).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-style">지급일자 *</label>
              <input type="date" value={form.pay_date}
                onChange={e => setForm({ ...form, pay_date: e.target.value })}
                className="input-style" />
            </div>
            <div>
              <label className="label-style">세전 지급금액 (원) *</label>
              <input
                type="number"
                placeholder="0"
                value={form.pay_amount}
                onChange={e => setForm({ ...form, pay_amount: e.target.value })}
                className="input-style"
              />
            </div>
            <div>
              <label className="label-style">자동계산 (3.3%)</label>
              <div className="bg-gray-50 border rounded px-3 py-2 text-sm space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">원천징수</span>
                  <span className="text-red-600 font-medium">{fmt(withholding)}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">실지급액</span>
                  <span className="text-blue-700 font-medium">{fmt(net)}원</span>
                </div>
              </div>
            </div>
            <div>
              <label className="label-style">지급사유</label>
              <select
                value={form.pay_reason}
                onChange={e => setForm({ ...form, pay_reason: e.target.value })}
                className="input-style"
              >
                {PAY_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-style">지급방법</label>
              <select
                value={form.pay_method}
                onChange={e => setForm({ ...form, pay_method: e.target.value })}
                className="input-style"
              >
                {['계좌이체', '상품권', '현금'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-style">이체확인번호/증빙번호</label>
              <input
                placeholder="카드전표번호, 이체번호 등"
                value={form.transfer_ref}
                onChange={e => setForm({ ...form, transfer_ref: e.target.value })}
                className="input-style"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="gift_card"
                checked={form.gift_card_included}
                onChange={e => setForm({ ...form, gift_card_included: e.target.checked })}
              />
              <label htmlFor="gift_card" className="text-sm text-gray-700">상품권 포함</label>
            </div>
            <div className="col-span-2">
              <label className="label-style">비고</label>
              <input
                placeholder="메모"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                className="input-style"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 text-white px-5 py-2 rounded text-sm disabled:opacity-50"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditId(null); setForm(empty); }}
              className="border text-gray-600 px-5 py-2 rounded text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {['지급일자','수탁인','지급사유','세전금액','원천징수','실지급','지급방법','증빙',''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">등록된 내역이 없습니다.</td></tr>
            )}
            {payments.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-700">{p.pay_date}</td>
                <td className="px-3 py-2.5 font-medium">{p.contractor_name}</td>
                <td className="px-3 py-2.5 text-gray-600">
                  {p.pay_reason}
                  {p.gift_card_included && <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-1 rounded">상품권</span>}
                </td>
                <td className="px-3 py-2.5 text-right">{fmt(p.pay_amount)}</td>
                <td className="px-3 py-2.5 text-right text-red-600">{fmt(p.withholding_amount)}</td>
                <td className="px-3 py-2.5 text-right text-blue-700 font-medium">{fmt(p.net_amount)}</td>
                <td className="px-3 py-2.5 text-gray-500">{p.pay_method}</td>
                <td className="px-3 py-2.5 text-gray-400 text-xs">{p.transfer_ref}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(p)} className="text-blue-500 hover:underline text-xs">수정</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:underline text-xs">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 수탁인 관리 탭 ─────────────────────────────────────────
function ContractorTab({
  contractors, agent, loading, setLoading, onSaved, flash,
}: {
  contractors: Contractor[];
  agent: WithholdingAgent;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  const empty = {
    name: '', rrn_masked: '', phone: '',
    bank_name: '', account_no: '',
    contract_date: '', is_active: true, note: '',
    withholding_agent: agent,
  };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // 주민번호 마스킹 자동 처리
  const handleRrn = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, '').slice(0, 13);
    let masked = clean;
    if (clean.length > 6) {
      masked = clean.slice(0, 6) + '-' + clean[6] + '******';
    }
    setForm({ ...form, rrn_masked: masked, _rrn_raw: clean });
  };

  const handleSave = async () => {
    if (!form.name) { flash('이름은 필수입니다.'); return; }
    setLoading(true);
    const payload = {
      name: form.name,
      rrn_masked: form.rrn_masked,
      phone: form.phone,
      bank_name: form.bank_name,
      account_no: form.account_no,
      contract_date: form.contract_date || null,
      is_active: form.is_active,
      note: form.note,
      withholding_agent: form.withholding_agent,
    };
    if (editId) {
      await supabase.from('tb_contractors').update(payload).eq('id', editId);
    } else {
      await supabase.from('tb_contractors').insert(payload);
    }
    setLoading(false);
    setForm(empty);
    setEditId(null);
    setShowForm(false);
    onSaved();
  };

  const handleEdit = (c: Contractor) => {
    setForm({ ...c });
    setEditId(c.id);
    setShowForm(true);
  };

  const toggleActive = async (c: Contractor) => {
    await supabase.from('tb_contractors')
      .update({ is_active: !c.is_active })
      .eq('id', c.id);
    onSaved();
  };

  return (
    <div className="space-y-4">
      {!showForm && (
        <button
          onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }}
          className="bg-[#0a192f] text-white px-4 py-2 rounded text-sm"
        >
          + 수탁인 등록
        </button>
      )}

      {showForm && (
        <div className="bg-white border rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">
            {editId ? '수탁인 수정' : '수탁인 등록'}
          </h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs text-yellow-700">
            ⚠️ 주민등록번호는 지급명세서 제출에 필요합니다. 뒷자리는 자동 마스킹 처리됩니다.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-style">성명 *</label>
              <input value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input-style" placeholder="홍길동" />
            </div>
            <div>
              <label className="label-style">원천징수자(甲) *</label>
              <select
                value={form.withholding_agent}
                onChange={e => setForm({ ...form, withholding_agent: e.target.value as WithholdingAgent })}
                className="input-style"
              >
                {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label-style">주민등록번호 (입력 후 자동 마스킹)</label>
              <input
                placeholder="숫자만 입력 (13자리)"
                onChange={e => handleRrn(e.target.value)}
                className="input-style"
              />
              {form.rrn_masked && (
                <p className="text-xs text-gray-500 mt-1">저장값: {form.rrn_masked}</p>
              )}
            </div>
            <div>
              <label className="label-style">연락처</label>
              <input value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="input-style" placeholder="010-0000-0000" />
            </div>
            <div>
              <label className="label-style">계약일</label>
              <input type="date" value={form.contract_date}
                onChange={e => setForm({ ...form, contract_date: e.target.value })}
                className="input-style" />
            </div>
            <div>
              <label className="label-style">은행명</label>
              <input value={form.bank_name}
                onChange={e => setForm({ ...form, bank_name: e.target.value })}
                className="input-style" placeholder="국민은행" />
            </div>
            <div>
              <label className="label-style">계좌번호</label>
              <input value={form.account_no}
                onChange={e => setForm({ ...form, account_no: e.target.value })}
                className="input-style" placeholder="000-0000-0000" />
            </div>
            <div className="col-span-2">
              <label className="label-style">비고</label>
              <input value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                className="input-style" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <label htmlFor="is_active" className="text-sm">계약 활성</label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={loading}
              className="bg-blue-600 text-white px-5 py-2 rounded text-sm disabled:opacity-50">
              {loading ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(empty); }}
              className="border text-gray-600 px-5 py-2 rounded text-sm">
              취소
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {['성명','주민번호','연락처','은행/계좌','계약일','상태',''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contractors.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">등록된 수탁인이 없습니다.</td></tr>
            )}
            {contractors.map(c => (
              <tr key={c.id} className={`border-b hover:bg-gray-50 ${!c.is_active ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2.5 font-medium">{c.name}</td>
                <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{c.rrn_masked || '—'}</td>
                <td className="px-3 py-2.5 text-gray-600">{c.phone}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{c.bank_name} {c.account_no}</td>
                <td className="px-3 py-2.5 text-gray-500">{c.contract_date}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(c)} className="text-blue-500 hover:underline text-xs">수정</button>
                    <button onClick={() => toggleActive(c)} className="text-gray-400 hover:underline text-xs">
                      {c.is_active ? '비활성화' : '활성화'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 상품권 관리 탭 ──────────────────────────────────────────
function GiftCardTab({
  entries, contractors, loading, setLoading, onSaved, flash,
}: {
  entries: GiftCardEntry[];
  contractors: Contractor[];
  loading: boolean;
  setLoading: (v: boolean) => void;
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  const empty = {
    entry_type: 'purchase' as 'purchase' | 'distribution',
    entry_date: new Date().toISOString().slice(0, 10),
    denomination: '',
    quantity: '',
    unit_price: '',
    vendor: '',
    recipient_name: '',
    contractor_id: '',
    reason: '',
    note: '',
  };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // 액면가별 현재 재고 = 구매 수량 합 - 지급 수량 합
  const stockByDenom = entries.reduce((acc: Record<number, number>, e) => {
    const d = e.denomination;
    acc[d] = (acc[d] ?? 0) + (e.entry_type === 'purchase' ? e.quantity : -e.quantity);
    return acc;
  }, {});
  const denomList = Object.keys(stockByDenom).map(Number).sort((a, b) => a - b);
  const totalStockQty = Object.values(stockByDenom).reduce((s, q) => s + q, 0);
  const totalStockValue = denomList.reduce((s, d) => s + d * (stockByDenom[d] ?? 0), 0);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthDistCount = entries
    .filter(e => e.entry_type === 'distribution' && e.entry_date?.startsWith(thisMonth))
    .reduce((s, e) => s + e.quantity, 0);

  const currentStockForDenom = form.denomination ? (stockByDenom[Number(form.denomination)] ?? 0) : 0;
  const distExceedsStock =
    form.entry_type === 'distribution' && form.denomination && form.quantity
      ? Number(form.quantity) > currentStockForDenom
      : false;

  const handleSave = async () => {
    if (!form.denomination || !form.quantity) {
      flash('액면가와 수량은 필수입니다.');
      return;
    }
    if (form.entry_type === 'distribution' && !form.recipient_name) {
      flash('지급 대상자명은 필수입니다.');
      return;
    }
    setLoading(true);
    const qty = Number(form.quantity);
    const denom = Number(form.denomination);
    const unitPrice = form.unit_price ? Number(form.unit_price) : null;
    const totalAmount = form.entry_type === 'purchase' ? (unitPrice ?? denom) * qty : denom * qty;
    const payload = {
      entry_type: form.entry_type,
      entry_date: form.entry_date,
      denomination: denom,
      quantity: qty,
      unit_price: form.entry_type === 'purchase' ? unitPrice : null,
      total_amount: totalAmount,
      vendor: form.entry_type === 'purchase' ? (form.vendor || null) : null,
      recipient_name: form.entry_type === 'distribution' ? (form.recipient_name || null) : null,
      contractor_id: form.entry_type === 'distribution' ? (form.contractor_id || null) : null,
      reason: form.reason || null,
      note: form.note || null,
      created_by: 'admin@rnfkorea.co.kr',
    };
    if (editId) {
      await supabase.from('tb_gift_card_stock').update(payload).eq('id', editId);
    } else {
      await supabase.from('tb_gift_card_stock').insert(payload);
    }
    setLoading(false);
    setForm(empty);
    setEditId(null);
    setShowForm(false);
    onSaved();
  };

  const handleEdit = (e: GiftCardEntry) => {
    setForm({
      entry_type: e.entry_type,
      entry_date: e.entry_date,
      denomination: String(e.denomination),
      quantity: String(e.quantity),
      unit_price: e.unit_price ? String(e.unit_price) : '',
      vendor: e.vendor ?? '',
      recipient_name: e.recipient_name ?? '',
      contractor_id: e.contractor_id ?? '',
      reason: e.reason ?? '',
      note: e.note ?? '',
    });
    setEditId(e.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await supabase.from('tb_gift_card_stock').delete().eq('id', id);
    onSaved();
  };

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">현재 보유 수량 (전체 액면가)</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{totalStockQty.toLocaleString('ko-KR')}장</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">현재 보유 금액 (액면가 기준)</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{fmt(totalStockValue)}원</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">이번 달 지급 수량</p>
          <p className="text-xl font-bold text-orange-600 mt-1">{thisMonthDistCount.toLocaleString('ko-KR')}장</p>
        </div>
      </div>

      {/* 액면가별 재고 */}
      {denomList.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b text-sm font-medium text-gray-600">액면가별 재고 현황</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium border-b">액면가</th>
                <th className="px-4 py-2 text-right font-medium border-b">보유 수량</th>
                <th className="px-4 py-2 text-right font-medium border-b">보유 금액</th>
              </tr>
            </thead>
            <tbody>
              {denomList.map(d => (
                <tr key={d} className="border-b last:border-0">
                  <td className="px-4 py-2">{fmt(d)}원권</td>
                  <td className={`px-4 py-2 text-right font-medium ${(stockByDenom[d] ?? 0) < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {(stockByDenom[d] ?? 0).toLocaleString('ko-KR')}장
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">{fmt(d * (stockByDenom[d] ?? 0))}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 등록 버튼 */}
      {!showForm && (
        <div className="flex gap-2">
          <button
            onClick={() => { setForm({ ...empty, entry_type: 'purchase' }); setEditId(null); setShowForm(true); }}
            className="bg-[#0a192f] text-white px-4 py-2 rounded text-sm"
          >
            + 구매 등록
          </button>
          <button
            onClick={() => { setForm({ ...empty, entry_type: 'distribution' }); setEditId(null); setShowForm(true); }}
            className="bg-orange-500 text-white px-4 py-2 rounded text-sm"
          >
            + 지급 등록
          </button>
        </div>
      )}

      {/* 입력 폼 */}
      {showForm && (
        <div className="bg-white border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              {editId ? '내역 수정' : form.entry_type === 'purchase' ? '상품권 구매 등록' : '상품권 지급 등록'}
            </h3>
            {!editId && (
              <div className="flex gap-1 bg-gray-100 rounded p-0.5">
                {(['purchase', 'distribution'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, entry_type: t })}
                    className={`px-3 py-1 rounded text-xs font-medium ${form.entry_type === t ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                  >
                    {t === 'purchase' ? '구매' : '지급'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-style">일자 *</label>
              <input type="date" value={form.entry_date}
                onChange={e => setForm({ ...form, entry_date: e.target.value })}
                className="input-style" />
            </div>
            <div>
              <label className="label-style">액면가 (원) *</label>
              <input type="number" placeholder="50000" value={form.denomination}
                onChange={e => setForm({ ...form, denomination: e.target.value })}
                className="input-style" />
            </div>
            <div>
              <label className="label-style">수량 *</label>
              <input type="number" placeholder="0" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                className="input-style" />
              {distExceedsStock && (
                <p className="text-xs text-red-500 mt-1">⚠️ 현재 재고({currentStockForDenom.toLocaleString('ko-KR')}장)보다 많습니다.</p>
              )}
            </div>
            {form.entry_type === 'purchase' ? (
              <>
                <div>
                  <label className="label-style">매입 단가 (원, 미입력 시 액면가)</label>
                  <input type="number" placeholder={form.denomination || '액면가와 동일'} value={form.unit_price}
                    onChange={e => setForm({ ...form, unit_price: e.target.value })}
                    className="input-style" />
                </div>
                <div>
                  <label className="label-style">구매처</label>
                  <input value={form.vendor}
                    onChange={e => setForm({ ...form, vendor: e.target.value })}
                    className="input-style" placeholder="예: OO상품권 / 백화점" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label-style">지급 대상자명 *</label>
                  <input value={form.recipient_name}
                    onChange={e => setForm({ ...form, recipient_name: e.target.value })}
                    className="input-style" placeholder="홍길동" />
                </div>
                <div>
                  <label className="label-style">수탁인 연결 (선택)</label>
                  <select value={form.contractor_id}
                    onChange={e => setForm({ ...form, contractor_id: e.target.value })}
                    className="input-style">
                    <option value="">선택 안 함</option>
                    {contractors.filter(c => c.is_active).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="label-style">사유</label>
              <input value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                className="input-style" placeholder={form.entry_type === 'purchase' ? '명절 판촉용 등' : '실적 격려, 명절 선물 등'} />
            </div>
            <div>
              <label className="label-style">비고</label>
              <input value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                className="input-style" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={loading}
              className="bg-blue-600 text-white px-5 py-2 rounded text-sm disabled:opacity-50">
              {loading ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(empty); }}
              className="border text-gray-600 px-5 py-2 rounded text-sm">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 거래 내역 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {['일자', '구분', '액면가', '수량', '금액', '구매처/대상자', '사유', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">등록된 내역이 없습니다.</td></tr>
            )}
            {entries.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-700">{e.entry_date}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.entry_type === 'purchase' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                    {e.entry_type === 'purchase' ? '구매' : '지급'}
                  </span>
                </td>
                <td className="px-3 py-2.5">{fmt(e.denomination)}원권</td>
                <td className="px-3 py-2.5 text-right">{e.quantity.toLocaleString('ko-KR')}장</td>
                <td className="px-3 py-2.5 text-right font-medium">{fmt(e.total_amount)}</td>
                <td className="px-3 py-2.5 text-gray-600">
                  {e.entry_type === 'purchase' ? (e.vendor || '—') : (e.recipient_name || '—')}
                  {e.contractor_name && <span className="ml-1 text-xs text-gray-400">({e.contractor_name})</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{e.reason}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(e)} className="text-blue-500 hover:underline text-xs">수정</button>
                    <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:underline text-xs">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 지급대상 탭 (수Company) ─────────────────────────────────
// 오릭스 인센티브 관리(별도 페이지)에서 입력한 항목 중 수익자가 수Company인 것만
// 읽기전용으로 그대로 보여준다. 등록/수정/삭제는 오릭스 인센티브 관리 화면에서만 가능하다.
function OrixRecipientTab({ rows, year }: { rows: OrixRecipientRow[]; year: string }) {
  const totalIncentive = rows.reduce((s, r) => s + (r.incentive_total ?? 0), 0);
  const totalCmPaid = rows.reduce((s, r) => s + (r.cm_paid_incentive ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        📋 오릭스 인센티브 관리 화면에서 입력한 항목 중 수익자가 <strong>수Company</strong>인 건만 표시됩니다. 등록·수정은 오릭스 인센티브 관리 화면에서 해주세요.
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">{year}년 건수</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{rows.length.toLocaleString('ko-KR')}건</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">인센티브 총액 합계</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{fmt(totalIncentive)}원</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">CM지급 인센티브 합계</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{fmt(totalCmPaid)}원</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {['확정일자', '고객명', '대출원금', '상품구분', '차종', '인센티브율', '인센티브 총액', 'CM지급 인센티브', '지급상태', '비고'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">해당 연도에 등록된 항목이 없습니다.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-700">{r.confirmed_date ?? '—'}</td>
                <td className="px-3 py-2.5 font-medium">{r.customer_name}</td>
                <td className="px-3 py-2.5 text-right">{fmt(r.loan_principal ?? 0)}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.product_type ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.vehicle_type ?? '—'}</td>
                <td className="px-3 py-2.5">{r.incentive_rate ?? '—'}{r.incentive_rate !== null ? '%' : ''}</td>
                <td className="px-3 py-2.5 text-right font-medium">{fmt(r.incentive_total ?? 0)}</td>
                <td className="px-3 py-2.5 text-right text-blue-700 font-medium">{fmt(r.cm_paid_incentive ?? 0)}</td>
                <td className="px-3 py-2.5">
                  {r.paid_at ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">지급완료</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">미지급</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 월별 현황 탭 ────────────────────────────────────────────
function MonthlyTab({ monthly, year }: { monthly: MonthlyRow[]; year: string }) {
  const totalPay = monthly.reduce((s, r) => s + Number(r.total_pay), 0);
  const totalWh  = monthly.reduce((s, r) => s + Number(r.total_withholding), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">{year}년 세전 지급 합계</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{fmt(totalPay)}원</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">{year}년 원천징수 합계</p>
          <p className="text-xl font-bold text-red-600 mt-1">{fmt(totalWh)}원</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <p className="text-xs text-blue-600">홈택스 신고 주기</p>
          <p className="text-sm font-medium text-blue-800 mt-1">지급月 익월 10일까지 납부</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['귀속월','지급건수','세전금액','원천징수액','실지급액','납부기한','신고상태'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthly.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
            )}
            {monthly.map(m => {
              const isPast = new Date(m.due_date) < new Date();
              return (
                <tr key={m.month_label} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.month_label}</td>
                  <td className="px-4 py-3 text-center">{m.count}건</td>
                  <td className="px-4 py-3 text-right">{fmt(Number(m.total_pay))}</td>
                  <td className="px-4 py-3 text-right text-red-600">{fmt(Number(m.total_withholding))}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt(Number(m.total_net))}</td>
                  <td className={`px-4 py-3 ${isPast ? 'text-red-500' : 'text-gray-600'}`}>{m.due_date}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400 border rounded px-2 py-0.5">미확인</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">※ 신고상태는 수동으로 확인 후 메모하시기 바랍니다. 홈택스 연동은 공식 API 미지원으로 자동화 불가.</p>
    </div>
  );
}

// ─── 연간 집계 탭 ────────────────────────────────────────────
function AnnualTab({ annual, year }: { annual: AnnualRow[]; year: string }) {
  const total = annual.reduce((s, r) => ({
    pay: s.pay + Number(r.annual_pay),
    wh: s.wh + Number(r.annual_withholding),
    net: s.net + Number(r.annual_net),
  }), { pay: 0, wh: 0, net: 0 });

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        📋 지급명세서 제출 기한: <strong>{Number(year) + 1}년 3월 10일</strong>까지 홈택스 제출 (소득구분: 사업소득 940)
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['성명','주민등록번호','지급건수','연간 지급액','원천징수액','차감 지급액'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {annual.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
            )}
            {annual.map((a, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.rrn_masked || '—'}</td>
                <td className="px-4 py-3 text-center">{a.pay_count}건</td>
                <td className="px-4 py-3 text-right">{fmt(Number(a.annual_pay))}</td>
                <td className="px-4 py-3 text-right text-red-600">{fmt(Number(a.annual_withholding))}</td>
                <td className="px-4 py-3 text-right text-blue-700 font-medium">{fmt(Number(a.annual_net))}</td>
              </tr>
            ))}
            {annual.length > 0 && (
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3" colSpan={3}>합 계</td>
                <td className="px-4 py-3 text-right">{fmt(total.pay)}</td>
                <td className="px-4 py-3 text-right text-red-600">{fmt(total.wh)}</td>
                <td className="px-4 py-3 text-right text-blue-700">{fmt(total.net)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 롯데오토리스 인센티브 관리 탭 ────────────────────────────
function LotteLeaseTab({
  entries, loading, setLoading, onSaved, flash,
}: {
  entries: LotteIncentive[];
  loading: boolean;
  setLoading: (v: boolean) => void;
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  const empty = {
    contract_date: new Date().toISOString().slice(0, 10),
    contract_no: '',
    customer_name: '',
    contract_amount: '',
    collateral_set: false,
    note: '',
  };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'set' | 'unset'>('all');

  const incentive = form.contract_amount ? calcLotteIncentive(Number(form.contract_amount)) : 0;

  const handleSave = async () => {
    if (!form.customer_name || !form.contract_date || !form.contract_amount) {
      flash('계약일자·고객명·계약금액은 필수입니다.');
      return;
    }
    setLoading(true);
    const payload = {
      contract_date: form.contract_date,
      contract_no: form.contract_no || null,
      customer_name: form.customer_name,
      contract_amount: Number(form.contract_amount),
      collateral_set: form.collateral_set,
      incentive_amount: incentive,
      note: form.note || null,
    };
    if (editId) {
      await supabase.from('tb_lotte_lease_incentives').update(payload).eq('id', editId);
    } else {
      await supabase.from('tb_lotte_lease_incentives').insert(payload);
    }
    setLoading(false);
    setForm(empty);
    setEditId(null);
    setShowForm(false);
    onSaved();
  };

  const handleEdit = (r: LotteIncentive) => {
    setForm({
      contract_date: r.contract_date,
      contract_no: r.contract_no ?? '',
      customer_name: r.customer_name,
      contract_amount: r.contract_amount.toString(),
      collateral_set: r.collateral_set,
      note: r.note ?? '',
    });
    setEditId(r.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await supabase.from('tb_lotte_lease_incentives').delete().eq('id', id);
    onSaved();
  };

  const toggleCollateral = async (r: LotteIncentive) => {
    await supabase.from('tb_lotte_lease_incentives')
      .update({ collateral_set: !r.collateral_set })
      .eq('id', r.id);
    onSaved();
  };

  const filteredEntries = entries.filter(r => {
    const monthOk = monthFilter === 'all' || r.contract_date?.slice(5, 7) === monthFilter;
    const statusOk = statusFilter === 'all'
      || (statusFilter === 'set' ? r.collateral_set : !r.collateral_set);
    return monthOk && statusOk;
  });

  const totalAmount = filteredEntries.reduce((s, r) => s + r.contract_amount, 0);
  const totalIncentive = filteredEntries.reduce((s, r) => s + r.incentive_amount, 0);

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">계약 건수</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{entries.length.toLocaleString('ko-KR')}건</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">계약금액 합계</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{fmt(totalAmount)}원</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">인센티브 합계 (0.5%)</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{fmt(totalIncentive)}원</p>
        </div>
      </div>

      {/* 등록 버튼 */}
      {!showForm && (
        <button
          onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }}
          className="bg-[#0a192f] text-white px-4 py-2 rounded text-sm"
        >
          + 계약 등록
        </button>
      )}

      {/* 입력 폼 */}
      {showForm && (
        <div className="bg-white border rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">
            {editId ? '계약 수정' : '계약 등록'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-style">계약일자 *</label>
              <input type="date" value={form.contract_date}
                onChange={e => setForm({ ...form, contract_date: e.target.value })}
                className="input-style" />
            </div>
            <div>
              <label className="label-style">계약번호</label>
              <input value={form.contract_no}
                onChange={e => setForm({ ...form, contract_no: e.target.value })}
                className="input-style" placeholder="2618001217" />
            </div>
            <div>
              <label className="label-style">고객명 *</label>
              <input value={form.customer_name}
                onChange={e => setForm({ ...form, customer_name: e.target.value })}
                className="input-style" placeholder="홍길동" />
            </div>
            <div>
              <label className="label-style">계약금액 (원) *</label>
              <input type="number" placeholder="0" value={form.contract_amount}
                onChange={e => setForm({ ...form, contract_amount: e.target.value })}
                className="input-style" />
            </div>
            <div>
              <label className="label-style">자동계산 (0.5%)</label>
              <div className="bg-gray-50 border rounded px-3 py-2 text-sm flex justify-between">
                <span className="text-gray-500">인센티브</span>
                <span className="text-blue-700 font-medium">{fmt(incentive)}원</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="collateral_set"
                checked={form.collateral_set}
                onChange={e => setForm({ ...form, collateral_set: e.target.checked })}
              />
              <label htmlFor="collateral_set" className="text-sm text-gray-700">담보설정 완료</label>
            </div>
            <div className="col-span-2">
              <label className="label-style">비고</label>
              <input value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                className="input-style" placeholder="메모" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={loading}
              className="bg-blue-600 text-white px-5 py-2 rounded text-sm disabled:opacity-50">
              {loading ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(empty); }}
              className="border text-gray-600 px-5 py-2 rounded text-sm">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white border rounded-lg p-3 flex items-center gap-3">
        <span className="text-xs text-gray-500">필터</span>
        <select
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm text-gray-700"
        >
          <option value="all">전체 월</option>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
            <option key={m} value={m}>{Number(m)}월</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | 'set' | 'unset')}
          className="border rounded px-2 py-1.5 text-sm text-gray-700"
        >
          <option value="all">전체 담보상태</option>
          <option value="set">설정</option>
          <option value="unset">미설정</option>
        </select>
        {(monthFilter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => { setMonthFilter('all'); setStatusFilter('all'); }}
            className="text-xs text-gray-400 hover:underline"
          >
            필터 초기화
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filteredEntries.length}건 표시 중</span>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {['계약일자', '계약번호', '고객명', '계약금액', '담보설정', '인센티브(0.5%)', '비고', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">등록된 계약이 없습니다.</td></tr>
            )}
            {filteredEntries.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-700">{r.contract_date}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{r.contract_no || '—'}</td>
                <td className="px-3 py-2.5 font-medium">{r.customer_name}</td>
                <td className="px-3 py-2.5 text-right">{fmt(r.contract_amount)}</td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => toggleCollateral(r)}
                    title={r.collateral_set ? '클릭 시 미설정으로 변경' : '클릭 시 설정으로 변경'}
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${r.collateral_set ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {r.collateral_set ? '설정' : '미설정'}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right text-blue-700 font-medium">{fmt(r.incentive_amount)}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{r.note}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(r)} className="text-blue-500 hover:underline text-xs">수정</button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:underline text-xs">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}