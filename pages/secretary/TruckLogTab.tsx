// pages/secretary/TruckLogTab.tsx
// AI비서 "🚚 운행일지" 탭 — 화물운송(타타대우 25톤 윙바디) 일자별 운행·주유 기록.
// 테이블: truck_trips, truck_fuels (supabase/migrations/20261030120000_truck_logs.sql)
// 권한: admin@rnfkorea.co.kr / ltongs7@gmail.com 은 /work/secretary, everyasset.fc@gmail.com 은 /work/secretary-ins 에서
//       같은 데이터를 함께 본다 (RLS: is_truck_log_user()).
//
// 화면 흐름
//   1) 월 선택 → 그달 운행 횟수·운행거리·주유금액·평균연비를 요약 카드로 표시 (운전자별 거리 포함)
//   2) "운행" / "주유" 전환 후 입력 카드에서 기록
//      - 운행: 계기판(출발/도착)을 넣으면 운행거리 자동 계산, 계기판 없이 거리만 넣어도 된다.
//              저장 후 다음 입력은 출발지 = 직전 도착지, 출발 계기판 = 직전 도착 계기판으로 이어 채운다.
//      - 주유: 주유량 × 단가로 금액 자동 계산 (금액을 직접 고치면 그 값을 우선)
//   3) 목록에서 수정(입력 카드로 불러오기)·삭제
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Trip = {
  id: number; trip_date: string; driver: string; origin: string; destination: string;
  odometer_start: number | null; odometer_end: number | null; distance_km: number | null;
  cargo: string | null; memo: string | null;
};
type Fuel = {
  id: number; fuel_date: string; driver: string; station: string | null; liters: number | null;
  unit_price: number | null; amount: number; odometer: number | null; pay_method: string | null; memo: string | null;
};
type Mode = "trip" | "fuel";

