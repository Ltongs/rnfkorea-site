// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용
// supabase/functions/order-confirm/index.ts
// 진흥 주문 공개 확인링크(OrderConfirm 페이지)용 엣지함수.
// 기존엔 프론트엔드가 anon 키로 tb_orders를 직접 select/update했는데, RLS 정책이
// "qual:true"로 걸려있어 anon 키만 있으면 전체 주문 테이블을 조회/수정할 수 있었다.
// 보안 점검(2026-07-12) 후 anon의 tb_orders 직접 접근을 막고, 이 엣지함수가 service_role로
// 딱 이 id 한 건만 조회/수정하도록 대체한다. 프론트엔드가 넘겨준 id는 uuid라 추측 불가능하므로
// "링크를 아는 사람만 그 주문 하나를 확인할 수 있다"는 기존 동작은 그대로 유지된다.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTION_LABEL: Record<string, string> = {
  delivered: "물품발송",
  completed_order: "휠반납완료",
};

// action(URL 파라미터) → 실제 tb_orders.status 컬럼에 들어갈 값
const STATUS_MAP: Record<string, string> = {
  delivered: "delivered",
  completed_order: "wheel_returned",
};

// 각 action이 처리 완료로 간주되는 상태 목록
const DONE_MAP: Record<string, string[]> = {
  delivered: ["delivered", "wheel_returned", "invoiced", "payment_in", "payment_out"],
  completed_order: ["wheel_returned", "invoiced", "payment_in", "payment_out"],
};

const SITE_URL = "https://www.rnfkorea.co.kr";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { id, action } = await req.json();
    const actionLabel = ACTION_LABEL[action];

    if (!id || !actionLabel) {
      return new Response(JSON.stringify({ status: "error", message: "잘못된 요청입니다." }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(sbUrl, sbKey);

    const { data: order, error: fetchErr } = await db
      .from("tb_orders")
      .select("id, status, customer_name_raw, product_spec, quantity")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return new Response(JSON.stringify({ status: "error", message: "주문을 찾을 수 없습니다." }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const orderInfo = {
      customer_name_raw: order.customer_name_raw ?? "-",
      product_spec: order.product_spec ?? "-",
      quantity: order.quantity,
    };

    const doneStatuses = DONE_MAP[action] ?? [];
    if (doneStatuses.includes(order.status)) {
      return new Response(JSON.stringify({ status: "already_done", orderInfo }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const newStatus = STATUS_MAP[action] ?? action;
    const patch: Record<string, unknown> = { status: newStatus };
    if (action === "delivered") patch.delivered_at = now;
    if (action === "completed_order") patch.wheel_returned_at = now;

    const { error: updateErr } = await db.from("tb_orders").update(patch).eq("id", id);
    if (updateErr) {
      return new Response(JSON.stringify({ status: "error", message: "상태 업데이트 실패" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    await db.from("secretary_chat_logs").insert({
      role: "assistant",
      content: `📦 **${actionLabel} 완료**\n\n**${order.customer_name_raw}** ${order.product_spec ?? ""} ${order.quantity ? order.quantity + "개" : ""}\n주문번호: ${String(id).slice(-8).toUpperCase()}\n✅ (주)진흥에서 ${actionLabel} 처리 완료`,
      session_id: "main",
    });

    // 물품발송 확인 시 — 화면에서 "휠반납 요청 알림톡 발송됨"이라고 안내하므로 실제로 발송한다
    if (action === "delivered") {
      await db.functions.invoke("send-hyundaicm-kakao", {
        body: {
          type: "wheel_return_request",
          orderNo: id,
          customerName: order.customer_name_raw ?? "-",
          productSpec: order.product_spec ?? "-",
          quantity: order.quantity ? String(order.quantity) : "-",
          wheelReturnedUrl: `${SITE_URL}/order/confirm/completed_order/${id}`,
        },
      });
    }

    return new Response(JSON.stringify({ status: "success", orderInfo }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ status: "error", message: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
