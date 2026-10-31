// pages/secretary/TruckLogTab.tsx
// AI비서 "🚚 운행일지" 탭 — 화물운송(타타대우 25톤 윙바디) 운행 기록을 한 페이지 일자별 표로 관리.
//   일자 / 순번 / 출발지 / 도착지 / 거리 / 주유(L, 금액) / 요소수(L, 금액) / 운임
// 테이블: truck_trips (supabase/migrations/20261030120000_truck_logs.sql, 20261030150000_truck_trips_places.sql,
//         20261030160000_truck_trips_fuel_urea_freight.sql, 20261030200000_truck_trips_next_day.sql,
//         20261031100000_truck_trips_empty_run.sql)
// 장소검색·거리계산: supabase/functions/truck-route (카카오 로컬 + 카카오모빌리티 길찾기)
// 권한: admin@rnfkorea.co.kr / ltongs7@gmail.com 은 /work/secretary, everyasset.fc@gmail.com 은 /work/secretary-ins 에서
//       같은 데이터를 함께 본다 (RLS: is_truck_log_user()).
//
// 화면 흐름
//   1) 월 선택 → 요약(운행·거리·주유·요소수·운임·운임-유류비)
//   2) 입력줄 한 곳에서 한 구간씩 입력 (표 칸에 직접 입력하지 않음 — 엑셀식 칸 편집은 커서 이동이 불편해서)
//      - 출발지·도착지: 상호/주소 입력 → 후보(최근 장소 + 카카오 장소검색)에서 고르면 길찾기 거리 자동 입력
//      - 같은 날 여러 구간: 저장하면 일자는 유지되고 출발지 = 직전 도착지로 이어진다 (순번은 자동)
//      - 일자는 상차일 기준. 도착지 옆 [당착]/[익일착] 토글로 구분 (익일착 = 도착일이 상차일 + 1일)
//        익일착으로 저장하면 다음 입력의 일자가 다음 날로 넘어가고 출발지 = 그 도착지
//      - 숫자 칸에서 Enter = 저장
//   3) 공차: 직전 구간 도착지 ≠ 이 구간 출발지면 그 사이 빈 차 이동을 이 구간의 "공차" 칸(거리 옆)에 표시한다.
//      거리는 길찾기로 자동 계산해 이 구간의 empty_km에 저장하고, 공차 칸을 누르면 직접 고칠 수 있다.
//      일계·월계 줄에는 운행·공차와 함께 총 이동거리를 보여준다.
//      총 이동거리 = 운행거리 + 공차거리 (연비·km당 운임은 총 이동거리 기준)
//   4) 표에서 줄을 누르면 입력줄로 불러와 수정, 일자 칸의 "+ 구간"은 그 날짜로 구간 추가
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Trip = {
  id: number; trip_date: string; driver: string | null; origin: string; destination: string;
  origin_address: string | null; origin_x: number | null; origin_y: number | null;
  dest_address: string | null; dest_x: number | null; dest_y: number | null;
  distance_km: number | null; distance_approx: boolean;
  next_day: boolean;   // 익일착 (trip_date = 상차일)
  // 공차: 직전 구간 도착지 → 이 구간 출발지 사이 빈 차 이동. empty_from = 계산 기준(직전 도착지 서명)
  empty_km: number | null; empty_approx: boolean; empty_manual: boolean; empty_from: string | null;
  fuel_liters: number | null; fuel_amount: number | null;
  urea_liters: number | null; urea_amount: number | null;
  freight: number | null; memo: string | null;
};
// 출발지/도착지 입력값. x·y(경도·위도)는 후보에서 골랐을 때만 채워지고, 글자를 고치면 비워진다.
type PlaceVal = { name: string; address: string | null; x: number | null; y: number | null };

const CARD = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const CTRL = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
const NUM = `${CTRL} text-right tabular-nums`;
const LBL = "block text-[11px] font-semibold text-gray-500 mb-1";
const BTO = "px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all disabled:opacity-50";
const BTG = "px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 transition-all disabled:opacity-50";
// 표 셀 (엑셀 느낌의 얇은 격자)
const TH = "border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap";
const TD = "border border-gray-200 px-2 py-1.5 text-sm text-[#0f172a]";
const TDN = `${TD} text-right tabular-nums whitespace-nowrap`;
const TF = "border border-[#0f172a] px-2 py-2 text-sm text-right tabular-nums";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 운전자는 대표 + 기사 1인 기준. 이름이 정해지면 여기만 바꾸면 된다 (기존 기록은 그대로 남음).
const DEFAULT_DRIVERS = ["대표", "기사"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const addDays = (s: string, n: number) => { const [y, m, d] = s.split("-").map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`; };
const labelDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`; };
const monthRange = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return { from: `${ym}-01`, to: `${ym}-${pad2(new Date(y, m, 0).getDate())}` };
};
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const num = (s: string) => { const v = Number(String(s).replace(/,/g, "")); return s.trim() === "" || !Number.isFinite(v) ? null : v; };
const int = (s: string) => { const v = num(s); return v == null ? null : Math.round(v); };
const n0 = (v: number | null | undefined) => Number(v) || 0;
const fmtWon = (v: number | null | undefined) => (v == null ? "" : Math.round(Number(v)).toLocaleString("ko-KR"));
const fmt1 = (v: number | null | undefined) => (v == null ? "" : (Math.round(Number(v) * 10) / 10).toLocaleString("ko-KR"));
const str = (v: number | null) => (v == null ? "" : String(v));
const xy = (v: number | null) => (v == null ? null : Number(v));

