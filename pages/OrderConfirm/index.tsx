// pages/OrderConfirm/index.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type Status = "loading" | "success" | "already_done" | "error";

const ACTION_MAP: Record<string, { label: string }> = {
  delivered:       { label: "물품발송" },
  completed_order: { label: "휠반납완료" },
};

export default function OrderConfirmPage() {
  const [params]    = useSearchParams();
  const routeParams = useParams<{ action?: string; id?: string }>();
  const id          = routeParams.id ?? params.get("id") ?? "";
  const action      = routeParams.action ?? params.get("action") ?? "";
  const [status, setStatus]       = useState<Status>("loading");
  const [orderInfo, setOrderInfo] = useState<{
    customer_name_raw: string;
    product_spec: string;
    quantity: number | null;
  } | null>(null);

  const actionMeta = ACTION_MAP[action];

  useEffect(() => {
    if (!id || !actionMeta) {
      setStatus("error");
      return;
    }
    processAction();
  }, [id, action]);

  async function processAction() {
    try {
      // tb_orders는 로그인 계정만 접근 가능하도록 잠갔으므로(보안 점검 2026-07-12),
      // 이 공개 확인링크는 service_role로 딱 이 주문 한 건만 처리하는 엣지함수를 거친다.
      const { data, error } = await supabase.functions.invoke("order-confirm", {
        body: { id, action },
      });

      if (error || !data || data.status === "error") {
        setStatus("error");
        return;
      }

      if (data.orderInfo) setOrderInfo(data.orderInfo);
      setStatus(data.status === "already_done" ? "already_done" : "success");
    } catch {
      setStatus("error");
    }
  }

  // ── 로딩 ──────────────────────────────────────────
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

  // ── 이미 처리됨 ───────────────────────────────────
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
          <p className="text-xs text-gray-400 mt-6">이 창을 닫아주세요</p>
        </div>
      </div>
    );
  }

  // ── 오류 ──────────────────────────────────────────
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
        </div>
      </div>
    );
  }

  // ── 성공 ──────────────────────────────────────────
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
        <p className="text-xs text-gray-400 mt-4">이 창을 닫아주세요</p>
      </div>
    </div>
  );
}
