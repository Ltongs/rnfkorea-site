import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── 템플릿 ID 맵 ────────────────────────────────────────────
const TEMPLATES: Record<string, string> = {
  order_received:      Deno.env.get("SOLAPI_TEMPLATE_ID_ORDER")      ?? "",
  order_forwarded:     Deno.env.get("SOLAPI_TEMPLATE_ID_FORWARDED")  ?? "",
  order_delivered:     Deno.env.get("SOLAPI_TEMPLATE_ID_DELIVERED")  ?? "",
  order_wheel_returned:Deno.env.get("SOLAPI_TEMPLATE_ID_WHEEL")      ?? "",
  order_invoiced:      Deno.env.get("SOLAPI_TEMPLATE_ID_INVOICED")   ?? "",
  order_billed_in:     Deno.env.get("SOLAPI_TEMPLATE_ID_BILLED_IN")  ?? "",
  order_payment_in:    Deno.env.get("SOLAPI_TEMPLATE_ID_PAYMENT_IN") ?? "",
  order_payment_out:   Deno.env.get("SOLAPI_TEMPLATE_ID_PAYMENT_OUT")?? "",
  order_confirm_needed:Deno.env.get("SOLAPI_TEMPLATE_ID_CONFIRM")    ?? "",
};

// ─── Claude API로 주문 텍스트 파싱 ───────────────────────────
async function parseOrderWithClaude(message: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `다음 발주 메시지에서 정보를 추출해서 JSON만 반환하세요. 다른 텍스트는 절대 포함하지 마세요.

메시지: "${message}"

반환 형식:
{
  "customer_name": "고객사명 또는 null",
  "product_type": "tire" 또는 "battery" 또는 "unknown",
  "product_spec": "규격 문자열 또는 null",
  "quantity": 숫자 또는 null,
  "confidence": "high" 또는 "low",
  "notes": "불확실한 부분 또는 null"
}

판단 기준:
- 타이어: 규격(예: 245/65R17, 18*7-8, 11R22.5), 타이어/공기압 언급
- 배터리: Ah/V 규격, 배터리/밧데리 언급
- 고객사: 회사명, 브랜드명 (예: 두산, 현대, 삼성)
- quantity 없으면 null`,
      }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Claude API 오류:", errText);
    return { customer_name: null, product_type: "unknown", product_spec: null, quantity: null, confidence: "low", notes: "Claude API 오류: " + errText };
  }

  const data = await response.json();
  console.log("Claude 응답:", JSON.stringify(data));

  if (!data.content?.[0]?.text) {
    return { customer_name: null, product_type: "unknown", product_spec: null, quantity: null, confidence: "low", notes: "Claude 응답 형식 오류" };
  }

  try {
    return JSON.parse(data.content[0].text.trim());
  } catch {
    return { customer_name: null, product_type: "unknown", product_spec: null, quantity: null, confidence: "low", notes: "파싱 실패: " + data.content[0].text };
  }
}

// ─── 솔라피 HMAC 서명 ────────────────────────────────────────
async function generateSolapiSignature(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(date + salt));
  const hashHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
  return { date, salt, signature: hashHex };
}

// ─── 알림톡 발송 공통 함수 ───────────────────────────────────
async function sendAlimtalk(
  to: string,
  templateCode: string,
  variables: Record<string, string>
): Promise<boolean> {
  const apiKey    = Deno.env.get("SOLAPI_API_KEY")!;
  const apiSecret = Deno.env.get("SOLAPI_API_SECRET")!;
  const templateId = TEMPLATES[templateCode];
  if (!templateId) { console.error("템플릿 ID 없음:", templateCode); return false; }

  const { date, salt, signature } = await generateSolapiSignature(apiKey, apiSecret);
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `HMAC-SHA256 ApiKey=${apiKey}, Date=${date}, Salt=${salt}, Signature=${signature}`,
    },
    body: JSON.stringify({
      message: {
        to,
        from: Deno.env.get("SOLAPI_SENDER_NUMBER"),
        kakaoOptions: {
          pfId:       Deno.env.get("SOLAPI_PF_ID"),
          templateId,
          variables:  { ...variables, "#{접수시간}": now, "#{전달시간}": now, "#{납품시간}": now, "#{반납시간}": now, "#{발행시간}": now, "#{수신시간}": now, "#{입금시간}": now, "#{송금시간}": now },
          disableSms: true,
        },
      },
    }),
  });

  if (!res.ok) { console.error("알림톡 오류:", await res.text()); return false; }
  console.log("알림톡 성공:", templateCode, to);
  return true;
}

