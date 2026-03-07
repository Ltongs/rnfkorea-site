import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import PageTitle from "../../components/PageTitle";

const ADMIN_EMAIL = "admin@rnfkorea.co.kr";

// 정책
const UI_MASK_AFTER_HOURS = 24;
const DB_SCRUB_AFTER_HOURS = 120;
const HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN = 30;

type TaskStatus =
  | "todo"
  | "insurance"
  | "docs"
  | "registering"
  | "registered"
  | "completed";

type NarumiTask = {
  id: string | number;
  vin: string;
  vin_last6: string | null;
  delivery_date_text: string | null;
  is_lotte_autolease: boolean;
  has_insurance: boolean;
  docs_ready: boolean;
  is_registering: boolean;
  is_registered: boolean;
  status?: TaskStatus | string | null;
  memo?: string | null;
  special_note: string | null;
  created_at?: string;
  vehicle_doc_path?: string | null;
  customer_phone?: string | null;
  customer_phone_set_at?: string | null;
  customer_phone_scrubbed_at?: string | null;
};

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function normalizeVin(v: string) {
  return (v ?? "").trim().toUpperCase();
}

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

function formatPhoneKR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);

  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function maskLast4(phone: string) {
  const digits = onlyDigits(phone);
  if (digits.length < 8) return phone;
  const head = digits.slice(0, digits.length - 4);
  return `${head}****`;
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

function deriveStatus(
  row: Pick<
    NarumiTask,
    "has_insurance" | "docs_ready" | "is_registering" | "is_registered" | "vehicle_doc_path"
  >
): TaskStatus {
  if (row.vehicle_doc_path) return "completed";
  if (row.is_registered) return "registered";
  if (row.is_registering) return "registering";
  if (row.docs_ready) return "docs";
  if (row.has_insurance) return "insurance";
  return "todo";
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "insurance":
      return "보험서류";
    case "docs":
      return "등록서류";
    case "registering":
      return "등록접수";
    case "registered":
      return "등록완료";
    case "completed":
      return "완결";
    case "todo":
    default:
      return "접수";
  }
}

