import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Claude API로 주문 텍스트 파싱
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
      messages: [
        {
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
        },
      ],
    }),
  });

  // 응답 상태 확인
  if (!response.ok) {
    const errText = await response.text();
    console.error("Claude API 오류:", errText);
    return {
      customer_name: null,
      product_type: "unknown",
      product_spec: null,
      quantity: null,
      confidence: "low",
      notes: "Claude API 오류: " + errText,
    };
  }

  const data = await response.json();
  console.log("Claude 응답:", JSON.stringify(data));

  // content 배열 확인
  if (!data.content || !data.content[0] || !data.content[0].text) {
    console.error("Claude 응답 형식 오류:", JSON.stringify(data));
    return {
      customer_name: null,
      product_type: "unknown",
      product_spec: null,
      quantity: null,
      confidence: "low",
      notes: "Claude 응답 형식 오류: " + JSON.stringify(data),
    };
  }

  const text = data.content[0].text.trim();

  try {
    return JSON.parse(text);
  } catch {
    return {
      customer_name: null,
      product_type: "unknown",
      product_spec: null,
      quantity: null,
      confidence: "low",
      notes: "파싱 실패: " + text,
    };
  }
}

// 솔라피 HMAC 서명 생성
async function generateSolapiSignature(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const message = date + salt;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return { date, salt, signature: hashHex };
}

// 박진수 대표에게 알림톡 발송
async function sendAlimtalkToJinheung(
  customerName: string,
  spec: string,
  quantity: string,
  orderId: string
) {
  const apiKey = Deno.env.get("SOLAPI_API_KEY")!;
  const apiSecret = Deno.env.get("SOLAPI_API_SECRET")!;
  const { date, salt, signature } = await generateSolapiSignature(apiKey, apiSecret);

  const response = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `HMAC-SHA256 ApiKey=${apiKey}, Date=${date}, Salt=${salt}, Signature=${signature}`,
    },
    body: JSON.stringify({
      message: {
        to: Deno.env.get("JINHEUNG_PHONE"),
        from: Deno.env.get("SOLAPI_SENDER_NUMBER"),
        kakaoOptions: {
          pfId: Deno.env.get("SOLAPI_PF_ID"),
          templateId: Deno.env.get("SOLAPI_TEMPLATE_ID_ORDER"),
          variables: {
            "#{고객사}": customerName || "확인필요",
            "#{규격}": spec || "확인필요",
            "#{수량}": quantity || "확인필요",
            "#{주문번호}": orderId.slice(-8).toUpperCase(),
          },
        },
      },
    }),
  });

  return response.ok;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();

    // 카카오 오픈빌더 웹훅 페이로드 파싱
    const rawMessage = body?.userRequest?.utterance || "";

    if (!rawMessage) {
      return new Response(
        JSON.stringify({ ok: false, error: "빈 메시지" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Claude로 파싱
    const parsed = await parseOrderWithClaude(rawMessage);

    // 2. tb_orders 저장
    const { data: order, error } = await supabase
      .from("tb_orders")
      .insert({
        customer_name_raw: parsed.customer_name,
        inbound_channel: "kakao",
        raw_message: rawMessage,
        product_type: parsed.product_type,
        product_spec: parsed.product_spec,
        quantity: parsed.quantity,
        parsed_confidence: parsed.confidence,
        parse_notes: parsed.notes,
        status: "forwarded",
      })
      .select()
      .single();

    if (error) throw error;

    // 3. 박진수 대표에게 알림톡 발송 (템플릿 승인 후 활성화)
    let alimtalkSent = false;
    if (
      Deno.env.get("SOLAPI_PF_ID") &&
      Deno.env.get("SOLAPI_TEMPLATE_ID_ORDER") &&
      Deno.env.get("JINHEUNG_PHONE")
    ) {
      alimtalkSent = await sendAlimtalkToJinheung(
        parsed.customer_name || "",
        parsed.product_spec || "",
        parsed.quantity?.toString() || "",
        order.id
      );

      if (alimtalkSent) {
        await supabase
          .from("tb_orders")
          .update({
            alimtalk_sent: true,
            alimtalk_sent_at: new Date().toISOString(),
            forwarded_at: new Date().toISOString(),
          })
          .eq("id", order.id);
      }
    }

    // 카카오 오픈빌더 응답
    return new Response(
      JSON.stringify({
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: {
                text: `✅ 발주 등록 완료\n\n고객사: ${parsed.customer_name || "확인필요"}\n품목: ${parsed.product_spec || "확인필요"}\n수량: ${parsed.quantity || "확인필요"}\n접수번호: ${order.id.slice(-8).toUpperCase()}`,
              },
            },
          ],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("웹훅 처리 오류:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});