// 공차 판정: 직전 도착지와 이 출발지가 같은 곳인가 (둘 다 좌표가 있으면 500m 이내, 아니면 이름 비교)
const destSig = (t: Trip) => `${t.destination}|${t.dest_x ?? ""}|${t.dest_y ?? ""}`;
const normName = (v: string) => v.replace(/\s+/g, "").toLowerCase();
const straightKm = (ax: number, ay: number, bx: number, by: number) => {
  const rad = (v: number) => v * Math.PI / 180;
  const h = Math.sin(rad(by - ay) / 2) ** 2 + Math.cos(rad(ay)) * Math.cos(rad(by)) * Math.sin(rad(bx - ax) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const samePlace = (prev: Trip, t: Trip) => {
  if (prev.dest_x != null && prev.dest_y != null && t.origin_x != null && t.origin_y != null)
    return straightKm(Number(prev.dest_x), Number(prev.dest_y), Number(t.origin_x), Number(t.origin_y)) < 0.5;
  return normName(prev.destination) === normName(t.origin);
};
type Gap = { prev: Trip; km: number | null; approx: boolean; manual: boolean; pending: boolean };

const emptyPlace = (): PlaceVal => ({ name: "", address: null, x: null, y: null });
const hasXY = (p: PlaceVal) => p.x != null && p.y != null;
const emptyForm = (date = todayStr(), driver = DEFAULT_DRIVERS[0]) => ({
  trip_date: date, driver, origin: emptyPlace(), destination: emptyPlace(),
  distance_km: "", distance_approx: false, next_day: false,
  fuel_liters: "", fuel_amount: "", urea_liters: "", urea_amount: "", freight: "", memo: "",
});
type Form = ReturnType<typeof emptyForm>;
type NumKey = "distance_km" | "fuel_liters" | "fuel_amount" | "urea_liters" | "urea_amount" | "freight";

// 출발지/도착지 입력 — 최근 운행에 쓴 장소를 먼저 보여주고, 카카오 장소검색 결과를 이어 붙인다.
function PlaceInput({ label, value, onChange, recent, placeholder, inputRef }: {
  label: string; value: PlaceVal; onChange: (v: PlaceVal) => void; recent: PlaceVal[]; placeholder: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlaceVal[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const q = value.name.trim();

  // 글자를 고친 경우(좌표 없음)에만 검색. 0.4초 디바운스.
  useEffect(() => {
    if (!open || hasXY(value) || q.length < 2) { setResults([]); setError(""); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase.functions.invoke("truck-route", { body: { action: "search", query: q } });
      if (!alive) return;
      setSearching(false);
      if (error || data?.error) { setResults([]); setError("장소검색을 쓸 수 없습니다. 거리는 직접 입력해 주세요."); return; }
      setError("");
      setResults(((data?.places ?? []) as PlaceVal[]).map(p => ({ name: p.name, address: p.address, x: p.x, y: p.y })));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [q, open, value.x, value.y]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, [open]);

  const recentHits = recent.filter(r => !q || r.name.includes(q) || (r.address ?? "").includes(q)).slice(0, 5);
  const options = [
    ...recentHits.map(p => ({ ...p, recent: true })),
    ...results.filter(r => !recentHits.some(h => h.name === r.name && h.address === r.address)).map(p => ({ ...p, recent: false })),
  ];
  const pick = (p: PlaceVal) => { onChange({ name: p.name, address: p.address, x: p.x, y: p.y }); setOpen(false); };

  return (
    <div ref={boxRef} className="relative">
      <label className={LBL}>{label}</label>
      <input ref={inputRef} className={`${CTRL} ${hasXY(value) ? "border-green-300 bg-green-50/40" : ""}`} value={value.name} placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          // Enter = 첫 번째 후보 선택
          if (e.key === "Enter" && open && !hasXY(value) && options.length > 0) { e.preventDefault(); pick(options[0]); }
          if (e.key === "Escape") setOpen(false);
        }}
        onChange={e => { setOpen(true); onChange({ name: e.target.value, address: null, x: null, y: null }); }} />
      {value.address && <p className="text-[10px] text-gray-400 mt-0.5 truncate">📍 {value.address}</p>}
      {open && !hasXY(value) && (options.length > 0 || searching || error) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-gray-200 bg-white shadow-lg py-1 max-h-72 overflow-y-auto">
          {options.map((p, i) => (
            <button key={`${p.name}-${p.address}-${i}`} type="button" className="w-full text-left px-3 py-2 hover:bg-orange-50 transition-all"
              onClick={() => pick(p)}>
              <p className="text-sm text-[#0f172a] truncate">{p.recent && <span className="text-[10px] text-orange-600 mr-1">최근</span>}{p.name}</p>
              {p.address && <p className="text-[11px] text-gray-400 truncate">{p.address}</p>}
            </button>
          ))}
          {searching && <p className="px-3 py-2 text-xs text-gray-400">검색 중…</p>}
          {error && <p className="px-3 py-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}

const sum = (rows: Trip[]) => ({
  dist: rows.reduce((a, t) => a + n0(t.distance_km), 0),
  fuelL: rows.reduce((a, t) => a + n0(t.fuel_liters), 0),
  fuelW: rows.reduce((a, t) => a + n0(t.fuel_amount), 0),
  ureaL: rows.reduce((a, t) => a + n0(t.urea_liters), 0),
  ureaW: rows.reduce((a, t) => a + n0(t.urea_amount), 0),
  freight: rows.reduce((a, t) => a + n0(t.freight), 0),
});

export default function TruckLogTab({ showToast }: { showToast: (msg: string, type?: "ok" | "err") => void }) {
  // 부모의 showToast는 렌더마다 새로 만들어지므로 ref로 고정해 load 재생성을 막는다
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>(() => emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [recentPlaces, setRecentPlaces] = useState<PlaceVal[]>([]);
  const [routeInfo, setRouteInfo] = useState("");                // 길찾기 결과 안내 문구
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [distanceTouched, setDistanceTouched] = useState(false); // 거리를 직접 고쳤는지
  const originRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const [prevTrip, setPrevTrip] = useState<Trip | null>(null);   // 이 달 첫 구간의 공차 계산용 (전달 마지막 구간)
  const gapTried = useRef(new Set<string>());                     // 공차 자동계산을 이미 시도한 "구간id|기준"

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = monthRange(month);
    const [{ data, error }, before] = await Promise.all([
      supabase.from("truck_trips").select("*")
        .gte("trip_date", from).lte("trip_date", to)
        .order("trip_date", { ascending: true }).order("id", { ascending: true }),
      supabase.from("truck_trips").select("*").lt("trip_date", from)
        .order("trip_date", { ascending: false }).order("id", { ascending: false }).limit(1),
    ]);
    setLoading(false);
    if (error) { toastRef.current(`불러오기 실패: ${error.message}`, "err"); return; }
    setPrevTrip(((before.data ?? [])[0] as Trip) ?? null);
    setTrips((data ?? []) as Trip[]);
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  // 최근 운행에 쓴 장소(좌표 있는 것만) — 월과 무관하게 최근 200건 기준
  const loadRecentPlaces = useCallback(async () => {
    const { data } = await supabase.from("truck_trips")
      .select("origin,origin_address,origin_x,origin_y,destination,dest_address,dest_x,dest_y")
      .order("id", { ascending: false }).limit(200);
    const seen = new Set<string>();
    const list: PlaceVal[] = [];
    (data ?? []).forEach((t: any) => {
      [[t.origin, t.origin_address, t.origin_x, t.origin_y], [t.destination, t.dest_address, t.dest_x, t.dest_y]].forEach(([name, address, x, y]) => {
        if (x == null || y == null || seen.has(`${name}|${address}`)) return;
        seen.add(`${name}|${address}`);
        list.push({ name, address, x: Number(x), y: Number(y) });
      });
    });
    setRecentPlaces(list);
  }, []);
  useEffect(() => { void loadRecentPlaces(); }, [loadRecentPlaces]);

  // 출발지·도착지가 모두 좌표를 가지면 길찾기 거리로 거리 칸을 채운다 (직접 고친 거리는 덮어쓰지 않음)
  const { origin: o, destination: d } = form;
  useEffect(() => {
    setRouteKm(null);
    if (!hasXY(o) || !hasXY(d)) { setRouteInfo(""); return; }
    let alive = true;
    setRouteInfo("거리 계산 중…");
    void (async () => {
      const { data, error } = await supabase.functions.invoke("truck-route", {
        body: { action: "route", origin: { x: o.x, y: o.y }, destination: { x: d.x, y: d.y } },
      });
      if (!alive) return;
      if (error || data?.error || data?.km == null) { setRouteInfo("거리 계산 실패 — 직접 입력"); return; }
      const h = data.minutes != null ? ` · ${Math.floor(data.minutes / 60) ? `${Math.floor(data.minutes / 60)}시간 ` : ""}${data.minutes % 60}분` : "";
      setRouteKm(data.km);
      setRouteInfo(data.approx ? `직선 근사 ${data.km}km` : `길찾기 ${data.km}km${h}`);
      if (!distanceTouched) setForm(f => ({ ...f, distance_km: String(data.km), distance_approx: !!data.approx }));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.x, o.y, d.x, d.y]);

  const drivers = useMemo(() => {
    const s = new Set(DEFAULT_DRIVERS);
    trips.forEach(t => t.driver && s.add(t.driver));
    return [...s];
  }, [trips]);

  // 일자별 묶음 (같은 날은 입력 순서 = 순번)
  const days = useMemo(() => {
    const map = new Map<string, Trip[]>();
    trips.forEach(t => { if (!map.has(t.trip_date)) map.set(t.trip_date, []); map.get(t.trip_date)!.push(t); });
    return [...map.entries()];
  }, [trips]);
  const total = useMemo(() => sum(trips), [trips]);
  const fuelCost = total.fuelW + total.ureaW;

  // 공차 구간: 구간id → 직전 구간과 공차거리 (같은 곳에서 이어지면 없음)
  const gaps = useMemo(() => {
    const m = new Map<number, Gap>();
    trips.forEach((t, i) => {
      const prev = i > 0 ? trips[i - 1] : prevTrip;
      if (!prev || samePlace(prev, t)) return;
      const current = t.empty_from === destSig(prev);
      const hasXYBoth = prev.dest_x != null && t.origin_x != null;
      m.set(t.id, {
        prev, km: current ? (t.empty_km == null ? null : Number(t.empty_km)) : null,
        approx: current && t.empty_approx, manual: current && t.empty_manual,
        pending: !current && hasXYBoth,
      });
    });
    return m;
  }, [trips, prevTrip]);
  const emptyTotal = useMemo(() => [...gaps.values()].reduce((a, g) => a + (g.km ?? 0), 0), [gaps]);
  const moveTotal = total.dist + emptyTotal;

  // 공차거리 자동계산·정리 — 기준(직전 도착지)이 바뀐 구간만 길찾기로 다시 계산해 저장한다
  useEffect(() => {
    if (loading) return;
    const patchLocal = (id: number, patch: Partial<Trip>) => setTrips(ts => ts.map(x => (x.id === id ? { ...x, ...patch } : x)));
    trips.forEach((t, i) => {
      const prev = i > 0 ? trips[i - 1] : prevTrip;
      const isGap = !!prev && !samePlace(prev, t);
      const sig = isGap ? destSig(prev!) : "";
      const key = `${t.id}|${sig}`;
      if (gapTried.current.has(key)) return;
      if (!isGap) {
        if (t.empty_km == null && t.empty_from == null) return;
        gapTried.current.add(key);
        const patch = { empty_km: null, empty_approx: false, empty_manual: false, empty_from: null };
        void supabase.from("truck_trips").update(patch).eq("id", t.id).then(() => patchLocal(t.id, patch));
        return;
      }
      if (t.empty_from === sig) return;   // 이미 이 기준으로 계산(또는 직접 입력)됨
      gapTried.current.add(key);
      void (async () => {
        let km: number | null = null, approx = false;
        if (prev!.dest_x != null && prev!.dest_y != null && t.origin_x != null && t.origin_y != null) {
          const { data } = await supabase.functions.invoke("truck-route", {
            body: { action: "route", origin: { x: prev!.dest_x, y: prev!.dest_y }, destination: { x: t.origin_x, y: t.origin_y } },
          });
          if (data?.km != null) { km = data.km; approx = !!data.approx; }
        }
        const patch = { empty_km: km, empty_approx: approx, empty_manual: false, empty_from: sig };
        const { error } = await supabase.from("truck_trips").update(patch).eq("id", t.id);
        if (!error) patchLocal(t.id, patch);
      })();
    });
  }, [trips, prevTrip, loading]);

  // 공차 줄 클릭 → 공차거리 직접 입력 (비우면 자동계산으로 되돌림)
  const editGap = async (t: Trip, prev: Trip) => {
    const v = window.prompt(`공차거리(km)\n${prev.destination} → ${t.origin}\n비우면 자동계산으로 되돌립니다.`, t.empty_km != null ? String(t.empty_km) : "");
    if (v === null) return;
    const km = num(v);
    const patch = km == null
      ? { empty_km: null, empty_approx: false, empty_manual: false, empty_from: null }
      : { empty_km: km, empty_approx: false, empty_manual: true, empty_from: destSig(prev) };
    const { error } = await supabase.from("truck_trips").update(patch).eq("id", t.id);
    if (error) { showToast(`저장 실패: ${error.message}`, "err"); return; }
    gapTried.current.delete(`${t.id}|${destSig(prev)}`);
    setTrips(ts => ts.map(x => (x.id === t.id ? { ...x, ...patch } : x)));
  };
  const nextDayCount = useMemo(() => trips.filter(t => t.next_day).length, [trips]);

  const resetForm = (date = form.trip_date) => {
    setEditingId(null); setDistanceTouched(false);
    setForm(f => emptyForm(date, f.driver));
  };

  const save = async () => {
    const f = form;
    if (!f.trip_date || !f.origin.name.trim() || !f.destination.name.trim()) {
      showToast("일자·출발지·도착지를 입력해 주세요.", "err"); return;
    }
    const row = {
      trip_date: f.trip_date, driver: f.driver || null,
      origin: f.origin.name.trim(), origin_address: f.origin.address, origin_x: f.origin.x, origin_y: f.origin.y,
      destination: f.destination.name.trim(), dest_address: f.destination.address, dest_x: f.destination.x, dest_y: f.destination.y,
      distance_km: num(f.distance_km), distance_approx: distanceTouched ? false : f.distance_approx,
      next_day: f.next_day,
      fuel_liters: num(f.fuel_liters), fuel_amount: int(f.fuel_amount),
      urea_liters: num(f.urea_liters), urea_amount: int(f.urea_amount),
      freight: int(f.freight), memo: f.memo.trim() || null,
    };
    setSaving(true);
    const res = editingId
      ? await supabase.from("truck_trips").update({ ...row, updated_at: new Date().toISOString() }).eq("id", editingId)
      : await supabase.from("truck_trips").insert(row);
    setSaving(false);
    if (res.error) { showToast(`저장 실패: ${res.error.message}`, "err"); return; }
    showToast(editingId ? "수정했습니다." : "저장했습니다.");
    // 다음 구간: 출발지 = 직전 도착지 → 커서는 도착지로. 익일착이면 일자를 다음 날로 넘긴다.
    const wasEditing = editingId != null;
    const nextDate = !wasEditing && row.next_day ? addDays(row.trip_date, 1) : row.trip_date;
    setEditingId(null); setDistanceTouched(false);
    setForm({ ...emptyForm(nextDate, f.driver), origin: wasEditing ? emptyPlace() : { ...f.destination } });
    setTimeout(() => (wasEditing ? originRef : destRef).current?.focus(), 0);
    void loadRecentPlaces();
    if (row.trip_date.slice(0, 7) !== month) setMonth(row.trip_date.slice(0, 7)); else void load();
  };

  const edit = (t: Trip) => {
    // 저장된 거리를 그대로 두도록 직접 입력한 것으로 취급
    setEditingId(t.id); setDistanceTouched(true);
    setForm({
      trip_date: t.trip_date, driver: t.driver ?? "",
      origin: { name: t.origin, address: t.origin_address, x: xy(t.origin_x), y: xy(t.origin_y) },
      destination: { name: t.destination, address: t.dest_address, x: xy(t.dest_x), y: xy(t.dest_y) },
      distance_km: str(t.distance_km), distance_approx: t.distance_approx, next_day: t.next_day,
      fuel_liters: str(t.fuel_liters), fuel_amount: str(t.fuel_amount),
      urea_liters: str(t.urea_liters), urea_amount: str(t.urea_amount),
      freight: str(t.freight), memo: t.memo ?? "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const addOnDate = (date: string) => {
    // 그 날 마지막 도착지를 출발지로 (그 날 기록이 없으면 전날 익일착 도착지)
    const sameDay = trips.filter(t => t.trip_date === date);
    const prevNextDay = trips.filter(t => t.trip_date === addDays(date, -1) && t.next_day);
    const last = sameDay[sameDay.length - 1] ?? prevNextDay[prevNextDay.length - 1];
    setEditingId(null); setDistanceTouched(false);
    setForm(f => ({
      ...emptyForm(date, f.driver),
      origin: last ? { name: last.destination, address: last.dest_address, x: xy(last.dest_x), y: xy(last.dest_y) } : emptyPlace(),
    }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => (last ? destRef : originRef).current?.focus(), 300);
  };
  const remove = async (id: number) => {
    if (!window.confirm("이 구간을 삭제할까요?")) return;
    const { error } = await supabase.from("truck_trips").delete().eq("id", id);
    if (error) { showToast(`삭제 실패: ${error.message}`, "err"); return; }
    if (editingId === id) resetForm();
    showToast("삭제했습니다.");
    void load();
  };

  // 숫자 칸 Enter = 저장
  const onEnterSave = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); if (!saving) void save(); } };
  const numInput = (k: NumKey, label: string, unit: string) => (
    <div>
      <label className={LBL}>{label} <span className="font-normal text-gray-400">{unit}</span></label>
      <input inputMode="decimal" className={NUM} value={form[k]} onKeyDown={onEnterSave}
        onChange={e => {
          if (k === "distance_km") { setDistanceTouched(true); setForm(f => ({ ...f, distance_km: e.target.value, distance_approx: false })); }
          else set(k, e.target.value);
        }} />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* 헤더 + 월 선택 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0f172a]">🚚 화물운송 운행일지</p>
          <p className="text-xs text-gray-400 mt-0.5">타타대우 25톤 윙바디 · 일자별 운행·주유·요소수·운임</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={BTG} onClick={() => setMonth(m => shiftMonth(m, -1))}>◀</button>
          <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)}
            className="h-8 rounded-xl border border-gray-200 px-2 text-sm text-[#0f172a]" />
          <button className={BTG} onClick={() => setMonth(m => shiftMonth(m, 1))}>▶</button>
        </div>
      </div>

      {/* 월 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {[
          { k: "운행", v: `${trips.length}건`, s: `${days.length}일${nextDayCount ? ` · 익일착 ${nextDayCount}` : ""}` },
          { k: "🛣 총 이동거리", v: `${fmt1(moveTotal)}km`, s: `운행 ${fmt1(total.dist)} · 공차 ${fmt1(emptyTotal)}${moveTotal > 0 ? ` (${Math.round(emptyTotal / moveTotal * 100)}%)` : ""}` },
          { k: "⛽ 주유", v: `${fmtWon(total.fuelW)}원`, s: `${fmt1(total.fuelL)}L${total.fuelL > 0 && moveTotal > 0 ? ` · 연비 ${(moveTotal / total.fuelL).toFixed(2)}km/L` : ""}` },
          { k: "💧 요소수", v: `${fmtWon(total.ureaW)}원`, s: `${fmt1(total.ureaL)}L` },
          { k: "💰 운임", v: `${fmtWon(total.freight)}원`, s: moveTotal > 0 ? `총 이동 km당 ${fmtWon(total.freight / moveTotal)}원` : "-" },
          { k: "운임 − 유류비", v: `${fmtWon(total.freight - fuelCost)}원`, s: `유류비(주유+요소수) ${fmtWon(fuelCost)}원` },
        ].map(c => (
          <div key={c.k} className={`${CARD} p-3`}>
            <p className="text-[11px] text-gray-400">{c.k}</p>
            <p className="text-lg font-bold text-[#0f172a] mt-0.5 tabular-nums">{c.v}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{c.s}</p>
          </div>
        ))}
      </div>

      {/* 입력줄 */}
      <div ref={formRef} className={`${CARD} p-4 space-y-3 scroll-mt-4 ${editingId ? "ring-2 ring-orange-300" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#0f172a]">{editingId ? "✏️ 구간 수정" : "➕ 구간 입력"}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-400">운전</span>
            {drivers.map(dv => (
              <button key={dv} type="button" onClick={() => set("driver", dv)}
                className={`h-7 px-2.5 rounded-lg border text-xs font-semibold transition-all ${form.driver === dv ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                {dv}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-[150px_1fr_auto_1fr_auto_120px] gap-2.5 items-start">
          <div className="col-span-2 md:col-span-1"><label className={LBL}>일자 <span className="font-normal text-gray-400">상차일</span></label>
            <input type="date" className={CTRL} value={form.trip_date} onChange={e => set("trip_date", e.target.value)} /></div>
          <div className="col-span-2 md:col-span-1">
            <PlaceInput label="출발지" value={form.origin} recent={recentPlaces} placeholder="상호 또는 주소" inputRef={originRef}
              onChange={v => set("origin", v)} /></div>
          <div className="hidden md:block pt-5">
            <button type="button" className={`${BTG} h-10`} title="출발지↔도착지 바꾸기 (복귀 운행)"
              onClick={() => setForm(f => ({ ...f, origin: f.destination, destination: f.origin }))}>⇄</button>
          </div>
          <div className="col-span-2 md:col-span-1">
            <PlaceInput label="도착지" value={form.destination} recent={recentPlaces} placeholder="상호 또는 주소" inputRef={destRef}
              onChange={v => set("destination", v)} /></div>
          <div className="col-span-2 md:col-span-1">
            <label className={LBL}>도착</label>
            <div className="flex h-10 rounded-xl border border-gray-200 overflow-hidden">
              {([false, true] as const).map(nd => (
                <button key={String(nd)} type="button" onClick={() => set("next_day", nd)}
                  className={`flex-1 px-3 text-sm font-semibold whitespace-nowrap transition-all ${form.next_day === nd ? (nd ? "bg-indigo-600 text-white" : "bg-[#0f172a] text-white") : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {nd ? "익일착" : "당착"}
                </button>
              ))}
            </div>
            {form.next_day && form.trip_date && <p className="text-[10px] text-indigo-600 mt-0.5">도착 {labelDate(addDays(form.trip_date, 1))}</p>}
          </div>
          <div className="col-span-2 md:col-span-1">
            {numInput("distance_km", "거리", "km")}
            {routeInfo && <p className="text-[10px] text-gray-400 mt-0.5 truncate" title={routeInfo}>{routeInfo}</p>}
            {distanceTouched && routeKm != null && String(routeKm) !== form.distance_km && (
              <button type="button" className="text-[10px] text-orange-600 underline"
                onClick={() => { setDistanceTouched(false); setForm(f => ({ ...f, distance_km: String(routeKm), distance_approx: false })); }}>
                길찾기 거리 적용
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1fr_1.3fr] gap-2.5 p-3 rounded-xl bg-gray-50">
          {numInput("fuel_liters", "⛽ 주유량", "L")}
          {numInput("fuel_amount", "⛽ 주유 금액", "원")}
          {numInput("urea_liters", "💧 요소수", "L")}
          {numInput("urea_amount", "💧 요소수 금액", "원")}
          <div className="col-span-2 md:col-span-1">{numInput("freight", "💰 운임", "원")}</div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1"><label className={LBL}>메모</label>
            <input className={CTRL} value={form.memo} placeholder="화주·특이사항 (선택)" onChange={e => set("memo", e.target.value)} onKeyDown={onEnterSave} /></div>
          {editingId && <button className={`${BTG} h-10`} onClick={() => resetForm()}>취소</button>}
          <button className={`${BTO} h-10 px-6 text-sm`} disabled={saving} onClick={() => void save()}>{editingId ? "수정 저장" : "저장"}</button>
        </div>
        <p className="text-[11px] text-gray-400">숫자 칸에서 Enter = 저장 · 저장 후 다음 구간은 출발지가 직전 도착지로 채워집니다 (익일착이면 일자도 다음 날로).</p>
      </div>

      {/* 일자별 표 */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                <th rowSpan={2} className={`${TH} w-[84px]`}>일자</th>
                <th rowSpan={2} className={`${TH} w-[44px]`}>순번</th>
                <th rowSpan={2} className={TH}>출발지</th>
                <th rowSpan={2} className={TH}>도착지</th>
                <th colSpan={2} className={TH}>거리 <span className="font-normal">km</span></th>
                <th colSpan={2} className={`${TH} !bg-orange-50 text-orange-700`}>⛽ 주유</th>
                <th colSpan={2} className={`${TH} !bg-sky-50 text-sky-700`}>💧 요소수</th>
                <th rowSpan={2} className={`${TH} w-[96px] !bg-emerald-50 text-emerald-700`}>💰 운임<br /><span className="font-normal">원</span></th>
                <th rowSpan={2} className={`${TH} w-[40px]`}></th>
              </tr>
              <tr>
                <th className={`${TH} w-[68px]`}>운행</th>
                <th className={`${TH} w-[64px] !bg-slate-100 text-slate-500`}>공차</th>
                <th className={`${TH} w-[60px] !bg-orange-50/60`}>L</th>
                <th className={`${TH} w-[88px] !bg-orange-50/60`}>금액</th>
                <th className={`${TH} w-[56px] !bg-sky-50/60`}>L</th>
                <th className={`${TH} w-[80px] !bg-sky-50/60`}>금액</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="text-sm text-gray-400 text-center py-10">불러오는 중…</td></tr>
              ) : days.length === 0 ? (
                <tr><td colSpan={12} className="text-sm text-gray-400 text-center py-10">{month.replace("-", "년 ")}월 운행 기록이 없습니다.</td></tr>
              ) : days.map(([date, rows], di) => {
                const s = sum(rows);
                const band = di % 2 ? "bg-gray-50/60" : "bg-white";
                const dayEmpty = rows.reduce((a, t) => a + (gaps.get(t.id)?.km ?? 0), 0);
                return (
                  <React.Fragment key={date}>
                    {rows.map((t, i) => {
                      const g = gaps.get(t.id);
                      return (
                        <tr key={t.id} onClick={() => edit(t)}
                          className={`${band} cursor-pointer hover:bg-orange-50/60 ${editingId === t.id ? "!bg-orange-100/70" : ""}`}>
                          {i === 0 && (
                            <td rowSpan={rows.length + 1} className={`${TD} align-top font-semibold whitespace-nowrap ${band}`}
                              onClick={e => e.stopPropagation()}>
                              {labelDate(date)}
                              <button className="block mt-1 text-[11px] text-orange-600 hover:underline font-normal" onClick={() => addOnDate(date)}>+ 구간</button>
                            </td>
                          )}
                          <td className={`${TD} text-center tabular-nums`}>
                            {i + 1}
                            {t.driver && t.driver !== DEFAULT_DRIVERS[0] && <span className="block text-[10px] text-gray-400">{t.driver}</span>}
                          </td>
                          <td className={TD} title={t.origin_address ?? ""}>{t.origin}</td>
                          <td className={TD} title={t.dest_address ?? ""}>
                            {t.destination}
                            {t.next_day && (
                              <span className="ml-1 align-middle text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                                title={`도착 ${labelDate(addDays(t.trip_date, 1))}`}>익일</span>
                            )}
                            {t.memo && <span className="block text-[11px] text-gray-400">{t.memo}</span>}
                          </td>
                          <td className={TDN}>{t.distance_approx && t.distance_km != null && <span className="text-gray-400 text-[10px] mr-0.5">약</span>}{fmt1(t.distance_km)}</td>
                          {/* 공차: 직전 도착지 → 이 출발지. 누르면 직접 수정 */}
                          <td className={`${TDN} bg-slate-50 !text-slate-600 ${g ? "cursor-pointer hover:bg-slate-200/70" : ""}`}
                            title={g ? `공차: ${g.prev.destination} → ${t.origin}${g.manual ? " (직접 입력)" : ""} · 눌러서 수정` : ""}
                            onClick={e => { if (!g) return; e.stopPropagation(); void editGap(t, g.prev); }}>
                            {!g ? "" : g.pending ? <span className="text-[10px] text-slate-400">계산중</span>
                              : g.km == null ? <span className="text-[11px] text-orange-600 underline">입력</span>
                              : <>{g.approx && <span className="text-slate-400 text-[10px] mr-0.5">약</span>}{fmt1(g.km)}</>}
                          </td>
                          <td className={`${TDN} bg-orange-50/30`}>{fmt1(t.fuel_liters)}</td>
                          <td className={`${TDN} bg-orange-50/30`}>{fmtWon(t.fuel_amount)}</td>
                          <td className={`${TDN} bg-sky-50/30`}>{fmt1(t.urea_liters)}</td>
                          <td className={`${TDN} bg-sky-50/30`}>{fmtWon(t.urea_amount)}</td>
                          <td className={`${TDN} bg-emerald-50/30 font-semibold`}>{fmtWon(t.freight)}</td>
                          <td className={`${TD} text-center`} onClick={e => e.stopPropagation()}>
                            <button className="text-gray-300 hover:text-red-500 text-xs" title="삭제" onClick={() => void remove(t.id)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                    {/* 일계: 운행·공차와 총 이동거리 */}
                    <tr className={band}>
                      <td colSpan={3} className={`${TD} text-right text-[11px] text-gray-500 whitespace-nowrap`}>
                        일계 <span className="ml-1 text-[13px] font-bold text-[#0f172a] tabular-nums">총 {fmt1(s.dist + dayEmpty)}km</span>
                      </td>
                      <td className={`${TDN} text-gray-600`}>{fmt1(s.dist)}</td>
                      <td className={`${TDN} bg-slate-50 text-slate-500`}>{dayEmpty ? fmt1(dayEmpty) : ""}</td>
                      <td className={`${TDN} text-gray-600`}>{s.fuelL ? fmt1(s.fuelL) : ""}</td>
                      <td className={`${TDN} text-gray-600`}>{s.fuelW ? fmtWon(s.fuelW) : ""}</td>
                      <td className={`${TDN} text-gray-600`}>{s.ureaL ? fmt1(s.ureaL) : ""}</td>
                      <td className={`${TDN} text-gray-600`}>{s.ureaW ? fmtWon(s.ureaW) : ""}</td>
                      <td className={`${TDN} text-gray-700 font-semibold`}>{s.freight ? fmtWon(s.freight) : ""}</td>
                      <td className={TD}></td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            {trips.length > 0 && (
              <tfoot>
                <tr className="bg-[#0f172a] text-white">
                  <td colSpan={4} className="border border-[#0f172a] px-2 py-2 text-sm font-semibold whitespace-nowrap">
                    {Number(month.slice(5))}월 월계 · {trips.length}건
                    <span className="ml-2 text-base font-bold tabular-nums">총 {fmt1(moveTotal)}km</span>
                    {moveTotal > 0 && <span className="ml-1.5 text-[11px] font-normal text-slate-300">공차율 {Math.round(emptyTotal / moveTotal * 100)}%</span>}
                  </td>
                  <td className={TF}>{fmt1(total.dist)}</td>
                  <td className={`${TF} text-slate-300`}>{fmt1(emptyTotal)}</td>
                  <td className={TF}>{fmt1(total.fuelL)}</td>
                  <td className={TF}>{fmtWon(total.fuelW)}</td>
                  <td className={TF}>{fmt1(total.ureaL)}</td>
                  <td className={TF}>{fmtWon(total.ureaW)}</td>
                  <td className={`${TF} font-bold`}>{fmtWon(total.freight)}</td>
                  <td className="border border-[#0f172a]"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">줄을 누르면 위 입력줄에서 수정 · 회색 공차 칸을 누르면 공차거리 수정 · 일자 칸의 “+ 구간”으로 그 날 구간 추가</p>
      </div>
    </div>
  );
}
