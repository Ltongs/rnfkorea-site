// pages/Brother/ItemSections.tsx
// 현대지게차 경기북부(Brother) 페이지의 타이어/배터리/기타 항목 섹션.
// brother_tasks(할부)와 달리, 회사 전체 집계 파이프라인(consultation_cases +
// consultation_tire_details/consultation_battery_details, AI비서·CallManagement·FinanceHub가
// 공유하는 테이블)에 직접 저장해서 그쪽 화면에도 자동으로 잡히게 한다.
// 타이어는 추가로 tb_orders(진흥주문 관리)에도 미러 등록한다.
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const REGION = "경기북부";
const EDGE_FN_URL = "https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/send-hyundaicm-kakao";

function onlyDigits(s: string) { return (s ?? "").replace(/\D/g, ""); }
function formatPhoneKR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
function formatCreatedAt(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtAmt(n: number | null | undefined) {
  return n != null ? `${n.toLocaleString("ko-KR")}원` : "-";
}

// 담당 영업사원 연락처 자동완성 — brother_tasks + consultation_cases(경기북부) 이력 통합 조회
async function lookupSalesRepPhone(name: string): Promise<string | null> {
  const q = name.trim();
  if (!q) return null;
  try {
    const [a, b] = await Promise.all([
      supabase.from("brother_tasks")
        .select("sales_rep_phone, created_at")
        .eq("sales_rep", q)
        .not("sales_rep_phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("consultation_cases")
        .select("sales_rep_phone, created_at")
        .eq("region", REGION)
        .eq("sales_rep", q)
        .not("sales_rep_phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const candidates = [...(a.data ?? []), ...(b.data ?? [])]
      .filter((r: any) => r.sales_rep_phone)
      .sort((x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
    return candidates[0]?.sales_rep_phone ?? null;
  } catch {
    return null;
  }
}

async function notifyBrother(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ channel: "brother", ...payload }),
    });
  } catch (e) {
    console.warn("[brother item kakao notify] 전송 실패:", e);
  }
}

// ─── 공통 진행단계 (AI비서 통합상담의 타이어/배터리 COMMON_STAGES와 동일) ──
type Stage = "contract" | "delivery" | "invoiced" | "cancelled";
const STAGE_LABEL: Record<Stage, string> = {
  contract: "계약", delivery: "납품", invoiced: "계산서발행", cancelled: "취소",
};
const STAGE_ORDER: Stage[] = ["contract", "delivery", "invoiced"];
function stageStyle(stage: string) {
  switch (stage) {
    case "contract":  return "bg-blue-50 text-blue-600 border-blue-200";
    case "delivery":  return "bg-orange-50 text-orange-600 border-orange-200";
    case "invoiced":  return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "cancelled": return "bg-gray-200 text-gray-600 border-gray-300";
    default:          return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

// ─── 스타일 상수 (index.tsx와 동일한 톤 유지) ──
const inputClass =
  "h-10 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm text-[#0f172a] " +
  "placeholder:text-gray-400 focus:outline-none focus:border-orange-400 disabled:opacity-50 transition-all";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";
const btnPrimary =
  "inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-[#0f172a] font-semibold text-sm hover:border-gray-300 transition-all disabled:opacity-50";

type SectionProps = { isAdminLevel: boolean; canCreate: boolean; canChangeStatus: boolean };

// 담당 영업사원 + 연락처 공용 입력 필드 (이름 blur 시 최근 연락처 자동완성)
function SalesRepFields({
  salesRep, setSalesRep, salesRepPhone, setSalesRepPhone,
}: { salesRep: string; setSalesRep: (v: string) => void; salesRepPhone: string; setSalesRepPhone: (v: string) => void }) {
  return (
    <>
      <div>
        <label className={labelClass}>영업사원 *</label>
        <input
          value={salesRep}
          onChange={(e) => setSalesRep(e.target.value)}
          onBlur={async () => {
            if (salesRep.trim() && !salesRepPhone.trim()) {
              const phone = await lookupSalesRepPhone(salesRep);
              if (phone) setSalesRepPhone(formatPhoneKR(phone));
            }
          }}
          placeholder="홍길동"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>영업사원 연락처</label>
        <input
          value={salesRepPhone}
          onChange={(e) => setSalesRepPhone(formatPhoneKR(e.target.value))}
          placeholder="010-1234-5678 (자동입력)"
          inputMode="tel"
          className={inputClass}
        />
      </div>
    </>
  );
}

function StageButtons({
  stage, onChange, disabled,
}: { stage: string; onChange: (next: Stage) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-xl border text-xs font-semibold ${stageStyle(stage)}`}>
        {STAGE_LABEL[(stage as Stage) ?? "contract"] ?? stage}
      </span>
      {STAGE_ORDER.map((s) => (
        <button
          key={s}
          disabled={disabled || stage === s || stage === "cancelled"}
          onClick={() => onChange(s)}
          className="px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >{STAGE_LABEL[s]}</button>
      ))}
      {stage !== "cancelled" && (
        <button
          disabled={disabled}
          onClick={() => { if (window.confirm("이 건을 취소 처리하시겠습니까?")) onChange("cancelled"); }}
          className="px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-400 hover:border-red-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >취소</button>
      )}
    </div>
  );
}

function EditModalShell({
  title, onClose, onSave, saving, children,
}: { title: string; onClose: () => void; onSave: () => void; saving: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-[#0f172a] mb-3">{title}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className={btnSecondary}>취소</button>
          <button onClick={onSave} disabled={saving} className={btnPrimary}>{saving ? "저장중..." : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 타이어
// ══════════════════════════════════════════════════════════
type TireRow = {
  id: number; created_at: string; customer_name: string; phone: string | null;
  sales_rep: string | null; sales_rep_phone: string | null; status: string;
  tire: {
    tire_size: string | null; vehicle_info: string | null; vehicle_type: string | null;
    front_quantity: number | null; rear_quantity: number | null; quantity: number | null;
    price_to_customer: number | null; price_from_jinheung: number | null;
    process_stage: string | null; note: string | null;
  } | null;
};

export function TireSection({ isAdminLevel, canCreate, canChangeStatus }: SectionProps) {
  const [rows, setRows] = useState<TireRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [custType, setCustType] = useState<"개인" | "법인">("개인");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [tireSize, setTireSize] = useState("");
  const [frontQty, setFrontQty] = useState("");
  const [rearQty, setRearQty] = useState("");
  const [priceToCustomer, setPriceToCustomer] = useState("");
  const [priceFromJinheung, setPriceFromJinheung] = useState("");
  const [salesRep, setSalesRep] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [note, setNote] = useState("");

  const [editRow, setEditRow] = useState<TireRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [eCustName, setECustName] = useState("");
  const [eCustPhone, setECustPhone] = useState("");
  const [eVehicleInfo, setEVehicleInfo] = useState("");
  const [eVehicleType, setEVehicleType] = useState("");
  const [eTireSize, setETireSize] = useState("");
  const [eFrontQty, setEFrontQty] = useState("");
  const [eRearQty, setERearQty] = useState("");
  const [ePriceToCustomer, setEPriceToCustomer] = useState("");
  const [ePriceFromJinheung, setEPriceFromJinheung] = useState("");
  const [eSalesRep, setESalesRep] = useState("");
  const [eSalesRepPhone, setESalesRepPhone] = useState("");
  const [eNote, setENote] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data: cases, error } = await supabase.from("consultation_cases")
        .select("id, created_at, customer_name, phone, sales_rep, sales_rep_phone, status")
        .eq("region", REGION).eq("work_type", "tire_sales")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const ids = (cases ?? []).map((c: any) => c.id);
      let detailMap: Record<number, any> = {};
      if (ids.length > 0) {
        const { data: details } = await supabase.from("consultation_tire_details")
          .select("consultation_id, tire_size, vehicle_info, vehicle_type, front_quantity, rear_quantity, quantity, price_to_customer, price_from_jinheung, process_stage, note")
          .in("consultation_id", ids);
        (details ?? []).forEach((d: any) => { detailMap[d.consultation_id] = d; });
      }
      setRows((cases ?? []).map((c: any) => ({ ...c, tire: detailMap[c.id] ?? null })));
    } catch (e: any) {
      console.error("[tire_sales fetch]", e);
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchRows(); }, []);

  const reset = () => {
    setCustType("개인"); setCustName(""); setCustPhone("");
    setVehicleInfo(""); setVehicleType(""); setTireSize("");
    setFrontQty(""); setRearQty(""); setPriceToCustomer(""); setPriceFromJinheung("");
    setSalesRep(""); setSalesRepPhone(""); setNote("");
  };

  const add = async () => {
    if (!custName.trim()) { alert("고객명을 입력해주세요."); return; }
    if (!salesRep.trim())  { alert("영업사원을 입력해주세요."); return; }
    setSaving(true);
    try {
      const front = frontQty ? parseInt(frontQty, 10) : 0;
      const rear  = rearQty  ? parseInt(rearQty, 10)  : 0;
      const qty   = (front + rear) || null;
      const summary = [tireSize, vehicleInfo, vehicleType].filter(Boolean).join(" / ") || "타이어 접수";
      const { data: caseData, error: caseErr } = await supabase.from("consultation_cases").insert({
        customer_name: custName.trim(), phone: onlyDigits(custPhone) || null,
        region: REGION, work_type: "tire_sales", status: "new",
        summary, sales_rep: salesRep.trim(), sales_rep_phone: onlyDigits(salesRepPhone) || null,
        call_datetime: new Date().toISOString(),
      }).select("id").single();
      if (caseErr) throw caseErr;
      const cid = caseData!.id;

      const { error: detailErr } = await supabase.from("consultation_tire_details").insert({
        consultation_id: cid, tire_size: tireSize.trim() || null,
        vehicle_info: vehicleInfo.trim() || null, vehicle_type: vehicleType.trim() || null,
        front_quantity: front || null, rear_quantity: rear || null, quantity: qty,
        price_to_customer: priceToCustomer ? parseInt(onlyDigits(priceToCustomer), 10) || null : null,
        price_from_jinheung: priceFromJinheung ? parseInt(onlyDigits(priceFromJinheung), 10) || null : null,
        process_stage: "contract", process_status: "contract",
        note: note.trim() || null,
      });
      if (detailErr) throw detailErr;

      // 진흥주문 관리(tb_orders)에도 미러 등록 — 발주/납품 실무는 그쪽에서 이어서 진행
      const { error: orderErr } = await supabase.from("tb_orders").insert({
        customer_name_raw: custName.trim(), product_type: "tire", product_spec: summary,
        quantity: qty, price_to_customer: priceToCustomer ? parseInt(onlyDigits(priceToCustomer), 10) || null : null,
        price_from_jinheung: priceFromJinheung ? parseInt(onlyDigits(priceFromJinheung), 10) || null : null,
        inbound_channel: "brother_gbn", status: "received", consultation_id: cid,
      });
      if (orderErr) console.error("[tb_orders 미러 등록 실패]", orderErr);

      void notifyBrother({
        type: "new", caseNo: `TR-${cid}`,
        customerName: custName.trim(), customerType: custType,
        equipmentTon: `[타이어] ${summary}${qty ? ` · ${qty}개(전${front}/후${rear})` : ""}`,
        financeCompany: "-",
        installmentPrincipal: priceToCustomer ? onlyDigits(priceToCustomer) : undefined,
        salesRep: salesRep.trim(), dealSalesRepPhone: onlyDigits(salesRepPhone) || undefined,
      });

      reset(); setShowCreate(false); await fetchRows();
    } catch (e: any) {
      alert(e?.message || "등록 실패");
    } finally { setSaving(false); }
  };

  const changeStage = async (row: TireRow, next: Stage) => {
    const prevStage = row.tire?.process_stage ?? "contract";
    setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, tire: r.tire ? { ...r.tire, process_stage: next } : r.tire } : r));
    const { error } = await supabase.from("consultation_tire_details")
      .update({ process_stage: next, process_status: next }).eq("consultation_id", row.id);
    if (error) {
      alert("단계 변경 실패: " + error.message);
      setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, tire: r.tire ? { ...r.tire, process_stage: prevStage } : r.tire } : r));
      return;
    }
    void notifyBrother({
      type: "status_change", caseNo: `TR-${row.id}`,
      customerName: row.customer_name, customerType: "개인",
      equipmentTon: `[타이어] ${row.tire?.tire_size ?? "-"}`,
      prevStatus: STAGE_LABEL[(prevStage as Stage)] ?? prevStage, nextStatus: STAGE_LABEL[next],
      salesRep: row.sales_rep, dealSalesRepPhone: row.sales_rep_phone ?? undefined,
    });
  };

  const openEdit = (row: TireRow) => {
    setEditRow(row);
    setECustName(row.customer_name ?? "");
    setECustPhone(row.phone ? formatPhoneKR(row.phone) : "");
    setEVehicleInfo(row.tire?.vehicle_info ?? "");
    setEVehicleType(row.tire?.vehicle_type ?? "");
    setETireSize(row.tire?.tire_size ?? "");
    setEFrontQty(row.tire?.front_quantity != null ? String(row.tire.front_quantity) : "");
    setERearQty(row.tire?.rear_quantity != null ? String(row.tire.rear_quantity) : "");
    setEPriceToCustomer(row.tire?.price_to_customer != null ? String(row.tire.price_to_customer) : "");
    setEPriceFromJinheung(row.tire?.price_from_jinheung != null ? String(row.tire.price_from_jinheung) : "");
    setESalesRep(row.sales_rep ?? "");
    setESalesRepPhone(row.sales_rep_phone ? formatPhoneKR(row.sales_rep_phone) : "");
    setENote(row.tire?.note ?? "");
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (!eCustName.trim()) { alert("고객명을 입력해주세요."); return; }
    if (!eSalesRep.trim())  { alert("영업사원을 입력해주세요."); return; }
    setEditSaving(true);
    try {
      const front = eFrontQty ? parseInt(eFrontQty, 10) : 0;
      const rear  = eRearQty  ? parseInt(eRearQty, 10)  : 0;
      const qty   = (front + rear) || null;
      const summary = [eTireSize, eVehicleInfo, eVehicleType].filter(Boolean).join(" / ") || "타이어 접수";
      const priceToCustomer = ePriceToCustomer ? parseInt(onlyDigits(ePriceToCustomer), 10) || null : null;
      const priceFromJinheung = ePriceFromJinheung ? parseInt(onlyDigits(ePriceFromJinheung), 10) || null : null;

      const { error: caseErr } = await supabase.from("consultation_cases").update({
        customer_name: eCustName.trim(), phone: onlyDigits(eCustPhone) || null,
        summary, sales_rep: eSalesRep.trim(), sales_rep_phone: onlyDigits(eSalesRepPhone) || null,
      }).eq("id", editRow.id);
      if (caseErr) throw caseErr;

      const { error: detailErr } = await supabase.from("consultation_tire_details").update({
        tire_size: eTireSize.trim() || null, vehicle_info: eVehicleInfo.trim() || null,
        vehicle_type: eVehicleType.trim() || null, front_quantity: front || null, rear_quantity: rear || null,
        quantity: qty, price_to_customer: priceToCustomer, price_from_jinheung: priceFromJinheung,
        note: eNote.trim() || null,
      }).eq("consultation_id", editRow.id);
      if (detailErr) throw detailErr;

      // 진흥주문(tb_orders) 미러도 함께 동기화
      const { error: orderErr } = await supabase.from("tb_orders").update({
        customer_name_raw: eCustName.trim(), product_spec: summary, quantity: qty,
        price_to_customer: priceToCustomer, price_from_jinheung: priceFromJinheung,
      }).eq("consultation_id", editRow.id);
      if (orderErr) console.error("[tb_orders 동기화 실패]", orderErr);

      setRows((prev) => prev.map((r) => String(r.id) === String(editRow.id) ? {
        ...r, customer_name: eCustName.trim(), phone: onlyDigits(eCustPhone) || null,
        sales_rep: eSalesRep.trim(), sales_rep_phone: onlyDigits(eSalesRepPhone) || null,
        tire: r.tire ? {
          ...r.tire, tire_size: eTireSize.trim() || null, vehicle_info: eVehicleInfo.trim() || null,
          vehicle_type: eVehicleType.trim() || null, front_quantity: front || null, rear_quantity: rear || null,
          quantity: qty, price_to_customer: priceToCustomer, price_from_jinheung: priceFromJinheung,
          note: eNote.trim() || null,
        } : r.tire,
      } : r));
      setEditRow(null);
    } catch (e: any) {
      alert(e?.message || "수정 실패");
    } finally { setEditSaving(false); }
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setShowCreate((v) => !v)} className={btnPrimary}>+ 타이어 신규 접수</button>
        <button onClick={fetchRows} disabled={loading} className={btnSecondary}>{loading ? "로딩중..." : "새로고침"}</button>
      </div>

      {showCreate && canCreate && (
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>고객 유형</label>
              <select value={custType} onChange={(e) => setCustType(e.target.value as any)} className={inputClass}>
                <option value="개인">개인</option><option value="법인">법인</option>
              </select>
            </div>
            <div><label className={labelClass}>고객명 *</label><input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="홍길동 / 법인명" className={inputClass} /></div>
            <div><label className={labelClass}>전화번호</label><input value={custPhone} onChange={(e) => setCustPhone(formatPhoneKR(e.target.value))} placeholder="010-1234-5678" inputMode="tel" className={inputClass} /></div>
            <div><label className={labelClass}>차량정보</label><input value={vehicleInfo} onChange={(e) => setVehicleInfo(e.target.value)} placeholder="5톤 카고" className={inputClass} /></div>
            <div><label className={labelClass}>차종</label><input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="카고/덤프/버스/지게차 등" className={inputClass} /></div>
            <div><label className={labelClass}>타이어 규격</label><input value={tireSize} onChange={(e) => setTireSize(e.target.value)} placeholder="295/80R22.5" className={inputClass} /></div>
            <div><label className={labelClass}>전륜 수량</label><input value={frontQty} onChange={(e) => setFrontQty(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
            <div><label className={labelClass}>후륜 수량</label><input value={rearQty} onChange={(e) => setRearQty(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
            <div className={labelClass + " flex items-end h-10"}>합계 {(parseInt(frontQty || "0", 10) + parseInt(rearQty || "0", 10)) || 0}개</div>
            <div><label className={labelClass}>판매단가 (원, 선택)</label><input value={priceToCustomer} onChange={(e) => setPriceToCustomer(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
            <div><label className={labelClass}>진흥 매입가 (원, 선택)</label><input value={priceFromJinheung} onChange={(e) => setPriceFromJinheung(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
            <SalesRepFields salesRep={salesRep} setSalesRep={setSalesRep} salesRepPhone={salesRepPhone} setSalesRepPhone={setSalesRepPhone} />
          </div>
          <div>
            <label className={labelClass}>특이사항</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCreate(false); reset(); }} disabled={saving} className={btnSecondary}>취소</button>
            <button onClick={add} disabled={saving} className={btnPrimary}>{saving ? "저장중..." : "등록"}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && !loading && <p className="text-sm text-gray-400 py-6 text-center">등록된 타이어 건이 없습니다.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">{r.customer_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatCreatedAt(r.created_at)} · 영업 {r.sales_rep ?? "-"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <StageButtons stage={r.tire?.process_stage ?? "contract"} disabled={!canChangeStatus} onChange={(next) => changeStage(r, next)} />
                <button onClick={() => openEdit(r)} className="px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-500 hover:border-gray-300 transition-all">수정</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              <span>차량 <b className="text-gray-800">{r.tire?.vehicle_info ?? "-"}</b></span>
              <span>차종 <b className="text-gray-800">{r.tire?.vehicle_type ?? "-"}</b></span>
              <span>규격 <b className="text-gray-800">{r.tire?.tire_size ?? "-"}</b></span>
              <span>수량 <b className="text-gray-800">전{r.tire?.front_quantity ?? "-"}/후{r.tire?.rear_quantity ?? "-"}(총{r.tire?.quantity ?? "-"})</b></span>
              <span>판매단가 <b className="text-gray-800">{fmtAmt(r.tire?.price_to_customer)}</b></span>
            </div>
            {r.tire?.note && <p className="mt-1.5 text-xs text-gray-500">메모: {r.tire.note}</p>}
          </div>
        ))}
      </div>

      {editRow && (
        <EditModalShell title={`타이어 건 수정 — ${editRow.customer_name}`} onClose={() => setEditRow(null)} onSave={saveEdit} saving={editSaving}>
          <div><label className={labelClass}>고객명 *</label><input value={eCustName} onChange={(e) => setECustName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>전화번호</label><input value={eCustPhone} onChange={(e) => setECustPhone(formatPhoneKR(e.target.value))} inputMode="tel" className={inputClass} /></div>
          <div><label className={labelClass}>차량정보</label><input value={eVehicleInfo} onChange={(e) => setEVehicleInfo(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>차종</label><input value={eVehicleType} onChange={(e) => setEVehicleType(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>타이어 규격</label><input value={eTireSize} onChange={(e) => setETireSize(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>전륜 수량</label><input value={eFrontQty} onChange={(e) => setEFrontQty(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
          <div><label className={labelClass}>후륜 수량</label><input value={eRearQty} onChange={(e) => setERearQty(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
          <div><label className={labelClass}>판매단가 (원)</label><input value={ePriceToCustomer} onChange={(e) => setEPriceToCustomer(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
          <div><label className={labelClass}>진흥 매입가 (원)</label><input value={ePriceFromJinheung} onChange={(e) => setEPriceFromJinheung(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
          <SalesRepFields salesRep={eSalesRep} setSalesRep={setESalesRep} salesRepPhone={eSalesRepPhone} setSalesRepPhone={setESalesRepPhone} />
          <div className="sm:col-span-2 md:col-span-3">
            <label className={labelClass}>특이사항</label>
            <textarea value={eNote} onChange={(e) => setENote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
          </div>
        </EditModalShell>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 배터리
// ══════════════════════════════════════════════════════════
type BatteryRow = {
  id: number; created_at: string; customer_name: string; phone: string | null;
  sales_rep: string | null; sales_rep_phone: string | null; status: string;
  battery: {
    battery_vehicle_type: string | null; battery_voltage: number | null; battery_capacity_ah: number | null;
    battery_due_date: string | null; battery_unit_sale_price: number | null; battery_quantity: number | null;
    battery_sale_price: number | null; process_stage: string | null; note: string | null;
  } | null;
};

export function BatterySection({ isAdminLevel, canCreate, canChangeStatus }: SectionProps) {
  const [rows, setRows] = useState<BatteryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [custType, setCustType] = useState<"개인" | "법인">("개인");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [voltage, setVoltage] = useState("");
  const [capacityAh, setCapacityAh] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [salesRep, setSalesRep] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [note, setNote] = useState("");

  const [editRow, setEditRow] = useState<BatteryRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [eCustName, setECustName] = useState("");
  const [eCustPhone, setECustPhone] = useState("");
  const [eVehicleType, setEVehicleType] = useState("");
  const [eVoltage, setEVoltage] = useState("");
  const [eCapacityAh, setECapacityAh] = useState("");
  const [eDueDate, setEDueDate] = useState("");
  const [eUnitPrice, setEUnitPrice] = useState("");
  const [eQty, setEQty] = useState("1");
  const [eSalesRep, setESalesRep] = useState("");
  const [eSalesRepPhone, setESalesRepPhone] = useState("");
  const [eNote, setENote] = useState("");

  const salePrice = useMemo(() => {
    const u = parseInt(onlyDigits(unitPrice) || "0", 10);
    const q = parseInt(qty || "0", 10);
    return u * q;
  }, [unitPrice, qty]);
  const eSalePrice = useMemo(() => {
    const u = parseInt(onlyDigits(eUnitPrice) || "0", 10);
    const q = parseInt(eQty || "0", 10);
    return u * q;
  }, [eUnitPrice, eQty]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data: cases, error } = await supabase.from("consultation_cases")
        .select("id, created_at, customer_name, phone, sales_rep, sales_rep_phone, status")
        .eq("region", REGION).eq("work_type", "battery_sales")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const ids = (cases ?? []).map((c: any) => c.id);
      let detailMap: Record<number, any> = {};
      if (ids.length > 0) {
        const { data: details } = await supabase.from("consultation_battery_details")
          .select("consultation_id, battery_vehicle_type, battery_voltage, battery_capacity_ah, battery_due_date, battery_unit_sale_price, battery_quantity, battery_sale_price, process_stage, note")
          .in("consultation_id", ids);
        (details ?? []).forEach((d: any) => { detailMap[d.consultation_id] = d; });
      }
      setRows((cases ?? []).map((c: any) => ({ ...c, battery: detailMap[c.id] ?? null })));
    } catch (e: any) {
      console.error("[battery_sales fetch]", e);
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchRows(); }, []);

  const reset = () => {
    setCustType("개인"); setCustName(""); setCustPhone("");
    setVehicleType(""); setVoltage(""); setCapacityAh(""); setDueDate("");
    setUnitPrice(""); setQty("1"); setSalesRep(""); setSalesRepPhone(""); setNote("");
  };

  const add = async () => {
    if (!custName.trim()) { alert("고객명을 입력해주세요."); return; }
    if (!salesRep.trim())  { alert("영업사원을 입력해주세요."); return; }
    setSaving(true);
    try {
      const summary = [vehicleType, voltage ? `${voltage}V` : null, capacityAh ? `${capacityAh}Ah` : null].filter(Boolean).join(" / ") || "배터리 접수";
      const { data: caseData, error: caseErr } = await supabase.from("consultation_cases").insert({
        customer_name: custName.trim(), phone: onlyDigits(custPhone) || null,
        region: REGION, work_type: "battery_sales", status: "new",
        summary, sales_rep: salesRep.trim(), sales_rep_phone: onlyDigits(salesRepPhone) || null,
        call_datetime: new Date().toISOString(),
      }).select("id").single();
      if (caseErr) throw caseErr;
      const cid = caseData!.id;

      const { error: detailErr } = await supabase.from("consultation_battery_details").insert({
        consultation_id: cid,
        battery_vehicle_type: vehicleType.trim() || null,
        battery_voltage: voltage ? parseFloat(voltage) || null : null,
        battery_capacity_ah: capacityAh ? parseFloat(capacityAh) || null : null,
        battery_due_date: dueDate || null,
        battery_unit_sale_price: unitPrice ? parseInt(onlyDigits(unitPrice), 10) || null : null,
        battery_quantity: qty ? parseInt(qty, 10) || null : null,
        battery_sale_price: salePrice || null,
        process_stage: "contract",
        note: note.trim() || null,
      });
      if (detailErr) throw detailErr;

      void notifyBrother({
        type: "new", caseNo: `BT-${cid}`,
        customerName: custName.trim(), customerType: custType,
        equipmentTon: `[배터리] ${summary}${qty ? ` · ${qty}개` : ""}`,
        financeCompany: "-",
        installmentPrincipal: salePrice ? String(salePrice) : undefined,
        salesRep: salesRep.trim(), dealSalesRepPhone: onlyDigits(salesRepPhone) || undefined,
      });

      reset(); setShowCreate(false); await fetchRows();
    } catch (e: any) {
      alert(e?.message || "등록 실패");
    } finally { setSaving(false); }
  };

  const changeStage = async (row: BatteryRow, next: Stage) => {
    const prevStage = row.battery?.process_stage ?? "contract";
    setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, battery: r.battery ? { ...r.battery, process_stage: next } : r.battery } : r));
    const { error } = await supabase.from("consultation_battery_details")
      .update({ process_stage: next }).eq("consultation_id", row.id);
    if (error) {
      alert("단계 변경 실패: " + error.message);
      setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, battery: r.battery ? { ...r.battery, process_stage: prevStage } : r.battery } : r));
      return;
    }
    void notifyBrother({
      type: "status_change", caseNo: `BT-${row.id}`,
      customerName: row.customer_name, customerType: "개인",
      equipmentTon: `[배터리] ${row.battery?.battery_vehicle_type ?? "-"}`,
      prevStatus: STAGE_LABEL[(prevStage as Stage)] ?? prevStage, nextStatus: STAGE_LABEL[next],
      salesRep: row.sales_rep, dealSalesRepPhone: row.sales_rep_phone ?? undefined,
    });
  };

  const openEdit = (row: BatteryRow) => {
    setEditRow(row);
    setECustName(row.customer_name ?? "");
    setECustPhone(row.phone ? formatPhoneKR(row.phone) : "");
    setEVehicleType(row.battery?.battery_vehicle_type ?? "");
    setEVoltage(row.battery?.battery_voltage != null ? String(row.battery.battery_voltage) : "");
    setECapacityAh(row.battery?.battery_capacity_ah != null ? String(row.battery.battery_capacity_ah) : "");
    setEDueDate(row.battery?.battery_due_date ?? "");
    setEUnitPrice(row.battery?.battery_unit_sale_price != null ? String(row.battery.battery_unit_sale_price) : "");
    setEQty(row.battery?.battery_quantity != null ? String(row.battery.battery_quantity) : "1");
    setESalesRep(row.sales_rep ?? "");
    setESalesRepPhone(row.sales_rep_phone ? formatPhoneKR(row.sales_rep_phone) : "");
    setENote(row.battery?.note ?? "");
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (!eCustName.trim()) { alert("고객명을 입력해주세요."); return; }
    if (!eSalesRep.trim())  { alert("영업사원을 입력해주세요."); return; }
    setEditSaving(true);
    try {
      const summary = [eVehicleType, eVoltage ? `${eVoltage}V` : null, eCapacityAh ? `${eCapacityAh}Ah` : null].filter(Boolean).join(" / ") || "배터리 접수";

      const { error: caseErr } = await supabase.from("consultation_cases").update({
        customer_name: eCustName.trim(), phone: onlyDigits(eCustPhone) || null,
        summary, sales_rep: eSalesRep.trim(), sales_rep_phone: onlyDigits(eSalesRepPhone) || null,
      }).eq("id", editRow.id);
      if (caseErr) throw caseErr;

      const { error: detailErr } = await supabase.from("consultation_battery_details").update({
        battery_vehicle_type: eVehicleType.trim() || null,
        battery_voltage: eVoltage ? parseFloat(eVoltage) || null : null,
        battery_capacity_ah: eCapacityAh ? parseFloat(eCapacityAh) || null : null,
        battery_due_date: eDueDate || null,
        battery_unit_sale_price: eUnitPrice ? parseInt(onlyDigits(eUnitPrice), 10) || null : null,
        battery_quantity: eQty ? parseInt(eQty, 10) || null : null,
        battery_sale_price: eSalePrice || null,
        note: eNote.trim() || null,
      }).eq("consultation_id", editRow.id);
      if (detailErr) throw detailErr;

      setRows((prev) => prev.map((r) => String(r.id) === String(editRow.id) ? {
        ...r, customer_name: eCustName.trim(), phone: onlyDigits(eCustPhone) || null,
        sales_rep: eSalesRep.trim(), sales_rep_phone: onlyDigits(eSalesRepPhone) || null,
        battery: r.battery ? {
          ...r.battery, battery_vehicle_type: eVehicleType.trim() || null,
          battery_voltage: eVoltage ? parseFloat(eVoltage) || null : null,
          battery_capacity_ah: eCapacityAh ? parseFloat(eCapacityAh) || null : null,
          battery_due_date: eDueDate || null,
          battery_unit_sale_price: eUnitPrice ? parseInt(onlyDigits(eUnitPrice), 10) || null : null,
          battery_quantity: eQty ? parseInt(eQty, 10) || null : null,
          battery_sale_price: eSalePrice || null, note: eNote.trim() || null,
        } : r.battery,
      } : r));
      setEditRow(null);
    } catch (e: any) {
      alert(e?.message || "수정 실패");
    } finally { setEditSaving(false); }
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setShowCreate((v) => !v)} className={btnPrimary}>+ 배터리 신규 접수</button>
        <button onClick={fetchRows} disabled={loading} className={btnSecondary}>{loading ? "로딩중..." : "새로고침"}</button>
      </div>

      {showCreate && canCreate && (
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>고객 유형</label>
              <select value={custType} onChange={(e) => setCustType(e.target.value as any)} className={inputClass}>
                <option value="개인">개인</option><option value="법인">법인</option>
              </select>
            </div>
            <div><label className={labelClass}>고객명 *</label><input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="홍길동 / 법인명" className={inputClass} /></div>
            <div><label className={labelClass}>전화번호</label><input value={custPhone} onChange={(e) => setCustPhone(formatPhoneKR(e.target.value))} placeholder="010-1234-5678" inputMode="tel" className={inputClass} /></div>
            <div><label className={labelClass}>차종</label><input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="골프카트/지게차 등" className={inputClass} /></div>
            <div><label className={labelClass}>전압 (V)</label><input value={voltage} onChange={(e) => setVoltage(e.target.value)} inputMode="decimal" className={inputClass} /></div>
            <div><label className={labelClass}>용량 (Ah)</label><input value={capacityAh} onChange={(e) => setCapacityAh(e.target.value)} inputMode="decimal" className={inputClass} /></div>
            <div><label className={labelClass}>납기일</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>단가 (원)</label><input value={unitPrice} onChange={(e) => setUnitPrice(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
            <div><label className={labelClass}>수량</label><input value={qty} onChange={(e) => setQty(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
            <div className={labelClass + " flex items-end h-10"}>판매가 {fmtAmt(salePrice)}</div>
            <SalesRepFields salesRep={salesRep} setSalesRep={setSalesRep} salesRepPhone={salesRepPhone} setSalesRepPhone={setSalesRepPhone} />
          </div>
          <div>
            <label className={labelClass}>특이사항</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCreate(false); reset(); }} disabled={saving} className={btnSecondary}>취소</button>
            <button onClick={add} disabled={saving} className={btnPrimary}>{saving ? "저장중..." : "등록"}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && !loading && <p className="text-sm text-gray-400 py-6 text-center">등록된 배터리 건이 없습니다.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">{r.customer_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatCreatedAt(r.created_at)} · 영업 {r.sales_rep ?? "-"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <StageButtons stage={r.battery?.process_stage ?? "contract"} disabled={!canChangeStatus} onChange={(next) => changeStage(r, next)} />
                <button onClick={() => openEdit(r)} className="px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-500 hover:border-gray-300 transition-all">수정</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              <span>차종 <b className="text-gray-800">{r.battery?.battery_vehicle_type ?? "-"}</b></span>
              <span>전압/용량 <b className="text-gray-800">{r.battery?.battery_voltage ?? "-"}V/{r.battery?.battery_capacity_ah ?? "-"}Ah</b></span>
              <span>납기 <b className="text-gray-800">{r.battery?.battery_due_date ?? "-"}</b></span>
              <span>단가 <b className="text-gray-800">{fmtAmt(r.battery?.battery_unit_sale_price)}</b></span>
              <span>수량 <b className="text-gray-800">{r.battery?.battery_quantity ?? "-"}개</b></span>
              <span>판매가 <b className="text-gray-800">{fmtAmt(r.battery?.battery_sale_price)}</b></span>
            </div>
            {r.battery?.note && <p className="mt-1.5 text-xs text-gray-500">메모: {r.battery.note}</p>}
          </div>
        ))}
      </div>

      {editRow && (
        <EditModalShell title={`배터리 건 수정 — ${editRow.customer_name}`} onClose={() => setEditRow(null)} onSave={saveEdit} saving={editSaving}>
          <div><label className={labelClass}>고객명 *</label><input value={eCustName} onChange={(e) => setECustName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>전화번호</label><input value={eCustPhone} onChange={(e) => setECustPhone(formatPhoneKR(e.target.value))} inputMode="tel" className={inputClass} /></div>
          <div><label className={labelClass}>차종</label><input value={eVehicleType} onChange={(e) => setEVehicleType(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>전압 (V)</label><input value={eVoltage} onChange={(e) => setEVoltage(e.target.value)} inputMode="decimal" className={inputClass} /></div>
          <div><label className={labelClass}>용량 (Ah)</label><input value={eCapacityAh} onChange={(e) => setECapacityAh(e.target.value)} inputMode="decimal" className={inputClass} /></div>
          <div><label className={labelClass}>납기일</label><input type="date" value={eDueDate} onChange={(e) => setEDueDate(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>단가 (원)</label><input value={eUnitPrice} onChange={(e) => setEUnitPrice(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
          <div><label className={labelClass}>수량</label><input value={eQty} onChange={(e) => setEQty(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
          <div className={labelClass + " flex items-end h-10"}>판매가 {fmtAmt(eSalePrice)}</div>
          <SalesRepFields salesRep={eSalesRep} setSalesRep={setESalesRep} salesRepPhone={eSalesRepPhone} setSalesRepPhone={setESalesRepPhone} />
          <div className="sm:col-span-2 md:col-span-3">
            <label className={labelClass}>특이사항</label>
            <textarea value={eNote} onChange={(e) => setENote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
          </div>
        </EditModalShell>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 기타
// ══════════════════════════════════════════════════════════
type EtcRow = {
  id: number; created_at: string; customer_name: string; phone: string | null;
  sales_rep: string | null; sales_rep_phone: string | null; status: string;
  summary: string | null; detail_memo: string | null;
};

export function EtcSection({ isAdminLevel, canCreate, canChangeStatus }: SectionProps) {
  const [rows, setRows] = useState<EtcRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [salesRep, setSalesRep] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [note, setNote] = useState("");

  const [editRow, setEditRow] = useState<EtcRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [eCustName, setECustName] = useState("");
  const [eCustPhone, setECustPhone] = useState("");
  const [eSummary, setESummary] = useState("");
  const [eSalesRep, setESalesRep] = useState("");
  const [eSalesRepPhone, setESalesRepPhone] = useState("");
  const [eNote, setENote] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("consultation_cases")
        .select("id, created_at, customer_name, phone, sales_rep, sales_rep_phone, status, summary, detail_memo")
        .eq("region", REGION).eq("work_type", "brother_etc")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      setRows(data ?? []);
    } catch (e: any) {
      console.error("[brother_etc fetch]", e);
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchRows(); }, []);

  const reset = () => {
    setCustName(""); setCustPhone(""); setItemName(""); setQty("1");
    setUnitPrice(""); setSalesRep(""); setSalesRepPhone(""); setNote("");
  };

  const add = async () => {
    if (!custName.trim()) { alert("고객명을 입력해주세요."); return; }
    if (!itemName.trim()) { alert("품목명을 입력해주세요."); return; }
    if (!salesRep.trim())  { alert("영업사원을 입력해주세요."); return; }
    setSaving(true);
    try {
      const price = unitPrice ? parseInt(onlyDigits(unitPrice), 10) : null;
      const summary = `${itemName.trim()}${qty ? ` × ${qty}개` : ""}${price ? ` (${price.toLocaleString("ko-KR")}원)` : ""}`;
      const { data, error } = await supabase.from("consultation_cases").insert({
        customer_name: custName.trim(), phone: onlyDigits(custPhone) || null,
        region: REGION, work_type: "brother_etc", status: "contract",
        summary, detail_memo: note.trim() || null,
        sales_rep: salesRep.trim(), sales_rep_phone: onlyDigits(salesRepPhone) || null,
        call_datetime: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;

      void notifyBrother({
        type: "new", caseNo: `ET-${data!.id}`,
        customerName: custName.trim(), customerType: "개인",
        equipmentTon: `[기타] ${summary}`, financeCompany: "-",
        salesRep: salesRep.trim(), dealSalesRepPhone: onlyDigits(salesRepPhone) || undefined,
      });

      reset(); setShowCreate(false); await fetchRows();
    } catch (e: any) {
      alert(e?.message || "등록 실패");
    } finally { setSaving(false); }
  };

  const changeStage = async (row: EtcRow, next: Stage) => {
    const prevStatus = row.status;
    setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, status: next } : r));
    const { error } = await supabase.from("consultation_cases").update({ status: next }).eq("id", row.id);
    if (error) {
      alert("단계 변경 실패: " + error.message);
      setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, status: prevStatus } : r));
      return;
    }
    void notifyBrother({
      type: "status_change", caseNo: `ET-${row.id}`,
      customerName: row.customer_name, customerType: "개인",
      equipmentTon: `[기타] ${row.summary ?? "-"}`,
      prevStatus: STAGE_LABEL[(prevStatus as Stage)] ?? prevStatus, nextStatus: STAGE_LABEL[next],
      salesRep: row.sales_rep, dealSalesRepPhone: row.sales_rep_phone ?? undefined,
    });
  };

  const openEdit = (row: EtcRow) => {
    setEditRow(row);
    setECustName(row.customer_name ?? "");
    setECustPhone(row.phone ? formatPhoneKR(row.phone) : "");
    setESummary(row.summary ?? "");
    setESalesRep(row.sales_rep ?? "");
    setESalesRepPhone(row.sales_rep_phone ? formatPhoneKR(row.sales_rep_phone) : "");
    setENote(row.detail_memo ?? "");
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (!eCustName.trim()) { alert("고객명을 입력해주세요."); return; }
    if (!eSummary.trim())  { alert("품목 내역을 입력해주세요."); return; }
    if (!eSalesRep.trim())  { alert("영업사원을 입력해주세요."); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.from("consultation_cases").update({
        customer_name: eCustName.trim(), phone: onlyDigits(eCustPhone) || null,
        summary: eSummary.trim(), detail_memo: eNote.trim() || null,
        sales_rep: eSalesRep.trim(), sales_rep_phone: onlyDigits(eSalesRepPhone) || null,
      }).eq("id", editRow.id);
      if (error) throw error;

      setRows((prev) => prev.map((r) => String(r.id) === String(editRow.id) ? {
        ...r, customer_name: eCustName.trim(), phone: onlyDigits(eCustPhone) || null,
        summary: eSummary.trim(), detail_memo: eNote.trim() || null,
        sales_rep: eSalesRep.trim(), sales_rep_phone: onlyDigits(eSalesRepPhone) || null,
      } : r));
      setEditRow(null);
    } catch (e: any) {
      alert(e?.message || "수정 실패");
    } finally { setEditSaving(false); }
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setShowCreate((v) => !v)} className={btnPrimary}>+ 기타 신규 접수</button>
        <button onClick={fetchRows} disabled={loading} className={btnSecondary}>{loading ? "로딩중..." : "새로고침"}</button>
      </div>

      {showCreate && canCreate && (
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelClass}>고객명 *</label><input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="홍길동 / 법인명" className={inputClass} /></div>
            <div><label className={labelClass}>전화번호</label><input value={custPhone} onChange={(e) => setCustPhone(formatPhoneKR(e.target.value))} placeholder="010-1234-5678" inputMode="tel" className={inputClass} /></div>
            <div><label className={labelClass}>품목명 *</label><input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="예: 지게차 부품, 소모품 등" className={inputClass} /></div>
            <div><label className={labelClass}>수량</label><input value={qty} onChange={(e) => setQty(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
            <div><label className={labelClass}>단가 (원)</label><input value={unitPrice} onChange={(e) => setUnitPrice(onlyDigits(e.target.value))} inputMode="numeric" className={inputClass} /></div>
            <SalesRepFields salesRep={salesRep} setSalesRep={setSalesRep} salesRepPhone={salesRepPhone} setSalesRepPhone={setSalesRepPhone} />
          </div>
          <div>
            <label className={labelClass}>특이사항</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCreate(false); reset(); }} disabled={saving} className={btnSecondary}>취소</button>
            <button onClick={add} disabled={saving} className={btnPrimary}>{saving ? "저장중..." : "등록"}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && !loading && <p className="text-sm text-gray-400 py-6 text-center">등록된 기타 건이 없습니다.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">{r.customer_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatCreatedAt(r.created_at)} · 영업 {r.sales_rep ?? "-"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <StageButtons stage={r.status ?? "contract"} disabled={!canChangeStatus} onChange={(next) => changeStage(r, next)} />
                <button onClick={() => openEdit(r)} className="px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-500 hover:border-gray-300 transition-all">수정</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-600">{r.summary}</p>
            {r.detail_memo && <p className="mt-1 text-xs text-gray-500">메모: {r.detail_memo}</p>}
          </div>
        ))}
      </div>

      {editRow && (
        <EditModalShell title={`기타 건 수정 — ${editRow.customer_name}`} onClose={() => setEditRow(null)} onSave={saveEdit} saving={editSaving}>
          <div><label className={labelClass}>고객명 *</label><input value={eCustName} onChange={(e) => setECustName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>전화번호</label><input value={eCustPhone} onChange={(e) => setECustPhone(formatPhoneKR(e.target.value))} inputMode="tel" className={inputClass} /></div>
          <div className="sm:col-span-2 md:col-span-1"><label className={labelClass}>품목 내역 *</label><input value={eSummary} onChange={(e) => setESummary(e.target.value)} placeholder="예: 지게차 부품 × 2개 (150,000원)" className={inputClass} /></div>
          <SalesRepFields salesRep={eSalesRep} setSalesRep={setESalesRep} salesRepPhone={eSalesRepPhone} setSalesRepPhone={setESalesRepPhone} />
          <div className="sm:col-span-2 md:col-span-3">
            <label className={labelClass}>특이사항</label>
            <textarea value={eNote} onChange={(e) => setENote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
          </div>
        </EditModalShell>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 전체 현황 (할부/타이어/배터리/기타 통합 뷰)
// ══════════════════════════════════════════════════════════
type JumpTab = "할부" | "타이어" | "배터리" | "기타";
type OverviewRow = {
  key: string; source: JumpTab; created_at: string;
  customer_name: string; sales_rep: string | null;
  stage_label: string; is_done: boolean; is_cancelled: boolean; amount: number | null;
};

export function OverviewSection({ onJumpToTab }: { onJumpToTab: (t: JumpTab) => void }) {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsMonth, setStatsMonth] = useState<string>(() => {
    const n = new Date();
    return n.getFullYear().toString() + String(n.getMonth() + 1).padStart(2, "0");
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [brotherR, tireCaseR, battCaseR, etcCaseR] = await Promise.all([
        supabase.from("brother_tasks").select("id, created_at, customer_name, sales_rep, status, loan_limit, installment_principal").order("created_at", { ascending: false }).limit(300),
        supabase.from("consultation_cases").select("id, created_at, customer_name, sales_rep, status").eq("region", REGION).eq("work_type", "tire_sales").order("created_at", { ascending: false }).limit(300),
        supabase.from("consultation_cases").select("id, created_at, customer_name, sales_rep, status").eq("region", REGION).eq("work_type", "battery_sales").order("created_at", { ascending: false }).limit(300),
        supabase.from("consultation_cases").select("id, created_at, customer_name, sales_rep, status, summary").eq("region", REGION).eq("work_type", "brother_etc").order("created_at", { ascending: false }).limit(300),
      ]);

      const tireIds = (tireCaseR.data ?? []).map((c: any) => c.id);
      const battIds = (battCaseR.data ?? []).map((c: any) => c.id);
      const [tireDetailR, battDetailR] = await Promise.all([
        tireIds.length > 0
          ? supabase.from("consultation_tire_details").select("consultation_id, process_stage, price_to_customer").in("consultation_id", tireIds)
          : Promise.resolve({ data: [] as any[] }),
        battIds.length > 0
          ? supabase.from("consultation_battery_details").select("consultation_id, process_stage, battery_sale_price").in("consultation_id", battIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const tireDetailMap: Record<number, any> = {};
      (tireDetailR.data ?? []).forEach((d: any) => { tireDetailMap[d.consultation_id] = d; });
      const battDetailMap: Record<number, any> = {};
      (battDetailR.data ?? []).forEach((d: any) => { battDetailMap[d.consultation_id] = d; });

      const out: OverviewRow[] = [];
      (brotherR.data ?? []).forEach((r: any) => {
        out.push({
          key: `hcm-${r.id}`, source: "할부", created_at: r.created_at,
          customer_name: r.customer_name, sales_rep: r.sales_rep,
          stage_label: r.status, is_done: r.status === "확정", is_cancelled: r.status === "취소",
          amount: r.loan_limit ?? r.installment_principal ?? null,
        });
      });
      (tireCaseR.data ?? []).forEach((c: any) => {
        const d = tireDetailMap[c.id];
        const stage = (d?.process_stage ?? "contract") as Stage;
        out.push({
          key: `tire-${c.id}`, source: "타이어", created_at: c.created_at,
          customer_name: c.customer_name, sales_rep: c.sales_rep,
          stage_label: STAGE_LABEL[stage] ?? stage, is_done: stage === "invoiced", is_cancelled: stage === "cancelled",
          amount: d?.price_to_customer ?? null,
        });
      });
      (battCaseR.data ?? []).forEach((c: any) => {
        const d = battDetailMap[c.id];
        const stage = (d?.process_stage ?? "contract") as Stage;
        out.push({
          key: `batt-${c.id}`, source: "배터리", created_at: c.created_at,
          customer_name: c.customer_name, sales_rep: c.sales_rep,
          stage_label: STAGE_LABEL[stage] ?? stage, is_done: stage === "invoiced", is_cancelled: stage === "cancelled",
          amount: d?.battery_sale_price ?? null,
        });
      });
      (etcCaseR.data ?? []).forEach((c: any) => {
        const stage = (c.status ?? "contract") as Stage;
        const m = (c.summary ?? "").match(/\(([\d,]+)원\)/);
        out.push({
          key: `etc-${c.id}`, source: "기타", created_at: c.created_at,
          customer_name: c.customer_name, sales_rep: c.sales_rep,
          stage_label: STAGE_LABEL[stage] ?? stage, is_done: stage === "invoiced", is_cancelled: stage === "cancelled",
          amount: m ? parseInt(m[1].replace(/,/g, ""), 10) : null,
        });
      });

      out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRows(out);
    } catch (e: any) {
      console.error("[overview fetch]", e);
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchAll(); }, []);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0"));
    rows.forEach((r) => {
      const d = new Date(r.created_at);
      if (Number.isNaN(d.getTime())) return;
      set.add(d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, "0"));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const monthRows = useMemo(() => rows.filter((r) => {
    const d = new Date(r.created_at);
    return d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, "0") === statsMonth;
  }), [rows, statsMonth]);

  const TYPES: JumpTab[] = ["할부", "타이어", "배터리", "기타"];
  const stats = useMemo(() => {
    const m: Record<JumpTab, { total: number; done: number; amount: number }> = {
      "할부": { total: 0, done: 0, amount: 0 }, "타이어": { total: 0, done: 0, amount: 0 },
      "배터리": { total: 0, done: 0, amount: 0 }, "기타": { total: 0, done: 0, amount: 0 },
    };
    monthRows.forEach((r) => {
      m[r.source].total += 1;
      if (r.is_done) { m[r.source].done += 1; m[r.source].amount += r.amount ?? 0; }
    });
    return m;
  }, [monthRows]);
  const grandAmount = TYPES.reduce((sum, t) => sum + stats[t].amount, 0);

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-600">
          <select value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)} className="bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer pr-1">
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>{ym.slice(0, 4)}년 {parseInt(ym.slice(4), 10)}월</option>
            ))}
          </select>
          <span className="text-gray-300">|</span>
          <span className="text-gray-400">완료 합계</span>
          <span className="font-bold text-orange-500">{(grandAmount / 100000000).toFixed(1)}억</span>
        </div>
        <button onClick={fetchAll} disabled={loading} className={btnSecondary}>{loading ? "로딩중..." : "새로고침"}</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TYPES.map((t) => (
          <button key={t} onClick={() => onJumpToTab(t)} className="rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-orange-300 hover:shadow-sm transition-all">
            <p className="text-xs font-semibold text-gray-500">{t}</p>
            <p className="mt-1 text-lg font-bold text-[#0f172a]">{stats[t].total}<span className="text-xs font-medium text-gray-400"> 건</span></p>
            <p className="mt-0.5 text-xs text-gray-500">완료 {stats[t].done}건 · {fmtAmt(stats[t].amount)}</p>
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {rows.length === 0 && !loading && <p className="text-sm text-gray-400 py-6 text-center">등록된 건이 없습니다.</p>}
        {rows.slice(0, 80).map((r) => (
          <button key={r.key} onClick={() => onJumpToTab(r.source)} className="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left hover:border-orange-300 hover:shadow-sm transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-semibold">{r.source}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#0f172a] truncate">{r.customer_name}</p>
                <p className="text-xs text-gray-400">{formatCreatedAt(r.created_at)} · 영업 {r.sales_rep ?? "-"}</p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${r.is_cancelled ? "bg-gray-100 text-gray-500 border-gray-200" : r.is_done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-orange-50 text-orange-600 border-orange-200"}`}>{r.stage_label}</span>
              <span className="text-xs font-semibold text-gray-600 w-20 text-right">{fmtAmt(r.amount)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
