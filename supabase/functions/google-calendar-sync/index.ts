// supabase/functions/google-calendar-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

// deno-lint-ignore no-explicit-any
async function getValidToken(db: any, userId: string) {
  const { data } = await db.from("google_calendar_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", userId).single() as {
      data: { access_token: string; refresh_token: string; expires_at: string } | null;
    };

  if (!data) throw new Error("구글 캘린더 미연동");

  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) return data.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: data.refresh_token, grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (tokens.error) throw new Error("토큰 갱신 실패: " + tokens.error);

  await db.from("google_calendar_tokens").update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq("user_id", userId);

  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(sbUrl, sbKey);

    const { action, user_id, event, event_id, year, month } = await req.json();
    const token = await getValidToken(db, user_id);
    const calId = "primary";
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;
    const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

    // ── 이벤트 목록 조회
    if (action === "list") {
      const yr = year ?? new Date().getFullYear();
      const mo = month ?? new Date().getMonth();
      const timeMin = new Date(yr, mo, 1).toISOString();
      const timeMax = new Date(yr, mo + 1, 0, 23, 59, 59).toISOString();
      const res = await fetch(
        `${baseUrl}?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
        { headers }
      );
      const data = await res.json();
      return new Response(JSON.stringify({ events: data.items ?? [] }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 이벤트 생성
    if (action === "create") {
      const body = {
        summary: event.title,
        description: event.description ?? "",
        start: event.start_time
          ? { dateTime: `${event.schedule_date}T${event.start_time}:00+09:00`, timeZone: "Asia/Seoul" }
          : { date: event.schedule_date },
        end: event.end_time
          ? { dateTime: `${event.schedule_date}T${event.end_time}:00+09:00`, timeZone: "Asia/Seoul" }
          : event.start_time
          ? { dateTime: `${event.schedule_date}T${event.start_time}:00+09:00`, timeZone: "Asia/Seoul" }
          : { date: event.schedule_date },
        location: event.location ?? "",
      };
      const res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(body) });
      const data = await res.json();

      if (!res.ok || data.error) {
        return new Response(JSON.stringify({ error: data.error?.message ?? "일정 생성 실패", raw: data }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // secretary_schedules에 gcal_event_id 저장 (AI비서 일정 동기화용)
      if (event.schedule_id && data.id) {
        await db.from("secretary_schedules").update({ gcal_event_id: data.id }).eq("id", event.schedule_id);
      }

      // 생성된 이벤트 전체를 반환 (프론트에서 즉시 상태 반영용)
      return new Response(JSON.stringify({ ok: true, google_event_id: data.id, event: data }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 이벤트 수정
    if (action === "update" && event_id) {
      const body = {
        summary: event.title,
        description: event.description ?? "",
        start: event.start_time
          ? { dateTime: `${event.schedule_date}T${event.start_time}:00+09:00`, timeZone: "Asia/Seoul" }
          : { date: event.schedule_date },
        end: event.end_time
          ? { dateTime: `${event.schedule_date}T${event.end_time}:00+09:00`, timeZone: "Asia/Seoul" }
          : { date: event.schedule_date },
      };
      const res = await fetch(`${baseUrl}/${event_id}`, { method: "PUT", headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || data.error) {
        return new Response(JSON.stringify({ error: data.error?.message ?? "일정 수정 실패", raw: data }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 이벤트 삭제
    if (action === "delete" && event_id) {
      const res = await fetch(`${baseUrl}/${event_id}`, { method: "DELETE", headers });
      if (!res.ok && res.status !== 410) {
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify({ error: data.error?.message ?? "일정 삭제 실패", raw: data }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════════════════════════
    // Google Tasks API (할일 목록) — 완료 체크 시 목록에서 사라지도록
    // ════════════════════════════════════════════════════════════
    const TASKS_BASE = "https://tasks.googleapis.com/tasks/v1";
    const TASKLIST_ID = "@default"; // 기본 할 일 목록 사용

    // ── 할일 생성
    if (action === "create_task") {
      const body: Record<string, unknown> = {
        title: event.title,
        notes: event.description ?? "",
      };
      // due는 RFC3339 (날짜만 있어도 무방, 시간은 00:00:00Z로 처리됨)
      if (event.schedule_date) {
        body.due = `${event.schedule_date}T00:00:00.000Z`;
      }
      const res = await fetch(`${TASKS_BASE}/lists/${TASKLIST_ID}/tasks`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        return new Response(JSON.stringify({ error: data.error.message ?? "할일 생성 실패", raw: data }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // 출처 테이블에 gcal_task_id 저장 (source_table: secretary_schedules / secretary_todos / consultation_cases / hyundaicm_tasks)
      if (event.source_table && event.source_id && data.id) {
        await db.from(event.source_table).update({ gcal_task_id: data.id }).eq("id", event.source_id);
      }

      return new Response(JSON.stringify({ ok: true, task: data }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 할일 완료 처리 (목록에서 사라지도록 status=completed)
    if (action === "complete_task" && event_id) {
      const res = await fetch(`${TASKS_BASE}/lists/${TASKLIST_ID}/tasks/${event_id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status: "completed" }),
      });
      const data = await res.json();
      if (data.error) {
        return new Response(JSON.stringify({ error: data.error.message ?? "할일 완료 처리 실패", raw: data }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, task: data }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 할일 마감일 수정 (다음 일정으로 변경)
    if (action === "update_task" && event_id) {
      const body: Record<string, unknown> = {};
      if (event?.title) body.title = event.title;
      if (event?.description != null) body.notes = event.description;
      if (event?.schedule_date) body.due = `${event.schedule_date}T00:00:00.000Z`;
      const res = await fetch(`${TASKS_BASE}/lists/${TASKLIST_ID}/tasks/${event_id}`, {
        method: "PATCH", headers, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        return new Response(JSON.stringify({ error: data.error.message ?? "할일 수정 실패", raw: data }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, task: data }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 할일 삭제
    if (action === "delete_task" && event_id) {
      await fetch(`${TASKS_BASE}/lists/${TASKLIST_ID}/tasks/${event_id}`, { method: "DELETE", headers });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 할일 목록 조회 (미완료만, 화면 표시용)
    if (action === "list_tasks") {
      const res = await fetch(
        `${TASKS_BASE}/lists/${TASKLIST_ID}/tasks?showCompleted=false&showHidden=false&maxResults=100`,
        { headers }
      );
      const data = await res.json();
      return new Response(JSON.stringify({ tasks: data.items ?? [] }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});