// pages/secretary/DiaryTab.tsx
// AI비서 "📔 다이어리" 탭 — 하루를 자유형식으로 돌아보고, 넘길 것들을 내일/다음 일정으로 정리하는 화면.
// 테이블: secretary_diary_items, secretary_diary_notes
//   (supabase/migrations/20261007120000_secretary_diary.sql, 20261007150000_secretary_diary_forward.sql)
//
// 화면 흐름
//   1) "오늘 돌아보기"에 한 일을 노트처럼 한 줄씩 입력 (Enter = 다음 줄, 빈 줄에서 Backspace = 줄 삭제,
//      여러 줄 붙여넣기 = 줄마다 분리 저장)
//   2) 각 줄의 "→ 내일" 클릭 → 내일 할 일로 등록 (다시 누르면 취소)
//      각 줄의 "📅 일정" 클릭 → 날짜/시간을 골라 secretary_schedules 일정으로 등록 (구글 캘린더 연동 시 동기화)
//   3) 메모·회고는 하루 단위 자유 메모
//
// 데이터 계약
//   - kind="done" : 오늘 돌아보기 한 줄 (entry_date = 그날). forwarded_item_id = "→ 내일"로 만든 plan 항목
//   - kind="plan" : 할 일 (entry_date = 실행할 날짜). D일의 "내일로 넘긴 일"은 entry_date=D+1 인 plan이며,
//                   D+1일 화면에서는 "오늘 예정이었던 일" 체크리스트로 보인다.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type DiaryItem = {
  id: number; entry_date: string; kind: "done" | "plan"; content: string;
  is_checked: boolean; schedule_id: number | null; forwarded_item_id: number | null;
  sort_order: number; created_at: string;
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
const CHIP = "flex-shrink-0 text-[11px] px-2 py-0.5 rounded-md border transition-all whitespace-nowrap";
const CAT_LABEL: Record<SchedCategory, string> = { meeting: "미팅", call: "통화", task: "업무", followup: "팔로업" };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => fmtDate(new Date());
const addDays = (s: string, n: number) => { const [y, m, d] = s.split("-").map(Number); return fmtDate(new Date(y, m - 1, d + n)); };
const labelDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`; };

// "14:00 …", "14시 …", "오후 3시 …", "10시반 …", "9시 30분 …" 처럼 시간으로 시작하면 시간과 나머지 내용을 분리한다.
// 일정 등록 창의 시간/제목 기본값을 채우는 데만 쓴다. 오전/오후 표기 없이 1~7시는 업무시간 기준 오후로 본다.
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

// 오늘 돌아보기 한 줄 — 입력 중 텍스트는 로컬로 들고 있다가 포커스를 벗어나거나 Enter 시 저장한다.
function ReviewRow({
  item, index, inputRef, onSave, onEnter, onRemoveEmpty, onArrow, actions,
}: {
  item: DiaryItem; index: number;
  inputRef: (el: HTMLInputElement | null) => void;
  onSave: (text: string) => void;
  onEnter: () => void;
  onRemoveEmpty: () => void;
  onArrow: (dir: -1 | 1) => void;
  actions: React.ReactNode;
}) {
  const [text, setText] = useState(item.content);
  useEffect(() => { setText(item.content); }, [item.content]);
  const commit = () => { const t = text.trim(); if (t && t !== item.content) onSave(t); else if (!t) setText(item.content); };
  return (
    <li className="group flex items-center gap-2 py-1 border-b border-gray-50 last:border-b-0">
      <span className="w-5 text-right text-[11px] text-gray-300 flex-shrink-0 tabular-nums">{index + 1}</span>
      <input ref={inputRef}
        className="flex-1 min-w-0 h-8 text-sm text-[#0f172a] bg-transparent focus:outline-none focus:bg-orange-50/40 rounded-md px-1"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") { e.preventDefault(); commit(); onEnter(); }
          else if (e.key === "Backspace" && text === "") { e.preventDefault(); onRemoveEmpty(); }
          else if (e.key === "ArrowUp") { e.preventDefault(); onArrow(-1); }
          else if (e.key === "ArrowDown") { e.preventDefault(); onArrow(1); }
        }} />
      <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>
    </li>
  );
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
  // 비동기 저장/조회가 끝났을 때 그 사이 날짜가 바뀌었는지 확인하는 용도
  const dateRef = useRef(date);
  dateRef.current = date;
  const tomorrow = addDays(date, 1);
  const isToday = date === todayStr();
  // 어제 것을 정리할 때도 헷갈리지 않도록 오늘 기준 상대 표현을 쓴다 (어제/오늘/내일, 그 밖은 M/D(요일))
  const dayWord = (s: string) => {
    const t = todayStr();
    return s === t ? "오늘" : s === addDays(t, -1) ? "어제" : s === addDays(t, 1) ? "내일" : labelDate(s);
  };
  const nextWord = dayWord(tomorrow);

  const [items, setItems] = useState<DiaryItem[]>([]);           // date의 done/plan + tomorrow의 plan
  const [overdue, setOverdue] = useState<DiaryItem[]>([]);       // date 이전 미완료 plan (오늘 화면에서만)
  const [schedMap, setSchedMap] = useState<Record<number, LinkedSchedule>>({});
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [newRow, setNewRow] = useState("");
  const [planInput, setPlanInput] = useState("");
  const [editingPlan, setEditingPlan] = useState<{ id: number; text: string } | null>(null);
  const [schedForm, setSchedForm] = useState<{ item: DiaryItem; title: string; date: string; time: string; category: SchedCategory } | null>(null);
  const [busy, setBusy] = useState(false);

  const rowRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const newRowRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const reqDate = date;
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
    if (dateRef.current !== reqDate) return;   // 조회 중에 날짜를 바꿨으면 이전 날짜 결과는 버린다
    setLoading(false);
    if (itemsRes.error) { toastRef.current("다이어리 불러오기 실패: " + itemsRes.error.message, "err"); return; }
    const loaded = (itemsRes.data ?? []) as DiaryItem[];
    const late = (overdueRes.data ?? []) as DiaryItem[];
    setItems(loaded);
    setOverdue(late);
    const n = (noteRes.data as { note: string } | null)?.note ?? "";
    setNote(n); setSavedNote(n);
    const sIds = [...loaded, ...late].map(i => i.schedule_id).filter((x): x is number => x != null);
    if (sIds.length) {
      const { data } = await supabase.from("secretary_schedules").select("id,schedule_date,start_time,is_done").in("id", sIds);
      setSchedMap(Object.fromEntries(((data ?? []) as LinkedSchedule[]).map(s => [s.id, s])));
    } else setSchedMap({});
  }, [date, tomorrow, isToday]);

  useEffect(() => { void load(); }, [load]);

  const rows = items.filter(i => i.kind === "done" && i.entry_date === date);
  const todayPlans = items.filter(i => i.kind === "plan" && i.entry_date === date);
  const tomorrowPlans = items.filter(i => i.kind === "plan" && i.entry_date === tomorrow);
  const forwardedFrom = new Set(rows.map(r => r.forwarded_item_id).filter((x): x is number => x != null));
  const scheduled = [...rows, ...todayPlans, ...overdue, ...tomorrowPlans].filter(i => i.schedule_id && schedMap[i.schedule_id]);

  const patchLocal = (id: number, patch: Partial<DiaryItem>) => {
    setItems(p => p.map(i => i.id === id ? { ...i, ...patch } : i));
    setOverdue(p => p.map(i => i.id === id ? { ...i, ...patch } : i));
  };
  const nextSort = (list: DiaryItem[]) => list.length ? Math.max(...list.map(i => i.sort_order)) + 1 : 0;

  // ─── 오늘 돌아보기 행 ────────────────────────────────────────────────────────
  async function addRows(texts: string[]) {
    const clean = texts.map(t => t.trim()).filter(Boolean);
    if (!clean.length) return;
    const forDate = date;
    const base = nextSort(rows);
    const { data, error } = await supabase.from("secretary_diary_items").insert(
      clean.map((content, idx) => ({ entry_date: forDate, kind: "done", content, is_checked: true, sort_order: base + idx })),
    ).select("*");
    if (error) { showToast("저장 실패: " + error.message, "err"); return; }
    if (dateRef.current === forDate) setItems(p => [...p, ...((data ?? []) as DiaryItem[])]);
  }

  async function saveRow(item: DiaryItem, text: string) {
    patchLocal(item.id, { content: text });
    const { error } = await supabase.from("secretary_diary_items").update({ content: text }).eq("id", item.id);
    if (error) showToast("저장 실패: " + error.message, "err");
  }

  async function removeItem(item: DiaryItem, ask = true) {
    if (ask) {
      const linked = item.schedule_id || item.forwarded_item_id;
      if (!confirm(linked ? "삭제하시겠습니까?\n(이미 넘긴 내일 할 일·일정은 그대로 남습니다)" : "삭제하시겠습니까?")) return;
    }
    setItems(p => p.filter(i => i.id !== item.id));
    setOverdue(p => p.filter(i => i.id !== item.id));
    const { error } = await supabase.from("secretary_diary_items").delete().eq("id", item.id);
    if (error) { showToast("삭제 실패: " + error.message, "err"); void load(); }
  }

  const focusRow = (idx: number) => {
    if (idx >= rows.length) { newRowRef.current?.focus(); return; }
    if (idx >= 0) rowRefs.current[rows[idx].id]?.focus();
  };

  // "→ 내일" 토글: 내일 할 일을 만들거나, 이미 넘겼으면 그 내일 할 일을 지운다
  async function toggleForward(row: DiaryItem) {
    if (row.forwarded_item_id) {
      const planId = row.forwarded_item_id;
      setItems(p => p.filter(i => i.id !== planId).map(i => i.id === row.id ? { ...i, forwarded_item_id: null } : i));
      await supabase.from("secretary_diary_items").delete().eq("id", planId);   // FK on delete set null로 링크도 해제
      return;
    }
    const { data, error } = await supabase.from("secretary_diary_items").insert({
      entry_date: tomorrow, kind: "plan", content: row.content, is_checked: false, sort_order: nextSort(tomorrowPlans),
    }).select("*").single();
    if (error || !data) { showToast("내일 할 일 등록 실패: " + (error?.message ?? ""), "err"); return; }
    await supabase.from("secretary_diary_items").update({ forwarded_item_id: data.id }).eq("id", row.id);
    setItems(p => [...p.map(i => i.id === row.id ? { ...i, forwarded_item_id: data.id } : i), data as DiaryItem]);
  }

  // ─── 일정 등록 ───────────────────────────────────────────────────────────────
  function openSchedForm(item: DiaryItem) {
    const p = parseLeadingTime(item.content);
    // 오늘 한 일/오늘 예정 → 기본 내일, 내일 할 일 → 그 날짜
    const defDate = item.kind === "plan" && item.entry_date > date ? item.entry_date : tomorrow;
    setSchedForm({ item, title: p ? p.rest : item.content, date: defDate, time: p?.time ?? "", category: guessCategory(item.content) });
  }

  async function submitSchedForm() {
    if (!schedForm || !schedForm.title.trim()) return;
    const { item, date: sDate, time, category } = schedForm;
    const title = schedForm.title.trim();
    setBusy(true);
    const { data, error } = await supabase.from("secretary_schedules").insert({
      title, description: "다이어리에서 등록", schedule_date: sDate, start_time: time || null, end_time: null, category,
    }).select("id,schedule_date,start_time,is_done").single();
    if (error || !data) { setBusy(false); showToast("일정 등록 실패: " + (error?.message ?? ""), "err"); return; }
    await supabase.from("secretary_diary_items").update({ schedule_id: data.id }).eq("id", item.id);
    setBusy(false);
    patchLocal(item.id, { schedule_id: data.id });
    setSchedMap(m => ({ ...m, [data.id]: data as LinkedSchedule }));
    setSchedForm(null);
    onScheduleCreated?.({ id: data.id, title, description: "다이어리에서 등록", schedule_date: sDate, start_time: time || null, end_time: null, location: null });
    showToast(`📅 ${labelDate(sDate)}${time ? " " + time : ""} 일정 등록 완료`);
  }

  // ─── 내일 할 일 / 오늘 예정 ──────────────────────────────────────────────────
  async function addPlan() {
    const content = planInput.trim();
    if (!content) return;
    const forDate = date;
    setPlanInput("");
    const { data, error } = await supabase.from("secretary_diary_items").insert({
      entry_date: tomorrow, kind: "plan", content, is_checked: false, sort_order: nextSort(tomorrowPlans),
    }).select("*").single();
    if (error || !data) { setPlanInput(content); showToast("저장 실패: " + (error?.message ?? ""), "err"); return; }
    if (dateRef.current === forDate) setItems(p => [...p, data as DiaryItem]);
  }

  // 날짜를 바꾸기 전에 입력칸에 적어둔(아직 Enter 안 누른) 글은 지금 보고 있는 날짜에 저장하고 비운다.
  // (비우지 않으면 글자가 다른 날짜 화면으로 따라가서, 그 날짜에 잘못 저장될 수 있다)
  function changeDate(next: string) {
    if (next === date) return;
    if (newRow.trim()) { const t = newRow; setNewRow(""); void addRows([t]); }
    if (planInput.trim()) void addPlan();
    setEditingPlan(null);
    setSchedForm(null);
    setDate(next);
  }

  async function savePlanEdit() {
    if (!editingPlan) return;
    const { id, text } = editingPlan;
    setEditingPlan(null);
    if (!text.trim()) return;
    patchLocal(id, { content: text.trim() });
    await supabase.from("secretary_diary_items").update({ content: text.trim() }).eq("id", id);
  }

  async function toggleCheck(item: DiaryItem) {
    const next = !item.is_checked;
    patchLocal(item.id, { is_checked: next });
    const { error } = await supabase.from("secretary_diary_items").update({ is_checked: next }).eq("id", item.id);
    if (error) { showToast("변경 실패: " + error.message, "err"); void load(); return; }
    if (item.schedule_id) await supabase.from("secretary_schedules").update({ is_done: next }).eq("id", item.schedule_id);
  }

  async function moveTo(item: DiaryItem, target: string) {
    const { error } = await supabase.from("secretary_diary_items").update({ entry_date: target }).eq("id", item.id);
    if (error) { showToast("이동 실패: " + error.message, "err"); return; }
    showToast(`${labelDate(target)}로 옮겼습니다`);
    void load();
  }

  async function saveNote() {
    if (note === savedNote) return;
    const { error } = await supabase.from("secretary_diary_notes")
      .upsert({ entry_date: date, note, updated_at: new Date().toISOString() }, { onConflict: "user_id,entry_date" });
    if (error) { showToast("메모 저장 실패: " + error.message, "err"); return; }
    setSavedNote(note);
  }

  // 그날 완료 처리된 일정·할일을 돌아보기 행으로 불러온다 (이미 있는 내용은 건너뜀)
  async function importCompleted() {
    setBusy(true);
    const [s, t] = await Promise.all([
      supabase.from("secretary_schedules").select("title,start_time").eq("schedule_date", date).eq("is_done", true).order("start_time"),
      supabase.from("secretary_todos").select("title,done_at").eq("is_done", true)
        .gte("done_at", `${date}T00:00:00`).lt("done_at", `${tomorrow}T00:00:00`),
    ]);
    const existing = new Set(rows.map(i => i.content.trim().toLowerCase()));
    const titles = [
      ...((s.data ?? []) as { title: string; start_time: string | null }[]).map(x => (x.start_time ? x.start_time.slice(0, 5) + " " : "") + x.title.trim()),
      ...((t.data ?? []) as { title: string }[]).map(x => x.title.trim()),
    ].filter(x => x && !existing.has(x.toLowerCase()));
    const uniq = Array.from(new Set(titles));
    if (!uniq.length) { setBusy(false); showToast("가져올 완료 일정·할일이 없습니다"); return; }
    await addRows(uniq);
    setBusy(false);
    showToast(`완료된 일정·할일 ${uniq.length}건을 불러왔습니다`);
  }

  async function copySummary() {
    const sched = (i: DiaryItem) => {
      const s = i.schedule_id ? schedMap[i.schedule_id] : null;
      return s ? ` → 📅 ${labelDate(s.schedule_date)}${s.start_time ? " " + s.start_time.slice(0, 5) : ""}` : "";
    };
    const lines = [
      `[${labelDate(date)} 업무일지]`,
      "",
      "■ 한 일",
      ...rows.map(i => `- ${i.content}${sched(i)}`),
      ...todayPlans.filter(i => i.is_checked).map(i => `- ${i.content}`),
      ...(todayPlans.some(i => !i.is_checked) ? ["", "■ 미완료", ...todayPlans.filter(i => !i.is_checked).map(i => `- ${i.content}`)] : []),
      "",
      `■ 다음날 할 일 (${labelDate(tomorrow)})`,
      ...tomorrowPlans.map(i => `- ${i.content}${sched(i)}`),
      ...(note.trim() ? ["", "■ 메모", note.trim()] : []),
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); showToast("업무일지를 복사했습니다"); }
    catch { showToast("복사 실패 — 브라우저 권한을 확인해 주세요", "err"); }
  }

  // ─── 렌더링 ─────────────────────────────────────────────────────────────────
  const schedChip = (item: DiaryItem) => {
    const s = item.schedule_id ? schedMap[item.schedule_id] : null;
    if (s) return (
      <span className={`${CHIP} bg-blue-50 text-blue-600 border-blue-100`} title="일정 등록됨">
        📅 {labelDate(s.schedule_date)}{s.start_time ? " " + s.start_time.slice(0, 5) : ""}
      </span>
    );
    return (
      <button className={`${CHIP} border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50`}
        title="다음 일정으로 등록" onClick={() => openSchedForm(item)}>📅 일정</button>
    );
  };

  const delBtn = (item: DiaryItem) => (
    <button className="text-xs text-gray-300 hover:text-red-500 px-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" title="삭제"
      onClick={() => void removeItem(item)}>✕</button>
  );

  const planRow = (item: DiaryItem, opts: { checkable: boolean; tag?: string; actions?: React.ReactNode }) => (
    <li key={item.id} className="group flex items-center gap-2 py-1.5">
      {opts.checkable
        ? <input type="checkbox" className="w-4 h-4 accent-orange-500 flex-shrink-0 cursor-pointer" checked={item.is_checked} onChange={() => void toggleCheck(item)} />
        : <span className="w-4 text-center text-gray-300 flex-shrink-0">•</span>}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
        {opts.tag && <span className={`${CHIP} bg-amber-50 text-amber-600 border-amber-100`}>{opts.tag}</span>}
        {editingPlan?.id === item.id
          ? <input autoFocus className="flex-1 min-w-0 text-sm border-b border-orange-300 focus:outline-none" value={editingPlan.text}
            onChange={e => setEditingPlan({ id: item.id, text: e.target.value })}
            onBlur={() => void savePlanEdit()}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void savePlanEdit(); if (e.key === "Escape") setEditingPlan(null); }} />
          : <span className={`text-sm break-all cursor-text ${opts.checkable && item.is_checked ? "line-through text-gray-400" : "text-[#0f172a]"}`}
            onClick={() => setEditingPlan({ id: item.id, text: item.content })}>{item.content}</span>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {opts.actions}
        {delBtn(item)}
      </div>
    </li>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* 헤더 · 날짜 이동 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0f172a]">📔 업무 다이어리</p>
          <p className="text-xs text-gray-400 mt-0.5">날짜별로 하루를 돌아보며 한 줄씩 적고, 넘길 것은 다음날 할 일·다음 일정으로 보냅니다</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={BTG} onClick={() => void copySummary()} title="보고용 텍스트로 복사">📋 복사</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {/* 왼쪽: 돌아보기 — 화면 아래까지 채운다 */}
        <div className="md:col-span-3 flex flex-col gap-4">
          {(todayPlans.length > 0 || overdue.length > 0) && (
            <div className={`${CARD} px-4 py-3`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">📌 {dayWord(date)} 예정이었던 일</p>
                <span className="text-[11px] text-gray-400">{todayPlans.filter(i => i.is_checked).length}/{todayPlans.length} 완료</span>
              </div>
              <ul className="mt-1">
                {overdue.map(i => planRow(i, {
                  checkable: true, tag: `${labelDate(i.entry_date)} 밀림`,
                  actions: <button className={`${CHIP} border-gray-200 text-gray-500 hover:bg-gray-50`} onClick={() => void moveTo(i, date)}>오늘로</button>,
                }))}
                {todayPlans.map(i => planRow(i, {
                  checkable: true,
                  actions: !i.is_checked && <>
                    {schedChip(i)}
                    <button className={`${CHIP} border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50`} onClick={() => void moveTo(i, tomorrow)}>→ {nextWord}</button>
                  </>,
                }))}
              </ul>
            </div>
          )}

          <div className={`${CARD} p-4 flex flex-col flex-1 min-h-[420px] md:min-h-[calc(100vh-230px)]`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[#0f172a]">
                ✍️ {dayWord(date)} 돌아보기
                {!isToday && <span className={`${CHIP} ml-2 align-middle font-normal bg-amber-50 text-amber-600 border-amber-100`}>{labelDate(date)} 정리 중</span>}
              </p>
              <button className={BTG} disabled={busy} onClick={() => void importCompleted()} title="그날 완료 처리한 일정·할일을 줄로 불러옵니다">↻ 완료 일정 불러오기</button>
            </div>
            {/* 날짜 선택 — 날짜별로 관리, 지난 날짜도 정리 가능 */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <button className={BTG} onClick={() => changeDate(addDays(date, -1))} title="전날">◀</button>
              <input type="date" className="h-8 rounded-xl border border-gray-200 px-2 text-sm text-[#0f172a] focus:outline-none focus:border-orange-400" value={date}
                onChange={e => e.target.value && changeDate(e.target.value)} />
              <button className={BTG} onClick={() => changeDate(addDays(date, 1))} title="다음날">▶</button>
              {[["어제", addDays(todayStr(), -1)], ["오늘", todayStr()]].map(([lbl, d]) => (
                <button key={lbl} onClick={() => changeDate(d)}
                  className={`px-3 py-1.5 rounded-xl border text-xs transition-all ${date === d ? "bg-[#0f172a] text-white border-[#0f172a]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {lbl}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">한 일을 한 줄씩 자유롭게 적으세요 · Enter 다음 줄 · 빈 줄에서 ⌫ 삭제 · 여러 줄 붙여넣기 가능</p>
            {loading && rows.length === 0 && <p className="text-xs text-gray-400 mt-2">불러오는 중…</p>}
            <ul className="mt-2 flex-1 cursor-text" onClick={e => { if (e.target === e.currentTarget) newRowRef.current?.focus(); }}>
              {rows.map((r, idx) => (
                <ReviewRow key={r.id} item={r} index={idx}
                  inputRef={el => { rowRefs.current[r.id] = el; }}
                  onSave={t => void saveRow(r, t)}
                  onEnter={() => focusRow(idx + 1)}
                  onRemoveEmpty={() => { focusRow(idx - 1 >= 0 ? idx - 1 : rows.length); void removeItem(r, !!(r.schedule_id || r.forwarded_item_id)); }}
                  onArrow={d => focusRow(idx + d)}
                  actions={<>
                    <button
                      className={`${CHIP} ${r.forwarded_item_id
                        ? "bg-orange-50 text-orange-600 border-orange-200"
                        : "border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50"}`}
                      title={r.forwarded_item_id ? `${nextWord} 할 일에서 빼기` : `${nextWord} 할 일로 등록 (${labelDate(tomorrow)})`}
                      onClick={() => void toggleForward(r)}>
                      {r.forwarded_item_id ? `✓ ${nextWord}` : `→ ${nextWord}`}
                    </button>
                    {schedChip(r)}
                    {delBtn(r)}
                  </>} />
              ))}
              <li className="flex items-center gap-2 py-1">
                <span className="w-5 text-right text-[11px] text-gray-300 flex-shrink-0">+</span>
                <input ref={newRowRef}
                  className="flex-1 min-w-0 h-8 text-sm text-[#0f172a] bg-transparent focus:outline-none focus:bg-orange-50/40 rounded-md px-1 placeholder:text-gray-300"
                  placeholder={rows.length ? "이어서 적기…" : "예) OO상사 지게차 견적 발송, 담당자 통화 — 다음주 재연락"}
                  value={newRow}
                  onChange={e => setNewRow(e.target.value)}
                  onBlur={() => { if (newRow.trim()) { const t = newRow; setNewRow(""); void addRows([t]); } }}
                  onPaste={e => {
                    const pasted = e.clipboardData.getData("text");
                    if (!pasted.includes("\n")) return;
                    e.preventDefault();
                    const lines = (newRow + pasted).split(/\r?\n/).map(l => l.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, ""));
                    setNewRow("");
                    void addRows(lines);
                  }}
                  onKeyDown={e => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter" && newRow.trim()) { e.preventDefault(); const t = newRow; setNewRow(""); void addRows([t]); }
                    else if ((e.key === "Backspace" && newRow === "") || e.key === "ArrowUp") { if (rows.length) { e.preventDefault(); focusRow(rows.length - 1); } }
                  }} />
              </li>
            </ul>
          </div>

        </div>

        {/* 오른쪽: 넘긴 것들 + 메모 */}
        <div className="md:col-span-2 space-y-4">
          <div className={`${CARD} p-4`}>
            <p className="text-sm font-semibold text-[#0f172a]">🗓 {nextWord} 할 일 <span className="text-xs font-normal text-gray-400">{labelDate(tomorrow)}</span></p>
            <ul className="mt-2">
              {tomorrowPlans.map(i => planRow(i, {
                checkable: false, tag: forwardedFrom.has(i.id) ? "돌아보기" : undefined, actions: schedChip(i),
              }))}
              {tomorrowPlans.length === 0 && <li className="py-2 text-xs text-gray-400">돌아보기 줄의 "→ {nextWord}"을 누르면 여기로 넘어옵니다</li>}
            </ul>
            <div className="flex gap-2 mt-2">
              <input className={CTRL} placeholder={`${nextWord} 할 일 직접 추가`} value={planInput}
                onChange={e => setPlanInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void addPlan(); }} />
              <button className={`${BTO} whitespace-nowrap flex-shrink-0`} onClick={() => void addPlan()}>추가</button>
            </div>
          </div>

          <div className={`${CARD} p-4`}>
            <p className="text-sm font-semibold text-[#0f172a]">📅 다음 일정으로 넘긴 것</p>
            <ul className="mt-2 space-y-1.5">
              {scheduled
                .sort((a, b) => {
                  const sa = schedMap[a.schedule_id!], sb = schedMap[b.schedule_id!];
                  return (sa.schedule_date + (sa.start_time ?? "")).localeCompare(sb.schedule_date + (sb.start_time ?? ""));
                })
                .map(i => {
                  const s = schedMap[i.schedule_id!];
                  return (
                    <li key={i.id} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0 text-xs text-blue-600 font-medium tabular-nums w-24">
                        {labelDate(s.schedule_date)}{s.start_time ? " " + s.start_time.slice(0, 5) : ""}
                      </span>
                      <span className={`break-all ${s.is_done ? "line-through text-gray-400" : "text-[#0f172a]"}`}>{i.content}</span>
                    </li>
                  );
                })}
              {scheduled.length === 0 && <li className="text-xs text-gray-400">각 줄의 "📅 일정"으로 등록한 일정이 여기에 모입니다 (일정 탭·구글 캘린더에도 반영)</li>}
            </ul>
          </div>

          <div className={`${CARD} p-4`}>
            <p className="text-sm font-semibold text-[#0f172a]">📝 메모 · 회고</p>
            <textarea rows={5}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 resize-y focus:outline-none focus:border-orange-400 transition-all"
              placeholder="오늘 하루 소감, 특이사항, 배운 점, 놓치지 말아야 할 것…"
              value={note} onChange={e => setNote(e.target.value)} onBlur={() => void saveNote()} />
            <p className="text-[11px] text-gray-400 text-right">{note === savedNote ? "저장됨" : "입력창을 벗어나면 저장됩니다"}</p>
          </div>
        </div>
      </div>

      {/* 일정 등록 모달 */}
      {schedForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4" onClick={() => !busy && setSchedForm(null)}>
          <div className={`${CARD} w-full max-w-sm p-5 space-y-3`} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-[#0f172a]">📅 다음 일정으로 등록</p>
            <input className={CTRL} value={schedForm.title} placeholder="일정 제목"
              onChange={e => setSchedForm(f => f && { ...f, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={CTRL} value={schedForm.date} onChange={e => setSchedForm(f => f && { ...f, date: e.target.value })} />
              <input type="time" className={CTRL} value={schedForm.time} onChange={e => setSchedForm(f => f && { ...f, time: e.target.value })} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[["내일", 1], ["모레", 2], ["다음주", 7]].map(([lbl, n]) => (
                <button key={lbl} className={`${CHIP} border-gray-200 text-gray-500 hover:bg-gray-50`}
                  onClick={() => setSchedForm(f => f && { ...f, date: addDays(date, n as number) })}>{lbl}</button>
              ))}
              <span className="w-px bg-gray-200 mx-1" />
              {(Object.keys(CAT_LABEL) as SchedCategory[]).map(c => (
                <button key={c} onClick={() => setSchedForm(f => f && { ...f, category: c })}
                  className={`${CHIP} ${schedForm.category === c ? "bg-[#0f172a] text-white border-[#0f172a]" : "border-gray-200 text-gray-500"}`}>
                  {CAT_LABEL[c]}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className={BTG} disabled={busy} onClick={() => setSchedForm(null)}>취소</button>
              <button className={BTO} disabled={busy || !schedForm.date || !schedForm.title.trim()} onClick={() => void submitSchedForm()}>{busy ? "등록 중…" : "등록"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
