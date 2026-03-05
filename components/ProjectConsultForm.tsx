import React, { useMemo, useState } from "react";

export type ProjectConsultFormProps = {
  project: "BATTERY" | "TIRES" | "EXPORT" | "FINANCE" | string;
  defaultFinanceType?: "RENTAL" | "INSTALLMENT" | "LEASE" | string;
  defaultSegment?: "STANDARD" | "BUSINESS" | "INDIVIDUAL" | string;
  title?: string;
  subtitle?: string;
  className?: string;
};

export const ProjectConsultForm: React.FC<ProjectConsultFormProps> = ({
  project,
  defaultFinanceType = "RENTAL",
  defaultSegment = "STANDARD",
  title = "프로젝트 상담",
  subtitle = "연락처 또는 이메일만 입력하셔도 접수됩니다.",
  className = "",
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle"
  );

  const canSubmit = useMemo(() => {
    const hasContact = phone.trim().length >= 7 || email.trim().length >= 5;
    return hasContact && status !== "sending";
  }, [phone, email, status]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("sending");

    try {
      // ✅ 현재는 백엔드가 없으니 로컬 저장 + 안내만
      const payload = {
        project,
        financeType: defaultFinanceType,
        segment: defaultSegment,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        memo: memo.trim(),
        createdAt: new Date().toISOString(),
      };

      // 필요하면 나중에 여기서 fetch("/api/lead", { method:"POST", ... })로 교체
      console.log("[ProjectConsultForm]", payload);

      // 간단 저장(원치 않으면 지우셔도 됩니다)
      const key = "rnf_consult_leads";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([payload, ...prev].slice(0, 50)));

      setStatus("ok");
      setName("");
      setPhone("");
      setEmail("");
      setMemo("");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-navy-900">{title}</div>
          <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300"
          placeholder="이름(선택)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300"
          placeholder="연락처(필수: 연락처 또는 이메일)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300 md:col-span-2"
          placeholder="이메일(필수: 연락처 또는 이메일)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <textarea
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-300 md:col-span-2 min-h-[110px]"
          placeholder="요청사항(선택)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <div className="md:col-span-2 flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`inline-flex items-center justify-center px-6 py-3 rounded-xl font-extrabold transition-all
              ${
                canSubmit
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
          >
            {status === "sending" ? "전송 중..." : "상담 접수"}
          </button>

          <a
            href="tel:1551-1873"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-gray-200 bg-white text-navy-900 font-extrabold hover:border-gray-300 hover:shadow-sm transition-all"
          >
            전화로 바로 상담 1551-1873
          </a>
        </div>

        {status === "ok" && (
          <div className="md:col-span-2 text-sm font-bold text-green-600">
            접수되었습니다. 곧 연락드리겠습니다.
          </div>
        )}

        {status === "error" && (
          <div className="md:col-span-2 text-sm font-bold text-red-600">
            전송 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </div>
        )}

        <div className="md:col-span-2 mt-1 text-[11px] text-gray-400">
          * 입력하신 정보는 상담 목적 외 사용하지 않습니다.
        </div>
      </form>
    </div>
  );
};