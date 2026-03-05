import React from "react";
import { Link } from "react-router-dom";

const card =
  "border border-gray-200 rounded-2xl bg-white p-6 " +
  "shadow-[0_10px_30px_rgba(15,23,42,0.06)] " +
  "hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)] transition-all";

const Home: React.FC = () => {
  const items = [
    {
      title: "타이어",
      desc: "타이어 구매 프로젝트 + 금융 구조",
      to: "/tires",
    },
    {
      title: "배터리",
      desc: "배터리 전환 프로젝트 + 금융 구조",
      to: "/battery",
    },
    {
      title: "수출",
      desc: "중고장비/부품 수출 운영",
      to: "/export",
    },
    {
      title: "금융(타이어, 배터리)",
      desc: "타이어 렌탈 · 배터리 렌탈 · 할부금융",
      to: "/finance",
    },
    {
      title: "개별협회",
      desc: "개별(개인)화물협회 전용 금융상품",
      to: "/individual-cargo-finance",
    },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-16 space-y-10">
      <div className="space-y-3 border-b border-gray-200 pb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">
          RNF KOREA
        </h1>
        <p className="text-gray-600 text-base md:text-lg max-w-3xl leading-relaxed">
          산업용 타이어 · 배터리 전환 · 수출 · 프로젝트 금융 구조를 한 번에 제공합니다.
        </p>
      </div>

      <section className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              사업영역
            </h2>
            <p className="text-gray-600 mt-2">
              5개 사업영역을 각각의 페이지로 분리 운영합니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((x) => (
            <Link key={x.to} to={x.to} className={`${card} block`}>
              <div className="text-xs font-extrabold tracking-wider text-gray-500 mb-2">
                BUSINESS
              </div>
              <div className="text-xl font-extrabold text-navy-900">{x.title}</div>
              <div className="mt-2 text-sm text-gray-600 leading-relaxed">{x.desc}</div>
              <div className="mt-4 text-sm font-extrabold text-orange-600">
                바로가기 →
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;