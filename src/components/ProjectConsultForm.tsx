// src/components/ProjectConsultForm.tsx
import React from "react";

type Props = {
  /** Netlify Forms용 form name (기본: catalog) */
  formName?: string;
  /** 폼 상단 타이틀 */
  title?: string;
  /** 타이틀 아래 설명 */
  subtitle?: string;
  /** 프로젝트 구분(타이어/배터리/화물협회 등) */
  projectType?: string;
  /** 버튼 텍스트 */
  submitLabel?: string;
  /** 추가 클래스 */
  className?: string;
};

export const ProjectConsultForm: React.FC<Props> = ({
  formName = "catalog",
  title = "견적 및 상담신청",
  subtitle = "연락처 또는 이메일만 입력하셔도 접수됩니다.",
  projectType = "",
  submitLabel = "문의하기",
  className = "",
}) => {
  return (
    <form
      name={formName}
      method="POST"
      data-netlify="true"
      netlify-honeypot="bot-field"
      className={`h-full rounded-3xl overflow-hidden bg-white ${className}`}
    >
      {/* Netlify required hidden fields */}
      <input type="hidden" name="form-name" value={formName} />
      <p hidden>
        <label>
          Don’t fill this out: <input name="bot-field" />
        </label>
      </p>

      {/* 프로젝트 타입 hidden */}
      <input type="hidden" name="projectType" value={projectType} />

      <div className="p-8 md:p-10">
        {/* ✅ 타이틀 색상: 흰색 문제 해결 (항상 네이비) */}
        <h3 className="text-2xl md:text-3xl font-extrabold text-navy-900">
          {title}
        </h3>

        {/* ✅ 서브타이틀 색상 설정 */}
        <p className="text-gray-600 mt-2">{subtitle}</p>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <input
            name="companyName"
            placeholder="회사명"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-orange-400"
          />
          <input
            name="contactName"
            placeholder="담당자명"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-orange-400"
          />
          <input
            name="phone"
            placeholder="연락처"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-orange-400"
          />
          <input
            name="email"
            placeholder="이메일 주소"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-orange-400"
          />
        </div>

        <button
          type="submit"
          className="
            mt-6 w-full rounded-2xl
            bg-orange-500 text-white font-extrabold
            py-4
            hover:bg-orange-600 transition-colors
          "
        >
          {submitLabel}
        </button>

        <p className="mt-3 text-xs text-gray-400 text-center">
          * 연락처 또는 이메일 중 하나만 입력하셔도 됩니다.
        </p>
      </div>
    </form>
  );
};