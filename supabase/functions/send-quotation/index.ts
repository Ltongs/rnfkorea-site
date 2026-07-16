// supabase/functions/send-quotation/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const {
      quoteNo, quoteType, recipient,
      toList, ccList,
      totalAmount, vatAmount, grandTotal,
      htmlBody, extraMessage, installmentInfo,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "noreply@rnfkorea.co.kr";
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY가 설정되지 않았습니다.");

    const toEmails = (toList  ?? []).filter(Boolean);
    const ccEmails = (ccList  ?? []).filter(Boolean);
    if (toEmails.length === 0) throw new Error("수신 이메일이 없습니다.");

    const typeLabel: Record<string, string> = {
      battery: "배터리 견적서",
      forklift: "지게차 견적서",
      tire: "타이어 견적서",
      installment: "할부 견적서",
      purchase: "발주서",
    };
    const label = typeLabel[quoteType ?? ""] ?? "견적서";
    const fmt = (n: number) => Number(n || 0).toLocaleString("ko-KR");

    let emailHtml = htmlBody || "";

    if (quoteType === "installment" && installmentInfo) {
      const ii = installmentInfo;
      emailHtml = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:#0a192f;padding:24px 32px;">
    <table width="100%"><tr>
      <td><div style="color:#fff;font-size:18px;font-weight:bold;">RNF KOREA</div></td>
      <td style="text-align:right;">
        <div style="color:#f97316;font-size:18px;font-weight:bold;">할부 견적서</div>
        <div style="color:#94a3b8;font-size:10px">No. ${quoteNo}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    <p style="font-size:14px;color:#1e293b;margin:0 0 16px;"><strong>${recipient}</strong> 귀중,</p>
    <p style="font-size:13px;color:#374151;margin:0 0 20px;">
      안녕하세요. 주식회사 알앤에프코리아입니다.<br>
      요청하신 할부 견적서를 안내드립니다.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:6px;padding:16px 20px;margin-bottom:16px;">
      <tr><td style="font-size:11px;color:#64748b;padding:3px 0">차량/장비</td><td style="font-size:12px;text-align:right">${ii.itemName} ${ii.itemSpec}</td></tr>
      <tr><td style="font-size:11px;color:#64748b;padding:3px 0">할부원금</td><td style="font-size:12px;text-align:right">${fmt(ii.principal)}원</td></tr>
      <tr><td style="font-size:11px;color:#64748b;padding:3px 0">할부금융사</td><td style="font-size:12px;text-align:right">${ii.financeCompany}</td></tr>
      <tr><td style="font-size:11px;color:#64748b;padding:3px 0">연이율</td><td style="font-size:12px;text-align:right">${ii.annualRate}%</td></tr>
      <tr><td style="font-size:11px;color:#64748b;padding:3px 0">대출기간</td><td style="font-size:12px;text-align:right">${ii.totalMonths}개월</td></tr>
      <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding-top:8px;"></td></tr>
      <tr>
        <td style="font-size:13px;font-weight:bold;color:#0a192f;padding:4px 0">월 납입액</td>
        <td style="font-size:18px;font-weight:bold;color:#f97316;text-align:right">${fmt(ii.payment)}원</td>
      </tr>
    </table>
    ${extraMessage ? `<p style="font-size:12px;color:#374151;white-space:pre-wrap;margin:0 0 16px;">${extraMessage}</p>` : ""}
    <p style="font-size:11px;color:#64748b;margin:0">
      ※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다.
    </p>
  </td></tr>
  <tr><td style="background:#0a192f;padding:16px 32px;text-align:center;">
    <div style="color:#fff;font-size:11px;font-weight:bold;">주식회사 알앤에프코리아</div>
    <div style="color:#94a3b8;font-size:10px;margin-top:4px">TEL: 1551-1873 | rnfkorea.co.kr</div>
  </td></tr>
</table>
</body></html>`;
    } else if (!emailHtml) {
      emailHtml = `<html><body style="font-family:Arial;max-width:600px;margin:auto;padding:20px;">
        <h2 style="color:#0a192f">${label} — ${quoteNo}</h2>
        <p><strong>${recipient}</strong> 귀중</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;background:#f1f5f9">공급가액</td><td style="padding:8px;text-align:right">${fmt(totalAmount)}원</td></tr>
          <tr><td style="padding:8px;background:#f1f5f9">부가세</td><td style="padding:8px;text-align:right">${fmt(vatAmount)}원</td></tr>
          <tr>
            <td style="padding:8px;background:#0a192f;color:#fff;font-weight:bold">총액</td>
            <td style="padding:8px;text-align:right;background:#0a192f;color:#f97316;font-weight:bold;font-size:16px">${fmt(grandTotal)}원</td>
          </tr>
        </table>
        ${extraMessage ? `<p>${extraMessage}</p>` : ""}
        <p style="color:#94a3b8;font-size:11px">주식회사 알앤에프코리아 | 1551-1873</p>
      </body></html>`;
    }

    const payload: Record<string, unknown> = {
      from:    `주식회사 알앤에프코리아 <${FROM_EMAIL}>`,
      to:      toEmails,
      subject: `[RNF KOREA] ${label} ${quoteNo} — ${recipient} 귀중`,
      html:    emailHtml,
    };
    if (ccEmails.length > 0) payload.cc = ccEmails;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, emailId: data.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});