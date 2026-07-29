// pages/OrixIncentive/index.tsx
// ORIX 인센티브 관리: admin과 조용백(yongbaek_jo@orix.co.kr) 단 두 사람만 접근.
// admin은 orix_incentives 테이블(전체 컬럼)을, 조용백은 admin 전용 컬럼이 아예 빠진
// orix_incentives_partner_view를 통해서만 조회/입력한다 — 서버(DB) 단에서 컬럼 자체를 숨긴다.
// 인센티브총액/CM지급인센티브는 DB의 GENERATED 컬럼(대출원금×인센티브율 기반)이라 직접 입력하지 않는다.
import React, { useEffect, useState } from "react";
import { Loader2, Plus, Upload, Download, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import AppTabBar from "../../components/AppTabBar";

type SalesInputFields = {
  confirmed_date: string | null;
  customer_name: string;
  loan_principal: number | null;
  item: string | null;
  incentive_rate: number | null;
  incentive_recipient: string | null;
};

type AdminOnlyFields = {
  paid_at: string | null;
  paid_to: string | null;
  deduction_amount: number | null;
  wire_receipt_path: string | null;
};

type Row = SalesInputFields &
  Partial<AdminOnlyFields> & {
    id: string;
    incentive_total: number | null; // DB GENERATED: round(loan_principal * incentive_rate / 100)
    cm_paid_incentive: number | null; // DB GENERATED: incentive_total의 96.7% (3.3% 원천징수 공제)
    created_at: string;
  };

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

// DB의 GENERATED 컬럼과 동일한 계산식 — 저장 전 화면에 미리보기로 보여주기 위한 용도.
function calcIncentive(loanPrincipal: number | null, rate: number | null) {
  if (loanPrincipal === null || rate === null) return { total: null, cmPaid: null };
  const total = Math.round((loanPrincipal * rate) / 100);
  const cmPaid = Math.round(total * (1 - 0.033));
  return { total, cmPaid };
}

function emptySalesForm(): SalesInputFields {
  return {
    confirmed_date: "",
    customer_name: "",
    loan_principal: null,
    item: "",
    incentive_rate: null,
    incentive_recipient: "",
  };
}

function emptyAdminForm(): AdminOnlyFields {
  return { paid_at: "", paid_to: "", deduction_amount: null, wire_receipt_path: null };
}

export default function OrixIncentivePage() {
  const { user, logout, isOrixAdmin, isOrixPartner } = useAuth() as any;
  const table = isOrixAdmin ? "orix_incentives" : "orix_incentives_partner_view";

  const [rows, setRows] = useState<Row[]>([]);
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
      .from(table)
      .select("*")
      .order("confirmed_date", { ascending: false, nullsFirst: false });
    if (err) setError(err.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const createRow = async () => {
    if (!newSales.customer_name.trim()) { setCreateMsg("고객명을 입력해주세요."); return; }
    setCreating(true);
    setCreateMsg("");
    try {
      const { error: err } = await supabase.from(table).insert({
        confirmed_date: newSales.confirmed_date || null,
        customer_name: newSales.customer_name.trim(),
        loan_principal: newSales.loan_principal,
        item: newSales.item || null,
        incentive_rate: newSales.incentive_rate,
        incentive_recipient: newSales.incentive_recipient || null,
      });
      if (err) throw err;
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
      item: row.item,
      incentive_rate: row.incentive_rate,
      incentive_recipient: row.incentive_recipient,
    });
    if (isOrixAdmin) {
      setEditAdmin({
        paid_at: row.paid_at ?? "",
        paid_to: row.paid_to ?? "",
        deduction_amount: row.deduction_amount ?? null,
        wire_receipt_path: row.wire_receipt_path ?? null,
      });
    }
  };

  const saveRow = async () => {
    if (!expandedId) return;
    setSaving(true);
    setRowMsg("");
    try {
      const payload: Record<string, unknown> = {
        confirmed_date: editSales.confirmed_date || null,
        customer_name: editSales.customer_name.trim(),
        loan_principal: editSales.loan_principal,
        item: editSales.item || null,
        incentive_rate: editSales.incentive_rate,
        incentive_recipient: editSales.incentive_recipient || null,
      };
      if (isOrixAdmin) {
        payload.paid_at = editAdmin.paid_at || null;
        payload.paid_to = editAdmin.paid_to || null;
        payload.deduction_amount = editAdmin.deduction_amount;
        payload.wire_receipt_path = editAdmin.wire_receipt_path;
      }
      const { error: err } = await supabase.from(table).update(payload).eq("id", expandedId);
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
    const { error: err } = await supabase.from(table).delete().eq("id", id);
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
  const newPreview = calcIncentive(newSales.loan_principal, newSales.incentive_rate);
  const editPreview = calcIncentive(editSales.loan_principal, editSales.incentive_rate);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 + 탭 헤더 ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
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
                  <label className={labelClass}>품목</label>
                  <input className={inputClass} value={newSales.item ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, item: e.target.value }))} placeholder="품목" />
                </div>
                <div>
                  <label className={labelClass}>인센티브율 (%)</label>
                  <input type="number" step="0.01" className={inputClass} value={newSales.incentive_rate ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, incentive_rate: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="예: 2.5" />
                </div>
                <div>
                  <label className={labelClass}>지급대상</label>
                  <input className={inputClass} value={newSales.incentive_recipient ?? ""}
                    onChange={(e) => setNewSales((p) => ({ ...p, incentive_recipient: e.target.value }))} placeholder="수령자/대상명" />
                </div>
                <div>
                  <label className={labelClass}>인센티브 총액 (자동계산)</label>
                  <div className={readonlyClass}>{formatMoney(newPreview.total)}</div>
                </div>
                <div>
                  <label className={labelClass}>CM지급 인센티브 (자동계산)</label>
                  <div className={readonlyClass}>{formatMoney(newPreview.cmPaid)}</div>
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
                      <th className="py-2 pr-4">품목</th>
                      <th className="py-2 pr-4">인센티브율</th>
                      <th className="py-2 pr-4">인센티브 총액</th>
                      <th className="py-2 pr-4">CM지급 인센티브</th>
                      <th className="py-2 pr-4">지급대상</th>
                      {isOrixAdmin && <th className="py-2 pr-4">지급상태</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={isOrixAdmin ? 9 : 8} className="py-8 text-center text-gray-400">등록된 항목이 없습니다.</td></tr>
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
                          <td className="py-2.5 pr-4">{row.item ?? "-"}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">{row.incentive_rate ?? "-"}{row.incentive_rate !== null ? "%" : ""}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap font-medium">{formatMoney(row.incentive_total)}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">{formatMoney(row.cm_paid_incentive)}</td>
                          <td className="py-2.5 pr-4 whitespace-nowrap">{row.incentive_recipient ?? "-"}</td>
                          {isOrixAdmin && (
                            <td className="py-2.5 pr-4">
                              {row.paid_at ? (
                                <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">지급완료</span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-500">미지급</span>
                              )}
                            </td>
                          )}
                        </tr>
                        {expandedId === row.id && (
                          <tr className="bg-gray-50">
                            <td colSpan={isOrixAdmin ? 9 : 8} className="p-4">
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
                                    <label className={labelClass}>품목</label>
                                    <input className={inputClass} value={editSales.item ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, item: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>인센티브율 (%)</label>
                                    <input type="number" step="0.01" className={inputClass} value={editSales.incentive_rate ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, incentive_rate: e.target.value === "" ? null : Number(e.target.value) }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>지급대상</label>
                                    <input className={inputClass} value={editSales.incentive_recipient ?? ""}
                                      onChange={(e) => setEditSales((p) => ({ ...p, incentive_recipient: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>인센티브 총액 (자동계산)</label>
                                    <div className={readonlyClass}>{formatMoney(editPreview.total)}</div>
                                  </div>
                                  <div>
                                    <label className={labelClass}>CM지급 인센티브 (자동계산)</label>
                                    <div className={readonlyClass}>{formatMoney(editPreview.cmPaid)}</div>
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
                                        <label className={labelClass}>지급처</label>
                                        <input className={inputClass} value={editAdmin.paid_to ?? ""}
                                          onChange={(e) => setEditAdmin((p) => ({ ...p, paid_to: e.target.value }))} placeholder="입금 계좌/거래처" />
                                      </div>
                                      <div>
                                        <label className={labelClass}>공제금액</label>
                                        <input type="number" className={inputClass} value={editAdmin.deduction_amount ?? ""}
                                          onChange={(e) => setEditAdmin((p) => ({ ...p, deduction_amount: e.target.value === "" ? null : Number(e.target.value) }))} />
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
                                            <button onClick={() => downloadReceipt(editAdmin.wire_receipt_path!)} className="p-2 rounded-xl border border-gray-200 hover:border-orange-400 hover:text-orange-500 transition-all">
                                              <Download className="w-4 h-4" />
                                            </button>
                                          )}
                                        </div>
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
