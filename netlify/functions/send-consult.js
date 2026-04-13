exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: false,
        message: "Method Not Allowed",
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const project = String(body.project || "").trim();
    const financeType = String(body.financeType || "").trim();
    const segment = String(body.segment || "").trim();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const memo = String(body.memo || "").trim();

    const hasContact = phone.length >= 7 || email.length >= 5;

    if (!hasContact) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ok: false,
          message: "연락처 또는 이메일을 입력해주세요.",
        }),
      };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const consultToEmail =
      process.env.CONSULT_TO_EMAIL || "admin@rnfkorea.co.kr";
    const consultFromEmail =
      process.env.CONSULT_FROM_EMAIL || "onboarding@resend.dev";

    if (!resendApiKey) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ok: false,
          message: "서버 환경변수(RESEND_API_KEY)가 설정되지 않았습니다.",
        }),
      };
    }

    const now = new Date();
    const submittedAt = now.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
    });

    const subject = `[RNF 상담접수] ${project || "문의"} / ${
      name || phone || email || "익명 문의"
    }`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #111827;">
        <h2 style="margin:0 0 16px;">RNF Korea 상담 접수</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; width:180px; background:#f9fafb;"><strong>접수일시</strong></td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb;">${submittedAt}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; background:#f9fafb;"><strong>프로젝트</strong></td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(
              project || "-"
            )}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; background:#f9fafb;"><strong>금융유형</strong></td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(
              financeType || "-"
            )}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; background:#f9fafb;"><strong>세그먼트</strong></td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(
              segment || "-"
            )}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; background:#f9fafb;"><strong>이름</strong></td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(
              name || "-"
            )}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; background:#f9fafb;"><strong>연락처</strong></td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(
              phone || "-"
            )}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; background:#f9fafb;"><strong>이메일</strong></td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(
              email || "-"
            )}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; background:#f9fafb;"><strong>요청사항</strong></td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(
              memo || "-"
            )}</td>
          </tr>
        </table>
      </div>
    `;

    const text = [
      "RNF Korea 상담 접수",
      `접수일시: ${submittedAt}`,
      `프로젝트: ${project || "-"}`,
      `금융유형: ${financeType || "-"}`,
      `세그먼트: ${segment || "-"}`,
      `이름: ${name || "-"}`,
      `연락처: ${phone || "-"}`,
      `이메일: ${email || "-"}`,
      `요청사항: ${memo || "-"}`,
    ].join("\n");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: consultFromEmail,
        to: [consultToEmail],
        subject,
        html,
        text,
        reply_to: email || undefined,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("[send-consult][resend-error]", resendData);

      return {
        statusCode: 502,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ok: false,
          message: "메일 발송 서비스 오류가 발생했습니다.",
          detail: resendData,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        message: "상담이 정상 접수되었습니다.",
        emailId: resendData?.id || null,
      }),
    };
  } catch (error) {
    console.error("[send-consult][unexpected-error]", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: false,
        message: "서버 오류가 발생했습니다.",
      }),
    };
  }
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}