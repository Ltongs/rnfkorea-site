// supabase/functions/gmail-report/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  console.log("token refresh result:", JSON.stringify(data));
  return data.access_token ?? null;
}

async function fetchGmailMessages(accessToken: string, afterTs: number, beforeTs: number) {
  const q = `in:inbox after:${Math.floor(afterTs/1000)} before:${Math.floor(beforeTs/1000)} -category:promotions -category:social`;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  console.log("gmail list result:", JSON.stringify(listData).slice(0, 300));
  if (!listData.messages) return [];

  const details = await Promise.all(
    listData.messages.map((m: { id: string }) =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).then(r => r.json())
    )
  );

  return details.map((d: any) => {
    const headers: Record<string, string> = {};
    (d.payload?.headers ?? []).forEach((h: any) => { headers[h.name] = h.value; });
    return {
      subject: headers["Subject"] ?? "(제목없음)",
      from: headers["From"] ?? "",
      date: headers["Date"] ?? "",
      snippet: d.snippet ?? "",
    };
  });
}

async function analyzeWithClaude(emails: any[], reportDate: string): Promise<string> {
  const emailList = emails.map((e, i) =>
    `[${i + 1}] 발신: ${e.from}\n제목: ${e.subject}\n날짜: ${e.date}\n내용 미리보기: ${e.snippet}`
  ).join("\n\n");

  const prompt = `다음은 ${reportDate} 수신된 이메일 목록입니다. 상업성(광고·뉴스레터·프로모션) 이메일은 이미 제외된 상태입니다.\n\n${emailList}\n\n아래 형식으로 업무 리포트를 작성해주세요:\n\n## 🔴 즉시 처리 필요\n(마감·긴급·응답 필요 메일만. 없으면 "없음"으로)\n\n## 🟡 확인 및 보관\n(증권·약관·공문 등 보관 필요 메일)\n\n## 🟠 기술·시스템 대응\n(서비스 알림·만료 경고 등 조치 필요 메일)\n\n## 🔵 참고\n(단순 알림·자동발송·FYI 성격 메일 요약)\n\n각 항목은 발신처, 내용 요약, 필요한 액션을 간결하게 작성해주세요.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  console.log("claude result:", JSON.stringify(data).slice(0, 300));
  if (!data.content?.[0]?.text) {
    return `분석 실패: ${JSON.stringify(data)}`;
  }
  return data.content[0].text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(sbUrl, sbKey);

  try {
    const { data: tokens, error: tokenErr } = await db
      .from("google_calendar_tokens")
      .select("user_id, refresh_token, access_token, expires_at");

    if (tokenErr || !tokens?.length) {
      console.error("token error:", tokenErr);
      return new Response(JSON.stringify({ ok: false, msg: "토큰 없음" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayKST = new Date(now.getTime() + kstOffset);
    todayKST.setUTCHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayKST.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd   = new Date(todayKST.getTime() - 1);
    const reportDate = yesterdayStart.toISOString().slice(0, 10);
    console.log("report date:", reportDate);

    const { data: existing } = await db
      .from("email_reports")
      .select("id")
      .eq("report_date", reportDate)
      .limit(1);
    if (existing?.length) {
      return new Response(JSON.stringify({ ok: true, msg: "이미 리포트 존재", date: reportDate }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const tokenRow = tokens[0];
    let accessToken = tokenRow.access_token;

    const expiresAt = new Date(tokenRow.expires_at).getTime();
    console.log("token expires:", tokenRow.expires_at, "now:", new Date().toISOString());
    if (Date.now() > expiresAt - 60 * 1000) {
      console.log("refreshing token...");
      const newToken = await refreshAccessToken(tokenRow.refresh_token);
      if (newToken) {
        accessToken = newToken;
        await db.from("google_calendar_tokens").update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        }).eq("user_id", tokenRow.user_id);
      } else {
        console.error("token refresh failed");
      }
    }

    const emails = await fetchGmailMessages(accessToken, yesterdayStart.getTime(), yesterdayEnd.getTime());
    console.log("emails count:", emails.length);

    if (!emails.length) {
      await db.from("email_reports").insert({
        report_date: reportDate,
        title: `📭 ${reportDate} 이메일 리포트 — 수신 없음`,
        content: `${reportDate} 업무 관련 수신 이메일이 없습니다.`,
        source: "gmail-auto",
        is_read: false,
      });
      return new Response(JSON.stringify({ ok: true, msg: "메일 없음", date: reportDate }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const reportContent = await analyzeWithClaude(emails, reportDate);

    const { error: insertErr } = await db.from("email_reports").insert({
      report_date: reportDate,
      title: `📧 ${reportDate} 이메일 리포트 — ${emails.length}건`,
      content: reportContent,
      source: "gmail-auto",
      is_read: false,
    });

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ ok: true, date: reportDate, count: emails.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("gmail-report error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});