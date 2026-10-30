// supabase/functions/truck-route/index.ts
//
// 화물운송 운행일지(pages/secretary/TruckLogTab.tsx)용 장소검색·거리계산 — admin·ltongs7·everyasset 전용
//   { action: "search", query }            → 상호/주소로 장소 후보 (카카오 로컬: 키워드 + 주소 검색)
//   { action: "route", origin, destination } → 도로 기준 거리(km)·소요시간 (카카오모빌리티 길찾기)
//     길찾기 호출이 실패하면 직선거리 × 1.25 로 근사값을 돌려준다 (approx: true)
//
// 필요한 Supabase Secrets: KAKAO_REST_API_KEY (카카오 로그인/알림톡 함수와 공용)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const KAKAO_REST_API_KEY = Deno.env.get("KAKAO_REST_API_KEY") ?? "";
const ALLOWED_EMAILS     = ["admin@rnfkorea.co.kr", "ltongs7@gmail.com", "everyasset.fc@gmail.com"];
const ROAD_FACTOR        = 1.25;   // 길찾기 실패 시 직선거리 → 도로거리 근사 계수

type Point = { x: number; y: number };   // x = 경도, y = 위도
type Place = { name: string; address: string; x: number; y: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function kakao(url: string) {
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } });
  if (!res.ok) throw new Error(`kakao ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function searchPlaces(query: string): Promise<Place[]> {
  const q = encodeURIComponent(query);
  const [kw, addr] = await Promise.all([
    // 키워드 검색 실패(예: 카카오맵 사용 설정 꺼짐)는 화면에 알려야 하므로 그대로 throw
    kakao(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${q}&size=7`),
    kakao(`https://dapi.kakao.com/v2/local/search/address.json?query=${q}&size=3`).catch(() => ({ documents: [] })),
  ]);
  const places: Place[] = [
    ...(addr.documents ?? []).map((d: any) => ({
      name: d.road_address?.building_name || d.address_name,
      address: d.road_address?.address_name || d.address_name,
      x: Number(d.x), y: Number(d.y),
    })),
    ...(kw.documents ?? []).map((d: any) => ({
      name: d.place_name,
      address: d.road_address_name || d.address_name,
      x: Number(d.x), y: Number(d.y),
    })),
  ];
  return places.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).slice(0, 8);
}

function straightKm(a: Point, b: Point) {
  const R = 6371, rad = (d: number) => d * Math.PI / 180;
  const dLat = rad(b.y - a.y), dLng = rad(b.x - a.x);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.y)) * Math.cos(rad(b.y)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function route(origin: Point, destination: Point) {
  try {
    const d = await kakao(
      `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.x},${origin.y}&destination=${destination.x},${destination.y}&priority=RECOMMEND`,
    );
    const r = d.routes?.[0];
    if (r?.result_code === 0 && r.summary) {
      return { km: Math.round(r.summary.distance / 100) / 10, minutes: Math.round(r.summary.duration / 60), approx: false };
    }
  } catch (_) { /* 아래 근사값으로 */ }
  return { km: Math.round(straightKm(origin, destination) * ROAD_FACTOR * 10) / 10, minutes: null, approx: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST만 지원합니다." }, 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await supabase.auth.getUser(token);
  if (!ALLOWED_EMAILS.includes(userData?.user?.email ?? "")) return json({ error: "권한이 없습니다." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "잘못된 요청입니다." }, 400); }

  try {
    if (body.action === "search") {
      const query = String(body.query ?? "").trim();
      if (query.length < 2) return json({ places: [] });
      return json({ places: await searchPlaces(query) });
    }
    if (body.action === "route") {
      const o = body.origin, d = body.destination;
      if (![o?.x, o?.y, d?.x, d?.y].every((v) => Number.isFinite(Number(v)))) return json({ error: "좌표가 없습니다." }, 400);
      return json(await route({ x: Number(o.x), y: Number(o.y) }, { x: Number(d.x), y: Number(d.y) }));
    }
    return json({ error: "알 수 없는 action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
});
