import React from "react";
import { Link } from "react-router-dom";

import { ProjectConsultForm } from "../../components/ProjectConsultForm";
import HoverPreviewGrid from "../../components/HoverPreviewGrid";

const BatteryPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-16 space-y-20">
      {/* 페이지 제목 */}
      <div className="relative space-y-3 border-b border-gray-200 pb-6">
        {/* ✅ 우측 상단 완성형 블록 */}
<div className="absolute right-0 top-0 hidden md:flex flex-col items-end gap-3">
  {/* 1) 총판 배지 (✅ CapEx 박스와 동일 폭) */}
  <div className="w-[300px] inline-flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 px-4 py-2 rounded-2xl shadow-[0_1px_0_rgba(0,0,0,0.02)]">
    <img
      src="/logo/reten.jpg"
      alt="Reten Energy Solution"
      className="h-20 w-auto object-contain"
      loading="lazy"
    />
    <div className="text-right leading-tight">
      <div className="text-[10px] font-extrabold tracking-wide text-orange-600">
        OFFICIAL PARTNER
      </div>
      <div className="text-sm font-extrabold text-navy-900">
        Spiderway 공식 총판
      </div>
    </div>
  </div>

  {/* 2) 구조 슬로건 (기존 유지) */}
  <div className="w-[300px] bg-gray-50 border border-gray-200 px-4 py-2 rounded-2xl text-right shadow-[0_1px_0_rgba(0,0,0,0.02)]">
    <div className="text-sm font-extrabold text-navy-900">
      CapEx → OpEx 구조 전환
    </div>
    <div className="text-xs text-gray-500 mt-1 font-bold">
      기술 설계 + 금융 구조 결합
    </div>
  </div>
</div>

        {/* Breadcrumb */}
        <div className="text-sm text-gray-500">
          <Link to="/" className="hover:text-orange-500 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 font-semibold">배터리</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">
          배터리
        </h1>

        {/* Desc (왼쪽 텍스트가 우측 블록과 겹치지 않도록 md에서 폭 제한) */}
        <p className="text-gray-600 text-base md:text-lg max-w-3xl md:max-w-[62%]">
          안전성/수명/운영효율 관점에서 현장 적용에 최적화된 구성으로 제안합니다.
        </p>
      </div>

      {/* ===================== 배터리 파트너사 (✅ LFP 라인업 위로 이동) ===================== */}
      <div className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              배터리 공급사
            </h2>
          </div>
        </div>

        <div className="grid md:grid-cols-1 gap-6">
          {/* Reten */}
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-extrabold tracking-wider text-orange-600 mb-2">
                  PARTNER
                </div>

                <h3 className="text-xl font-extrabold text-navy-900">
                  리텐에너지솔루션 (Reten Energy Solution)
                </h3>

                <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                  Spiderway 제품을 판매하고 있으며, RNF KOREA는
                  리텐에너지솔루션의 총판입니다.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    "브랜드 : Spiderway",
                    "분야 : 산업용 배터리 솔루션",
                    "RNF 역할 : 국내 총판 / 공급·현장 적용 지원",
                  ].map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm font-extrabold border border-orange-200 bg-white text-navy-900"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <a
                href="https://www.retenensol.com/"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-orange-500 text-white font-extrabold text-sm hover:bg-orange-600 transition-all whitespace-nowrap"
              >
                홈페이지 바로가기 →
              </a>
            </div>
          </div>

          {/* Spiderway (제품/브랜드 설명 카드) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div className="min-w-0">
                <h3 className="text-xl font-extrabold text-navy-900">
                  Spiderway (제품/브랜드)
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  현장 적용을 전제로 한 배터리 구성/세팅/운영 최적화에 초점을
                  둔 제품 라인업입니다. RNF KOREA는 요구 조건(장비/전압/용량/
                  충전환경) 기반으로 스펙을 제안합니다.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "적용 : 지게차 / AWP / 골프카트 등",
                    "지원 : 스펙 제안 · 설치/배선 · 세팅",
                    "운영 : 충전환경/사용패턴 기반 최적화",
                  ].map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm font-extrabold border border-gray-200 bg-white text-navy-900"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== LFP 배터리 라인업 ===================== */}
      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              LFP 배터리 라인업
            </h2>
            <p className="text-gray-600 mt-2 max-w-3xl">
              안전성/수명/운영효율 관점에서 현장 적용에 최적화된 구성으로
              제안합니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* 지게차용 배터리 */}
          <div className="group border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">
                    지게차용 배터리
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  교체/전환(납산→LFP) 컨설팅 및 현장 조건 기반 스펙 제안
                </p>
              </div>

              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src="/home/forklift.jpg"
                  alt="지게차용 배터리"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </div>

          {/* 고소작업대용 배터리 */}
          <div className="group border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">
                    고소작업대용 배터리
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  고소작업대 제조사, 높이별 전압/용량 최적화
                </p>
              </div>

              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src="/home/awp.jpg"
                  alt="고소작업대용 배터리"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </div>

          {/* 골프카트용 배터리 */}
          <div className="group border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">
                    골프카트용 배터리
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  골프카트/저속 전동차량용 LFP 전환 및 맞춤 용량 구성 제안
                </p>
              </div>

              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src="/home/golfcart.jpg"
                  alt="골프카트용 배터리"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </div>

          {/* 렌탈 상품 */}
          <div className="group border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">
                    렌탈 상품
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  도입 비용 부담을 줄이는 장기렌탈상품 지원
                </p>
              </div>

              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src="/home/rental.jpg"
                  alt="렌탈·금융 연계"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </div>
        </div>

        {/* ===================== Battery Conversion Project ===================== */}
        <section className="mt-16 space-y-10">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
                배터리 교체 Project!
              </h2>
              <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
                제품 판매가 아니라, 전환 프로젝트입니다. <br />
                RNF KOREA는 배터리 전환을 기술 설계와 금융 구조로 완성합니다.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="border rounded-xl p-6 bg-white hover:shadow-md transition-all">
              <div className="text-orange-500 font-extrabold text-sm mb-2">
                STEP 01
              </div>
              <h3 className="font-extrabold text-navy-900 mb-2">현장 진단</h3>
              <p className="text-sm text-gray-600">
                장비 사양, 사용 패턴, 충전 환경을 분석하여 전환 가능성과 예상
                효과를 도출합니다.
              </p>
            </div>

            <div className="border rounded-xl p-6 bg-white hover:shadow-md transition-all">
              <div className="text-orange-500 font-extrabold text-sm mb-2">
                STEP 02
              </div>
              <h3 className="font-extrabold text-navy-900 mb-2">LFP 설계</h3>
              <p className="text-sm text-gray-600">
                Spiderway 기반 최적 스펙 설계 및 안전성·수명·효율 중심 구성
                제안.
              </p>
            </div>

            <div className="border rounded-xl p-6 bg-white hover:shadow-md transition-all">
              <div className="text-orange-500 font-extrabold text-sm mb-2">
                STEP 03
              </div>
              <h3 className="font-extrabold text-navy-900 mb-2">
                금융 구조 설계
              </h3>
              <p className="text-sm text-gray-600">
                초기 도입비 부담을 줄이는 렌탈·분할 상환 구조 설계. 운영비
                절감 기반 상환 모델 제안.
              </p>
            </div>

            <div className="border rounded-xl p-6 bg-white hover:shadow-md transition-all">
              <div className="text-orange-500 font-extrabold text-sm mb-2">
                STEP 04
              </div>
              <h3 className="font-extrabold text-navy-900 mb-2">
                설치 및 운영 최적화
              </h3>
              <p className="text-sm text-gray-600">
                설치·배선·세팅 완료 후 운영 데이터 기반 성능 안정화 지원.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-orange-50 border border-orange-200 p-6 text-center">
            <p className="text-navy-900 font-extrabold text-lg">
              배터리 전환은 비용이 아니라 구조입니다.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              CapEx를 운영 구조로 전환하여 현금흐름 안정화를 설계합니다.
            </p>
          </div>

          <div className="mt-10">
            <ProjectConsultForm
              project="BATTERY"
              defaultFinanceType="RENTAL"
              defaultSegment="STANDARD"
              title="배터리 전환 프로젝트 상담"
              subtitle="연락처 또는 이메일만 입력하셔도 접수됩니다."
            />
          </div>
        </section>

        {/* ===================== 설치사례 ===================== */}
        <section className="mt-10 md:mt-12">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
            <div className="min-w-0">
              <h3 className="text-xl md:text-2xl font-extrabold text-navy-900 tracking-tight">
                골프카트용 배터리 · 최근 설치사례
              </h3>
              <p className="text-sm md:text-base text-gray-600 mt-2 leading-relaxed">
                기존 리튬이온 → 리튬인산철 전환으로 운영 효율 개선 실현.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "설치장소 : 타미우스CC (제주시 애월읍)",
                  "차종: 골프카트",
                  "배터리: LFP 전환 (기존 리튬인산철_NCM 계열)",
                  "작업: 설치/배선/세팅",
                  "효과: 충전효율↑ 유지보수↓, 기존 충전기 사용으로 불필요한 작업(충전기 교체, 충전소 변경 등) 제거",
                ].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm font-extrabold border border-gray-200 bg-white text-navy-900"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <HoverPreviewGrid
            images={[
              "/cases/golfcart/1.jpg",
              "/cases/golfcart/2.jpg",
              "/cases/golfcart/3.jpg",
              "/cases/golfcart/4.jpg",
              "/cases/golfcart/5.jpg",
              "/cases/golfcart/6.jpg",
            ]}
            alt="골프카트 배터리 설치사례"
            thumbClassName="h-28 md:h-36"
            centerRatio={0.28}
            openDelayMs={250}
            closeDelayMs={120}
          />

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a
              href="tel:1551-1873"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-orange-500 text-white font-extrabold hover:bg-orange-600 transition-all"
            >
              설치/견적 문의 1551-1873
            </a>

            <a
              href="https://blog.naver.com/reten_es/224029828603"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-gray-200 bg-white text-navy-900 font-extrabold hover:border-gray-300 hover:shadow-sm transition-all"
              title="네이버 블로그 원문"
            >
              블로그 원문 보기 →
            </a>
          </div>

          <p className="mt-3 text-xs text-gray-400 leading-relaxed">
            * 설치 사례 사진은 현장/고객 정보 보호를 위해 일부 편집될 수 있습니다.
          </p>
        </section>
      </section>
    </div>
  );
};

export default BatteryPage;