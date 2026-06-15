// supabase/functions/parse-tax-invoice/index.ts
//
// 세금계산서(또는 계산서) 캡처 이미지를 받아 Claude Vision으로 핵심 정보를 추출합니다.
// 매출관리 페이지의 "계산서 업로드" 버튼에서 호출됩니다.
//
// 배포:
//   supabase functions deploy parse-tax-invoice
//
// 환경변수 (Supabase 프로젝트 Edge Function Secrets에 설정):
//   ANTHROPIC_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

function buildExtractPrompt(direction: "sales" | "purchase") {
  // sales: 우리가 발행 → 거래상대방 = 공급받는자
  // purchase: 우리가 수취 → 거래상대방 = 공급자(매입처)
  const counterpartLabel = direction === "purchase" ? "공급자(매입처)" : "공급받는자(거래처)";

  return `이 이미지는 전자(세금)계산서 캡처본입니다. 아래 항목을 정확히 읽어 JSON 형식으로만 응답하세요.
다른 설명, 인사말, 코드블록 표시(\`\`\`) 없이 순수 JSON 객체만 출력하세요.

추출할 항목:
- invoice_no: 승인번호 또는 발급번호 (보통 "YYYYMMDD-XXXXXXXX-XXXXXXXXXXXXXXX" 형태의 숫자/하이픈 조합). 없으면 null.
- sale_date: 작성일자 (YYYY-MM-DD 형식). 연도가 2자리이면 20XX로 보정.
- customer_name: ${counterpartLabel} 상호명
- business_no: ${counterpartLabel} 사업자등록번호 (숫자만, 하이픈/공백 제거)
- supply_amount: 공급가액 합계 (숫자만, 콤마 제거)
- tax_amount: 세액 합계 (숫자만, 없으면 0)
- total_amount: 합계금액 (숫자만)
- items: 품목명과 규격을 모두 합쳐 ' / '로 구분한 문자열 (여러 품목이면 ', '로 나열)

값을 찾을 수 없는 항목은 null로 표기하세요.

응답 예시:
{"invoice_no":"20260613-12345678-87654321","sale_date":"2026-06-13","customer_name":"(주)예시상사","business_no":"1234567890","supply_amount":1000000,"tax_amount":100000,"total_amount":1100000,"items":"타이어 / 815-15 (4개)"}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되어 있지 않습니다.");
    }

    const { image_base64, media_type, direction } = await req.json();

    if (!image_base64) {
      throw new Error("image_base64가 필요합니다.");
    }

    const safeDirection: "sales" | "purchase" = direction === "purchase" ? "purchase" : "sales";

    const allowedMediaTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const safeMediaType = allowedMediaTypes.includes(media_type) ? media_type : "image/png";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: safeMediaType,
                  data: image_base64,
                },
              },
              {
                type: "text",
                text: buildExtractPrompt(safeDirection),
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API 오류 (${response.status}): ${errText}`);
    }

    const data = await response.json();

    const textBlock = (data.content || []).find((c: any) => c.type === "text");
    const rawText: string = textBlock?.text || "{}";

    // 코드블록 표시나 잡설이 섞여 와도 JSON 부분만 추출
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("AI 응답을 JSON으로 해석할 수 없습니다: " + rawText);
    }

    // 숫자 필드 정리 (문자열로 올 경우 콤마 제거 후 숫자화)
    const toNumber = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === "number") return v;
      const n = Number(String(v).replace(/[^0-9.-]/g, ""));
      return Number.isNaN(n) ? null : n;
    };

    const result = {
      invoice_no: parsed.invoice_no ? String(parsed.invoice_no).trim() : null,
      sale_date: parsed.sale_date || null,
      customer_name: parsed.customer_name || null,
      business_no: parsed.business_no ? String(parsed.business_no).replace(/[^0-9]/g, "") : null,
      supply_amount: toNumber(parsed.supply_amount),
      tax_amount: toNumber(parsed.tax_amount),
      total_amount: toNumber(parsed.total_amount),
      items: parsed.items || null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});