function formatCreatedAt(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

const pillBase =
  "inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border";
const pillDone = "bg-emerald-50 text-emerald-700 border-emerald-200";
const pillProg = "bg-orange-50 text-orange-700 border-orange-200";
const pillGray = "bg-gray-50 text-gray-700 border-gray-200";

const btnBase = "px-3 py-2 rounded-lg text-sm font-extrabold border transition-all";
const btnOn = "bg-navy-900 text-white border-navy-900";
const btnOff =
  "bg-white text-navy-900 border-gray-200 hover:border-orange-300 hover:text-orange-600";
const btnDisabled = "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed";

const labelClass = "text-xs font-extrabold text-gray-500 block mb-2";
const inputClass =
  "h-[52px] w-full px-4 rounded-xl border border-gray-200 bg-white " +
  "focus:border-orange-400 focus:ring-4 focus:ring-orange-200/40 outline-none";

const cardClass = "border border-gray-200 rounded-2xl bg-white shadow-sm";

const infoLabel = "text-xs font-extrabold text-gray-400";
const infoValue = "mt-1 text-sm font-extrabold text-navy-900 break-all";

export default function NarumiPage() {
  const { user, isInternal, logout } = useAuth();

  const [vin, setVin] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [lotte, setLotte] = useState<boolean>(false);
  const [specialNote, setSpecialNote] = useState("");
  const last6 = useMemo(() => vinLast6(vin), [vin]);

  const [rows, setRows] = useState<NarumiTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [isAdmin, setIsAdmin] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [showOldUploaded, setShowOldUploaded] = useState(false);

  const [uploadingId, setUploadingId] = useState<string | number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadRowId, setPendingUploadRowId] = useState<string | number | null>(null);

  const resolveAdmin = async () => {
    const localEmail = (user?.email ?? "").toLowerCase();
    const byLocalAuth = !!isInternal && localEmail === ADMIN_EMAIL.toLowerCase();

    try {
      const { data } = await supabase.auth.getUser();
      const supabaseEmail = (data?.user?.email ?? "").toLowerCase();
      const bySupabaseAuth = supabaseEmail === ADMIN_EMAIL.toLowerCase();
      const admin = byLocalAuth || bySupabaseAuth;
      setIsAdmin(admin);
      return admin;
    } catch {
      setIsAdmin(byLocalAuth);
      return byLocalAuth;
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setErr("");

    try {
      const admin = await resolveAdmin();

      const cutoffISO = new Date(
        Date.now() - HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN * 24 * 60 * 60 * 1000
      ).toISOString();

      let q = supabase.from("narumi_tasks").select("*");

      if (!admin) {
        q = q.or(`vehicle_doc_path.is.null,created_at.gte.${cutoffISO}`);
      } else if (!showOldUploaded) {
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
  }, [showOldUploaded]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

    const q = searchText.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => {
        const vinText = (r.vin ?? "").toLowerCase();
        const phoneText = onlyDigits(r.customer_phone ?? "");
        const noteText = (r.special_note ?? "").toLowerCase();
        const idText = String(r.id ?? "");
        return (
          vinText.includes(q) ||
          phoneText.includes(onlyDigits(q)) ||
          noteText.includes(q) ||
          idText.includes(q)
        );
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => deriveStatus(r) === statusFilter);
    }

    return result;
  }, [rows, searchText, statusFilter]);

  const onReset = () => {
    setVin("");
    setCustomerPhone("");
    setDeliveryText("");
    setLotte(false);
    setSpecialNote("");
  };

  const onAdd = async () => {
    const vinTrim = normalizeVin(vin);
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
{/* PAGE TITLE */}
<section className="space-y-4">
  <div className="flex items-start gap-3">
    <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />

    <div>
      <h1 className="text-2xl md:text-4xl font-extrabold text-navy-900 tracking-tight">
        Narumi 업무 관리
      </h1>

      <p className="text-gray-600 mt-3 max-w-3xl leading-relaxed">
        차량 출고 및 등록 진행 상태를 관리하는 RNF 내부 업무 페이지입니다.
        나르미 진행 상태, 보험, 등록, 서류 준비 여부를 확인할 수 있습니다.
      </p>
    </div>
  </div>
</section>
    setSaving(true);
    setErr("");

    try {
      const { data: existing, error: dupErr } = await supabase
        .from("narumi_tasks")
        .select("id, vin, created_at, vehicle_doc_path")
        .eq("vin", vinTrim)
        .order("created_at", { ascending: false })
        .limit(1);

      if (dupErr) throw dupErr;
      if (existing && existing.length > 0) {
        alert(`이미 등록된 VIN입니다.\nVIN: ${vinTrim}\n기존 ID: ${existing[0].id}`);
        return;
      }

      const payload = {
        vin: vinTrim,
        vin_last6: vinLast6(vinTrim),
        delivery_date_text: dtTrim,
        is_lotte_autolease: lotte,
        special_note: specialNote.trim() || null,
        customer_phone: phoneTrim,
        customer_phone_set_at: new Date().toISOString(),
        customer_phone_scrubbed_at: null,
        has_insurance: false,
        docs_ready: false,
        is_registering: false,
        is_registered: false,
        status: "todo" as TaskStatus,
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

  const isLockedAfterUpload = (r: NarumiTask) => !!r.vehicle_doc_path;
  const isVehicleDocKeyEnabled = (r: NarumiTask) => isAllDone(r) && !isLockedAfterUpload(r);

  const toggleStage = async (
    id: NarumiTask["id"],
    key: keyof Pick<NarumiTask, "has_insurance" | "docs_ready" | "is_registering" | "is_registered">
  ) => {
    const target = rows.find((rr) => String(rr.id) === String(id));
    if (!target) return;

    if (isLockedAfterUpload(target)) return;

    const nextVal = !target[key];
    const nextRow = { ...target, [key]: nextVal };
    const nextStatus = deriveStatus(nextRow);

    setRows((prev) =>
      prev.map((rr) =>
        String(rr.id) === String(id)
          ? { ...rr, [key]: nextVal, status: nextStatus }
          : rr
      )
    );

    const { error } = await supabase
      .from("narumi_tasks")
      .update({ [key]: nextVal, status: nextStatus })
      .eq("id", id as any);

    if (error) {
      setRows((prev) =>
        prev.map((rr) =>
          String(rr.id) === String(id)
            ? { ...rr, [key]: !nextVal, status: target.status ?? deriveStatus(target) }
            : rr
        )
      );
      alert(error.message);
    }
  };

  const onClickVehicleDocUpload = (r: NarumiTask) => {
    if (!isVehicleDocKeyEnabled(r)) return;
    setPendingUploadRowId(r.id);
    fileInputRef.current?.click();
  };

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
      const path = `${idText}/vehicle_registration.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("vehicle_docs")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });

      if (upErr) throw upErr;

      const nextStatus = "completed" as TaskStatus;

      const { error: dbErr } = await supabase
        .from("narumi_tasks")
        .update({ vehicle_doc_path: path, status: nextStatus })
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
    <div className="container mx-auto px-4 py-10 space-y-6">
      <PageTitle
  title="Narumi 업무 관리"
  desc="차량 출고 및 등록 진행 상태를 관리하는 RNF 내부 업무 페이지입니다. 보험, 등록, 서류 준비 등 진행 단계를 한눈에 확인할 수 있습니다."
/>
      <div className="space-y-3 border-b border-gray-200 pb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-extrabold text-navy-900 tracking-tight">
              나르미 업무
            </h1>

            <p className="text-gray-600">
              나르미모터스 입력 → RNF 단계 처리 → 차량등록증 업로드 시{" "}
              <span className="font-extrabold">완결</span> 표시
            </p>

            <div className="text-xs text-gray-400 leading-relaxed">
              * 고객 전화번호는 입력 후 {UI_MASK_AFTER_HOURS}시간 경과 시 화면에서 뒷 4자리가 마스킹됩니다.
              <br />
              * 고객 전화번호는 입력 후 {DB_SCRUB_AFTER_HOURS}시간(5일) 경과 시 DB에서 뒷 4자리가 영구 마스킹(삭제)됩니다.
              <br />
              * 차량등록증 업로드 완료 건은 일반 사용자는 최근 {HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN}일 이내만 표시되며, 그 이후는 관리자만 볼 수 있습니다.
            </div>

            <div className="text-xs font-extrabold text-gray-500">
              로그인:{" "}
              <span className={isAdmin ? "text-emerald-700" : "text-gray-700"}>
                {isAdmin ? "관리자" : "일반"}
              </span>
              {user?.email ? (
                <span className="ml-2 text-gray-400 font-bold">({user.email})</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchRows}
              className="px-5 py-3 rounded-xl border border-gray-200 text-navy-900 font-extrabold hover:border-gray-300 whitespace-nowrap"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-5 py-3 rounded-xl border border-red-200 text-red-600 font-extrabold hover:bg-red-50 whitespace-nowrap"
            >
              로그아웃
            </button>
          </div>
        </div>

        {!!err && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
            {err}
          </div>
        )}
      </div>

      <section className={`${cardClass} p-5`}>
  <div className="flex items-start gap-3 mb-4">
    <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
    <div className="flex-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-lg font-extrabold text-navy-900">
          업무 목록 ({filteredRows.length})
        </div>
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
      </div>

      <div className="text-sm text-gray-500 mt-1 leading-relaxed">
        차량등록증 업로드 완료 후에는 보험~차량등록증 키가 모두 잠금됩니다.
      </div>
    </div>
  </div>

  <div className="space-y-2">
    {filteredRows.map((r) => {
      const locked = !!r.vehicle_doc_path;
      const hasVehicleDoc = !!r.vehicle_doc_path;
      const vehicleDocCanUpload = isVehicleDocKeyEnabled(r);
      const currentStatus = deriveStatus(r);

      return (
        <div
          key={String(r.id)}
          className="border border-gray-200 rounded-2xl bg-white overflow-hidden"
        >
          <div className="grid lg:grid-cols-2">

            {/* 좌측 정보 */}
            <div className="p-3 border-b lg:border-b-0 lg:border-r border-gray-200">

              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span
                  className={`${pillBase} ${
                    currentStatus === "completed"
                      ? pillDone
                      : currentStatus === "todo"
                      ? pillGray
                      : pillProg
                  }`}
                >
                  {statusLabel(currentStatus)}
                </span>

                <span className="text-xs font-extrabold text-gray-500">
                  ID {String(r.id)}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">

                <div>
                  <div className={infoLabel}>차대번호</div>
                  <div className={infoValue}>{r.vin}</div>
                </div>

                <div>
                  <div className={infoLabel}>전화번호</div>
                  <div className={infoValue}>{getDisplayPhone(r)}</div>
                </div>

                <div>
                  <div className={infoLabel}>출고일자</div>
                  <div className={infoValue}>{r.delivery_date_text || "-"}</div>
                </div>

                <div>
                  <div className={infoLabel}>생성일시</div>
                  <div className={infoValue}>{formatCreatedAt(r.created_at)}</div>
                </div>

                <div>
                  <div className={infoLabel}>롯데오토리스</div>
                  <div className={infoValue}>{r.is_lotte_autolease ? "Y" : "N"}</div>
                </div>

              </div>
            </div>

            {/* 우측 RNF 단계 + 메모 */}
            <div className="p-3 flex flex-col gap-3">

              {/* RNF 단계 */}
              <div>
                <div className="text-sm font-extrabold text-gray-500 mb-2">
                  RNF 단계
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">

                  <button
                    disabled={locked}
                    className={[
                      btnBase,
                      locked ? btnDisabled : r.has_insurance ? btnOn : btnOff,
                    ].join(" ")}
                    onClick={() => toggleStage(r.id, "has_insurance")}
                  >
                    보험서류
                  </button>

                  <button
                    disabled={locked}
                    className={[
                      btnBase,
                      locked ? btnDisabled : r.docs_ready ? btnOn : btnOff,
                    ].join(" ")}
                    onClick={() => toggleStage(r.id, "docs_ready")}
                  >
                    등록서류
                  </button>

                  <button
                    disabled={locked}
                    className={[
                      btnBase,
                      locked ? btnDisabled : r.is_registering ? btnOn : btnOff,
                    ].join(" ")}
                    onClick={() => toggleStage(r.id, "is_registering")}
                  >
                    등록접수
                  </button>

                  <button
                    disabled={locked}
                    className={[
                      btnBase,
                      locked ? btnDisabled : r.is_registered ? btnOn : btnOff,
                    ].join(" ")}
                    onClick={() => toggleStage(r.id, "is_registered")}
                  >
                    등록완료
                  </button>

                  <button
                    disabled={!vehicleDocCanUpload || uploadingId === r.id || locked}
                    className={[
                      btnBase,
                      hasVehicleDoc ? btnOn : btnOff,
                      (!vehicleDocCanUpload || uploadingId === r.id || locked)
                        ? btnDisabled
                        : "",
                    ].join(" ")}
                    onClick={() => onClickVehicleDocUpload(r)}
                  >
                    {uploadingId === r.id
                      ? "업로드중"
                      : hasVehicleDoc
                      ? "차량등록증"
                      : "차량등록증"}
                  </button>

                  <button
                    disabled={!hasVehicleDoc}
                    className={[
                      btnBase,
                      hasVehicleDoc ? btnOff : btnDisabled,
                    ].join(" ")}
                    onClick={() => downloadVehicleDoc(r)}
                  >
                    다운로드
                  </button>

                </div>
              </div>

              {/* 메모 */}
              <div>
                <div className="text-sm font-extrabold text-gray-500 mb-2">
                  메모
                </div>

                <div className="min-h-[56px] text-sm text-gray-700 whitespace-pre-wrap break-words rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                  {r.special_note?.trim() ? r.special_note : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>

              </div>

            </div>

          </div>
        </div>
      );
    })}
  </div>
</section>

      {isAdmin && (
        <section className={`${cardClass} p-5`}>
          <div className="flex items-start gap-3 mb-4">
            <div className="mt-1 h-5 w-1.5 rounded bg-navy-900" />
            <div>
              <div className="text-lg font-extrabold text-navy-900">
                관리자 조회
              </div>
              <div className="text-sm text-gray-500 mt-1">
                VIN / 전화번호 / 특이사항 / ID 검색 및 상태별 필터
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-6">
              <label className={labelClass}>검색</label>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="VIN / 전화번호 / 특이사항 / ID"
                className={inputClass}
              />
            </div>

            <div className="md:col-span-3">
              <label className={labelClass}>상태 필터</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={inputClass}
              >
                <option value="all">전체</option>
                <option value="todo">접수</option>
                <option value="insurance">보험서류</option>
                <option value="docs">등록서류</option>
                <option value="registering">등록접수</option>
                <option value="registered">등록완료</option>
                <option value="completed">완결</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className={labelClass}>오래된 업로드 건</label>
              <label className="h-[52px] w-full rounded-xl border border-gray-200 bg-white flex items-center gap-3 px-4 cursor-pointer font-extrabold text-sm text-navy-900">
                <input
                  type="checkbox"
                  checked={showOldUploaded}
                  onChange={(e) => setShowOldUploaded(e.target.checked)}
                  className="h-4 w-4 accent-orange-500"
                />
                30일 초과도 포함
              </label>
            </div>
          </div>
        </section>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={onFilePicked}
      />

      <section className={`${cardClass} p-5`}>
        <div className="flex items-start gap-3 mb-4">
          <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-lg font-extrabold text-navy-900">
                업무 목록 ({filteredRows.length})
              </div>
              {loading && <div className="text-sm text-gray-500">Loading…</div>}
            </div>

            <div className="text-sm text-gray-500 mt-1 leading-relaxed">
              차량등록증 업로드 완료 후에는 보험~차량등록증 키가 모두 잠금됩니다.
              {!isAdmin && (
                <>
                  <br />
                  * 업로드 완료 건은 최근 {HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN}일만 표시됩니다.
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredRows.map((r) => {
            const locked = !!r.vehicle_doc_path;
            const hasVehicleDoc = !!r.vehicle_doc_path;
            const vehicleDocCanUpload = isVehicleDocKeyEnabled(r);
            const currentStatus = deriveStatus(r);

            return (
              <div
                key={String(r.id)}
                className="border border-gray-200 rounded-2xl bg-white overflow-hidden"
              >
                <div className="grid lg:grid-cols-2">
                  {/* 좌측 섹션 */}
                  <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-200">
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <span
                        className={`${pillBase} ${
                          currentStatus === "completed"
                            ? pillDone
                            : currentStatus === "todo"
                              ? pillGray
                              : pillProg
                        }`}
                      >
                        {statusLabel(currentStatus)}
                      </span>

                      <span className="text-xs font-extrabold text-gray-500">
                        ID {String(r.id)}
                      </span>

                      {locked && (
                        <span className="text-xs font-bold text-gray-400">
                          업로드 완료(잠금)
                        </span>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                      <div>
                        <div className={infoLabel}>차대번호(VIN)</div>
                        <div className={infoValue}>{r.vin}</div>
                        <div className="mt-1 text-xs text-gray-400">
                          끝6자리:{" "}
                          <span className="font-extrabold text-gray-600">
                            {r.vin_last6 || vinLast6(r.vin) || "-"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className={infoLabel}>전화번호</div>
                        <div className={infoValue}>{getDisplayPhone(r)}</div>
                        <div className="mt-1 text-xs text-gray-400">
                          {r.customer_phone_scrubbed_at
                            ? "DB 영구 마스킹됨"
                            : r.customer_phone_set_at
                              ? `${UI_MASK_AFTER_HOURS}h 후 화면 마스킹`
                              : ""}
                        </div>
                      </div>

                      <div>
                        <div className={infoLabel}>출고일자</div>
                        <div className={infoValue}>{r.delivery_date_text || "-"}</div>
                      </div>

                      <div>
                        <div className={infoLabel}>생성일시</div>
                        <div className={infoValue}>{formatCreatedAt(r.created_at)}</div>
                      </div>

                      <div>
                        <div className={infoLabel}>롯데오토리스</div>
                        <div className={infoValue}>{r.is_lotte_autolease ? "Y" : "N"}</div>
                      </div>
                    </div>
                  </div>

                  {/* 우측 섹션 */}
                  <div className="p-5 flex flex-col gap-5">
                    {/* 상단 RNF 단계 */}
                    <div>
                      <div className="text-sm font-extrabold text-gray-500 mb-3">
                        RNF 단계
                      </div>

                      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={locked}
                          className={[
                            btnBase,
                            locked ? btnDisabled : r.has_insurance ? btnOn : btnOff,
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
                          ].join(" ")}
                          onClick={() => onClickVehicleDocUpload(r)}
                          title={
                            hasVehicleDoc
                              ? "업로드 완료"
                              : !isAllDone(r)
                                ? "등록완료까지 처리된 후 업로드 가능"
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
                          className={[
                            btnBase,
                            hasVehicleDoc ? btnOff : btnDisabled,
                          ].join(" ")}
                          onClick={() => downloadVehicleDoc(r)}
                        >
                          다운로드
                        </button>
                      </div>

                      <div className="mt-2 text-xs text-gray-400 leading-relaxed">
                        * 등록완료까지 처리된 후 차량등록증 업로드 가능
                        <br />
                        * 업로드 완료 후 단계 변경 불가
                      </div>
                    </div>

                    {/* 하단 메모 */}
                    <div className="pt-1">
                      <div className="text-sm font-extrabold text-gray-500 mb-2">
                        메모
                      </div>
                      <div className="min-h-[92px] text-sm text-gray-700 whitespace-pre-wrap break-words rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                        {r.special_note?.trim() ? (
                          r.special_note
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredRows.length === 0 && (
            <div className="px-4 py-8 text-sm text-gray-500 border border-gray-200 rounded-2xl">
              조회 결과가 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}