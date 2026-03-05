import React from "react";
import { Link } from "react-router-dom";

export default function ShopHubPage() {
  return (
    <div className="container mx-auto px-4 py-16 space-y-10">
      <div className="space-y-3 border-b border-gray-200 pb-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">
          쇼핑몰
        </h1>
        <p className="text-gray-600">제품 카테고리별 쇼핑몰로 이동합니다.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link
          to="/tireshop"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
        >
          <div className="font-extrabold text-navy-900">타이어 쇼핑몰</div>
          <div className="text-sm text-gray-600 mt-2">인벤토리/가격/주문</div>
        </Link>

        <Link
          to="/battery"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
        >
          <div className="font-extrabold text-navy-900">배터리 쇼핑몰</div>
          <div className="text-sm text-gray-600 mt-2">준비중</div>
        </Link>

        <Link
          to="/tires"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300"
        >
          <div className="font-extrabold text-navy-900">타이어 제품 안내</div>
          <div className="text-sm text-gray-600 mt-2">스펙/브랜드/서비스</div>
        </Link>
      </div>
    </div>
  );
}