// pages/Export/ExportListingNewPage.tsx
import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Upload, X, Plus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ====================================================
// 상수
// ====================================================
type Category = "excavator" | "mini_excavator" | "forklift";

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "excavator",      label: "굴삭기 (Excavator)" },
  { value: "mini_excavator", label: "미니 굴삭기 (Mini Excavator)" },
  { value: "forklift",       label: "지게차 (Forklift)" },
];

const BRANDS_BY_CATEGORY: Record<Category, string[]> = {
  excavator:      ["Hyundai", "Volvo", "Doosan", "Komatsu", "Caterpillar", "Hitachi", "Kobelco", "Liebherr"],
  mini_excavator: ["Hyundai", "Doosan", "Komatsu", "Kubota", "Yanmar", "Caterpillar"],
  forklift:       ["Hyundai", "Toyota", "Doosan", "Nichiyu", "Komatsu", "Yale", "Jungheinrich", "Linde"],
};

// 지게차는 diesel/electric/LPG 선택 가능, 굴삭기 계열은 diesel 고정
const ENGINE_OPTIONS: Record<Category, string[] | null> = {
  excavator:      null, // null = 고정 diesel
  mini_excavator: null,
  forklift:       ["diesel", "electric", "LPG"],
};

const KRW_TO_USD_RATE = 1500;

const PHOTO_SLOTS = [
  { key: "front",       label: "전면 (Front)" },
  { key: "rear",        label: "후면 (Rear)" },
  { key: "left",        label: "좌측 (Left)" },
  { key: "right",       label: "우측 (Right)" },
  { key: "engine",      label: "엔진실 (Engine)" },
  { key: "cabin",       label: "실내 (Cabin)" },
  { key: "hour_meter",  label: "Hour Meter" },
  { key: "underside_l", label: "하부 좌 (Underside L)" },
  { key: "underside_r", label: "하부 우 (Underside R)" },
] as const;

type PhotoKey = typeof PHOTO_SLOTS[number]["key"];
type ConditionGrade = "A" | "B" | "C";

type PhotoSlotFile = {
  key: PhotoKey;
  label: string;
  file: File | null;
  preview: string | null;
};

type FormData = {
  category: Category;
  brand: string;
  model: string;
  year: string;
  tonnage: string;
  engine_type: string;
  condition_grade: ConditionGrade | "";
  price_krw: string;
  price_usd: number | null;
  price_negotiable: boolean;
  stock_qty: string;
  available_date: string;
  description_ko: string;
  description_en: string;
  status: "active" | "draft";
};

const INITIAL: FormData = {
  category: "excavator", brand: "", model: "", year: "", tonnage: "",
  engine_type: "diesel",
  condition_grade: "", price_krw: "", price_usd: null,
  price_negotiable: true, stock_qty: "1", available_date: "",
  description_ko: "", description_en: "", status: "active",
};

