// pages/Narumi/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const ADMIN_EMAIL = "admin@rnfkorea.co.kr";

// ✅ 정책
const UI_MASK_AFTER_HOURS = 24; // 화면 표시 마스킹(뒷4자리)
const DB_SCRUB_AFTER_HOURS = 120; // DB 영구 마스킹(뒷4자리) 기준(참고용)
const HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN = 30; // 업로드 완료 건: 일반사용자는 30일 이내만 표시

type NarumiTask = {
  id: string | number;

  vin: string;
  vin_last6: string | null;

  // 기존
  delivery_date_text: string | null;
  is_lotte_autolease: boolean;

  has_insurance: boolean;
  docs_ready: boolean;
  is_registering: boolean;
  is_registered: boolean;

  special_note: string | null;
  created_at?: string;

  // ✅ 차량등록증 저장 경로
  vehicle_doc_path?: string | null;

  // ✅ 고객 전화번호 (끝6자리 대체)
  customer_phone?: string | null;
  customer_phone_set_at?: string | null; // ISO
  customer_phone_scrubbed_at?: string | null; // ISO
};

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

/** YYYYMMDD -> YYYY.MM.DD */
function formatYYYYMMDDToDots(raw: string) {
  const digits = onlyDigits(raw).slice(0, 8);
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);

  if (digits.length <= 4) return y;
  if (digits.length <= 6) return `${y}.${m}`;
  return `${y}.${m}.${d}`;
}

function vinLast6(vin: string) {
  const v = (vin ?? "").trim();
  if (!v) return "";
  return v.slice(-6);
}

function isAllDone(t: NarumiTask) {
  return !!(t.has_insurance && t.docs_ready && t.is_registering && t.is_registered);
}

