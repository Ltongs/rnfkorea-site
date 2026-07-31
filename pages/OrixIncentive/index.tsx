// pages/OrixIncentive/index.tsx
// ORIX 인센티브 관리: admin과 조용백(yongbaek_jo@orix.co.kr) 단 두 사람만 접근.
// admin은 orix_incentives 테이블(전체 컬럼)을, 조용백은 admin 전용 컬럼이 아예 빠진
// orix_incentives_partner_view를 통해서만 조회/입력한다 — 서버(DB) 단에서 컬럼 자체를 숨긴다.
// 인센티브총액/CM지급인센티브는 DB의 GENERATED 컬럼(대출원금×인센티브율/CM인센티브율 기반)이라 직접 입력하지 않는다.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Upload, Download, Trash2, X, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import AppTabBar from "../../components/AppTabBar";

const PRODUCT_TYPES = ["할부", "리스", "기타"] as const;

type SalesInputFields = {
  confirmed_date: string | null;
  customer_name: string;
  loan_principal: number | null;
  product_type: string | null;
  vehicle_type: string | null;
  incentive_rate: number | null;
  cm_incentive_rate: number | null;
  incentive_recipient_contractor_id: string | null; // 지급대상(수령자) — 등록된 수탁인(tb_contractors)만 선택 가능
  incentive_recipient_pending: boolean; // 업무위수탁 계약 전이라 수탁인 미등록 상태("미정")
};

// 지급대상 select에서 "미정"을 고를 때만 쓰는 화면 전용 sentinel (DB에는 저장되지 않음)
const RECIPIENT_PENDING_VALUE = "__pending__";

type AdminOnlyFields = {
  paid_at: string | null;
  paid_to_contractor_id: string | null;
  actual_paid_amount: number | null;
  payment_diff_note: string | null;
  wire_receipt_path: string | null;
};

type Row = SalesInputFields &
  Partial<AdminOnlyFields> & {
    id: string;
    incentive_total: number | null; // DB GENERATED: round(loan_principal * incentive_rate / 100)
    cm_paid_incentive: number | null; // DB GENERATED: round(loan_principal * cm_incentive_rate / 100) 의 96.7%(3.3% 원천징수 공제)
    paid_to_contractor_name?: string | null; // 조용백용 읽기전용 뷰에서만 내려오는 지급처(수탁인) 이름
    created_at: string;
  };

type Contractor = { id: string; name: string };

const cardClass =
  "border border-gray-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all";
const sectionTitleClass =
  "text-xs font-medium tracking-[0.12em] uppercase text-orange-500";
const inputClass =
  "h-[42px] w-full px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-navy-900 " +
  "placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all";
const readonlyClass =
  "h-[42px] w-full px-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium text-gray-500 flex items-center";
const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";

function formatMoney(v: number | null | undefined) {
  if (v === null || v === undefined) return "-";
  return `${v.toLocaleString("ko-KR")}원`;
}

function contractorName(contractors: Contractor[], id: string | null | undefined) {
  if (!id) return "-";
  return contractors.find((c) => c.id === id)?.name ?? "-";
}

function recipientLabel(contractors: Contractor[], row: { incentive_recipient_contractor_id?: string | null; incentive_recipient_pending?: boolean }) {
  if (row.incentive_recipient_pending) return "미정";
  return contractorName(contractors, row.incentive_recipient_contractor_id);
}

// DB의 GENERATED 컬럼과 동일한 계산식 — 저장 전 화면에 미리보기로 보여주기 위한 용도.
function calcIncentiveTotal(loanPrincipal: number | null, rate: number | null) {
  if (loanPrincipal === null || rate === null) return null;
  return Math.round((loanPrincipal * rate) / 100);
}
function calcCmPaidIncentive(loanPrincipal: number | null, cmRate: number | null) {
  if (loanPrincipal === null || cmRate === null) return null;
  return Math.round(Math.round((loanPrincipal * cmRate) / 100) * (1 - 0.033));
}

function emptySalesForm(): SalesInputFields {
  return {
    confirmed_date: "",
    customer_name: "",
    loan_principal: null,
    product_type: "",
    vehicle_type: "",
    incentive_rate: null,
    cm_incentive_rate: null,
    incentive_recipient_contractor_id: null,
    incentive_recipient_pending: false,
  };
}