// ====================================================
// Claude 자동번역
// ====================================================
async function translateKoToEn(text: string, context: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a professional translator specializing in industrial equipment listings for export.
Translate the following Korean equipment description to English for an international buyer audience.
Keep it concise, professional, and use standard industrial terminology.

Equipment context: ${context}

Korean text to translate:
${text}

Respond with ONLY the English translation, no explanation.`,
      }],
    }),
  });
  if (!res.ok) throw new Error("Translation API error");
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? "";
}

// ====================================================
// UI 헬퍼
// ====================================================
const fieldCls = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-slate-400 bg-white";
const fixedCls = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-slate-50 text-slate-400";
const errorCls = "w-full rounded-xl border border-red-300 px-4 py-2.5 text-sm outline-none transition-all bg-white";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {children}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

// ====================================================
// 사진 슬롯 업로더
// ====================================================
function PhotoSlotUploader({ slots, onChange }: {
  slots: PhotoSlotFile[];
  onChange: (slots: PhotoSlotFile[]) => void;
}) {
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFile = (key: PhotoKey, file: File) => {
    const preview = URL.createObjectURL(file);
    onChange(slots.map((s) => s.key === key ? { ...s, file, preview } : s));
  };

  const handleRemove = (key: PhotoKey) => {
    onChange(slots.map((s) => s.key === key ? { ...s, file: null, preview: null } : s));
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {slots.map((slot) => (
        <div key={slot.key} className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 text-center leading-tight">{slot.label}</p>
          <div className={[
            "relative aspect-square rounded-xl border-2 overflow-hidden transition-all",
            slot.preview ? "border-slate-200" : "border-dashed border-slate-200 hover:border-orange-400",
          ].join(" ")}>
            {slot.preview ? (
              <>
                <img src={slot.preview} alt={slot.label} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemove(slot.key)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                >
                  <X size={11} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => refs.current[slot.key]?.click()}
                className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-orange-400 transition-colors"
              >
                <Plus size={20} />
                <span className="text-[10px]">추가</span>
              </button>
            )}
          </div>
          <input
            ref={(el) => { refs.current[slot.key] = el; }}
            type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(slot.key, file);
              e.target.value = "";
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ====================================================
// 메인 컴포넌트
// ====================================================
const ExportListingNewPage: React.FC = () => {
  const { user, isHyundaiCM, isAdmin, isSubAdmin } = useAuth();
  const navigate = useNavigate();
  const canAccess = isHyundaiCM || isAdmin || isSubAdmin;

  const [form, setForm] = useState<FormData>(INITIAL);
  const [photos, setPhotos] = useState<PhotoSlotFile[]>(
    PHOTO_SLOTS.map((s) => ({ key: s.key, label: s.label, file: null, preview: null }))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [translating, setTranslating] = useState(false);

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-bold text-slate-800">Access Denied</p>
          <button onClick={() => navigate("/export-shop")} className="text-orange-500 text-sm underline">
            Go back to shop
          </button>
        </div>
      </div>
    );
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  function handlePriceKrw(raw: string) {
    const numericOnly = raw.replace(/[^0-9]/g, "");
    const krw = numericOnly ? parseInt(numericOnly) : null;
    const usd = krw ? Math.round(krw / KRW_TO_USD_RATE) : null;
    setForm((p) => ({ ...p, price_krw: numericOnly, price_usd: usd }));
    setErrors((p) => { const n = { ...p }; delete n.price_krw; return n; });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.brand) e.brand = "브랜드를 선택해주세요.";
    if (!form.description_ko.trim()) e.description_ko = "한국어 설명을 입력해주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleTranslate() {
    if (!form.description_ko.trim()) {
      setErrors((p) => ({ ...p, description_ko: "한국어 설명을 먼저 입력해주세요." }));
      return;
    }
    setTranslating(true);
    try {
      const context = `${CATEGORY_OPTIONS.find(c => c.value === form.category)?.label ?? form.category} / ${form.brand} ${form.model} / ${form.year}y / ${form.tonnage}T / Grade ${form.condition_grade}`;
      const en = await translateKoToEn(form.description_ko, context);
      set("description_en", en);
    } catch {
      setErrors((p) => ({ ...p, description_en: "번역 실패. 직접 입력해주세요." }));
    } finally {
      setTranslating(false);
    }
  }

  async function uploadPhotos(listingId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const slot of photos) {
      if (!slot.file) continue;
      const ext = slot.file.name.split(".").pop() ?? "jpg";
      const path = `${listingId}/${slot.key}.${ext}`;
      const { error } = await supabase.storage.from("export-listings").upload(path, slot.file, { upsert: true });
      if (error) throw error;
      urls.push(path);
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!user) return;

    setSubmitting(true);
    try {
      // 영문 설명이 비어있으면 자동번역
      let descEn = form.description_en.trim();
      if (!descEn && form.description_ko.trim()) {
        try {
          const context = `${CATEGORY_OPTIONS.find(c => c.value === form.category)?.label ?? form.category} / ${form.brand} ${form.model} / ${form.year}y / ${form.tonnage}T / Grade ${form.condition_grade}`;
          descEn = await translateKoToEn(form.description_ko, context);
          set("description_en", descEn);
        } catch {
          descEn = form.description_ko.trim();
        }
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("export_listings")
        .insert({
          created_by:       user.id,
          category:         form.category,
          brand:            form.brand,
          model:            form.model.trim() || null,
          year:             form.year ? parseInt(form.year) : null,
          tonnage:          form.tonnage ? parseFloat(form.tonnage) : null,
          engine_type:      ENGINE_OPTIONS[form.category] ? form.engine_type : "diesel",
          condition_grade:  form.condition_grade || null,
          price_usd:        form.price_usd,
          price_negotiable: form.price_negotiable,
          stock_qty:        parseInt(form.stock_qty) || 1,
          available_date:   form.available_date || null,
          description_ko:   form.description_ko.trim(),
          description_en:   descEn,
          status:           form.status,
          images:           [],
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const imageUrls = await uploadPhotos(inserted.id);
      if (imageUrls.length > 0) {
        const { error: updErr } = await supabase
          .from("export_listings").update({ images: imageUrls }).eq("id", inserted.id);
        if (updErr) throw updErr;
      }

      navigate("/export-shop/listing/manage");
    } catch (err: any) {
      setErrors({ _global: `저장 실패: ${err?.message ?? "다시 시도해주세요."}` });
    } finally {
      setSubmitting(false);
    }
  }

  const filledCount = photos.filter((s) => s.file !== null).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-700 transition-colors text-sm">
            ← Back
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-2xl font-bold text-slate-900">장비 매물 등록</h1>
        </div>

        {errors._global && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errors._global}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── 기본 정보 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded bg-orange-500" />
              <h2 className="font-bold text-slate-800">기본 정보</h2>
            </div>

            {/* 카테고리 선택 */}
            <div>
              <Label required>카테고리</Label>
              <select
                value={form.category}
                onChange={(e) => {
                  const cat = e.target.value as Category;
                  // 카테고리 변경 시 브랜드·엔진 초기화
                  setForm((p) => ({ ...p, category: cat, brand: "", engine_type: "diesel" }));
                  setErrors((p) => { const n = { ...p }; delete n.category; return n; });
                }}
                className={fieldCls}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* 브랜드 */}
            <div>
              <Label required>브랜드</Label>
              <select
                value={form.brand}
                onChange={(e) => set("brand", e.target.value)}
                className={errors.brand ? errorCls : fieldCls}
              >
                <option value="">선택</option>
                {BRANDS_BY_CATEGORY[form.category].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <FieldError msg={errors.brand} />
            </div>

            {/* 모델 */}
            <div>
              <Label>모델</Label>
              <input
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                placeholder="예: HX140L, EC220D"
                className={fieldCls}
              />
            </div>

            {/* 연식 / 톤수 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>연식</Label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => set("year", e.target.value)}
                  placeholder="예: 2018"
                  min={1990} max={new Date().getFullYear()}
                  className={fieldCls}
                />
              </div>
              <div>
                <Label>톤수 (T)</Label>
                <input
                  type="number" step="0.5"
                  value={form.tonnage}
                  onChange={(e) => set("tonnage", e.target.value)}
                  placeholder="예: 14.0"
                  className={fieldCls}
                />
              </div>
            </div>

            {/* 엔진 고정 / 컨디션 등급 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>엔진</Label>
                {ENGINE_OPTIONS[form.category] ? (
                  <select
                    value={form.engine_type}
                    onChange={(e) => set("engine_type", e.target.value)}
                    className={fieldCls}
                  >
                    {ENGINE_OPTIONS[form.category]!.map((opt) => (
                      <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                    ))}
                  </select>
                ) : (
                  <div className={fixedCls}>Diesel — 고정</div>
                )}
              </div>
              <div>
                <Label>컨디션 등급</Label>
                <select
                  value={form.condition_grade}
                  onChange={(e) => set("condition_grade", e.target.value as ConditionGrade | "")}
                  className={fieldCls}
                >
                  <option value="">선택</option>
                  <option value="A">Grade A — 완전 재정비</option>
                  <option value="B">Grade B — PDI 완료</option>
                  <option value="C">Grade C — 경미한 마모</option>
                </select>
              </div>
            </div>

            {/* 수량 / 입고예정일 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>수량</Label>
                <input
                  type="number" min={1}
                  value={form.stock_qty}
                  onChange={(e) => set("stock_qty", e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <Label>입고/판매 가능일</Label>
                <input
                  type="date"
                  value={form.available_date}
                  onChange={(e) => set("available_date", e.target.value)}
                  className={fieldCls}
                />
              </div>
            </div>
          </div>

          {/* ── 가격 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded bg-orange-500" />
              <h2 className="font-bold text-slate-800">가격</h2>
            </div>

            <div>
              <Label>한화 가격 (₩)</Label>
              <input
                type="text" inputMode="numeric"
                value={form.price_krw ? parseInt(form.price_krw).toLocaleString() : ""}
                onChange={(e) => handlePriceKrw(e.target.value.replace(/,/g, ""))}
                placeholder="예: 45,000,000"
                className={fieldCls}
              />
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">USD 환산 <span className="text-xs text-slate-400">(₩1,500 기준)</span></span>
              <span className="text-base font-bold text-slate-900">
                {form.price_usd ? `USD ${form.price_usd.toLocaleString()}` : "—"}
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox" checked={form.price_negotiable}
                onChange={(e) => set("price_negotiable", e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700">가격 협의 가능</span>
            </label>

            <div>
              <Label>게시 상태</Label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as "active" | "draft")}
                className={fieldCls}
              >
                <option value="active">Active (즉시 공개)</option>
                <option value="draft">Draft (임시저장)</option>
              </select>
            </div>
          </div>

          {/* ── 장비 설명 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded bg-orange-500" />
              <h2 className="font-bold text-slate-800">장비 설명</h2>
            </div>

            <div>
              <Label required>한국어 설명</Label>
              <textarea
                value={form.description_ko}
                onChange={(e) => set("description_ko", e.target.value)}
                rows={4}
                placeholder="장비 상태, 특이사항, 정비 내역 등을 입력하세요."
                className={[
                  "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all resize-y",
                  errors.description_ko ? "border-red-300" : "border-slate-200 focus:border-slate-400",
                ].join(" ")}
              />
              <FieldError msg={errors.description_ko} />
            </div>

            <button
              type="button" onClick={handleTranslate} disabled={translating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-all disabled:opacity-60"
            >
              {translating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {translating ? "번역 중..." : "미리 번역 확인 (KO → EN)"}
            </button>

            <div>
              <Label>영문 설명 <span className="text-xs font-normal text-slate-400">(저장 시 자동 번역)</span></Label>
              <textarea
                value={form.description_en}
                onChange={(e) => set("description_en", e.target.value)}
                rows={4}
                placeholder="저장 시 자동 번역됩니다. 미리 확인하려면 위 버튼을 누르세요."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all resize-y focus:border-slate-400"
              />
            </div>
          </div>

          {/* ── 사진 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded bg-orange-500" />
                <h2 className="font-bold text-slate-800">사진</h2>
              </div>
              <span className="text-xs text-slate-400">{filledCount} / {PHOTO_SLOTS.length}</span>
            </div>
            <p className="text-xs text-slate-400">각 슬롯에 맞는 사진을 업로드해주세요. 순서대로 바이어에게 표시됩니다.</p>
            <PhotoSlotUploader slots={photos} onChange={setPhotos} />
          </div>

          {/* 제출 */}
          <div className="flex gap-3 pb-10">
            <button
              type="submit" disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {submitting ? "저장 중..." : "매물 등록"}
            </button>
            <button
              type="button" onClick={() => navigate("/export-shop/listing/manage")}
              className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExportListingNewPage;