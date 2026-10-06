// pages/secretary/DiaryTab.tsx
// AI비서 "📔 다이어리" 탭 — 날짜별로 오늘 한 일 / 내일 할 일을 정리한다.
// 테이블: secretary_diary_items, secretary_diary_notes (supabase/migrations/20261007120000_secretary_diary.sql)
//
// 데이터 계약
//   - kind="done" : 그날 한 일 (entry_date = 한 날짜)
//   - kind="plan" : 할 일 (entry_date = 실행할 날짜). D일 화면의 "내일 할 일"은 entry_date=D+1 인 plan.
//                   D+1일이 되면 같은 항목이 "오늘 할 일"로 보이고, 체크하면 "오늘 한 일"에 함께 집계된다.
//
// 할 일 → 일정 등록 (두 가지 방법)
//   1) 각 할 일 옆 📅 버튼 → 날짜/시간/구분 선택 후 등록
//   2) 입력할 때 시간으로 시작하면 자동 등록: "14:00 OO상사 미팅", "오후 3시 견적 전화", "10시반 현장방문"
//   등록된 일정은 secretary_schedules에 저장되고, 구글 캘린더 연동 시 부모(onScheduleCreated)가 동기화한다.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type DiaryItem = {
  id: number; entry_date: string; kind: "done" | "plan"; content: string;
  is_checked: boolean; schedule_id: number | null; sort_order: number; created_at: string;
};
type LinkedSchedule = { id: number; schedule_date: string; start_time: string | null; is_done: boolean };
type SchedCategory = "meeting" | "call" | "task" | "followup";
export type DiaryScheduleCreated = {
  id: number; title: string; description: string | null; schedule_date: string;
  start_time: string | null; end_time: string | null; location: string | null;
};

