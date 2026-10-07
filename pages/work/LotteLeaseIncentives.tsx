// pages/work/LotteLeaseIncentives.tsx
// 롯데오토리스 인센티브 관리 — 원천징수관리(/work/withholding)와 인센티브(/orix) 페이지가 함께 쓰는 공용 모듈.
// 테이블 tb_lotte_lease_incentives (RLS: admin@rnfkorea.co.kr, ltongs7@gmail.com, everyasset.fc@gmail.com)
// 인센티브 = 계약금액 × 0.5% (부가세 제외 고정). 목록 구분: 월 / 담보 설정여부.
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface LotteIncentive {
  id: string;
  contract_date: string;
  contract_no: string | null;
  customer_name: string;
  contract_amount: number;
  collateral_set: boolean;
  incentive_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// 롯데 고객명("디딤상사(이병훈)", "주식회사 애플리")과 나르미 고객명("이병훈", "(주)애플리")을
// 맞추기 위한 비교 키: 괄호 밖/안 이름 각각에서 법인 표기·공백을 제거한다.
const lotteNameKeys = (name?: string | null): string[] => {
  const s = (name ?? '').replace(/주식회사|\(주\)|㈜/g, '');
  const outer = s.replace(/\(.*$/, '');
  const inner = s.match(/\(([^()]*)/)?.[1] ?? '';
  return [outer, inner]
    .map(v => v.replace(/\s/g, ''))
    .filter(v => v.length >= 2);
};

const fmt = (n: number) => n?.toLocaleString('ko-KR') ?? '0';
const LOTTE_RATE = 0.005;
const calcLotteIncentive = (amount: number) => Math.floor(amount * LOTTE_RATE);

// 전체 계약 조회 + 나르미에서 등록완료된 고객과 이름이 일치하는 미설정 건은 자동으로 '설정' 처리한다.
export async function fetchLotteIncentives(): Promise<LotteIncentive[]> {
  const [{ data }, { data: narumi }] = await Promise.all([
    supabase
      .from('tb_lotte_lease_incentives')
      .select('*')
      .order('contract_date', { ascending: false }),
    supabase
      .from('narumi_tasks')
      .select('customer_name, registered_at, vehicle_doc_uploaded_at, created_at')
      .eq('is_registered', true),
  ]);
  const rows: LotteIncentive[] = data ?? [];

  // 나르미에서 등록완료된 고객과 이름이 일치하는 미설정 건은 자동으로 '설정' 처리.
  // 한 번도 수정되지 않았거나, 마지막 수정 이후에 등록완료된 건만 대상 —
  // 사용자가 수동으로 미설정으로 되돌린 건은 다시 덮어쓰지 않는다.
  const registeredAt = new Map<string, number>();
  for (const t of narumi ?? []) {
    const ts = Date.parse(t.registered_at ?? t.vehicle_doc_uploaded_at ?? t.created_at ?? '') || 0;
    for (const k of lotteNameKeys(t.customer_name)) {
      registeredAt.set(k, Math.max(registeredAt.get(k) ?? 0, ts));
    }
  }
  const toSet = rows.filter(r => {
    if (r.collateral_set) return false;
    const matched = lotteNameKeys(r.customer_name).filter(k => registeredAt.has(k));
    if (matched.length === 0) return false;
    const ts = Math.max(...matched.map(k => registeredAt.get(k)!));
    return r.updated_at === r.created_at || ts > Date.parse(r.updated_at);
  });
  if (toSet.length > 0) {
    await supabase
      .from('tb_lotte_lease_incentives')
      .update({ collateral_set: true })
      .in('id', toSet.map(r => r.id));
    const ids = new Set(toSet.map(r => r.id));
    return rows.map(r => ids.has(r.id) ? { ...r, collateral_set: true } : r);
  }
  return rows;
}

// ─── 롯데오토리스 인센티브 관리 탭 ────────────────────────────
export default function LotteLeaseTab({
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

  // 월 구분은 실제 계약이 있는 월(YYYY-MM)만, 최신 월부터
  const monthOptions = Array.from(new Set(entries.map(r => r.contract_date?.slice(0, 7)).filter(Boolean))).sort().reverse();

  const filteredEntries = entries.filter(r => {
    const monthOk = monthFilter === 'all' || r.contract_date?.slice(0, 7) === monthFilter;
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
          <p className="text-xl font-bold text-gray-800 mt-1">{filteredEntries.length.toLocaleString('ko-KR')}건</p>
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
          {monthOptions.map(m => (
            <option key={m} value={m}>{m.slice(0, 4)}년 {Number(m.slice(5, 7))}월</option>
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