function extFromName(name: string) {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

function safeFileBase(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

// ✅ 010-1234-5678 포맷팅 보조
function formatPhoneKR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);

  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

// ✅ 화면 표시용 마스킹(뒷 4자리)
// - scrubbed_at 있으면 무조건 마스킹
// - set_at 기준 24시간 경과 시 마스킹
function maskLast4(phone: string) {
  const digits = onlyDigits(phone);
  if (digits.length < 8) return phone; // 너무 짧으면 그대로
  const head = digits.slice(0, digits.length - 4);
  return `${head}****`; // 숫자만 형태로 마스킹
}

function formatPhonePrettyFromDigits(digitsOnly: string) {
  const d = (digitsOnly ?? "").slice(0, 11);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return digitsOnly;
}

function shouldMaskPhoneForUI(r: NarumiTask) {
  if (r.customer_phone_scrubbed_at) return true;
  if (!r.customer_phone_set_at) return false;

  const setAt = new Date(r.customer_phone_set_at).getTime();
  if (Number.isNaN(setAt)) return false;
  const hours = (Date.now() - setAt) / (1000 * 60 * 60);
  return hours >= UI_MASK_AFTER_HOURS;
}

function getDisplayPhone(r: NarumiTask) {
  const raw = (r.customer_phone ?? "").trim();
  if (!raw) return "-";

  const digits = onlyDigits(raw);
  const pretty = formatPhonePrettyFromDigits(digits);

  if (!shouldMaskPhoneForUI(r)) return pretty;

  const maskedDigits = maskLast4(digits);
  return formatPhonePrettyFromDigits(maskedDigits);
}

const pillBase = "inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border";
const pillDone = "bg-emerald-50 text-emerald-700 border-emerald-200";
const pillProg = "bg-orange-50 text-orange-700 border-orange-200";

const btnBase = "px-3 py-2 rounded-lg text-sm font-extrabold border transition-all";
const btnOn = "bg-navy-900 text-white border-navy-900";
const btnOff =
  "bg-white text-navy-900 border-gray-200 hover:border-orange-300 hover:text-orange-600";
const btnDisabled = "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed";

const labelClass = "text-xs font-extrabold text-gray-500 block mb-2";
const inputClass =
  "h-[52px] w-full px-4 rounded-xl border border-gray-200 bg-white " +
  "focus:border-orange-400 focus:ring-4 focus:ring-orange-200/40 outline-none";

export default function NarumiPage() {
  // ===== 입력(나르미) =====
  const [vin, setVin] = useState("");
  const [customerPhone, setCustomerPhone] = useState(""); // ✅ 고객 전화번호
  const [deliveryText, setDeliveryText] = useState(""); // YYYY.MM.DD
  const [lotte, setLotte] = useState<boolean>(false);
  const [specialNote, setSpecialNote] = useState("");

  const last6 = useMemo(() => vinLast6(vin), [vin]);

  // ===== 목록 =====
  const [rows, setRows] = useState<NarumiTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  // ✅ 관리자 여부
  const [isAdmin, setIsAdmin] = useState(false);

  // 업로드 진행 표시
  const [uploadingId, setUploadingId] = useState<string | number | null>(null);

  // 숨김 file input (행별로 클릭 트리거)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadRowId, setPendingUploadRowId] = useState<string | number | null>(null);

  const resolveAdmin = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email ?? "";
      const admin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setIsAdmin(admin);
      return admin;
    } catch {
      setIsAdmin(false);
      return false;
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setErr("");

    try {
      const admin = await resolveAdmin();

      // ✅ 업로드 완료 건: 일반 사용자는 30일 이내만 표시 / 관리자는 전부 표시
      const cutoffISO = new Date(
        Date.now() - HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN * 24 * 60 * 60 * 1000
      ).toISOString();

      let q = supabase.from("narumi_tasks").select("*");

      if (!admin) {
        // vehicle_doc_path 가 NULL(미업로드) 이면 무조건 표시
        // vehicle_doc_path 가 NOT NULL(업로드 완료) 이면 created_at >= cutoff 일때만 표시
        q = q.or(`vehicle_doc_path.is.null,created_at.gte.${cutoffISO}`);
      }

      const { data, error } = await q.order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data ?? []) as NarumiTask[]);
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReset = () => {
    setVin("");
    setCustomerPhone("");
    setDeliveryText("");
    setLotte(false);
    setSpecialNote("");
  };

  const onAdd = async () => {
    const vinTrim = vin.trim();
    const dtTrim = deliveryText.trim();
    const phoneTrim = customerPhone.trim();

    if (!vinTrim) {
      alert("차대번호를 입력해주세요.");
      return;
    }
    if (!phoneTrim) {
      alert("고객 전화번호를 입력해주세요.");
      return;
    }
    if (dtTrim.length !== 10) {
      alert("출고일자는 YYYY.MM.DD 형식으로 입력해주세요. (예: 2026.02.25)");
      return;
    }

    setSaving(true);
    setErr("");

    try {
      const payload = {
        vin: vinTrim,
        vin_last6: vinLast6(vinTrim),
        delivery_date_text: dtTrim,
        is_lotte_autolease: lotte,
        special_note: specialNote.trim() || null,

        // ✅ 전화번호 트래킹 컬럼 3개
        customer_phone: phoneTrim,
        customer_phone_set_at: new Date().toISOString(),
        customer_phone_scrubbed_at: null,

        has_insurance: false,
        docs_ready: false,
        is_registering: false,
        is_registered: false,

        vehicle_doc_path: null,
      };

      const { error } = await supabase.from("narumi_tasks").insert(payload);
      if (error) throw error;

      onReset();
      await fetchRows();
    } catch (e: any) {
      setErr(e?.message || "Insert failed");
      alert(e?.message || "Insert failed");
    } finally {
      setSaving(false);
    }
  };

  /**
   * ✅ 잠금 규칙
   * - 업로드가 완료되면(vehicle_doc_path 존재) 보험~차량등록증 "키"는 모두 변경 불가
   */
  const isLockedAfterUpload = (r: NarumiTask) => !!r.vehicle_doc_path;

  /**
   * ✅ 차량등록증 키 활성 규칙
   * - "완결"일 때만 활성
   * - 단, 업로드 완료된 경우는 상태는 ON이지만 변경(재업로드) 불가로 잠금
   */
  const isVehicleDocKeyEnabled = (r: NarumiTask) => isAllDone(r) && !isLockedAfterUpload(r);

  // RNF 단계 토글(4개) - 업로드 이후에는 잠금
  const toggleStage = async (
    id: NarumiTask["id"],
    key: keyof Pick<NarumiTask, "has_insurance" | "docs_ready" | "is_registering" | "is_registered">
  ) => {
    const target = rows.find((rr) => String(rr.id) === String(id));
    if (!target) return;

    // ✅ 업로드 후에는 4단계 토글 불가
    if (isLockedAfterUpload(target)) return;

    const nextVal = !target[key];

    // 낙관적 업데이트
    setRows((prev) =>
      prev.map((rr) => (String(rr.id) === String(id) ? { ...rr, [key]: nextVal } : rr))
    );

    const { error } = await supabase
      .from("narumi_tasks")
      .update({ [key]: nextVal })
      .eq("id", id as any);

    if (error) {
      // rollback
      setRows((prev) =>
        prev.map((rr) => (String(rr.id) === String(id) ? { ...rr, [key]: !nextVal } : rr))
      );
      alert(error.message);
    }
  };

  // ✅ 차량등록증 업로드 버튼 클릭 -> file picker
  const onClickVehicleDocUpload = (r: NarumiTask) => {
    if (!isVehicleDocKeyEnabled(r)) return;

    setPendingUploadRowId(r.id);
    fileInputRef.current?.click();
  };

  // ✅ 실제 업로드 실행
  const uploadVehicleDoc = async (row: NarumiTask, file: File) => {
    if (!isAllDone(row)) {
      alert("완결 상태에서만 차량등록증 업로드가 가능합니다.");
      return;
    }
    if (isLockedAfterUpload(row)) {
      alert("이미 업로드 완료되었습니다. 업로드 후에는 변경할 수 없습니다.");
      return;
    }

    setUploadingId(row.id);
    setErr("");

    try {
      const idText = String(row.id);
      const ext = extFromName(file.name) || "bin";

      // ✅ 파일 경로: 한 건당 1개로 고정
      const path = `${idText}/vehicle_registration.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("vehicle_docs")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });

      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("narumi_tasks")
        .update({ vehicle_doc_path: path })
        .eq("id", row.id as any);

      if (dbErr) throw dbErr;

      await fetchRows();
      alert("차량등록증 업로드 완료. 업로드 후에는 단계 변경이 잠금됩니다.");
    } catch (e: any) {
      alert(e?.message || "차량등록증 업로드 실패");
    } finally {
      setUploadingId(null);
    }
  };

  // ✅ 다운로드
  const downloadVehicleDoc = async (row: NarumiTask) => {
    const path = row.vehicle_doc_path;
    if (!path) return;

    try {
      const { data, error } = await supabase.storage.from("vehicle_docs").download(path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileBase(path.split("/").pop() || "vehicle_registration");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "다운로드 실패");
    }
  };

  // file input change handler
  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const rowId = pendingUploadRowId;

    e.target.value = "";
    if (!file || rowId == null) return;

    const row = rows.find((rr) => String(rr.id) === String(rowId));
    if (!row) return;

    await uploadVehicleDoc(row, file);
    setPendingUploadRowId(null);
  };

  return (
    <div className="container mx-auto px-4 py-16 space-y-10">
      {/* 헤더 */}
      <div className="space-y-3 border-b border-gray-200 pb-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">
          나르미 업무
        </h1>

        <p className="text-gray-600">
          나르미모터스 입력 → RNF 단계 처리 → 모든 단계 완료 시{" "}
          <span className="font-extrabold">완결</span> 표시
        </p>

        <div className="text-xs text-gray-400 leading-relaxed">
          * 고객 전화번호는 입력 후 {UI_MASK_AFTER_HOURS}시간 경과 시 화면에서 뒷 4자리가 마스킹됩니다.
          <br />
          * 고객 전화번호는 입력 후 {DB_SCRUB_AFTER_HOURS}시간(5일) 경과 시 DB에서 뒷 4자리가 영구
          마스킹(삭제)됩니다. (서버/트리거 적용 기준)
          <br />
          * 차량등록증 업로드 완료 건은 일반 사용자는 최근{" "}
          {HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN}일 이내만 표시되며, 그 이후는 관리자만 볼 수 있습니다.
        </div>

        <div className="text-xs font-extrabold text-gray-500">
          로그인:{" "}
          <span className={isAdmin ? "text-emerald-700" : "text-gray-700"}>
            {isAdmin ? "관리자" : "일반"}
          </span>
        </div>

        {!!err && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
            {err}
          </div>
        )}
      </div>

      {/* 입력(나르미) */}
      <section className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <div className="text-xl font-extrabold text-navy-900">
              신규 입력 (나르미모터스)
            </div>
            <div className="text-sm text-gray-500 mt-1">
              차대번호/고객전화번호/출고일자/롯데오토리스 여부를 먼저 입력합니다.
            </div>
          </div>
        </div>

        {/* ✅ 4개 항목 한 줄 + 높이 통일 */}
        <div className="grid md:grid-cols-12 gap-4 items-end">
          {/* VIN */}
<div className="md:col-span-5 relative">
  <label className={labelClass}>차대번호(VIN) *</label>

  <input
    value={vin}
    onChange={(e) => setVin(e.target.value)}
    placeholder="예: KMH..."
    className={inputClass}   // h-[52px]
  />

  {/* 높이에 영향 안주도록 absolute */}
  <div className="absolute -bottom-5 left-0 text-xs text-gray-400">
    VIN 끝6자리(참고): 
    <span className="font-extrabold text-gray-600 ml-1">
      {last6 || "------"}
    </span>
  </div>
</div>

          {/* 고객 전화번호 */}
          <div className="md:col-span-3">
            <label className={labelClass}>전화번호 *</label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(formatPhoneKR(e.target.value))}
              placeholder="010-1234-5678"
              inputMode="tel"
              className={inputClass}
            />
          </div>

          {/* 출고일자 */}
          <div className="md:col-span-2">
            <label className={labelClass}>출고일자 *</label>
            <input
              value={deliveryText}
              onChange={(e) => setDeliveryText(formatYYYYMMDDToDots(e.target.value))}
              placeholder="YYYY.MM.DD"
              inputMode="numeric"
              className={inputClass}
            />
          </div>

          {/* 롯데오토리스 */}
          <div className="md:col-span-2">
            <label className={labelClass}>롯데오토리스(Y/N)</label>
            <div className="h-[52px] w-full rounded-xl border border-gray-200 bg-white flex items-center gap-6 px-4">
              <label className="inline-flex items-center gap-2 font-extrabold text-sm text-navy-900 cursor-pointer">
                <input
                  type="radio"
                  name="lotte"
                  checked={lotte === true}
                  onChange={() => setLotte(true)}
                  className="h-4 w-4 accent-orange-500"
                />
                Y
              </label>
              <label className="inline-flex items-center gap-2 font-extrabold text-sm text-navy-900 cursor-pointer">
                <input
                  type="radio"
                  name="lotte"
                  checked={lotte === false}
                  onChange={() => setLotte(false)}
                  className="h-4 w-4 accent-orange-500"
                />
                N
              </label>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className={labelClass}>특이사항 (긴 내용 가능)</label>
          <textarea
            value={specialNote}
            onChange={(e) => setSpecialNote(e.target.value)}
            placeholder="예: 고객 요청사항 / 특이사항 / 보험사 정보 / 등록 관련 메모 ..."
            className="w-full min-h-[90px] px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-4 focus:ring-orange-200/40 outline-none whitespace-pre-wrap"
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 flex-nowrap">
            {/* 왼쪽 버튼들 */}
            <div className="flex items-center gap-3 flex-nowrap overflow-x-auto no-scrollbar min-w-0">
              <button
                type="button"
                onClick={onAdd}
                disabled={saving}
                className="
                  shrink-0 px-6 py-3 rounded-xl
                  bg-orange-500 text-white font-extrabold
                  hover:bg-orange-600 disabled:opacity-60 whitespace-nowrap
                "
              >
                {saving ? "추가 중..." : "추가"}
              </button>

              <button
                type="button"
                onClick={onReset}
                className="
                  shrink-0 px-6 py-3 rounded-xl
                  border border-gray-200 text-navy-900 font-extrabold
                  hover:border-gray-300 whitespace-nowrap
                "
              >
                입력 초기화
              </button>
            </div>

            {/* 오른쪽 버튼 */}
            <button
              type="button"
              onClick={fetchRows}
              className="
                shrink-0 px-6 py-3 rounded-xl
                border border-gray-200 text-navy-900 font-extrabold
                hover:border-gray-300 whitespace-nowrap
              "
            >
              새로고침(조회)
            </button>
          </div>
        </div>
      </section>

      {/* 숨김 업로드 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={onFilePicked}
      />

      {/* 업무목록 */}
      <section className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-extrabold text-navy-900">업무 목록 ({rows.length})</div>
              {loading && <div className="text-sm text-gray-500">Loading…</div>}
            </div>

            <div className="text-sm text-gray-500 mt-1">
              고정 정보는 수정 불가.{" "}
              <span className="font-extrabold">차량등록증 업로드 완료 후</span>에는 보험~차량등록증 키가{" "}
              <span className="font-extrabold">모두 잠금</span>됩니다.
              {!isAdmin && (
                <>
                  <br />
                  <span className="font-extrabold">
                    * 업로드 완료 건은 최근 {HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN}일만 표시됩니다(관리자 제외).
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border-b border-gray-200 px-4 py-3 text-left font-extrabold text-gray-600 w-[180px] whitespace-nowrap">
                  상태 / ID
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left font-extrabold text-gray-600 w-[320px]">
                  차대번호(VIN)
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left font-extrabold text-gray-600 w-[180px] whitespace-nowrap">
                  고객전화번호
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left font-extrabold text-gray-600 w-[140px] whitespace-nowrap">
                  출고일자
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left font-extrabold text-gray-600 w-[140px] whitespace-nowrap">
                  롯데오토리스
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left font-extrabold text-gray-600 w-[560px]">
                  RNF 단계
                </th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {rows.map((r, idx) => {
                const done = isAllDone(r);
                const locked = !!r.vehicle_doc_path;
                const idText = String(r.id);
                const zebra = idx % 2 === 0 ? "bg-white" : "bg-gray-50/40";

                const vehicleDocCanUpload = isVehicleDocKeyEnabled(r);
                const hasVehicleDoc = !!r.vehicle_doc_path;

                return (
                  <React.Fragment key={idText}>
                    <tr className={`${zebra} align-top`}>
                      <td className="border-b border-gray-200 px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <span className={`${pillBase} ${done ? pillDone : pillProg} w-fit`}>
                            {done ? "완결" : "접수"}
                          </span>

                          <div className="text-xs font-extrabold text-gray-600 whitespace-nowrap tabular-nums font-mono">
                            ID: <span className="font-black text-gray-800">{String(idText).slice(0, 6)}</span>
                          </div>

                          {locked && (
                            <div className="text-[11px] font-bold text-gray-400">
                              * 등록증 업로드 완료(잠금)
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="border-b border-gray-200 px-4 py-4">
                        <div className="font-extrabold text-navy-900 break-words">{r.vin}</div>
                        <div className="mt-1 text-xs text-gray-400">
                          VIN 끝6(참고):{" "}
                          <span className="font-extrabold text-gray-600">
                            {r.vin_last6 || vinLast6(r.vin) || "-"}
                          </span>
                        </div>
                      </td>

                      <td className="border-b border-gray-200 px-4 py-4">
                        <div className="font-extrabold text-navy-900 whitespace-nowrap tabular-nums">
                          {getDisplayPhone(r)}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400">
                          {r.customer_phone_scrubbed_at
                            ? "* DB 영구 마스킹됨"
                            : r.customer_phone_set_at
                              ? `* ${UI_MASK_AFTER_HOURS}h 후 화면 마스킹`
                              : ""}
                        </div>
                      </td>

                      <td className="border-b border-gray-200 px-4 py-4">
                        <div className="font-extrabold text-navy-900 whitespace-nowrap tabular-nums">
                          {r.delivery_date_text || "-"}
                        </div>
                      </td>

                      <td className="border-b border-gray-200 px-4 py-4">
                        <div className="font-extrabold text-navy-900 whitespace-nowrap">
                          {r.is_lotte_autolease ? "Y" : "N"}
                        </div>
                      </td>

                      <td className="border-b border-gray-200 px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={locked}
                            className={[
                              btnBase,
                              locked ? btnDisabled : r.has_insurance ? btnOn : btnOff,
                              "min-w-[112px]",
                            ].join(" ")}
                            onClick={() => toggleStage(r.id, "has_insurance")}
                          >
                            보험서류
                          </button>

                          <button
                            type="button"
                            disabled={locked}
                            className={[
                              btnBase,
                              locked ? btnDisabled : r.docs_ready ? btnOn : btnOff,
                              "min-w-[112px]",
                            ].join(" ")}
                            onClick={() => toggleStage(r.id, "docs_ready")}
                          >
                            등록서류
                          </button>

                          <button
                            type="button"
                            disabled={locked}
                            className={[
                              btnBase,
                              locked ? btnDisabled : r.is_registering ? btnOn : btnOff,
                              "min-w-[112px]",
                            ].join(" ")}
                            onClick={() => toggleStage(r.id, "is_registering")}
                          >
                            등록접수
                          </button>

                          <button
                            type="button"
                            disabled={locked}
                            className={[
                              btnBase,
                              locked ? btnDisabled : r.is_registered ? btnOn : btnOff,
                              "min-w-[112px]",
                            ].join(" ")}
                            onClick={() => toggleStage(r.id, "is_registered")}
                          >
                            등록완료
                          </button>

                          <button
                            type="button"
                            disabled={!vehicleDocCanUpload || uploadingId === r.id || locked}
                            className={[
                              btnBase,
                              hasVehicleDoc ? btnOn : btnOff,
                              (!vehicleDocCanUpload || uploadingId === r.id || locked) && !hasVehicleDoc
                                ? btnDisabled
                                : "",
                              "min-w-[132px]",
                            ].join(" ")}
                            onClick={() => onClickVehicleDocUpload(r)}
                            title={
                              hasVehicleDoc
                                ? "업로드 완료"
                                : !done
                                  ? "완결 상태에서만 업로드 가능"
                                  : locked
                                    ? "업로드 후 잠금"
                                    : "차량등록증 업로드"
                            }
                          >
                            {uploadingId === r.id
                              ? "업로드중…"
                              : hasVehicleDoc
                                ? "차량등록증(완료)"
                                : "차량등록증"}
                          </button>

                          <button
                            type="button"
                            disabled={!hasVehicleDoc}
                            className={[btnBase, hasVehicleDoc ? btnOff : btnDisabled, "min-w-[112px]"].join(" ")}
                            onClick={() => downloadVehicleDoc(r)}
                          >
                            다운로드
                          </button>
                        </div>

                        <div className="mt-2 text-xs text-gray-400 leading-relaxed">
                          * 차량등록증은 <span className="font-extrabold">완결 상태</span>에서만 업로드 가능.
                          <br />
                          * 업로드 완료 후에는 보험~차량등록증 키 상태를{" "}
                          <span className="font-extrabold">변경할 수 없습니다(잠금)</span>.
                        </div>
                      </td>
                    </tr>

                    {/* 특이사항 아래줄 */}
                    <tr className={`${zebra}`}>
                      <td className="border-b border-gray-200 px-4 py-3" colSpan={6}>
                        <div className="flex gap-3">
                          <div className="text-xs font-extrabold text-gray-500 whitespace-nowrap pt-0.5">
                            특이사항
                          </div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                            {r.special_note?.trim() ? r.special_note : <span className="text-gray-400">-</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500" colSpan={6}>
                    아직 등록된 항목이 없습니다. 상단에서 추가해주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}