// pages/OrderConfirm/index.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const KAKAO_EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-hyundaicm-kakao`;
const SITE_URL = "https://www.rnfkorea.co.kr";

type Status = "loading" | "success" | "already_done" | "error";

const ACTION_MAP: Record<string, { label: string; next: string; nextLabel: string }> = {
  delivered: {
    label:     "물품발송",
    next:      "completed_order",
    nextLabel: "휠반납완료",
  },
  completed_order: {
    label:     "휠반납완료",
    next:      "invoiced",
    nextLabel: "계산서발행",
  },
};

const AUTO_CLOSE_SEC = 3;

export default function OrderConfirmPage() {
  const [params]  = useSearchParams();
  const routeParams = useParams<{ action?: string; id?: string }>();
  const id        = routeParams.id ?? params.get("id") ?? "";
  const action    = routeParams.action ?? params.get("action") ?? "";
  const [status, setStatus]       = useState<Status>("loading");
  const [errorMsg, setErrorMsg]   = useState<string>("");
  const [orderInfo, setOrderInfo] = useState<{
    customer_name_raw: string;
    product_spec: string;
    quantity: number | null;
  } | null>(null);
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SEC);

  const actionMeta = ACTION_MAP[action];

  useEffect(() => {
    if (!id || !actionMeta) {
      setErrorMsg(`id=${id}, action=${action}, actionMeta=${JSON.stringify(actionMeta)}`);
      setStatus("error");
      return;
    }
    processAction();
  }, [id, action]);

  useEffect(() => {
    if (status !== "success" && status !== "already_done") return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); window.close(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  async function processAction() {
    try {
      const { data: order, error: fetchErr } = await supabase
        .from("tb_orders")
        .select("id, status, customer_name_raw, product_spec, quantity")
        .eq("id", id)
        .single();

      if (fetchErr || !order) {
        setErrorMsg(`fetch 오류: ${fetchErr?.message ?? "order null"} / id=${id}`);
        setStatus("error");
        return;
      }

      setOrderInfo({
        customer_name_raw: order.customer_name_raw ?? "-",
        product_spec:      order.product_spec      ?? "-",
        quantity:          order.quantity,
      });

      const doneStatuses = ["delivered", "completed_order", "wheel_returned", "invoiced", "payment_in", "payment_out"];
      if (doneStatuses.includes(order.status) && order.status !== "forwarded") {
        setStatus("already_done");
        return;
      }

      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { status: action };
      if (action === "delivered")        patch.delivered_at      = now;
      if (action === "completed_order")  patch.wheel_returned_at = now;

      const { error: updateErr } = await supabase
        .from("tb_orders")
        .update(patch)
        .eq("id", id);

      if (updateErr) {
        setErrorMsg(`update 오류: ${updateErr.message}`);
        setStatus("error");
        return;
      }

      if (action === "delivered") {
        try {
          const wheelReturnedUrl = `${SITE_URL}/order/confirm/completed_order/${id}`;
          await fetch(KAKAO_EDGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type:            "wheel_return_request",
              orderNo:         id,
              customerName:    order.customer_name_raw ?? "확인필요",
              productSpec:     order.product_spec      ?? "확인필요",
              quantity:        order.quantity != null ? String(order.quantity) : "확인필요",
              wheelReturnedUrl,
            }),
          });
        } catch (e) {
          console.warn("[휠반납 알림톡 발송 실패]", e);
        }
      }

      const { error: chatErr } = await supabase.from("secretary_chat_logs").insert({
        role:       "assistant",
        content:    `📦 **${actionMeta.label} 완료**\n\n**${order.customer_name_raw}** ${order.product_spec ?? ""} ${order.quantity ? order.quantity + "개" : ""}\n주문번호: ${id.slice(-8).toUpperCase()}\n✅ (주)진흥에서 ${actionMeta.label} 처리 완료`,
        session_id: "main",
      });

      if (chatErr) {
        setErrorMsg(`chat_log 오류: ${chatErr.message}`);
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch (e) {
      setErrorMsg(`예외: ${(e as Error).message}`);
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">처리 중입니다...</p>
        </div>
      </div>
    );
  }

  if (status === "already_done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-gray-700 mb-2">이미 처리된 주문입니다</h1>
          {orderInfo && (
            <div className="text-sm text-gray-500 mt-4 space-y-1">
              <p>고객사: {orderInfo.customer_name_raw}</p>
              <p>품목: {orderInfo.product_spec}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-6">{countdown}초 후 자동으로 닫힙니다</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✕</span>
          </div>
          <h1 className="text-xl font-bold text-red-600 mb-2">처리 중 오류가 발생했습니다</h1>
          <p className="text-sm text-gray-500">링크를 다시 확인하거나 RNF Korea로 문의해주세요.</p>
          <p className="text-xs text-gray-400 mt-2">1551-1873</p>
          {errorMsg && (
            <p className="text-xs text-red-400 mt-4 break-all bg-red-50 rounded p-2">{errorMsg}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          {actionMeta?.label} 처리 완료
        </h1>
        {orderInfo && (
          <div className="text-sm text-gray-500 mt-4 space-y-1 bg-gray-50 rounded-xl p-4">
            <p>고객사: <span className="font-medium text-gray-700">{orderInfo.customer_name_raw}</span></p>
            <p>품목: <span className="font-medium text-gray-700">{orderInfo.product_spec}</span></p>
            {orderInfo.quantity && <p>수량: <span className="font-medium text-gray-700">{orderInfo.quantity}개</span></p>}
            <p className="text-xs text-gray-400 mt-2">주문번호: {id.slice(-8).toUpperCase()}</p>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-4">RNF Korea에 자동으로 알림이 전송되었습니다.</p>
        {action === "delivered" && (
          <p className="text-xs text-orange-500 mt-1">휠반납 요청 알림톡이 (주)진흥으로 발송되었습니다.</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{countdown}초 후 자동으로 닫힙니다</p>
      </div>
    </div>
  );
}