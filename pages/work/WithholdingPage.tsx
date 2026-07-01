// src/pages/work/WithholdingPage.tsx
// 원천징수 관리 페이지 — /work/withholding
// isAdmin 전용

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

// ─── 타입 ──────────────────────────────────────────────────
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
}

interface Payment {
  id: string;
  contractor_id: string;
  contractor_name?: string;
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
}

interface AnnualRow {
  pay_year: number;
  name: string;
  rrn_masked: string;
  pay_count: number;
  annual_pay: number;
  annual_withholding: number;
  annual_net: number;
}

// ─── 유틸 ──────────────────────────────────────────────────
const fmt = (n: number) => n?.toLocaleString('ko-KR') ?? '0';
const RATE = 0.033;
const calcWithholding = (amount: number) => Math.floor(amount * RATE);

const TABS = ['지급내역', '수탁인 관리', '월별 현황', '연간 집계'] as const;
type Tab = typeof TABS[number];

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
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [annual, setAnnual] = useState<AnnualRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 필터
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

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
      .select(`*, tb_contractors(name)`)
      .order('pay_date', { ascending: false });
    const rows = (data ?? []).map((r: any) => ({
      ...r,
      contractor_name: r.tb_contractors?.name ?? '',
    }));
    setPayments(rows);
  }, []);

  const loadMonthly = useCallback(async () => {
    const { data } = await supabase
      .from('v_withholding_monthly')
      .select('*')
      .ilike('month_label', `${filterYear}%`);
    setMonthly(data ?? []);
  }, [filterYear]);

  const loadAnnual = useCallback(async () => {
    const { data } = await supabase
      .from('v_withholding_annual')
      .select('*')
      .eq('pay_year', Number(filterYear));
    setAnnual(data ?? []);
  }, [filterYear]);

  useEffect(() => {
    loadContractors();
    loadPayments();
  }, [loadContractors, loadPayments]);

  useEffect(() => {
    if (tab === '월별 현황') loadMonthly();
    if (tab === '연간 집계') loadAnnual();
  }, [tab, filterYear, loadMonthly, loadAnnual]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  };

  // ── Excel 내보내기 ──
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 시트1: 지급내역 전체
    const payRows = payments
      .filter(p => p.pay_date?.startsWith(filterYear))
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
    const mRows = monthly.map(m => ({
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
    const aRows = annual.map(a => ({
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

    XLSX.writeFile(wb, `원천징수관리_${filterYear}.xlsx`);
  };

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
      </div>

      {/* 탭 */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto flex">
          {TABS.map(t => (
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

      {msg && (
        <div className="max-w-6xl mx-auto mt-3 px-4">
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded">
            {msg}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {tab === '지급내역' && (
          <PaymentTab
            payments={payments.filter(p => p.pay_date?.startsWith(filterYear))}
            contractors={contractors}
            loading={loading}
            setLoading={setLoading}
            onSaved={() => { loadPayments(); flash('저장되었습니다.'); }}
            flash={flash}
          />
        )}
        {tab === '수탁인 관리' && (
          <ContractorTab
            contractors={contractors}
            loading={loading}
            setLoading={setLoading}
            onSaved={() => { loadContractors(); flash('저장되었습니다.'); }}
            flash={flash}
          />
        )}
        {tab === '월별 현황' && (
          <MonthlyTab monthly={monthly} year={filterYear} />
        )}
        {tab === '연간 집계' && (
          <AnnualTab annual={annual} year={filterYear} />
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
  contractors, loading, setLoading, onSaved, flash,
}: {
  contractors: Contractor[];
  loading: boolean;
  setLoading: (v: boolean) => void;
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  const empty = {
    name: '', rrn_masked: '', phone: '',
    bank_name: '', account_no: '',
    contract_date: '', is_active: true, note: '',
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