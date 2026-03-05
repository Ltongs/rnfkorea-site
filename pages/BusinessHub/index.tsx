import React from "react";
import { Link } from "react-router-dom";

export default function BusinessHubPage() {
  return (
    <div className="container mx-auto px-4 py-16 space-y-10">
      <div className="space-y-3 border-b border-gray-200 pb-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">
          사업영역
        </h1>
        <p className="text-gray-600">RNF KOREA 사업 영역을 한 곳에서 안내합니다.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link
          to="/export"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
        >
          <div className="font-extrabold text-navy-900">수출</div>
          <div className="text-sm text-gray-600 mt-2">중고 장비/부품 수출</div>
        </Link>

        <Link
          to="/finance"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
        >
          <div className="font-extrabold text-navy-900">금융</div>
          <div className="text-sm text-gray-600 mt-2">리스/할부/프로젝트 파이낸싱</div>
        </Link>

        <Link
          to="/tires"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
        >
          <div className="font-extrabold text-navy-900">타이어</div>
          <div className="text-sm text-gray-600 mt-2">유통/공급/서비스</div>
        </Link>
      </div>
    </div>
  );
}