import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// ─── 타입 ─────────────────────────────────────────────────────
type OrderStatus =
  | "received" | "forwarded" | "delivered" | "wheel_returned"
  | "invoiced" | "billed_in" | "payment_in" | "payment_out";

interface TbOrder {
  id: string;
  created_at: string;
  customer_name_raw: string | null;
  inbound_channel: string | null;
  product_type: string | null;
  product_spec: string | null;
  quantity: number | null;
  status: OrderStatus;
  price_to_customer: number | null;
  price_from_jinheung: number | null;
  margin: number | null;
  forwarded_at: string | null;
  delivered_at: string | null;
  wheel_returned_at: string | null; // 휠반납 체크박스 — 값이 있으면 반납완료
  invoiced_at: string | null;
  billed_in_at: string | null;
  payment_in_at: string | null;
  payment_out_at: string | null;
  alimtalk_sent: boolean | null;
  memo: string | null;
}

// 화면에 보여줄 단순화된 3+1 단계
type SimpleStage = "received" | "delivered" | "invoiced" | "closed";

// ─── 상수 ─────────────────────────────────────────────────────
const SIMPLE_STAGE_INFO: Record<SimpleStage, { label: string; color: string }> = {
  received:  { label: "접수(진흥전달)",      color: "bg-gray-100 text-gray-600 border-gray-200" },
  delivered: { label: "발송(납품완료)",      color: "bg-blue-100 text-blue-700 border-blue-200" },
  invoiced:  { label: "계산서발행",          color: "bg-orange-100 text-orange-700 border-orange-200" },
  closed:    { label: "종결",                color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

// 과거(레거시) status 값들도 새 3단계 모델로 정규화해서 표시
function simpleStage(o: TbOrder): SimpleStage {
  const wheelDone = !!o.wheel_returned_at;
  const invoiced =
    !!o.invoiced_at ||
    ["invoiced", "billed_in", "payment_in", "payment_out"].includes(o.status);
  if (invoiced && wheelDone) return "closed";
  if (invoiced) return "invoiced";
  const delivered =
    !!o.delivered_at ||
    ["delivered", "wheel_returned", "invoiced", "billed_in", "payment_in", "payment_out"].includes(o.status);
  if (delivered) return "delivered";
  return "received";
}

// 스타일 상수
const CARD  = "border border-gray-200 rounded-xl bg-white shadow-sm";
const BTG   = "px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 transition-all";
const BTP   = "px-3 py-1.5 rounded-xl bg-[#0f172a] text-white text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-40";
const BTO   = "px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all";
const BTR   = "px-3 py-1.5 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-all";
const CTRL  = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
const SUPABASE_FUNC_URL = `https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/kakao-order-webhook`;

const fmtAmt = (v: number | null) =>
  v != null ? `${v.toLocaleString("ko-KR")}원` : "-";
const fmtDT = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "-";

// ─── 컴포넌트 ─────────────────────────────────────────────────
export default function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<TbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [amountModal, setAmountModal] = useState<TbOrder | null>(null);
  const [newModal, setNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<TbOrder | null>(null);

  // 신규 주문 입력 state
  const [newCustomer, setNewCustomer] = useState("");
  const [newSpec, setNewSpec] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newMemo, setNewMemo] = useState("");

  // 금액 입력 state
  const [amtToCustomer, setAmtToCustomer] = useState("");
  const [amtFromJinheung, setAmtFromJinheung] = useState("");

  // ─── 데이터 로드 ────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    setLoading(true);
    const q = supabase.from("tb_orders").select("*").order("created_at", { ascending: false });
    const { data } = await q;
    setOrders(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  // ?id= 파라미터로 진입 시 해당 주문 자동 펼침 + 전체 보기로 필터 전환
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id || orders.length === 0) return;
    setExpandedId(id);
    setFilter("all"); // 종결 건도 포함해서 반드시 보이도록
    setTimeout(() => {
      document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [orders, searchParams]);

  // ─── 필터 ───────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    const stage = simpleStage(o);
    if (filter === "active") return stage !== "closed";
    if (filter === "done")   return stage === "closed";
    return true;
  });

  // ─── 알림톡 발송 (공통) ────────────────────────────────────
  const sendKakao = async (order: TbOrder, statusLabel: string) => {
    try {
      await fetch(SUPABASE_FUNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event:        "status_change",
          orderId:      order.id,
          status:       statusLabel,
          customerName: order.customer_name_raw ?? "",
          productSpec:  order.product_spec ?? "",
          quantity:     order.quantity?.toString() ?? "",
          amount:       String(order.price_to_customer ?? order.price_from_jinheung ?? ""),
        }),
      });
    } catch (e) { console.error("알림톡 오류:", e); }
  };

  // ─── 발송(납품완료) 처리 ────────────────────────────────────
  const markDelivered = async (order: TbOrder) => {
    setSaving(true);
    const { error } = await supabase.from("tb_orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) {
      console.error("발송 처리 실패:", error);
      alert("발송 처리 중 오류가 발생했습니다: " + error.message);
      setSaving(false);
      return;
    }
    await sendKakao(order, "delivered");
    setSaving(false);
    void loadOrders();
  };

  // ─── 계산서발행 처리 + 매출관리(sales_records) 자동 연동 ──────
  const markInvoiced = async (order: TbOrder) => {
    if (!window.confirm(`${order.customer_name_raw ?? "고객"} 건을 계산서발행 처리할까요?\n매출관리(sales_records)에도 자동 등록됩니다.`)) return;
    setSaving(true);
    const { error } = await supabase.from("tb_orders")
      .update({ status: "invoiced", invoiced_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) {
      console.error("계산서발행 처리 실패:", error);
      alert("계산서발행 처리 중 오류가 발생했습니다: " + error.message);
      setSaving(false);
      return;
    }

    // 매출관리 중복 등록 방지
    const { data: existing } = await supabase.from("sales_records").select("id").eq("jinheung_order_id", order.id).maybeSingle();
    let salesRecordId: number | null = existing?.id ?? null;
    if (!existing) {
      const { data: inserted } = await supabase.from("sales_records").insert({
        sale_date: new Date().toISOString().split("T")[0],
        customer_name: order.customer_name_raw ?? "미확인",
        business_no: null,
        category: "타이어",
        trade_type: "내수",
        maker: null,
        spec: order.product_spec ?? null,
        quantity: order.quantity ?? 1,
        unit_price: order.price_to_customer ?? 0,
        unit_cost: order.price_from_jinheung ?? 0,
        tax_invoice: true,
        payment_confirmed: false,
        payment_date: null,
        delivery_date: order.delivered_at,
        delivery_confirmed: !!order.delivered_at,
        wheel_returned: !!order.wheel_returned_at,
        closing: false,
        note: `진흥주문 #${order.id} (${order.customer_name_raw ?? "미확인"}) 자동 연동 — 계산서발행 시 자동 등록`,
        jinheung_order_id: order.id,
      }).select("id").single();
      salesRecordId = inserted?.id ?? null;
    }

    // 역방향 링크 — 이게 없으면 "종결" 배지가 영원히 "계산서발행"에 멈춰 보임(sales_records 쪽만 정방향으로 연결되고 tb_orders는 비어있던 버그)
    if (salesRecordId) {
      const { error: linkErr } = await supabase.from("tb_orders").update({ sales_record_id: salesRecordId }).eq("id", order.id);
      if (linkErr) console.error("역방향 매출연결 실패(무시):", linkErr);
    }

    await sendKakao(order, "invoiced");
    setSaving(false);
    void loadOrders();
  };

  // ─── 휠반납 체크박스 토글 ───────────────────────────────────
  const toggleWheelReturned = async (order: TbOrder) => {
    setSaving(true);
    const next = order.wheel_returned_at ? null : new Date().toISOString();
    const { error } = await supabase.from("tb_orders")
      .update({ wheel_returned_at: next })
      .eq("id", order.id);
    if (error) {
      console.error("휠반납 처리 실패:", error);
      alert("휠반납 처리 중 오류가 발생했습니다: " + error.message);
      setSaving(false);
      return;
    }
    // 종결로 바뀌는 시점(휠반납 체크 + 이미 계산서발행 상태)이면 매출관리 wheel_returned 동기화
    if (next && (order.invoiced_at || ["invoiced","billed_in","payment_in","payment_out"].includes(order.status))) {
      await supabase.from("sales_records").update({ wheel_returned: true }).eq("jinheung_order_id", order.id);
    }
    setSaving(false);
    void loadOrders();
  };

  // ─── 삭제 ───────────────────────────────────────────────────
  const deleteOrder = async (order: TbOrder) => {
    setSaving(true);
    const { error } = await supabase.from("tb_orders").delete().eq("id", order.id);
    setSaving(false);
    if (error) {
      console.error("진흥주문 삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다: " + error.message);
      return;
    }
    setDeleteConfirm(null);
    if (expandedId === order.id) setExpandedId(null);
    void loadOrders();
  };

  // ─── 금액 저장 (매출금액 입력) ─────────────────────────────
  const saveAmount = async () => {
    if (!amountModal) return;
    setSaving(true);
    const { error } = await supabase.from("tb_orders").update({
      price_to_customer:   amtToCustomer   ? parseInt(amtToCustomer.replace(/,/g, ""))   : null,
      price_from_jinheung: amtFromJinheung ? parseInt(amtFromJinheung.replace(/,/g, "")) : null,
    }).eq("id", amountModal.id);
    setSaving(false);
    if (error) {
      console.error("금액 저장 실패:", error);
      alert("저장 중 오류가 발생했습니다: " + error.message);
      return;
    }
    // 이미 매출관리에 등록된 건이면 금액도 동기화
    await supabase.from("sales_records").update({
      unit_price: amtToCustomer   ? parseInt(amtToCustomer.replace(/,/g, ""))   : 0,
      unit_cost:  amtFromJinheung ? parseInt(amtFromJinheung.replace(/,/g, "")) : 0,
    }).eq("jinheung_order_id", amountModal.id);
    setAmountModal(null);
    void loadOrders();
  };

  // ─── 신규 주문 등록 ─────────────────────────────────────────
  const saveNewOrder = async () => {
    if (!newCustomer || !newSpec) return;
    setSaving(true);
    const { data: orderNoData } = await supabase.rpc("next_rnf_number");
    const { error } = await supabase.from("tb_orders").insert({
      order_no: orderNoData as string,
      customer_name_raw: newCustomer,
      product_type:      "tire",
      product_spec:      newSpec,
      quantity:           newQty ? parseInt(newQty) : null,
      inbound_channel:   "other",
      status:            "received",
      memo:              newMemo || null,
    });
    setSaving(false);
    if (error) {
      console.error("진흥주문 저장 실패:", error);
      alert("저장 중 오류가 발생했습니다: " + error.message);
      return;
    }
    setNewModal(false);
    setNewCustomer(""); setNewSpec(""); setNewQty(""); setNewMemo("");
    void loadOrders();
  };

  // ─── 렌더 ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 (AI비서 스타일) */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate("/work/secretary")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all">
            ← AI비서
          </button>
          <span className="text-sm font-semibold text-[#0f172a]">🔧 진흥주문 관리</span>
          <span className="text-xs text-gray-400">(주)진흥 타이어</span>
        </div>
        <button onClick={() => setNewModal(true)} className={BTO}>+ 신규 등록</button>
      </div>

      <div className="px-4 py-2 space-y-3">

        {/* 필터 + 목록 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            {(["active","all","done"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filter === f ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                {{ active: "진행중", all: "전체", done: "종결" }[f]}
              </button>
            ))}
            <span className="text-xs text-gray-400 ml-auto">{filtered.length}건</span>
            <button onClick={() => void loadOrders()} className={BTG}>새로고침</button>
          </div>

          {loading ? (
            <div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>주문이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(order => {
                const stage = simpleStage(order);
                const st = SIMPLE_STAGE_INFO[stage];
                const isExp = expandedId === order.id;
                const wheelDone = !!order.wheel_returned_at;

                return (
                  <div key={order.id} id={`order-${order.id}`} className={`${CARD} overflow-hidden ${expandedId === order.id ? "ring-2 ring-orange-400" : ""}`}>
                    {/* 메인 행 */}
                    <div className="p-3.5">
                      <div className="flex items-start gap-2.5">
                        <div className="flex-1 min-w-0">
                          {/* 1행: 고객사 + 상태 배지 */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-[#0f172a]">
                              {order.customer_name_raw ?? "미확인"}
                            </span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${st.color}`}>
                              {st.label}
                            </span>
                            {stage !== "closed" && stage !== "received" && (
                              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${wheelDone ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-white text-gray-300 border-gray-200"}`}>
                                휠반납 {wheelDone ? "✓" : "-"}
                              </span>
                            )}
                            {order.inbound_channel === "kakao" && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200">카카오</span>
                            )}
                          </div>
                          {/* 2행: 품목 */}
                          {order.product_spec && (
                            <p className="text-xs text-gray-600 mt-0.5 font-medium">
                              {order.product_spec}{order.quantity ? ` × ${order.quantity}개` : ""}
                            </p>
                          )}
                          {/* 3행: 금액 + 날짜 */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {order.price_to_customer && (
                              <span className="text-xs text-orange-600 font-medium">매출 {fmtAmt(order.price_to_customer)}</span>
                            )}
                            {order.margin != null && order.margin !== 0 && (
                              <span className="text-xs text-emerald-600 font-medium">마진 {fmtAmt(order.margin)}</span>
                            )}
                            <span className="text-xs text-gray-400">{fmtDT(order.created_at)}</span>
                          </div>
                        </div>
                        {/* 우측 버튼 */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {stage === "received" && (
                            <button onClick={() => markDelivered(order)} disabled={saving} className={BTO}>발송(납품완료) →</button>
                          )}
                          {stage === "delivered" && (
                            <button onClick={() => markInvoiced(order)} disabled={saving} className={BTO}>계산서발행 →</button>
                          )}
                          <button onClick={() => setExpandedId(isExp ? null : order.id)} className={BTG}>
                            {isExp ? "접기" : "상세"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 펼침 영역 */}
                    {isExp && (
                      <div className="border-t border-gray-100 px-3.5 py-2 bg-gray-50 space-y-3">
                        {/* 날짜 정보 */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {[
                            { label: "접수", val: order.created_at },
                            { label: "발송", val: order.delivered_at },
                            { label: "계산서", val: order.invoiced_at },
                            { label: "휠반납", val: order.wheel_returned_at },
                          ].filter(x => x.val).map(({ label, val }) => (
                            <div key={label} className="flex gap-1">
                              <span className="text-gray-400 w-14 shrink-0">{label}</span>
                              <span className="text-gray-600">{fmtDT(val)}</span>
                            </div>
                          ))}
                        </div>

                        {/* 금액 + 매출금액 입력 */}
                        <div className="flex items-center justify-between">
                          <div className="grid grid-cols-3 gap-3 flex-1 text-xs">
                            <div>
                              <p className="text-gray-400">고객사 청구(매출)</p>
                              <p className="font-semibold text-orange-600">{fmtAmt(order.price_to_customer)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">진흥 매입</p>
                              <p className="font-semibold text-gray-700">{fmtAmt(order.price_from_jinheung)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">마진</p>
                              <p className="font-semibold text-emerald-600">{fmtAmt(order.margin)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setAmountModal(order);
                              setAmtToCustomer(order.price_to_customer?.toLocaleString("ko-KR") ?? "");
                              setAmtFromJinheung(order.price_from_jinheung?.toLocaleString("ko-KR") ?? "");
                            }}
                            className={BTG}>매출금액 입력</button>
                        </div>

                        {/* 휠반납 체크박스 + 삭제 */}
                        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={wheelDone}
                              disabled={saving}
                              onChange={() => toggleWheelReturned(order)}
                              className="w-4 h-4 rounded border-gray-300 accent-purple-600"
                            />
                            휠반납 완료
                            {stage === "invoiced" && !wheelDone && (
                              <span className="text-gray-400">(체크 시 자동 종결)</span>
                            )}
                          </label>
                          <button onClick={() => setDeleteConfirm(order)} className={BTR}>삭제</button>
                        </div>

                        {/* 메모 */}
                        {order.memo && (
                          <p className="text-xs text-gray-500 bg-white rounded-xl p-2.5 border border-gray-200">{order.memo}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 금액 입력 모달 */}
      {amountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className={`w-full max-w-sm ${CARD} p-6`}>
            <h2 className="text-base font-bold text-[#0f172a] mb-1">매출금액 입력</h2>
            <p className="text-sm text-gray-500 mb-4">{amountModal.customer_name_raw} — {amountModal.product_spec}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">고객사 청구금액(매출, 원)</label>
                <input
                  value={amtToCustomer}
                  onChange={e => setAmtToCustomer(e.target.value.replace(/[^0-9]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ","))}
                  placeholder="예: 250,000" inputMode="numeric" className={CTRL} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">(주)진흥 매입금액 (원)</label>
                <input
                  value={amtFromJinheung}
                  onChange={e => setAmtFromJinheung(e.target.value.replace(/[^0-9]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ","))}
                  placeholder="예: 220,000" inputMode="numeric" className={CTRL} />
              </div>
              {amtToCustomer && amtFromJinheung && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs text-emerald-700 font-semibold">
                    마진: {(parseInt(amtToCustomer.replace(/,/g,"")) - parseInt(amtFromJinheung.replace(/,/g,""))).toLocaleString("ko-KR")}원
                  </p>
                </div>
              )}
              <p className="text-[11px] text-gray-400">계산서발행 이후 건은 매출관리(sales_records) 금액도 함께 갱신됩니다.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAmountModal(null)} className={BTG}>취소</button>
              <button onClick={saveAmount} disabled={saving} className={BTP}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className={`w-full max-w-sm ${CARD} p-6`}>
            <h2 className="text-base font-bold text-[#0f172a] mb-1">주문 삭제</h2>
            <p className="text-sm text-gray-500 mb-5">
              {deleteConfirm.customer_name_raw} — {deleteConfirm.product_spec} 건을 삭제할까요?<br/>
              <span className="text-red-500">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className={BTG}>취소</button>
              <button onClick={() => deleteOrder(deleteConfirm)} disabled={saving} className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-all disabled:opacity-40">
                {saving ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신규 주문 등록 모달 */}
      {newModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className={`w-full max-w-sm ${CARD} p-6`}>
            <h2 className="text-base font-bold text-[#0f172a] mb-4">신규 주문 등록</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">고객사명 *</label>
                <input value={newCustomer} onChange={e => setNewCustomer(e.target.value)} placeholder="예: 두산중공업" className={CTRL} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">품목/규격 *</label>
                <input value={newSpec} onChange={e => setNewSpec(e.target.value)} placeholder="예: 18*7-8 두산 3톤 후륜" className={CTRL} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">수량</label>
                <input value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="예: 2" inputMode="numeric" className={CTRL} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">메모</label>
                <input value={newMemo} onChange={e => setNewMemo(e.target.value)} placeholder="특이사항" className={CTRL} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setNewModal(false)} className={BTG}>취소</button>
              <button onClick={saveNewOrder} disabled={saving || !newCustomer || !newSpec} className={BTP}>등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}