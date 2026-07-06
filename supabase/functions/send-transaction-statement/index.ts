// supabase/functions/send-transaction-statement/index.ts
//
// 거래명세서 이메일 발송 Edge Function
// QuotationPage.tsx가 'send-quotation'을 호출하는 것과 동일한 방식으로,
// 클라이언트(TransactionStatementPage.tsx)에서 SheetJS로 조립한 xlsx를
// base64로 받아 Resend로 첨부 발송만 담당합니다. (템플릿/스토리지 불필요)
//
// 필요한 Supabase Secrets (이미 다른 함수들이 쓰는 것과 동일한 이름 — 그대로 재사용됨):
//   RESEND_API_KEY   ✅ 이미 설정되어 있음 (secrets list 확인됨)
//   FROM_EMAIL       ✅ 이미 설정되어 있음

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM_EMAIL       = Deno.env.get("FROM_EMAIL") ?? "no-reply@rnfkorea.co.kr";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  docNo: string;
  recipient: string;
  email: string;
  supplyAmount: number;
  taxAmount: number;
  grandTotal: number;
  xlsxBase64: string;
  fileName: string;
  extraMessage?: string;
};

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonError("POST만 지원합니다.", 405);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const { docNo, recipient, email, supplyAmount, taxAmount, grandTotal, xlsxBase64, fileName, extraMessage } = body;

  if (!recipient?.trim())    return jsonError("거래처 상호(recipient)가 필요합니다.");
  if (!email?.trim())        return jsonError("발송 이메일(email)이 필요합니다.");
  if (!xlsxBase64?.trim())   return jsonError("첨부할 엑셀 데이터(xlsxBase64)가 없습니다.");
  if (!RESEND_API_KEY)       return jsonError("RESEND_API_KEY가 설정되어 있지 않습니다.", 500);

  const today = new Date().toISOString().slice(0, 10);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `주식회사 알앤에프코리아 <${FROM_EMAIL}>`,
      to: [email],
      cc: ["admin@rnfkorea.co.kr"],
      subject: `[알앤에프코리아] 거래명세서 - ${recipient} (${today})`,
      html:
        `<p>${recipient} 담당자님,</p>` +
        `<p>거래명세서를 첨부해드립니다. 확인 부탁드립니다.</p>` +
        (extraMessage?.trim() ? `<p style="white-space:pre-wrap;">${extraMessage.trim()}</p>` : '') +
        `<p>공급가액: ${supplyAmount.toLocaleString()}원 / 세액: ${taxAmount.toLocaleString()}원 / ` +
        `청구 합계: ${grandTotal.toLocaleString()}원</p>` +
        `<p>문서번호: ${docNo}</p>` +
        `<p>감사합니다.<br/>주식회사 알앤에프코리아</p>`,
      attachments: [{ filename: fileName || `거래명세서_${recipient}.xlsx`, content: xlsxBase64 }],
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    return jsonError(`이메일 발송 실패: ${errText}`, 502);
  }

  // 발송 성공 로그 보강 (프론트에서 이미 tb_transaction_statements에 insert하지만,
  // 혹시 프론트 insert가 실패해도 발송 자체는 여기서 sent_at을 남겨 이력이 비지 않도록 함)
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await supabase
      .from("tb_transaction_statements")
      .update({ sent_at: new Date().toISOString() })
      .eq("doc_no", docNo);
  } catch (e) {
    console.error("sent_at 업데이트 실패:", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});