function emptyAdminForm(): AdminOnlyFields {
  return { paid_at: "", paid_to_contractor_id: null, actual_paid_amount: null, payment_diff_note: "", wire_receipt_path: null };
}

export default function OrixIncentivePage() {
  const navigate = useNavigate();
  const { user, logout, isOrixAdmin, isOrixPartner } = useAuth() as any;
  // admin은 전체 컬럼을 그대로 읽고 쓴다. 조용백은 관리자 전용 항목을 "읽기전용"으로 보되
  // 직접 수정은 못 하도록, 조회용(전체 컬럼)과 입력용(영업 항목만) 뷰를 분리해서 쓴다.
  const readTable = isOrixAdmin ? "orix_incentives" : "orix_incentives_partner_view";
  const writeTable = isOrixAdmin ? "orix_incentives" : "orix_incentives_partner_edit_view";

  const [rows, setRows] = useState<Row[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newSales, setNewSales] = useState<SalesInputFields>(emptySalesForm());
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editSales, setEditSales] = useState<SalesInputFields>(emptySalesForm());
  const [editAdmin, setEditAdmin] = useState<AdminOnlyFields>(emptyAdminForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rowMsg, setRowMsg] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from(readTable)
      .select("*")
      .order("confirmed_date", { ascending: false, nullsFirst: false });
    if (err) setError(err.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  const loadContractors = async () => {
    // 지급대상(수령자) 선택은 admin/파트너 모두 사용하므로 둘 다 로드한다.
    const { data } = await supabase.from("orix_contractors_picker_view").select("id, name").order("name");
    setContractors((data ?? []) as Contractor[]);
  };

  useEffect(() => {
    loadRows();
    loadContractors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readTable]);

  const notifyNewEntry = async (fields: SalesInputFields) => {
    try {
      await supabase.functions.invoke("send-orix-new-entry-alert", {
        body: {
          customerName: fields.customer_name,
          loanPrincipal: fields.loan_principal,
          productType: fields.product_type,
          incentiveRate: fields.incentive_rate,
        },
      });
    } catch {
      // 알림 실패는 등록 자체를 막지 않는다.
    }
  };

  const createRow = async () => {
    if (!newSales.customer_name.trim()) { setCreateMsg("고객명을 입력해주세요."); return; }
    setCreating(true);
    setCreateMsg("");
    try {
      const { error: err } = await supabase.from(writeTable).insert({
        confirmed_date: newSales.confirmed_date || null,
        customer_name: newSales.customer_name.trim(),
        loan_principal: newSales.loan_principal,
        product_type: newSales.product_type || null,
        vehicle_type: newSales.vehicle_type || null,
        incentive_rate: newSales.incentive_rate,
        cm_incentive_rate: newSales.cm_incentive_rate,
        incentive_recipient_contractor_id: newSales.incentive_recipient_contractor_id || null,
        incentive_recipient_pending: newSales.incentive_recipient_pending,
      });
      if (err) throw err;
      await notifyNewEntry(newSales);
      setNewSales(emptySalesForm());
      await loadRows();
    } catch (e: any) {
      setCreateMsg(e?.message || "저장에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const openRow = (row: Row) => {
    if (expandedId === row.id) { setExpandedId(null); return; }
    setExpandedId(row.id);
    setRowMsg("");
    setEditSales({
      confirmed_date: row.confirmed_date,
      customer_name: row.customer_name,
      loan_principal: row.loan_principal,
      product_type: row.product_type,
      vehicle_type: row.vehicle_type,
      incentive_rate: row.incentive_rate,
      cm_incentive_rate: row.cm_incentive_rate,
      incentive_recipient_contractor_id: row.incentive_recipient_contractor_id,
      incentive_recipient_pending: row.incentive_recipient_pending,
    });
    if (isOrixAdmin) {
      setEditAdmin({
        paid_at: row.paid_at ?? "",
        paid_to_contractor_id: row.paid_to_contractor_id ?? null,
        actual_paid_amount: row.actual_paid_amount ?? null,
        payment_diff_note: row.payment_diff_note ?? "",
        wire_receipt_path: row.wire_receipt_path ?? null,
      });
    }
  };

  const saveRow = async () => {
    if (!expandedId) return;
    if (isOrixAdmin && editAdmin.paid_at && !editAdmin.paid_to_contractor_id) {
      setRowMsg("지급일자를 입력하려면 등록된 수탁인을 먼저 지정해야 합니다.");
      return;
    }
    setSaving(true);
    setRowMsg("");
    try {
      const payload: Record<string, unknown> = {
        confirmed_date: editSales.confirmed_date || null,
        customer_name: editSales.customer_name.trim(),
        loan_principal: editSales.loan_principal,
        product_type: editSales.product_type || null,
        vehicle_type: editSales.vehicle_type || null,
        incentive_rate: editSales.incentive_rate,
        cm_incentive_rate: editSales.cm_incentive_rate,
        incentive_recipient_contractor_id: editSales.incentive_recipient_contractor_id || null,
        incentive_recipient_pending: editSales.incentive_recipient_pending,
      };
      if (isOrixAdmin) {
        payload.paid_at = editAdmin.paid_at || null;
        payload.paid_to_contractor_id = editAdmin.paid_to_contractor_id;
        payload.actual_paid_amount = editAdmin.actual_paid_amount;
        payload.payment_diff_note = editAdmin.payment_diff_note || null;
        payload.wire_receipt_path = editAdmin.wire_receipt_path;
      }
      const { error: err } = await supabase.from(writeTable).update(payload).eq("id", expandedId);
      if (err) throw err;
      setRowMsg("저장되었습니다.");
      await loadRows();
    } catch (e: any) {
      setRowMsg(e?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (id: string) => {
    if (!isOrixAdmin) return;
    if (!window.confirm("이 인센티브 항목을 삭제할까요? 되돌릴 수 없습니다.")) return;
    const { error: err } = await supabase.from(writeTable).delete().eq("id", id);
    if (err) { setRowMsg(err.message); return; }
    if (expandedId === id) setExpandedId(null);
    await loadRows();
  };

  const onUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !expandedId) return;
    setUploading(true);
    setRowMsg("");
    try {
      const path = `${expandedId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("orix_wire_receipts")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      setEditAdmin((prev) => ({ ...prev, wire_receipt_path: path }));
    } catch (e: any) {
      setRowMsg(e?.message || "송금증 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const downloadReceipt = async (path: string) => {
    const { data, error: err } = await supabase.storage.from("orix_wire_receipts").createSignedUrl(path, 60);
    if (err || !data?.signedUrl) { setRowMsg(err?.message || "다운로드 링크 생성에 실패했습니다."); return; }
    window.open(data.signedUrl, "_blank");
  };

  const totalIncentive = rows.reduce((sum, r) => sum + (r.incentive_total ?? 0), 0);
  const newTotalPreview = calcIncentiveTotal(newSales.loan_principal, newSales.incentive_rate);
  const newCmPreview = calcCmPaidIncentive(newSales.loan_principal, newSales.cm_incentive_rate);
  const editTotalPreview = calcIncentiveTotal(editSales.loan_principal, editSales.incentive_rate);
  const editCmPreview = calcCmPaidIncentive(editSales.loan_principal, editSales.cm_incentive_rate);
  const editAmountMismatch =
    isOrixAdmin &&
    editAdmin.actual_paid_amount !== null &&
    editCmPreview !== null &&
    editAdmin.actual_paid_amount !== editCmPreview;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 + 탭 헤더 ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isOrixAdmin && (
              <button
                onClick={() => navigate("/work/secretary")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all"
              >
                ← AI비서
              </button>
            )}
            <span className="text-sm font-semibold text-[#0f172a]">💰 ORIX 인센티브 관리</span>
            <span className="text-xs text-gray-400">
              {isOrixAdmin ? "관리자 화면 — 전체 항목 조회/입력" : "ORIX 파트너 화면 — 확정 내역 조회/입력"}
            </span>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all"
          >
            로그아웃 ({user?.email})
          </button>
        </div>
        {isOrixAdmin && (
          <div className="px-4 pb-2.5">
            <AppTabBar activeTab="orix" />
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white flex items-center justify-center gap-3 py-16 text-gray-400 shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="text-sm font-medium">데이터를 불러오는 중입니다.</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-6 py-4 text-sm font-semibold">
            {error}
          </div>
        ) : (
          <>
            <section className={`${cardClass} p-6 space-y-4`}>
              <p className={sectionTitleClass}>New</p>
              <h2 className="text-lg font-semibold text-navy-900">신규 인센티브 항목 등록</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>확정일자</label>
                  <input type="date" className={inputClass} value={newSales.confirmed_date ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, confirmed_date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>고객명</label>
                  <input className={inputClass} value={newSales.customer_name}
                    onChange={(e) => setNewSales((p) => ({ ...p, customer_name: e.target.value }))} placeholder="고객명" />
                </div>
                <div>
                  <label className={labelClass}>대출원금</label>
                  <input type="number" className={inputClass} value={newSales.loan_principal ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, loan_principal: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="원" />
                </div>
                <div>
                  <label className={labelClass}>상품구분</label>
                  <select className={inputClass} value={newSales.product_type ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, product_type: e.target.value }))}>
                    <option value="">선택</option>
                    {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>차종</label>
                  <input className={inputClass} value={newSales.vehicle_type ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, vehicle_type: e.target.value }))} placeholder="차종" />
                </div>
                <div>
                  <label className={labelClass}>지급대상 (수탁인)</label>
                  <select className={inputClass}
                    value={newSales.incentive_recipient_pending ? RECIPIENT_PENDING_VALUE : (newSales.incentive_recipient_contractor_id ?? "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewSales((p) => ({
                        ...p,
                        incentive_recipient_pending: v === RECIPIENT_PENDING_VALUE,
                        incentive_recipient_contractor_id: v === RECIPIENT_PENDING_VALUE ? null : (v || null),
                      }));
                    }}>
                    <option value="">선택 (원천징수관리-수탁인관리에 등록 필요)</option>
                    <option value={RECIPIENT_PENDING_VALUE}>미정 (업무위수탁 계약 전)</option>
                    {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>인센티브율 (%)</label>
                  <input type="number" step="0.01" className={inputClass} value={newSales.incentive_rate ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, incentive_rate: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="예: 2.5" />
                </div>
                <div>
                  <label className={labelClass}>인센티브 총액 (자동계산)</label>
                  <div className={readonlyClass}>{formatMoney(newTotalPreview)}</div>
                </div>
                <div />
                <div>
                  <label className={labelClass}>CM인센티브율 (%)</label>
                  <input type="number" step="0.01" className={inputClass} value={newSales.cm_incentive_rate ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, cm_incentive_rate: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="예: 2.5" />
                </div>
                <div>
                  <label className={labelClass}>CM지급 인센티브 (자동계산)</label>
                  <div className={readonlyClass}>{formatMoney(newCmPreview)}</div>
                </div>
              </div>
              {!!createMsg && <div className="text-sm font-medium text-orange-600">{createMsg}</div>}
              <button
                onClick={createRow}
                disabled={creating}
                className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> {creating ? "저장 중..." : "등록"}
              </button>
            </section>

            <section className={`${cardClass} p-6 space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={sectionTitleClass}>List</p>
                  <h2 className="text-lg font-semibold text-navy-900">인센티브 목록 ({rows.length}건)</h2>
                </div>
                <div className="text-sm text-gray-500">
                  인센티브 총액 합계: <span className="font-semibold text-navy-900">{formatMoney(totalIncentive)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-400 uppercase border-b border-gray-200">
                      <th className="py-2 pr-4">확정일자</th>
                      <th className="py-2 pr-4">고객명</th>
                      <th className="py-2 pr-4">대출원금</th>
                      <th className="py-2 pr-4">상품구분</th>
                      <th className="py-2 pr-4">차종</th>
                      <th className="py-2 pr-4">인센티브율</th>
                      <th className="py-2 pr-4">인센티브 총액</th>
                      <th className="py-2 pr-4">CM지급 인센티브</th>
                      <th className="py-2 pr-4">지급대상</th>
                      <th className="py-2 pr-4">지급상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={10} className="py-8 text-center text-gray-400">등록된 항목이 없습니다.</td></tr>
                    )}
                    {rows.map((row) => (
                      <React.Fragment key={row.id}>
                        <tr
                          className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                          onClick={() => openRow(row)}
                        >
                          <td className="py-2.5 pr-4 whitespace-nowrap">{row.confirmed_date ?? "-"}</td>
                          <td className="py-2.5 pr-4 font-medium text-navy-900 whitespace-nowrap">{row.customer_name}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">{formatMoney(row.loan_principal)}</td>
                          <td className="py-2.5 pr-4">{row.product_type ?? "-"}</td>
                          <td className="py-2.5 pr-4">{row.vehicle_type ?? "-"}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">{row.incentive_rate ?? "-"}{row.incentive_rate !== null ? "%" : ""}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap font-medium">{formatMoney(row.incentive_total)}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">{formatMoney(row.cm_paid_incentive)}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">{recipientLabel(contractors, row)}</td>
                          <td className="py-2.5 pr-4">
                            {row.paid_at ? (
                              <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">지급완료</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-500">미지급</span>
                            )}
                          </td>
                        </tr>
                        {expandedId === row.id && (
                          <tr className="bg-gray-50">
                            <td colSpan={10} className="p-4">
                              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-semibold text-navy-900">항목 수정</h3>
                                  <button onClick={() => setExpandedId(null)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <label className={labelClass}>확정일자</label>
                                    <input type="date" className={inputClass} value={editSales.confirmed_date ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, confirmed_date: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>고객명</label>
                                    <input className={inputClass} value={editSales.customer_name}
                                      onChange={(e) => setEditSales((p) => ({ ...p, customer_name: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>대출원금</label>
                                    <input type="number" className={inputClass} value={editSales.loan_principal ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, loan_principal: e.target.value === "" ? null : Number(e.target.value) }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>상품구분</label>
                                    <select className={inputClass} value={editSales.product_type ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, product_type: e.target.value }))}>
                                      <option value="">선택</option>
                                      {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className={labelClass}>차종</label>
                                    <input className={inputClass} value={editSales.vehicle_type ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, vehicle_type: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>지급대상 (수탁인)</label>
                                    <select className={inputClass}
                                      value={editSales.incentive_recipient_pending ? RECIPIENT_PENDING_VALUE : (editSales.incentive_recipient_contractor_id ?? "")}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setEditSales((p) => ({
                                          ...p,
                                          incentive_recipient_pending: v === RECIPIENT_PENDING_VALUE,
                                          incentive_recipient_contractor_id: v === RECIPIENT_PENDING_VALUE ? null : (v || null),
                                        }));
                                      }}>
                                      <option value="">선택 (원천징수관리-수탁인관리에 등록 필요)</option>
                                      <option value={RECIPIENT_PENDING_VALUE}>미정 (업무위수탁 계약 전)</option>
                                      {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className={labelClass}>인센티브율 (%)</label>
                                    <input type="number" step="0.01" className={inputClass} value={editSales.incentive_rate ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, incentive_rate: e.target.value === "" ? null : Number(e.target.value) }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>인센티브 총액 (자동계산)</label>
                                    <div className={readonlyClass}>{formatMoney(editTotalPreview)}</div>
                                  </div>
                                  <div />
                                  <div>
                                    <label className={labelClass}>CM인센티브율 (%)</label>
                                    <input type="number" step="0.01" className={inputClass} value={editSales.cm_incentive_rate ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, cm_incentive_rate: e.target.value === "" ? null : Number(e.target.value) }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>CM지급 인센티브 (자동계산)</label>
                                    <div className={readonlyClass}>{formatMoney(editCmPreview)}</div>
                                  </div>
                                </div>

                                {isOrixAdmin && (
                                  <div className="pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500 mb-3">관리자 전용</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div>
                                        <label className={labelClass}>지급일자</label>
                                        <input type="date" className={inputClass} value={editAdmin.paid_at ?? ""}
                                          onChange={(e) => setEditAdmin((p) => ({ ...p, paid_at: e.target.value }))} />
                                      </div>
                                      <div>
                                        <label className={labelClass}>지급처 (수탁인)</label>
                                        <select className={inputClass} value={editAdmin.paid_to_contractor_id ?? ""}
                                          onChange={(e) => setEditAdmin((p) => ({ ...p, paid_to_contractor_id: e.target.value || null }))}>
                                          <option value="">선택 (원천징수관리-수탁인관리에 등록 필요)</option>
                                          {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className={labelClass}>실지급금액</label>
                                        <input type="number" className={inputClass} value={editAdmin.actual_paid_amount ?? ""}
                                          onChange={(e) => setEditAdmin((p) => ({ ...p, actual_paid_amount: e.target.value === "" ? null : Number(e.target.value) }))} />
                                      </div>
                                      <div>
                                        <label className={labelClass}>송금증</label>
                                        <div className="flex items-center gap-2">
                                          <label className="flex-1 flex items-center justify-center gap-1.5 h-[42px] rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-orange-400 hover:text-orange-500 cursor-pointer transition-all">
                                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                            {editAdmin.wire_receipt_path ? "재업로드" : "업로드"}
                                            <input type="file" className="hidden" onChange={onUploadReceipt} disabled={uploading} />
                                          </label>
                                          {editAdmin.wire_receipt_path && (
                                            <button onClick={() => downloadReceipt(editAdmin.wire_receipt_path!)} className="inline-flex items-center gap-1 px-2.5 rounded-xl border border-gray-200 hover:border-orange-400 hover:text-orange-500 transition-all text-xs font-medium text-gray-600">
                                              <Download className="w-3.5 h-3.5" /> 미리보기
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {editAmountMismatch && (
                                      <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-700 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span>실지급금액이 CM지급 인센티브({formatMoney(editCmPreview)})와 다릅니다. 아래 비고란에 사유를 기재해주세요.</span>
                                      </div>
                                    )}
                                    <div className="mt-3">
                                      <label className={labelClass}>비고 (실지급금액이 CM지급 인센티브와 다른 경우 사유)</label>
                                      <textarea
                                        className="w-full min-h-[70px] px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all"
                                        value={editAdmin.payment_diff_note ?? ""}
                                        onChange={(e) => setEditAdmin((p) => ({ ...p, payment_diff_note: e.target.value }))}
                                        placeholder="예: 수탁인 요청으로 일부 금액 익월 이월"
                                      />
                                    </div>
                                  </div>
                                )}

                                {isOrixPartner && (
                                  <div className="pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500 mb-3">관리자 처리 현황 (읽기전용)</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div>
                                        <label className={labelClass}>지급일자</label>
                                        <div className={readonlyClass}>{row.paid_at ?? "-"}</div>
                                      </div>
                                      <div>
                                        <label className={labelClass}>지급처 (수탁인)</label>
                                        <div className={readonlyClass}>{row.paid_to_contractor_name ?? "-"}</div>
                                      </div>
                                      <div>
                                        <label className={labelClass}>실지급금액</label>
                                        <div className={readonlyClass}>{formatMoney(row.actual_paid_amount)}</div>
                                      </div>
                                      <div className="md:col-span-2">
                                        <label className={labelClass}>비고</label>
                                        <div className={readonlyClass}>{row.payment_diff_note ?? "-"}</div>
                                      </div>
                                      <div>
                                        <label className={labelClass}>송금증</label>
                                        {row.wire_receipt_path ? (
                                          <button onClick={() => downloadReceipt(row.wire_receipt_path!)} className="inline-flex items-center gap-1 h-[42px] px-3 rounded-xl border border-gray-200 hover:border-orange-400 hover:text-orange-500 transition-all text-xs font-medium text-gray-600">
                                            <Download className="w-3.5 h-3.5" /> 미리보기
                                          </button>
                                        ) : (
                                          <div className={readonlyClass}>-</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {!!rowMsg && <div className="text-sm font-medium text-orange-600">{rowMsg}</div>}

                                <div className="flex items-center gap-2 pt-2">
                                  <button
                                    onClick={saveRow}
                                    disabled={saving}
                                    className="inline-flex items-center px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50"
                                  >
                                    {saving ? "저장 중..." : "저장"}
                                  </button>
                                  {isOrixAdmin && (
                                    <button
                                      onClick={() => deleteRow(row.id)}
                                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" /> 삭제
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
