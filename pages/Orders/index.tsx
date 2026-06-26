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
  wheel_returned_at: string | null;
  invoiced_at: string | null;
  billed_in_at: string | null;
  payment_in_at: string | null;
  payment_out_at: string | null;
  alimtalk_sent: boolean | null;
  memo: string | null;
}

// ─── 상수 ─────────────────────────────────────────────────────
const STAGES: { key: OrderStatus; label: string; color: string }[] = [
  { key: "received",      label: "접수",      color: "bg-gray-100 text-gray-600 border-gray-200" },
  { key: "forwarded",     label: "진흥전달",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "delivered",     label: "납품완료",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "wheel_returned",label: "휠반납",    color: "bg-purple-100 text-purple-700 border-purple-200" },
  { key: "invoiced",      label: "계산서발행",color: "bg-orange-100 text-orange-700 border-orange-200" },
  { key: "billed_in",     label: "진흥청구",  color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { key: "payment_in",    label: "입금확인",  color: "bg-teal-100 text-teal-700 border-teal-200" },
  { key: "payment_out",   label: "송금완료",  color: "bg-green-100 text-green-700 border-green-200" },
];

const NEXT_STAGE: Record<OrderStatus, OrderStatus | null> = {
  received:      "forwarded",
  forwarded:     "delivered",
  delivered:     "wheel_returned",
  wheel_returned:"invoiced",
  invoiced:      "billed_in",
  billed_in:     "payment_in",
  payment_in:    "payment_out",
  payment_out:   null,
};

const STAGE_DATE_FIELD: Record<OrderStatus, keyof TbOrder | null> = {
  received:      null,
  forwarded:     "forwarded_at",
  delivered:     "delivered_at",
  wheel_returned:"wheel_returned_at",
  invoiced:      "invoiced_at",
  billed_in:     "billed_in_at",
  payment_in:    "payment_in_at",
  payment_out:   "payment_out_at",
};

// 스타일 상수
const CARD  = "border border-gray-200 rounded-xl bg-white shadow-sm";
const BTG   = "px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 transition-all";
const BTP   = "px-3 py-1.5 rounded-xl bg-[#0f172a] text-white text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-40";
const BTO   = "px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all";
const CTRL  = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
const SUPABASE_FUNC_URL = `https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/kakao-order-webhook`;

const fmtAmt = (v: number | null) =>
  v != null ? `${v.toLocaleString("ko-KR")}원` : "-";
const fmtDT = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "-";
const stageInfo = (key: OrderStatus) => STAGES.find(s => s.key === key)!;

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
    setFilter("all"); // 완료 건도 포함해서 반드시 보이도록
    // 해당 카드로 스크롤
    setTimeout(() => {
      document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [orders, searchParams]);

  // ─── 필터 ───────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    if (filter === "active") return o.status !== "payment_out";
    if (filter === "done")   return o.status === "payment_out";
    return true;
  });

  // ─── 월별 통계 ──────────────────────────────────────────────
  const now = new Date();
  const thisMonth = orders.filter(o => {
    const d = new Date(o.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const totalRevenue = thisMonth.reduce((s, o) => s + (o.price_to_customer ?? 0), 0);
  const totalCost    = thisMonth.reduce((s, o) => s + (o.price_from_jinheung ?? 0), 0);
  const totalMargin  = totalRevenue - totalCost;

  // ─── 단계 변경 ──────────────────────────────────────────────
  const changeStatus = async (order: TbOrder, nextStatus: OrderStatus) => {
    setSaving(true);
    const dateField = STAGE_DATE_FIELD[nextStatus];
    const patch: Partial<TbOrder> = { status: nextStatus };
    if (dateField) (patch as any)[dateField] = new Date().toISOString();

    await supabase.from("tb_orders").update(patch).eq("id", order.id);

    // 알림톡 발송
    try {
      await fetch(SUPABASE_FUNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event:        "status_change",
          orderId:      order.id,
          status:       nextStatus,
          customerName: order.customer_name_raw ?? "",
          productSpec:  order.product_spec ?? "",
          quantity:     order.quantity?.toString() ?? "",
          amount:       String(order.price_to_customer ?? order.price_from_jinheung ?? ""),
        }),
      });
    } catch (e) { console.error("알림톡 오류:", e); }

    setSaving(false);
    void loadOrders();
  };

  // ─── 금액 저장 ──────────────────────────────────────────────
  const saveAmount = async () => {
    if (!amountModal) return;
    setSaving(true);
    await supabase.from("tb_orders").update({
      price_to_customer:   amtToCustomer   ? parseInt(amtToCustomer.replace(/,/g, ""))   : null,
      price_from_jinheung: amtFromJinheung ? parseInt(amtFromJinheung.replace(/,/g, "")) : null,
    }).eq("id", amountModal.id);
    setSaving(false);
    setAmountModal(null);
    void loadOrders();
  };

  // ─── 신규 주문 등록 ─────────────────────────────────────────
  const saveNewOrder = async () => {
    if (!newCustomer || !newSpec) return;
    setSaving(true);
    await supabase.from("tb_orders").insert({
      customer_name_raw: newCustomer,
      product_type:      "tire",
      product_spec:      newSpec,
      quantity:          newQty ? parseInt(newQty) : null,
      inbound_channel:   "manual",
      status:            "received",
      memo:              newMemo || null,
    });
    setSaving(false);
    setNewModal(false);
    setNewCustomer(""); setNewSpec(""); setNewQty(""); setNewMemo("");
    void loadOrders();
  };

  // ─── 렌더 ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 (AI비서 스타일) */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3">
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

        {/* 당월 통계 */}
        <div className={`${CARD} p-3.5`}>
          <p className="text-xs font-semibold text-gray-500 mb-2">당월 실적 ({now.getMonth() + 1}월)</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "매출", value: fmtAmt(totalRevenue || null), color: "text-orange-600" },
              { label: "매입", value: fmtAmt(totalCost    || null), color: "text-gray-600" },
              { label: "마진", value: fmtAmt(totalMargin  || null), color: "text-emerald-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-sm font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="text-xs text-gray-400">건수 {thisMonth.length}건</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">완료 {thisMonth.filter(o => o.status === "payment_out").length}건</span>
          </div>
        </div>

        {/* 필터 + 목록 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            {(["active","all","done"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filter === f ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                {{ active: "진행중", all: "전체", done: "완료" }[f]}
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
                const st  = stageInfo(order.status);
                const next = NEXT_STAGE[order.status];
                const nextSt = next ? stageInfo(next) : null;
                const isExp = expandedId === order.id;

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
                          {nextSt && (
                            <button
                              onClick={() => changeStatus(order, next!)}
                              disabled={saving}
                              className={BTO}>
                              {nextSt.label} →
                            </button>
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
                        {/* 진행 단계 타임라인 */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2">진행 단계</p>
                          <div className="flex flex-wrap gap-1.5">
                            {STAGES.map(s => {
                              const stageIdx  = STAGES.findIndex(x => x.key === order.status);
                              const thisIdx   = STAGES.findIndex(x => x.key === s.key);
                              const isDone    = thisIdx <= stageIdx;
                              const isCurrent = s.key === order.status;
                              return (
                                <span key={s.key}
                                  className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                                    isCurrent ? s.color :
                                    isDone ? "bg-gray-100 text-gray-500 border-gray-200" :
                                    "bg-white text-gray-300 border-gray-100"
                                  }`}>
                                  {s.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* 날짜 정보 */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {[
                            { label: "접수", val: order.created_at },
                            { label: "진흥전달", val: order.forwarded_at },
                            { label: "납품", val: order.delivered_at },
                            { label: "휠반납", val: order.wheel_returned_at },
                            { label: "계산서", val: order.invoiced_at },
                            { label: "진흥청구", val: order.billed_in_at },
                            { label: "입금", val: order.payment_in_at },
                            { label: "송금", val: order.payment_out_at },
                          ].filter(x => x.val).map(({ label, val }) => (
                            <div key={label} className="flex gap-1">
                              <span className="text-gray-400 w-14 shrink-0">{label}</span>
                              <span className="text-gray-600">{fmtDT(val)}</span>
                            </div>
                          ))}
                        </div>

                        {/* 금액 */}
                        <div className="flex items-center justify-between">
                          <div className="grid grid-cols-3 gap-3 flex-1 text-xs">
                            <div>
                              <p className="text-gray-400">고객사 청구</p>
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
                            className={BTG}>금액 입력</button>
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
            <h2 className="text-base font-bold text-[#0f172a] mb-1">금액 입력</h2>
            <p className="text-sm text-gray-500 mb-4">{amountModal.customer_name_raw} — {amountModal.product_spec}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">고객사 청구금액 (원)</label>
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
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAmountModal(null)} className={BTG}>취소</button>
              <button onClick={saveAmount} disabled={saving} className={BTP}>저장</button>
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