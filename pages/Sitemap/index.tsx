import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

type SiteLink = {
  label: string;
  to?: string; // optional
  desc?: string;
  badge?: string; // ✅ 일반 링크에도 배지 표시
  comingSoon?: boolean; // 준비중 처리
};

type SiteSection = {
  title: string;
  subtitle?: string;
  links: SiteLink[];
};

const sections: SiteSection[] = [
  {
    title: "Business",
    subtitle: "RNF KOREA 서비스/사업 영역",
    links: [
      { label: "타이어", to: "/tires", desc: "상용차·산업용 타이어 솔루션" },
      {
        label: "배터리",
        to: "/battery",
        desc: "LFP 배터리 라인업 및 납산배터리 교체 컨설팅",
      },
      { label: "노후장비 수출사업", to: "/export", desc: "중고 산업장비 해외 수출" },
      { label: "금융솔루션", to: "/finance", desc: "렌탈·리스·할부금융 구조 설계" },

      // ✅ 개인(개별)화물협회 추가
      {
        label: "개인(개별)화물협회",
        to: "/cargo-finance",
        desc: "협회 전용 리스/금융상품 안내",
        badge: "협회 전용",
      },
    ],
  },

  {
    title: "Shop",
    subtitle: "상품/매물 쇼핑몰",
    links: [
      { label: "타이어 쇼핑몰", to: "/tires-shop", desc: "상품번호 기준, 제품 검색/상세" },
      { label: "수출용 쇼핑몰", to: "/export-shop", desc: "정비·등급화된 매물 확인" },
      {
        label: "배터리 쇼핑몰",
        desc: "배터리 상품 등록/검색 (준비중)",
        badge: "준비중",
        comingSoon: true,
      },
    ],
  },

  {
    title: "Company",
    subtitle: "기본 정보 및 홈",
    links: [
      { label: "홈", to: "/", desc: "RNF KOREA 메인" },
      { label: "사이트맵", to: "/sitemap", desc: "전체 구성 안내" },
    ],
  },

  {
    title: "Internal",
    subtitle: "내부 업무용(권한 필요)",
    links: [
      { label: "나르미업무 로그인", to: "/narumi/login", desc: "내부 업무 시스템 로그인" },
    ],
  },
];

const AppleSitemap: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <main className="bg-white">
      <div className="container mx-auto px-4 md:px-6 py-14 md:py-20">
        {/* Header */}
        <header className="max-w-3xl">
          <div className="text-xs font-bold tracking-[0.18em] text-gray-400 uppercase">
            RNF KOREA
          </div>

          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold text-navy-900 tracking-tight">
            Sitemap
          </h1>

          <p className="mt-3 text-base md:text-lg text-gray-600 leading-relaxed">
            RNF KOREA 홈페이지의 전체 구성 안내 페이지입니다.
            <br className="hidden md:block" />
            필요한 메뉴를 빠르게 찾아 이동할 수 있습니다.
          </p>

          <div className="mt-8 h-px w-full bg-gray-200" />
        </header>

        {/* Sections */}
        <section className="mt-10 md:mt-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
            {sections.map((sec) => (
              <div key={sec.title} className="min-w-0">
                <div className="text-xs font-extrabold tracking-[0.16em] text-gray-400 uppercase">
                  {sec.title}
                </div>

                {sec.subtitle && (
                  <div className="mt-2 text-sm text-gray-500 leading-relaxed">
                    {sec.subtitle}
                  </div>
                )}

                <div className="mt-5 space-y-2.5">
                  {sec.links.map((l) => {
                    const isCurrent = !!l.to && pathname === l.to;

                    const commonClass =
                      "group block rounded-2xl border border-gray-200 bg-white px-4 py-3.5 " +
                      "transition-all duration-200 hover:border-gray-300 hover:shadow-sm " +
                      "focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50";

                    // ✅ 준비중 or 링크 없음: Link 대신 button(클릭 막기)
                    if (l.comingSoon || !l.to) {
                      return (
                        <button
                          key={`${sec.title}-${l.label}`}
                          type="button"
                          className={`${commonClass} text-left opacity-80 cursor-not-allowed`}
                          disabled
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-extrabold text-navy-900 truncate">
                                  {l.label}
                                </div>
                                <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                  {l.badge ?? "준비중"}
                                </span>
                              </div>

                              {l.desc && (
                                <div className="mt-1 text-xs text-gray-500 leading-relaxed">
                                  {l.desc}
                                </div>
                              )}
                            </div>

                            <ChevronRight className="shrink-0 mt-0.5 text-gray-200" size={18} />
                          </div>
                        </button>
                      );
                    }

                    // ✅ 일반 링크
                    return (
                      <Link key={`${sec.title}-${l.to}`} to={l.to} className={commonClass}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-extrabold text-navy-900 truncate">
                                {l.label}
                              </div>

                              {/* ✅ 일반 링크 배지(협회 전용 등) */}
                              {l.badge && !isCurrent && (
                                <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                  {l.badge}
                                </span>
                              )}

                              {isCurrent && (
                                <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                  현재 페이지
                                </span>
                              )}
                            </div>

                            {l.desc && (
                              <div className="mt-1 text-xs text-gray-500 leading-relaxed">
                                {l.desc}
                              </div>
                            )}
                          </div>

                          <ChevronRight
                            className="shrink-0 mt-0.5 text-gray-300 group-hover:text-orange-400 transition-colors"
                            size={18}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-12 md:mt-16">
            <div className="h-px w-full bg-gray-200" />
            <p className="mt-6 text-xs text-gray-400 leading-relaxed">
              * 본 사이트맵은 홈페이지 구조 안내 목적입니다. 내부 메뉴(나르미업무)는 권한이 필요할 수 있습니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default AppleSitemap;