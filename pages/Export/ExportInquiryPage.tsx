// pages/Export/ExportInquiryPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, CheckCircle2, Globe, Loader2, Mail, Package, Phone, User } from "lucide-react";

type InquiryForm = {
  company: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  incoterms: "FOB" | "CIF" | "EXW" | "FCA" | "DAP" | "DDP" | "";
  items: string;
  quantity: string;
  target_port: string;
  timeline: string;
  notes: string;
  agree: boolean;
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ExportInquiryPage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, [location.hash]);

  const [form, setForm] = useState<InquiryForm>({
    company: "",
    name: "",
    phone: "",
    email: "",
    country: "",
    incoterms: "",
    items: "",
    quantity: "",
    target_port: "",
    timeline: "",
    notes: "",
    agree: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | { at: string; ref: string }>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refCode = useMemo(() => {
    const d = new Date();
    const y = String(d.getFullYear()).slice(2);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `EX-${y}${m}${day}-${rand}`;
  }, [submitted]);

  function update<K extends keyof InquiryForm>(key: K, value: InquiryForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function validate(v: InquiryForm) {
    const e: Record<string, string> = {};
    if (!v.company.trim()) e.company = "회사/상호를 입력해주세요.";
    if (!v.name.trim()) e.name = "담당자 성함을 입력해주세요.";
    if (!v.phone.trim()) e.phone = "연락처를 입력해주세요.";
    if (!v.email.trim() || !isEmail(v.email)) e.email = "올바른 이메일을 입력해주세요.";
    if (!v.country.trim()) e.country = "수출 대상 국가를 입력해주세요.";
    if (!v.items.trim()) e.items = "품목/모델/스펙을 입력해주세요.";
    if (!v.quantity.trim()) e.quantity = "수량/규격을 입력해주세요.";
    if (!v.agree) e.agree = "개인정보 처리 동의가 필요합니다.";
    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const eMap = validate(form);
    setErrors(eMap);
    if (Object.keys(eMap).length > 0) {
      document.getElementById("export-inquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      setSubmitted({ at: now.toISOString(), ref: refCode });

      setForm({
        company: "",
        name: "",
        phone: "",
        email: "",
        country: "",
        incoterms: "",
        items: "",
        quantity: "",
        target_port: "",
        timeline: "",
        notes: "",
        agree: false,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="hover:text-orange-500 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link to="/export-shop" className="hover:text-orange-500 transition-colors">
            수출용 쇼핑몰
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-semibold">상담/견적 요청</span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">수출 상담 / 견적 요청</h1>
          <p className="text-slate-600">
            아래 내용을 남겨주시면 RNF KOREA가 사양 확인 → 조건 정리 → 견적/리드타임 안내까지 빠르게 진행합니다.
          </p>
        </div>

        {submitted && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-extrabold text-emerald-900">접수가 완료되었습니다.</div>
                <div className="text-emerald-900/80 mt-1">
                  접수번호: <span className="font-black">{submitted.ref}</span>
                </div>
                <div className="text-emerald-900/70 text-sm mt-1">필요 시 위 접수번호로 문의해주세요.</div>
              </div>
            </div>
          </div>
        )}

        <section id="export-inquiry" className="mt-10">
          <div className="rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-6 rounded-full bg-orange-500" />
              <h2 className="text-xl md:text-2xl font-black text-slate-900">상담/견적 폼</h2>
            </div>

            <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="회사/상호 *"
                icon={<Building2 className="w-4 h-4" />}
                value={form.company}
                onChange={(v) => update("company", v)}
                placeholder="예: RNF KOREA"
                error={errors.company}
              />

              <Field
                label="담당자 성함 *"
                icon={<User className="w-4 h-4" />}
                value={form.name}
                onChange={(v) => update("name", v)}
                placeholder="예: 홍길동"
                error={errors.name}
              />

              <Field
                label="연락처 *"
                icon={<Phone className="w-4 h-4" />}
                value={form.phone}
                onChange={(v) => update("phone", v)}
                placeholder="예: 010-1234-5678"
                error={errors.phone}
              />

              <Field
                label="이메일 *"
                icon={<Mail className="w-4 h-4" />}
                value={form.email}
                onChange={(v) => update("email", v)}
                placeholder="예: name@company.com"
                error={errors.email}
              />

              <Field
                label="수출 대상 국가 *"
                icon={<Globe className="w-4 h-4" />}
                value={form.country}
                onChange={(v) => update("country", v)}
                placeholder="예: Kenya / Indonesia"
                error={errors.country}
              />

              <SelectField
                label="희망 인코텀즈"
                value={form.incoterms}
                onChange={(v) => update("incoterms", v as InquiryForm["incoterms"])}
                options={[
                  { value: "", label: "선택" },
                  { value: "FOB", label: "FOB" },
                  { value: "CIF", label: "CIF" },
                  { value: "EXW", label: "EXW" },
                  { value: "FCA", label: "FCA" },
                  { value: "DAP", label: "DAP" },
                  { value: "DDP", label: "DDP" },
                ]}
              />

              <TextArea
                className="md:col-span-2"
                label="품목/모델/스펙 *"
                icon={<Package className="w-4 h-4" />}
                value={form.items}
                onChange={(v) => update("items", v)}
                placeholder={`예:\n- Used forklift 3.0T / 4.5m mast\n- AWP scissor 10m\n- Tire 12R22.5 등`}
                error={errors.items}
              />

              <Field
                label="수량/규격 *"
                value={form.quantity}
                onChange={(v) => update("quantity", v)}
                placeholder="예: 5대 / 1x40HQ"
                error={errors.quantity}
              />

              <Field
                label="목적지(항/내륙)"
                value={form.target_port}
                onChange={(v) => update("target_port", v)}
                placeholder="예: Mombasa / Nairobi"
              />

              <Field
                label="희망 일정(납기/선적)"
                value={form.timeline}
                onChange={(v) => update("timeline", v)}
                placeholder="예: 4주 이내 / 3월 말 선적"
              />

              <TextArea
                className="md:col-span-2"
                label="요청사항/비고"
                value={form.notes}
                onChange={(v) => update("notes", v)}
                placeholder="예: 브랜드 선호, 연식 제한, 예산 범위, 사진 요청 등"
              />

              <div className="md:col-span-2">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="mt-1 w-5 h-5"
                    checked={form.agree}
                    onChange={(e) => update("agree", e.target.checked)}
                  />
                  <span className="text-slate-700">
                    <span className="font-bold">개인정보 처리 동의</span> (상담/견적 목적의 연락을 위해 최소한의 정보를 수집합니다.)
                  </span>
                </label>
                {errors.agree && <div className="mt-2 text-sm font-bold text-red-600">{errors.agree}</div>}
              </div>

              <div className="md:col-span-2 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-orange-500 text-white font-extrabold hover:bg-orange-600 transition-all disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {submitting ? "접수 중..." : "상담/견적 요청 접수"}
                </button>

                <div className="text-sm text-slate-500">접수번호는 화면에 표시됩니다. (추후 이메일/SMS 자동 발송도 붙일 수 있습니다)</div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

/** ---------- UI Helpers ---------- */

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
        {props.icon ? <span className="text-slate-500">{props.icon}</span> : null}
        <span>{props.label}</span>
      </div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={[
          "mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition-all",
          props.error ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-slate-300",
        ].join(" ")}
      />
      {props.error ? <div className="mt-2 text-sm font-bold text-red-600">{props.error}</div> : null}
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="text-sm font-extrabold text-slate-900">{props.label}</div>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-300"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={props.className}>
      <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
        {props.icon ? <span className="text-slate-500">{props.icon}</span> : null}
        <span>{props.label}</span>
      </div>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={5}
        className={[
          "mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition-all resize-y",
          props.error ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-slate-300",
        ].join(" ")}
      />
      {props.error ? <div className="mt-2 text-sm font-bold text-red-600">{props.error}</div> : null}
    </div>
  );
}