const CARD = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const CTRL = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
const LBL = "block text-[11px] font-semibold text-gray-500 mb-1";
const BTO = "px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all disabled:opacity-50";
const BTG = "px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 transition-all disabled:opacity-50";
const CHIP = "text-[11px] px-2 py-0.5 rounded-md border transition-all whitespace-nowrap";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 운전자는 대표 + 기사 1인 기준. 이름이 정해지면 여기만 바꾸면 된다 (기존 기록은 그대로 남음).
const DEFAULT_DRIVERS = ["대표", "기사"];
const PAY_METHODS = ["유류카드", "법인카드", "현금"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const labelDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`; };
const monthRange = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${pad2(last)}` };
};
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const num = (s: string) => { const v = Number(String(s).replace(/,/g, "")); return s.trim() === "" || !Number.isFinite(v) ? null : v; };
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const km = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("ko-KR")}km`;

const emptyTrip = (driver = DEFAULT_DRIVERS[0]) => ({
  trip_date: todayStr(), driver, origin: "", destination: "",
  odometer_start: "", odometer_end: "", distance_km: "", cargo: "", memo: "",
});
const emptyFuel = (driver = DEFAULT_DRIVERS[0]) => ({
  fuel_date: todayStr(), driver, station: "", liters: "", unit_price: "", amount: "",
  odometer: "", pay_method: PAY_METHODS[0], memo: "",
});

export default function TruckLogTab({ showToast }: { showToast: (msg: string, type?: "ok" | "err") => void }) {
  // 부모의 showToast는 렌더마다 새로 만들어지므로 ref로 고정해 load 재생성을 막는다
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [mode, setMode] = useState<Mode>("trip");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fuels, setFuels] = useState<Fuel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tripForm, setTripForm] = useState(emptyTrip());
  const [fuelForm, setFuelForm] = useState(emptyFuel());
  const [amountTouched, setAmountTouched] = useState(false);   // 주유 금액을 직접 고쳤는지
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = monthRange(month);
    const [t, f] = await Promise.all([
      supabase.from("truck_trips").select("*").gte("trip_date", from).lte("trip_date", to)
        .order("trip_date", { ascending: false }).order("id", { ascending: false }),
      supabase.from("truck_fuels").select("*").gte("fuel_date", from).lte("fuel_date", to)
        .order("fuel_date", { ascending: false }).order("id", { ascending: false }),
    ]);
    setLoading(false);
    if (t.error || f.error) { toastRef.current(`불러오기 실패: ${(t.error || f.error)!.message}`, "err"); return; }
    setTrips((t.data ?? []) as Trip[]);
    setFuels((f.data ?? []) as Fuel[]);
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  // 운전자 후보: 기본 2인 + 기록에 나온 이름
  const drivers = useMemo(() => {
    const s = new Set(DEFAULT_DRIVERS);
    trips.forEach(t => s.add(t.driver));
    fuels.forEach(f => s.add(f.driver));
    return [...s];
  }, [trips, fuels]);

  const summary = useMemo(() => {
    const dist = trips.reduce((a, t) => a + (Number(t.distance_km) || 0), 0);
    const fuelAmt = fuels.reduce((a, f) => a + (Number(f.amount) || 0), 0);
    const liters = fuels.reduce((a, f) => a + (Number(f.liters) || 0), 0);
    const byDriver: Record<string, { trips: number; dist: number }> = {};
    trips.forEach(t => {
      const d = (byDriver[t.driver] ??= { trips: 0, dist: 0 });
      d.trips += 1; d.dist += Number(t.distance_km) || 0;
    });
    return { dist, fuelAmt, liters, byDriver, kmPerL: liters > 0 ? dist / liters : null, wonPerKm: dist > 0 ? fuelAmt / dist : null };
  }, [trips, fuels]);

  // 계기판 → 운행거리 자동 계산
  const autoDistance = useMemo(() => {
    const s = num(tripForm.odometer_start), e = num(tripForm.odometer_end);
    return s != null && e != null && e >= s ? Math.round((e - s) * 10) / 10 : null;
  }, [tripForm.odometer_start, tripForm.odometer_end]);

  const setFuelField = (k: keyof ReturnType<typeof emptyFuel>, v: string) => {
    setFuelForm(prev => {
      const next = { ...prev, [k]: v };
      if (!amountTouched && (k === "liters" || k === "unit_price")) {
        const l = num(next.liters), p = num(next.unit_price);
        next.amount = l != null && p != null ? String(Math.round(l * p)) : next.amount;
      }
      return next;
    });
  };

  const resetForms = () => {
    setEditingId(null);
    setAmountTouched(false);
    setTripForm(f => emptyTrip(f.driver));
    setFuelForm(f => emptyFuel(f.driver));
  };

  const saveTrip = async () => {
    const f = tripForm;
    if (!f.trip_date || !f.driver.trim() || !f.origin.trim() || !f.destination.trim()) {
      showToast("일자·운전자·출발지·도착지를 입력해 주세요.", "err"); return;
    }
    const distance = num(f.distance_km) ?? autoDistance;
    const row = {
      trip_date: f.trip_date, driver: f.driver.trim(), origin: f.origin.trim(), destination: f.destination.trim(),
      odometer_start: num(f.odometer_start), odometer_end: num(f.odometer_end), distance_km: distance,
      cargo: f.cargo.trim() || null, memo: f.memo.trim() || null,
    };
    setSaving(true);
    const res = editingId
      ? await supabase.from("truck_trips").update({ ...row, updated_at: new Date().toISOString() }).eq("id", editingId)
      : await supabase.from("truck_trips").insert(row);
    setSaving(false);
    if (res.error) { showToast(`저장 실패: ${res.error.message}`, "err"); return; }
    showToast(editingId ? "운행 기록을 수정했습니다." : "운행 기록을 저장했습니다.");
    // 다음 구간 입력이 이어지도록 출발지·계기판을 직전 도착 기준으로 채운다
    setEditingId(null);
    setTripForm({
      ...emptyTrip(row.driver), trip_date: row.trip_date, origin: row.destination,
      odometer_start: row.odometer_end != null ? String(row.odometer_end) : "",
    });
    if (row.trip_date.slice(0, 7) !== month) setMonth(row.trip_date.slice(0, 7)); else void load();
  };

  const saveFuel = async () => {
    const f = fuelForm;
    const amount = num(f.amount);
    if (!f.fuel_date || !f.driver.trim() || amount == null) {
      showToast("일자·운전자·금액을 입력해 주세요.", "err"); return;
    }
    const row = {
      fuel_date: f.fuel_date, driver: f.driver.trim(), station: f.station.trim() || null,
      liters: num(f.liters), unit_price: num(f.unit_price), amount: Math.round(amount),
      odometer: num(f.odometer), pay_method: f.pay_method || null, memo: f.memo.trim() || null,
    };
    setSaving(true);
    const res = editingId
      ? await supabase.from("truck_fuels").update({ ...row, updated_at: new Date().toISOString() }).eq("id", editingId)
      : await supabase.from("truck_fuels").insert(row);
    setSaving(false);
    if (res.error) { showToast(`저장 실패: ${res.error.message}`, "err"); return; }
    showToast(editingId ? "주유 내역을 수정했습니다." : "주유 내역을 저장했습니다.");
    resetForms();
    if (row.fuel_date.slice(0, 7) !== month) setMonth(row.fuel_date.slice(0, 7)); else void load();
  };

  const editTrip = (t: Trip) => {
    setMode("trip"); setEditingId(t.id);
    setTripForm({
      trip_date: t.trip_date, driver: t.driver, origin: t.origin, destination: t.destination,
      odometer_start: t.odometer_start != null ? String(t.odometer_start) : "",
      odometer_end: t.odometer_end != null ? String(t.odometer_end) : "",
      distance_km: t.distance_km != null ? String(t.distance_km) : "",
      cargo: t.cargo ?? "", memo: t.memo ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const editFuel = (f: Fuel) => {
    setMode("fuel"); setEditingId(f.id); setAmountTouched(true);
    setFuelForm({
      fuel_date: f.fuel_date, driver: f.driver, station: f.station ?? "",
      liters: f.liters != null ? String(f.liters) : "", unit_price: f.unit_price != null ? String(f.unit_price) : "",
      amount: String(f.amount), odometer: f.odometer != null ? String(f.odometer) : "",
      pay_method: f.pay_method ?? "", memo: f.memo ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (table: "truck_trips" | "truck_fuels", id: number) => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { showToast(`삭제 실패: ${error.message}`, "err"); return; }
    if (editingId === id) resetForms();
    showToast("삭제했습니다.");
    void load();
  };

  // 일자별 묶음 (운행 + 주유를 한 날짜 아래에)
  const days = useMemo(() => {
    const map = new Map<string, { trips: Trip[]; fuels: Fuel[] }>();
    const get = (d: string) => { if (!map.has(d)) map.set(d, { trips: [], fuels: [] }); return map.get(d)!; };
    trips.forEach(t => get(t.trip_date).trips.push(t));
    fuels.forEach(f => get(f.fuel_date).fuels.push(f));
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [trips, fuels]);

  const driverPicker = (value: string, onChange: (v: string) => void) => (
    <div>
      <label className={LBL}>운전자</label>
      <div className="flex items-center gap-1.5">
        {drivers.map(d => (
          <button key={d} type="button" onClick={() => onChange(d)}
            className={`h-10 px-3 rounded-xl border text-sm font-semibold transition-all ${value === d ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* 헤더 + 월 선택 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0f172a]">🚚 화물운송 운행일지</p>
          <p className="text-xs text-gray-400 mt-0.5">타타대우 25톤 윙바디 · 일자별 운행·주유 기록</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={BTG} onClick={() => setMonth(m => shiftMonth(m, -1))}>◀</button>
          <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)}
            className="h-8 rounded-xl border border-gray-200 px-2 text-sm text-[#0f172a]" />
          <button className={BTG} onClick={() => setMonth(m => shiftMonth(m, 1))}>▶</button>
        </div>
      </div>

      {/* 월 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { k: "운행", v: `${trips.length}회`, s: km(summary.dist) },
          { k: "주유금액", v: won(summary.fuelAmt), s: `${fuels.length}회 · ${(Math.round(summary.liters * 10) / 10).toLocaleString("ko-KR")}L` },
          { k: "평균연비", v: summary.kmPerL != null ? `${summary.kmPerL.toFixed(2)}km/L` : "-", s: "운행거리 ÷ 주유량" },
          { k: "km당 유류비", v: summary.wonPerKm != null ? won(summary.wonPerKm) : "-", s: "주유금액 ÷ 운행거리" },
        ].map(c => (
          <div key={c.k} className={`${CARD} p-3`}>
            <p className="text-[11px] text-gray-400">{c.k}</p>
            <p className="text-lg font-bold text-[#0f172a] mt-0.5">{c.v}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{c.s}</p>
          </div>
        ))}
      </div>
      {Object.keys(summary.byDriver).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(summary.byDriver).map(([d, v]) => (
            <span key={d} className={`${CHIP} border-gray-200 text-gray-600 bg-gray-50`}>{d} · {v.trips}회 · {km(v.dist)}</span>
          ))}
        </div>
      )}

      {/* 입력 카드 */}
      <div className={`${CARD} p-4 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {(["trip", "fuel"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); if (editingId) resetForms(); }}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${mode === m ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-500 border-gray-200 hover:border-orange-300"}`}>
                {m === "trip" ? "🛣 운행 기록" : "⛽ 주유 내역"}
              </button>
            ))}
          </div>
          {editingId && <span className="text-xs text-orange-600 font-semibold">수정 중 · <button className="underline" onClick={resetForms}>취소</button></span>}
        </div>

        {mode === "trip" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div><label className={LBL}>일자</label>
              <input type="date" className={CTRL} value={tripForm.trip_date} onChange={e => setTripForm(f => ({ ...f, trip_date: e.target.value }))} /></div>
            <div className="col-span-1 md:col-span-3">{driverPicker(tripForm.driver, v => setTripForm(f => ({ ...f, driver: v })))}</div>
            <div className="col-span-1 md:col-span-2"><label className={LBL}>출발지</label>
              <input className={CTRL} value={tripForm.origin} placeholder="예) 평택항" onChange={e => setTripForm(f => ({ ...f, origin: e.target.value }))} /></div>
            <div className="col-span-1 md:col-span-2"><label className={LBL}>도착지</label>
              <input className={CTRL} value={tripForm.destination} placeholder="예) 부산 신항" onChange={e => setTripForm(f => ({ ...f, destination: e.target.value }))} /></div>
            <div><label className={LBL}>출발 계기판(km)</label>
              <input inputMode="decimal" className={CTRL} value={tripForm.odometer_start} onChange={e => setTripForm(f => ({ ...f, odometer_start: e.target.value }))} /></div>
            <div><label className={LBL}>도착 계기판(km)</label>
              <input inputMode="decimal" className={CTRL} value={tripForm.odometer_end} onChange={e => setTripForm(f => ({ ...f, odometer_end: e.target.value }))} /></div>
            <div><label className={LBL}>운행거리(km)</label>
              <input inputMode="decimal" className={CTRL} value={tripForm.distance_km}
                placeholder={autoDistance != null ? `자동 ${autoDistance}` : "직접 입력"}
                onChange={e => setTripForm(f => ({ ...f, distance_km: e.target.value }))} /></div>
            <div><label className={LBL}>화물/화주</label>
              <input className={CTRL} value={tripForm.cargo} onChange={e => setTripForm(f => ({ ...f, cargo: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-3"><label className={LBL}>메모</label>
              <input className={CTRL} value={tripForm.memo} onChange={e => setTripForm(f => ({ ...f, memo: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-1 flex items-end gap-1.5">
              <button className={`${BTO} h-10 flex-1`} disabled={saving} onClick={() => void saveTrip()}>{editingId ? "수정 저장" : "운행 저장"}</button>
              <button type="button" className={`${BTG} h-10`} title="출발지↔도착지 바꾸기 (복귀 운행)"
                onClick={() => setTripForm(f => ({ ...f, origin: f.destination, destination: f.origin }))}>⇄</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div><label className={LBL}>일자</label>
              <input type="date" className={CTRL} value={fuelForm.fuel_date} onChange={e => setFuelField("fuel_date", e.target.value)} /></div>
            <div className="col-span-1 md:col-span-3">{driverPicker(fuelForm.driver, v => setFuelField("driver", v))}</div>
            <div className="col-span-2"><label className={LBL}>주유소</label>
              <input className={CTRL} value={fuelForm.station} placeholder="예) 서해안고속도로 화성휴게소" onChange={e => setFuelField("station", e.target.value)} /></div>
            <div><label className={LBL}>주유량(L)</label>
              <input inputMode="decimal" className={CTRL} value={fuelForm.liters} onChange={e => setFuelField("liters", e.target.value)} /></div>
            <div><label className={LBL}>단가(원/L)</label>
              <input inputMode="numeric" className={CTRL} value={fuelForm.unit_price} onChange={e => setFuelField("unit_price", e.target.value)} /></div>
            <div><label className={LBL}>금액(원) *</label>
              <input inputMode="numeric" className={CTRL} value={fuelForm.amount}
                onChange={e => { setAmountTouched(true); setFuelField("amount", e.target.value); }} /></div>
            <div><label className={LBL}>계기판(km)</label>
              <input inputMode="decimal" className={CTRL} value={fuelForm.odometer} onChange={e => setFuelField("odometer", e.target.value)} /></div>
            <div className="col-span-2"><label className={LBL}>결제수단</label>
              <div className="flex gap-1.5">
                {PAY_METHODS.map(p => (
                  <button key={p} type="button" onClick={() => setFuelField("pay_method", p)}
                    className={`h-10 px-3 rounded-xl border text-sm transition-all ${fuelForm.pay_method === p ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>{p}</button>
                ))}
              </div></div>
            <div className="col-span-2 md:col-span-3"><label className={LBL}>메모</label>
              <input className={CTRL} value={fuelForm.memo} onChange={e => setFuelField("memo", e.target.value)} /></div>
            <div className="col-span-2 md:col-span-1 flex items-end">
              <button className={`${BTO} h-10 w-full`} disabled={saving} onClick={() => void saveFuel()}>{editingId ? "수정 저장" : "주유 저장"}</button>
            </div>
          </div>
        )}
      </div>

      {/* 일자별 목록 */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">불러오는 중…</p>
      ) : days.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{month.replace("-", "년 ")}월 기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {days.map(([date, d]) => {
            const dayDist = d.trips.reduce((a, t) => a + (Number(t.distance_km) || 0), 0);
            const dayFuel = d.fuels.reduce((a, f) => a + (Number(f.amount) || 0), 0);
            return (
              <div key={date} className={`${CARD} p-3`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-[#0f172a]">{labelDate(date)}</p>
                  <p className="text-[11px] text-gray-500">{dayDist > 0 && km(dayDist)}{dayDist > 0 && dayFuel > 0 && " · "}{dayFuel > 0 && `주유 ${won(dayFuel)}`}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {d.trips.map(t => (
                    <div key={`t${t.id}`} className="py-2 flex items-start gap-2">
                      <span className={`${CHIP} border-blue-200 bg-blue-50 text-blue-700 mt-0.5`}>운행</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0f172a]"><b>{t.origin}</b> → <b>{t.destination}</b>
                          {t.distance_km != null && <span className="text-gray-500"> · {km(Number(t.distance_km))}</span>}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {t.driver}
                          {t.odometer_start != null && t.odometer_end != null && ` · 계기판 ${Number(t.odometer_start).toLocaleString()}→${Number(t.odometer_end).toLocaleString()}`}
                          {t.cargo && ` · ${t.cargo}`}{t.memo && ` · ${t.memo}`}
                        </p>
                      </div>
                      <button className={BTG} onClick={() => editTrip(t)}>수정</button>
                      <button className={`${BTG} hover:text-red-600`} onClick={() => void remove("truck_trips", t.id)}>삭제</button>
                    </div>
                  ))}
                  {d.fuels.map(f => (
                    <div key={`f${f.id}`} className="py-2 flex items-start gap-2">
                      <span className={`${CHIP} border-orange-200 bg-orange-50 text-orange-700 mt-0.5`}>주유</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0f172a]"><b>{won(Number(f.amount))}</b>
                          {f.liters != null && <span className="text-gray-500"> · {Number(f.liters)}L</span>}
                          {f.unit_price != null && <span className="text-gray-500"> · {Number(f.unit_price).toLocaleString()}원/L</span>}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {f.driver}{f.station && ` · ${f.station}`}{f.pay_method && ` · ${f.pay_method}`}
                          {f.odometer != null && ` · 계기판 ${Number(f.odometer).toLocaleString()}`}{f.memo && ` · ${f.memo}`}
                        </p>
                      </div>
                      <button className={BTG} onClick={() => editFuel(f)}>수정</button>
                      <button className={`${BTG} hover:text-red-600`} onClick={() => void remove("truck_fuels", f.id)}>삭제</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
