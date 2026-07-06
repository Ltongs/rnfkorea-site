// supabase/functions/send-quotation/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "noreply@rnfkorea.co.kr";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const {
      quoteNo, quoteType, recipient, email,
      totalAmount, vatAmount, grandTotal,
      xlsxBase64, fileName, extraMessage,
    } = await req.json();

    const typeLabel = quoteType === "forklift" ? "지게차" : "배터리";
    const fmt = (n: number) => Number(n).toLocaleString("ko-KR");

    const htmlBody = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <tr><td style="background:#0a192f;padding:28px 32px;">
    <table width="100%"><tr>
      <td><div style="color:#fff;font-size:20px;font-weight:bold;">RNF KOREA</div>
          <div style="color:#94a3b8;font-size:11px;margin-top:3px;">INDUSTRIAL ENERGY &amp; MOBILITY SOLUTION</div></td>
      <td style="text-align:right;"><div style="color:#f97316;font-size:20px;font-weight:bold;">${typeLabel} 견적서</div>
          <div style="color:#94a3b8;font-size:11px;margin-top:3px;">No. ${quoteNo}</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="font-size:15px;color:#1e293b;margin:0 0 20px;"><strong>${recipient}</strong> 귀중,</p>
    <p style="font-size:13px;color:#374151;margin:0 0 24px;">안녕하세요. 주식회사 알앤에프코리아입니다.<br>요청하신 ${typeLabel} 견적서를 첨부 파일로 발송드립니다.</p>
    ${extraMessage?.trim() ? `<p style="font-size:13px;color:#374151;white-space:pre-wrap;margin:0 0 24px;">${extraMessage.trim()}</p>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:6px;padding:16px 20px;">
      <tr><td style="font-size:11px;color:#64748b;padding:3px 0;">견적번호</td><td style="font-size:12px;color:#1e293b;text-align:right;font-weight:bold;">${quoteNo}</td></tr>
      <tr><td style="font-size:11px;color:#64748b;padding:3px 0;">공급가액</td><td style="font-size:12px;color:#1e293b;text-align:right;">${fmt(totalAmount)}원</td></tr>
      <tr><td style="font-size:11px;color:#64748b;padding:3px 0;">부가세(10%)</td><td style="font-size:12px;color:#1e293b;text-align:right;">${fmt(vatAmount)}원</td></tr>
      <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px;"></td></tr>
      <tr><td style="font-size:13px;font-weight:bold;color:#0a192f;padding:4px 0;">총액 (VAT 포함)</td>
          <td style="font-size:16px;font-weight:bold;color:#f97316;text-align:right;">${fmt(grandTotal)}원</td></tr>
    </table>
    <p style="font-size:12px;color:#64748b;margin:20px 0 0;">궁금하신 사항은 언제든지 연락 주세요.</p>
  </td></tr>
  <tr><td style="background:#0a192f;padding:20px 32px;text-align:center;">
    <div style="color:#fff;font-size:12px;font-weight:bold;margin-bottom:6px;">주식회사 알앤에프코리아</div>
    <div style="color:#94a3b8;font-size:11px;">TEL: 1551-1873  |  rnfkorea.co.kr</div>
  </td></tr>
</table>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    `주식회사 알앤에프코리아 <${FROM_EMAIL}>`,
        to:      [email],
        cc:      ["admin@rnfkorea.co.kr"],
        subject: `[RNF KOREA] ${typeLabel} 견적서 ${quoteNo} — ${recipient} 귀중`,
        html:    htmlBody,
        attachments: [{
          filename: fileName,
          content:  xlsxBase64,
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Resend 오류");

    return new Response(JSON.stringify({ success: true, emailId: data.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});