const CARD = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const CTRL = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
const BTO = "px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all disabled:opacity-50";
const BTG = "px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 transition-all disabled:opacity-50";
const CAT_LABEL: Record<SchedCategory, string> = { meeting: "미팅", call: "통화", task: "업무", followup: "팔로업" };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => fmtDate(new Date());
const addDays = (s: string, n: number) => { const [y, m, d] = s.split("-").map(Number); return fmtDate(new Date(y, m - 1, d + n)); };
const labelDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`; };

// "14:00 …", "14시 …", "오후 3시 …", "10시반 …", "9시 30분 …" 처럼 시간으로 시작하면 시간과 나머지 내용을 분리한다.
// 오전/오후 표기 없이 1~7시는 업무시간 기준 오후로 본다.
export function parseLeadingTime(text: string): { time: string; rest: string } | null {
  const m = text.match(/^\s*(오전|오후)?\s*(\d{1,2})(?::(\d{2})|\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?)\s+(.+)$/);
  if (!m) return null;
  let h = Number(m[2]);
  const min = m[3] ? Number(m[3]) : m[4] ? Number(m[4]) : m[5] ? 30 : 0;
  if (m[1] === "오후" && h < 12) h += 12;
  else if (m[1] === "오전" && h === 12) h = 0;
  else if (!m[1] && h >= 1 && h <= 7) h += 12;
  if (h > 23 || min > 59) return null;
  return { time: `${pad2(h)}:${pad2(min)}`, rest: m[6].trim() };
}

function guessCategory(text: string): SchedCategory {
  if (/미팅|회의|방문|면담|상담|만남|점심|저녁/.test(text)) return "meeting";
  if (/통화|전화|콜/.test(text)) return "call";
  return "task";
}

export default function DiaryTab({
  showToast, onScheduleCreated,
}: {
  showToast: (msg: string, type?: "ok" | "err") => void;
  onScheduleCreated?: (s: DiaryScheduleCreated) => void;
}) {
  // 부모의 showToast는 렌더마다 새로 만들어지므로 ref로 고정해 load 재생성을 막는다
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const [date, setDate] = useState(todayStr);
  const tomorrow = addDays(date, 1);
  const isToday = date === todayStr();

  const [items, setItems] = useState<DiaryItem[]>([]);           // date의 done/plan + tomorrow의 plan
  const [overdue, setOverdue] = useState<DiaryItem[]>([]);       // date 이전 미완료 plan (오늘 화면에서만)
  const [schedMap, setSchedMap] = useState<Record<number, LinkedSchedule>>({});
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneInput, setDoneInput] = useState("");
  const [planInput, setPlanInput] = useState("");
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [schedForm, setSchedForm] = useState<{ item: DiaryItem; date: string; time: string; category: SchedCategory } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, noteRes, overdueRes] = await Promise.all([
      supabase.from("secretary_diary_items").select("*")
        .or(`entry_date.eq.${date},and(entry_date.eq.${tomorrow},kind.eq.plan)`)
        .order("sort_order").order("created_at"),
      supabase.from("secretary_diary_notes").select("note").eq("entry_date", date).maybeSingle(),
      isToday
        ? supabase.from("secretary_diary_items").select("*")
          .eq("kind", "plan").eq("is_checked", false).lt("entry_date", date).gte("entry_date", addDays(date, -14))
          .order("entry_date").order("created_at")
        : Promise.resolve({ data: [], error: null }),
    ]);
    setLoading(false);
    if (itemsRes.error) { toastRef.current("다이어리 불러오기 실패: " + itemsRes.error.message, "err"); return; }
    const all = [...((itemsRes.data ?? []) as DiaryItem[]), ...((overdueRes.data ?? []) as DiaryItem[])];
    setItems((itemsRes.data ?? []) as DiaryItem[]);
    setOverdue((overdueRes.data ?? []) as DiaryItem[]);
    const n = (noteRes.data as { note: string } | null)?.note ?? "";
    setNote(n); setSavedNote(n);
    const sIds = all.map(i => i.schedule_id).filter((x): x is number => x != null);
    if (sIds.length) {
      const { data } = await supabase.from("secretary_schedules").select("id,schedule_date,start_time,is_done").in("id", sIds);
      setSchedMap(Object.fromEntries(((data ?? []) as LinkedSchedule[]).map(s => [s.id, s])));
    } else setSchedMap({});
  }, [date, tomorrow, isToday]);

  useEffect(() => { void load(); }, [load]);

  const todayPlans = items.filter(i => i.kind === "plan" && i.entry_date === date);
  const doneItems = items.filter(i => i.kind === "done" && i.entry_date === date);
  const checkedPlans = todayPlans.filter(i => i.is_checked);
  const tomorrowPlans = items.filter(i => i.kind === "plan" && i.entry_date === tomorrow);

  // ─── 일정 등록 ───────────────────────────────────────────────────────────────
  async function createSchedule(item: DiaryItem, schedDate: string, time: string | null, category: SchedCategory) {
    const { data, error } = await supabase.from("secretary_schedules").insert({
      title: item.content, description: "다이어리에서 등록", schedule_date: schedDate,
      start_time: time || null, end_time: null, category,
    }).select("id").single();
    if (error || !data) { showToast("일정 등록 실패: " + (error?.message ?? ""), "err"); return false; }
    await supabase.from("secretary_diary_items").update({ schedule_id: data.id }).eq("id", item.id);
    onScheduleCreated?.({
      id: data.id, title: item.content, description: "다이어리에서 등록", schedule_date: schedDate,
      start_time: time || null, end_time: null, location: null,
    });
    showToast(`📅 ${labelDate(schedDate)}${time ? " " + time : ""} 일정 등록 완료`);
    return true;
  }

  async function submitSchedForm() {
    if (!schedForm) return;
    setBusy(true);
    const ok = await createSchedule(schedForm.item, schedForm.date, schedForm.time || null, schedForm.category);
    setBusy(false);
    if (ok) { setSchedForm(null); void load(); }
  }

  // ─── 항목 CRUD ───────────────────────────────────────────────────────────────
  async function addItem(kind: "done" | "plan") {
    const raw = (kind === "done" ? doneInput : planInput).trim();
    if (!raw) return;
    const entryDate = kind === "done" ? date : tomorrow;
    const parsed = kind === "plan" ? parseLeadingTime(raw) : null;
    const content = parsed ? `${parsed.time} ${parsed.rest}` : raw;
    const sameKind = items.filter(i => i.kind === kind && i.entry_date === entryDate);
    setBusy(true);
    const { data, error } = await supabase.from("secretary_diary_items").insert({
      entry_date: entryDate, kind, content, is_checked: false,
      sort_order: sameKind.length ? Math.max(...sameKind.map(i => i.sort_order)) + 1 : 0,
    }).select("*").single();
    if (error || !data) { setBusy(false); showToast("저장 실패: " + (error?.message ?? ""), "err"); return; }
    if (parsed) await createSchedule({ ...(data as DiaryItem), content: parsed.rest }, entryDate, parsed.time, guessCategory(parsed.rest));
    setBusy(false);
    if (kind === "done") setDoneInput(""); else setPlanInput("");
    void load();
  }

  async function toggleCheck(item: DiaryItem) {
    const next = !item.is_checked;
    setItems(p => p.map(i => i.id === item.id ? { ...i, is_checked: next } : i));
    setOverdue(p => p.map(i => i.id === item.id ? { ...i, is_checked: next } : i));
    const { error } = await supabase.from("secretary_diary_items").update({ is_checked: next }).eq("id", item.id);
    if (error) { showToast("변경 실패: " + error.message, "err"); void load(); return; }
    // 연결된 일정도 완료/미완료를 함께 맞춘다
    if (item.schedule_id) await supabase.from("secretary_schedules").update({ is_done: next }).eq("id", item.schedule_id);
    // 밀린 할 일을 체크하면 오늘 한 일로 집계되도록 오늘 날짜로 옮긴다
    if (next && item.entry_date < date) {
      await supabase.from("secretary_diary_items").update({ entry_date: date }).eq("id", item.id);
      void load();
    }
  }

  async function moveTo(item: DiaryItem, target: string) {
    const { error } = await supabase.from("secretary_diary_items").update({ entry_date: target }).eq("id", item.id);
    if (error) { showToast("이동 실패: " + error.message, "err"); return; }
    showToast(`${labelDate(target)}로 옮겼습니다`);
    void load();
  }

  async function saveEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    setEditing(null);
    if (!text) return;
    await supabase.from("secretary_diary_items").update({ content: text }).eq("id", editing.id);
    void load();
  }

  async function removeItem(item: DiaryItem) {
    const msg = item.schedule_id ? "삭제하시겠습니까?\n(등록된 일정은 일정 탭에 그대로 남습니다)" : "삭제하시겠습니까?";
    if (!confirm(msg)) return;
    await supabase.from("secretary_diary_items").delete().eq("id", item.id);
    void load();
  }

  async function saveNote() {
    if (note === savedNote) return;
    const { error } = await supabase.from("secretary_diary_notes")
      .upsert({ entry_date: date, note, updated_at: new Date().toISOString() }, { onConflict: "user_id,entry_date" });
    if (error) { showToast("메모 저장 실패: " + error.message, "err"); return; }
    setSavedNote(note);
  }

  // 그날 완료 처리된 일정·할일을 "한 일"로 불러온다 (이미 있는 내용은 건너뜀)
  async function importCompleted() {
    setBusy(true);
    const [s, t] = await Promise.all([
      supabase.from("secretary_schedules").select("title,start_time").eq("schedule_date", date).eq("is_done", true).order("start_time"),
      supabase.from("secretary_todos").select("title,done_at").eq("is_done", true)
        .gte("done_at", `${date}T00:00:00`).lt("done_at", `${tomorrow}T00:00:00`),
    ]);
    const existing = new Set([...doneItems, ...checkedPlans].map(i => i.content.replace(/^\d{2}:\d{2}\s+/, "").trim().toLowerCase()));
    const titles = [
      ...((s.data ?? []) as { title: string }[]).map(x => x.title),
      ...((t.data ?? []) as { title: string }[]).map(x => x.title),
    ].map(x => x.trim()).filter(x => x && !existing.has(x.toLowerCase()));
    const uniq = Array.from(new Set(titles));
    if (!uniq.length) { setBusy(false); showToast("가져올 완료 일정·할일이 없습니다"); return; }
    const base = doneItems.length ? Math.max(...doneItems.map(i => i.sort_order)) + 1 : 0;
    const { error } = await supabase.from("secretary_diary_items").insert(
      uniq.map((content, idx) => ({ entry_date: date, kind: "done", content, is_checked: true, sort_order: base + idx })),
    );
    setBusy(false);
    if (error) { showToast("불러오기 실패: " + error.message, "err"); return; }
    showToast(`완료된 일정·할일 ${uniq.length}건을 불러왔습니다`);
    void load();
  }

  async function copySummary() {
    const lines = [
      `[${labelDate(date)} 업무일지]`,
      "",
      "■ 한 일",
      ...[...checkedPlans, ...doneItems].map(i => `- ${i.content}`),
      ...(todayPlans.some(i => !i.is_checked) ? ["", "■ 미완료", ...todayPlans.filter(i => !i.is_checked).map(i => `- ${i.content}`)] : []),
      "",
      `■ 내일 할 일 (${labelDate(tomorrow)})`,
      ...tomorrowPlans.map(i => `- ${i.content}`),
      ...(note.trim() ? ["", "■ 메모", note.trim()] : []),
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); showToast("업무일지를 복사했습니다"); }
    catch { showToast("복사 실패 — 브라우저 권한을 확인해 주세요", "err"); }
  }

  // ─── 렌더링 ─────────────────────────────────────────────────────────────────
  const scheduleBadge = (item: DiaryItem) => {
    if (!item.schedule_id) return null;
    const s = schedMap[item.schedule_id];
    return (
      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
        📅 {s ? `${labelDate(s.schedule_date)}${s.start_time ? " " + s.start_time.slice(0, 5) : ""}` : "일정"}
      </span>
    );
  };

  const row = (item: DiaryItem, opts: { checkable: boolean; actions?: React.ReactNode; tag?: string }) => (
    <li key={item.id} className="group flex items-start gap-2 py-1.5">
      {opts.checkable
        ? <input type="checkbox" className="mt-1 w-4 h-4 accent-orange-500 flex-shrink-0 cursor-pointer" checked={item.is_checked} onChange={() => void toggleCheck(item)} />
        : <span className="mt-1 w-4 text-center text-gray-300 flex-shrink-0">•</span>}
      <div className="flex-1 min-w-0 flex items-start gap-1.5 flex-wrap">
        {opts.tag && <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">{opts.tag}</span>}
        {editing?.id === item.id
          ? <input autoFocus className="flex-1 min-w-0 text-sm border-b border-orange-300 focus:outline-none" value={editing.text}
            onChange={e => setEditing({ id: item.id, text: e.target.value })}
            onBlur={() => void saveEdit()}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void saveEdit(); if (e.key === "Escape") setEditing(null); }} />
          : <span className={`text-sm break-all cursor-text ${opts.checkable && item.is_checked ? "line-through text-gray-400" : "text-[#0f172a]"}`}
            onDoubleClick={() => setEditing({ id: item.id, text: item.content })}>{item.content}</span>}
        {scheduleBadge(item)}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {opts.actions}
        <button className="text-xs text-gray-400 hover:text-gray-600 px-1" title="수정" onClick={() => setEditing({ id: item.id, text: item.content })}>✏️</button>
        <button className="text-xs text-gray-400 hover:text-red-500 px-1" title="삭제" onClick={() => void removeItem(item)}>🗑</button>
      </div>
    </li>
  );

  const schedButton = (item: DiaryItem) => !item.schedule_id && (
    <button className="text-xs px-1.5 py-0.5 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50" title="일정으로 등록"
      onClick={() => {
        const p = parseLeadingTime(item.content);
        setSchedForm({ item: p ? { ...item, content: p.rest } : item, date: item.entry_date, time: p?.time ?? "", category: guessCategory(item.content) });
      }}>📅 일정</button>
  );

  const addBox = (kind: "done" | "plan") => (
    <div className="flex gap-2 mt-2">
      <input className={CTRL} disabled={busy}
        placeholder={kind === "done" ? "오늘 한 일을 입력 후 Enter" : "예) 14:00 OO상사 미팅 → 일정 자동 등록"}
        value={kind === "done" ? doneInput : planInput}
        onChange={e => kind === "done" ? setDoneInput(e.target.value) : setPlanInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void addItem(kind); }} />
      <button className={BTO} disabled={busy} onClick={() => void addItem(kind)}>추가</button>
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* 헤더 · 날짜 이동 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0f172a]">📔 업무 다이어리</p>
          <p className="text-xs text-gray-400 mt-0.5">오늘 한 일과 내일 할 일을 정리하고, 할 일은 바로 일정으로 등록합니다</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={BTG} onClick={() => setDate(d => addDays(d, -1))}>◀</button>
          <input type="date" className="h-8 rounded-xl border border-gray-200 px-2 text-sm text-[#0f172a]" value={date}
            onChange={e => e.target.value && setDate(e.target.value)} />
          <button className={BTG} onClick={() => setDate(d => addDays(d, 1))}>▶</button>
          {!isToday && <button className={BTG} onClick={() => setDate(todayStr())}>오늘</button>}
          <button className={BTG} onClick={() => void copySummary()} title="보고용 텍스트로 복사">📋 복사</button>
        </div>
      </div>

      {loading && items.length === 0 && <p className="text-xs text-gray-400">불러오는 중…</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {/* 왼쪽: 오늘 */}
        <div className="space-y-4">
          {(todayPlans.length > 0 || overdue.length > 0) && (
            <div className={`${CARD} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0f172a]">📌 {isToday ? "오늘" : labelDate(date)} 할 일</p>
                <span className="text-xs text-gray-400">{checkedPlans.length}/{todayPlans.length} 완료</span>
              </div>
              <ul className="mt-2 divide-y divide-gray-50">
                {overdue.map(i => row(i, {
                  checkable: true, tag: `${labelDate(i.entry_date)} 밀림`,
                  actions: <button className="text-xs px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50" onClick={() => void moveTo(i, date)}>오늘로</button>,
                }))}
                {todayPlans.map(i => row(i, {
                  checkable: true,
                  actions: <>
                    {!i.is_checked && schedButton(i)}
                    {!i.is_checked && <button className="text-xs px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50" onClick={() => void moveTo(i, tomorrow)}>내일로 →</button>}
                  </>,
                }))}
              </ul>
            </div>
          )}

          <div className={`${CARD} p-4`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#0f172a]">✅ {isToday ? "오늘" : labelDate(date)} 한 일</p>
              <button className={BTG} disabled={busy} onClick={() => void importCompleted()} title="그날 완료 처리한 일정·할일을 가져옵니다">↻ 완료 일정 불러오기</button>
            </div>
            <ul className="mt-2 divide-y divide-gray-50">
              {checkedPlans.map(i => row(i, { checkable: true, tag: "계획" }))}
              {doneItems.map(i => row(i, { checkable: false }))}
              {checkedPlans.length + doneItems.length === 0 && <li className="py-3 text-xs text-gray-400">아직 기록이 없습니다</li>}
            </ul>
            {addBox("done")}
          </div>
        </div>

        {/* 오른쪽: 내일 + 메모 */}
        <div className="space-y-4">
          <div className={`${CARD} p-4`}>
            <p className="text-sm font-semibold text-[#0f172a]">🗓 내일 할 일 <span className="text-xs font-normal text-gray-400">{labelDate(tomorrow)}</span></p>
            <ul className="mt-2 divide-y divide-gray-50">
              {tomorrowPlans.map(i => row(i, { checkable: false, actions: schedButton(i) }))}
              {tomorrowPlans.length === 0 && <li className="py-3 text-xs text-gray-400">내일 할 일을 적어두면 내일 이 화면의 "오늘 할 일"로 올라옵니다</li>}
            </ul>
            {addBox("plan")}
            <p className="text-[11px] text-gray-400 mt-2">💡 시간으로 시작하면 일정에도 자동 등록됩니다 — "14:00 …", "오후 3시 …", "10시반 …"</p>
          </div>

          <div className={`${CARD} p-4`}>
            <p className="text-sm font-semibold text-[#0f172a]">📝 메모 · 회고</p>
            <textarea rows={5}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:border-orange-400 transition-all"
              placeholder="특이사항, 배운 점, 내일 챙길 것…"
              value={note} onChange={e => setNote(e.target.value)} onBlur={() => void saveNote()} />
            <p className="text-[11px] text-gray-400 text-right">{note === savedNote ? "저장됨" : "입력창을 벗어나면 저장됩니다"}</p>
          </div>
        </div>
      </div>

      {/* 일정 등록 모달 */}
      {schedForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4" onClick={() => !busy && setSchedForm(null)}>
          <div className={`${CARD} w-full max-w-sm p-5 space-y-3`} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-[#0f172a]">📅 일정으로 등록</p>
            <p className="text-sm text-gray-600 break-all">{schedForm.item.content}</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={CTRL} value={schedForm.date} onChange={e => setSchedForm(f => f && { ...f, date: e.target.value })} />
              <input type="time" className={CTRL} value={schedForm.time} onChange={e => setSchedForm(f => f && { ...f, time: e.target.value })} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(CAT_LABEL) as SchedCategory[]).map(c => (
                <button key={c} onClick={() => setSchedForm(f => f && { ...f, category: c })}
                  className={`px-3 py-1 rounded-lg text-xs border ${schedForm.category === c ? "bg-[#0f172a] text-white border-[#0f172a]" : "border-gray-200 text-gray-500"}`}>
                  {CAT_LABEL[c]}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className={BTG} disabled={busy} onClick={() => setSchedForm(null)}>취소</button>
              <button className={BTO} disabled={busy || !schedForm.date} onClick={() => void submitSchedForm()}>{busy ? "등록 중…" : "등록"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