// ─── 메인 핸들러 ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json();

    // ── 단계 변경 이벤트 (웹 페이지에서 직접 호출) ──
    if (body?.event === "status_change") {
      const { orderId, status, customerName, productSpec, quantity, amount } = body;
      const jinheungPhone = Deno.env.get("JINHEUNG_PHONE")!;
      const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

      const templateMap: Record<string, string> = {
        forwarded:      "order_forwarded",
        delivered:      "order_delivered",
        wheel_returned: "order_wheel_returned",
        invoiced:       "order_invoiced",
        billed_in:      "order_billed_in",
        payment_in:     "order_payment_in",
        payment_out:    "order_payment_out",
      };

      const templateCode = templateMap[status];
      if (templateCode) {
        const variables: Record<string, string> = {
          "#{고객사}":   customerName || "확인필요",
          "#{품목}":     productSpec  || "확인필요",
          "#{수량}":     quantity     || "-",
          "#{청구금액}": amount ? `${Number(amount).toLocaleString("ko-KR")}원` : "-",
          "#{입금금액}": amount ? `${Number(amount).toLocaleString("ko-KR")}원` : "-",
          "#{송금금액}": amount ? `${Number(amount).toLocaleString("ko-KR")}원` : "-",
        };
        await sendAlimtalk(jinheungPhone, templateCode, variables);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }

    // ── 카카오 오픈빌더 웹훅 (신규 주문 인입) ──
    const rawMessage = body?.userRequest?.utterance || "";
    if (!rawMessage) return new Response(JSON.stringify({ ok: false, error: "빈 메시지" }), { status: 400, headers: { "Content-Type": "application/json" } });

    // 1. Claude 파싱
    const parsed = await parseOrderWithClaude(rawMessage);

    // 2. tb_orders 저장
    const { data: orderNoData } = await supabase.rpc("next_rnf_number");
    const { data: order, error } = await supabase
      .from("tb_orders")
      .insert({
        order_no:           orderNoData as string,
        customer_name_raw: parsed.customer_name,
        inbound_channel:   "kakao",
        raw_message:       rawMessage,
        product_type:      ["tire","battery"].includes(parsed.product_type) ? parsed.product_type : null,
        product_spec:      parsed.product_spec,
        quantity:          parsed.quantity,
        parsed_confidence: parsed.confidence,
        parse_notes:       parsed.notes,
        status:            "received",
      })
      .select()
      .single();

    if (error) throw error;

    // 2.5 통합상담(consultation_cases)에 미러 등록 — 카카오로 접수된 발주도 상담 목록에서 함께 조회되도록 연결
    try {
      const { data: mirrorCase } = await supabase.from("consultation_cases").insert({
        customer_name: parsed.customer_name || "미확인",
        phone:         "",
        work_type:     parsed.product_type === "battery" ? "battery_sales" : "tire_sales",
        status:        "new",
        summary:       `${parsed.product_spec || ""}${parsed.quantity ? ` × ${parsed.quantity}개` : ""}`.trim() || "카카오 주문",
        call_datetime: new Date().toISOString(),
      }).select("id").single();
      if (mirrorCase?.id) {
        await supabase.from("tb_orders").update({ consultation_id: mirrorCase.id }).eq("id", order.id);
      }
    } catch (mirrorErr) {
      console.error("통합상담 미러 등록 실패(무시):", mirrorErr);
    }

    // 3. 알림톡 발송
    const jinheungPhone = Deno.env.get("JINHEUNG_PHONE")!;
    const templateCode  = parsed.confidence === "high" ? "order_received" : "order_confirm_needed";
    const variables: Record<string, string> = {
      "#{고객사}":   parsed.customer_name || "확인필요",
      "#{품목}":     parsed.product_spec  || "확인필요",
      "#{수량}":     parsed.quantity?.toString() || "확인필요",
      "#{요청사항}": parsed.notes || "-",
      "#{파싱내용}": `${parsed.product_spec || ""} ${parsed.quantity || ""}개`.trim(),
      "#{원문}":     rawMessage.slice(0, 50),
    };

    const alimtalkSent = await sendAlimtalk(jinheungPhone, templateCode, variables);

    if (alimtalkSent) {
      await supabase.from("tb_orders").update({
        alimtalk_sent:    true,
        alimtalk_sent_at: new Date().toISOString(),
      }).eq("id", order.id);
    }

    // 4. 오픈빌더 응답
    return new Response(
      JSON.stringify({
        version: "2.0",
        template: {
          outputs: [{
            simpleText: {
              text: `✅ 발주 등록 완료\n\n고객사: ${parsed.customer_name || "확인필요"}\n품목: ${parsed.product_spec || "확인필요"}\n수량: ${parsed.quantity || "확인필요"}\n접수번호: ${order.id.slice(-8).toUpperCase()}`,
            },
          }],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("웹훅 처리 오류:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});