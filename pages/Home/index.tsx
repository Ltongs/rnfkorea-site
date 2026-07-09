import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Loader2, Send, LogIn } from "lucide-react";
import { Battery, Truck, Wallet, Check } from "lucide-react";

type HeroShowcaseItem = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  image: string | string[];
  to: string;
};

const heroShowcaseItems: HeroShowcaseItem[] = [
  {
    eyebrow: "최근 납품실적",
    title: "골프카트용 LFP 배터리 공급",
    subtitle: "타미우스CC",
    description: "기존 납산 배터리 대체용 LFP 배터리 공급 사례",
    image: "/home/golfcart_tamius.png",
    to: "/battery",
  },
  {
    eyebrow: "최근 납품실적",
    title: "골프카트용 LFP 배터리 추가납품",
    subtitle: "타미우스CC",
    description: "운영대수 확대에 따른 LFP 배터리 추가 공급 사례",
    image: ["/home/golfcart_tamius_add_1.jpg", "/home/golfcart_tamius_add_2.jpg"],
    to: "/battery",
  },
  {
    eyebrow: "최근 납품실적",
    title: "하이리치 LFP 배터리 장착 (광양)",
    subtitle: "예일이큅먼트 (Yale)",
    description: "물류센터 하이리치에 LFP 배터리 장착 공급 사례",
    image: ["/home/yale_reach_lfp_1.jpg", "/home/yale_reach_lfp_2.jpg"],
    to: "/battery",
  },
  {
    eyebrow: "현장 운영사례",
    title: "고소작업대 렌탈 제공",
    subtitle: "Dingli 고소작업대 (50대)",
    description: "현장 운영 목적의 장비 렌탈·금융 연계 사례",
    image:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
    to: "/finance",
  },
  {
    eyebrow: "협업 제안",
    title: "제품 + 금융 결합 판매 모델",
    subtitle: "토우그린 (TowGreen)",
    description: "골프장 장비에 금융솔루션을 결합한 구독형 공급 모델 제안",
    image: "/home/towgreen.png",
    to: "/finance",
  },
  {
    eyebrow: "협업 제안",
    title: "지게차용 배터리(납산) 렌탈 상품",
    subtitle: "아이티앤티전기",
    description: "배터리 구매 부담을 줄이는 렌탈 기반 공급 모델 협업",
    image: "/home/itnt.png",
    to: "/battery",
  },
  {
    eyebrow: "수출 사업",
    title: "중고장비 수출사업",
    subtitle: "(주)크린어스",
    description: "국내 노후 장비를 재정비·등급화해 신흥국 산업 현장으로 공급하는 수출 모델",
    image: "/home/export.jpg",
    to: "/export",
  },
  {
    eyebrow: "수출 사업",
    title: "중고 고소작업대 수출",
    subtitle: "정비 · 해외 공급",
    description: "중고 고소작업대를 선별·정비해 해외 산업 현장으로 공급하는 수출 사례",
    image: ["/home/awp_export_1.jpg", "/home/awp_export_2.jpg"],
    to: "/export",
  },
];

const HeroShowcaseSlider: React.FC = () => {
  const loopItems = [...heroShowcaseItems, ...heroShowcaseItems];
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const maxScrollRef = useRef(0);
  const latestXRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const applyTransform = (clientX: number) => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    // Track should pan in the same direction the cursor moves: cursor at
    // the right edge keeps the track at its start (0), cursor at the left
    // edge pans it fully to the left (-maxScroll).
    const x = (ratio - 1) * maxScrollRef.current;
    track.style.transform = `translateX(${x}px)`;
  };

  const handleMouseEnter = () => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (container && track) {
      // loopItems is the original list duplicated once for the seamless
      // marquee loop, so the meaningfully scrollable range is only the
      // first half of the track. Measured once on entry, not per move.
      const containerWidth = container.getBoundingClientRect().width;
      maxScrollRef.current = Math.max(track.scrollWidth / 2 - containerWidth, 0);
    }
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (trackRef.current) {
      trackRef.current.style.transform = "";
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    latestXRef.current = e.clientX;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        applyTransform(latestXRef.current);
        rafIdRef.current = null;
      });
    }
  };

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return (
    <div className="mt-10 md:mt-12 w-full">
      <div className="flex items-end justify-between gap-4 mb-4 px-1">
        <div>
          <p className="text-[11px] md:text-xs font-extrabold tracking-[0.28em] text-[#ff8a3d] uppercase">
            Recent Business Highlights
          </p>
          <h2 className="mt-2 text-left text-xl md:text-2xl font-bold text-white">
            최근 납품실적 · 사업추진 현황
          </h2>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-[2px]"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#0a192f] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0a192f] to-transparent" />

        <div
          ref={trackRef}
          className={`flex w-max gap-4 px-4 py-4 ${
            !isHovering ? "[animation:heroCaseMarquee_26s_linear_infinite]" : ""
          }`}
        >
          {loopItems.map((item, idx) => (
            <Link

              key={`${item.title}-${idx}`}
              to={item.to}
              className="group relative h-[220px] w-[300px] md:h-[236px] md:w-[360px] shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-[#10233c]"
            >
              <div className="absolute top-3 left-3 z-20">
  <span className="inline-flex rounded-full border border-white/15 bg-black/60 backdrop-blur px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] text-white uppercase">
    {item.eyebrow}
  </span>
</div>
              <div className="absolute inset-0 overflow-hidden">
                {Array.isArray(item.image) ? (
                  <div className="grid h-full w-full grid-rows-2 transition-transform duration-500 group-hover:scale-105">
                    {item.image.map((src, imageIdx) => (
                      <div key={src} className="relative min-h-0 overflow-hidden">
                        <img
                          src={src}
                          alt={`${item.title} ${item.subtitle} ${imageIdx + 1}`}
                          className="h-full w-full object-cover object-center"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <img
                    src={item.image}
                    alt={`${item.title} ${item.subtitle}`}
                    className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-[#07111f] via-[#07111f]/55 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-left">
                

                <h3 className="text-lg md:text-xl font-bold text-white leading-snug">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#b7f064]">
                  {item.subtitle}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-200 line-clamp-2">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes heroCaseMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-50% - 8px)); }
        }
      `}</style>
    </div>
  );
};

const Hero: React.FC = () => {
  return (
    <section
      className="
        relative
        min-h-[72vh] md:min-h-[82vh]
        flex items-center justify-center
        bg-[#0a192f] overflow-hidden
        py-10 md:py-16
      "
    >
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
          alt="Industrial Warehouse"
          className="w-full h-full object-cover object-center opacity-30"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-[#0a192f]/60 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f] via-[#0a192f]/35 to-transparent" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto text-center">
          <span className="animate-fadeUp text-[#a3e635] font-medium tracking-wider text-sm md:text-base mb-5 block uppercase">
            Industrial Energy & Mobility Solution
          </span>

          <h1 className="animate-fadeUp delay-150 text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            산업재에 관한 모든 것<br />
            <span className="text-[#a3e635]">RNF KOREA</span>가 책임집니다.
          </h1>

          <p className="animate-fadeUp delay-300 text-lg md:text-xl text-gray-300 mb-0 leading-relaxed font-light max-w-2xl mx-auto">
            물류기기용 LFP배터리, 산업용/화물용 타이어<br className="hidden md:block" />
            그리고 그 모든 것에 대한 렌탈과 금융 서비스.<br className="hidden md:block" />
            현장 운영비 절감을 위한 가장 합리적인 선택.
          </p>

          <HeroShowcaseSlider />
        </div>
      </div>
    </section>
  );
};

interface BrandInfo {
  name: string;
  desc: string;
  bgColor: string;
  textColor: string;
}

const ServiceCard: React.FC<{ 
  id?: string;
  icon: React.ReactNode; 
  title: string; 
  desc: string; 
  features: string[];
  brands?: BrandInfo[];
  isDark?: boolean;
}> = ({ id, icon, title, desc, features, brands, isDark }) => (
  <div id={id} className={`p-8 rounded-lg transition-all duration-300 h-full border flex flex-col scroll-mt-40
    ${isDark 
      ? 'bg-navy-800 border-navy-700 text-white' 
      : 'bg-white border-gray-100 text-navy-900 hover:border-gray-300 hover:shadow-lg'
    }`}>
    <div className={`mb-6 inline-flex p-3 rounded-lg w-fit ${isDark ? 'bg-navy-700 text-brand-lime' : 'bg-gray-50 text-navy-900'}`}>
      {icon}
    </div>
    <h3 className="text-2xl font-bold mb-3">{title}</h3>
    <p className={`text-base mb-8 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{desc}</p>
    
    <ul className="space-y-4 mb-8 flex-1">
      {features.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3 text-base">
          <Check className={`shrink-0 mt-1 w-4 h-4 ${isDark ? 'text-brand-lime' : 'text-navy-900'}`} />
          <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} leading-snug`}>{item}</span>
        </li>
      ))}
    </ul>

    {brands && (
      <div className={`pt-6 border-t ${isDark ? 'border-navy-700' : 'border-gray-100'}`}>
         <div className="flex flex-col gap-2">
           {brands.map((brand, idx) => (
             <div key={idx} className={`flex items-center justify-between p-3 rounded-md ${brand.bgColor}`}>
               <span className={`font-black ${brand.textColor}`}>{brand.name}</span>
               <span className={`text-xs font-medium ${brand.textColor} opacity-80`}>{brand.desc}</span>
             </div>
           ))}
         </div>
      </div>
    )}
  </div>
);

const Services: React.FC = () => {
  return (
    <section id="products" className="py-24 bg-white scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
  <div className="text-sm font-semibold tracking-[0.18em] uppercase text-orange-500">
    Our Solutions
  </div>
  <h2 className="mt-3 text-2xl md:text-4xl font-bold text-navy-900 leading-tight">
    현장 효율을 극대화하는
    <br className="md:hidden" />
    3대 핵심 서비스
  </h2>
</div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LFP Battery (Also Primary Product) */}
          <ServiceCard 
            icon={<Battery size={32} strokeWidth={1.5} />}
            title="LFP 배터리"
            desc="납산 배터리 대비 3배 긴 수명. 유지보수가 필요 없는 고효율 솔루션."
            features={[
              "증류수 보충 불필요 (Zero Maintenance)",
              "휴게시간 활용 고속 충전",
              "5년 이상 수명 보장 (3000 Cycle)",
              "납산배터리 사용 전 모델 적용 가능"
            ]}
            isDark={true}
          />
          {/* Tires - ID added for navigation */}
          <ServiceCard 
            id="tires"
            icon={<Truck size={32} strokeWidth={1.5} />}
            title="타이어 솔루션"
            desc="트럭부터 지게차까지. 최적의 성능을 보장하는 프리미엄 브랜드 라인업."
            features={[
              "산업용 특수 타이어 전문 유통",
              "현장 환경 맞춤형 패턴 추천",
              "대량 발주 시 특별 단가 적용"
            ]}
            brands={[
              { name: 'KUMHO TIRE', desc: '상용차(트럭/덤프/트레일러)', bgColor: 'bg-red-50', textColor: 'text-red-700' },
              { name: 'NEXEN', desc: '지게차용 솔리드', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
              { name: 'Maxam', desc: '지게차 및 특수물류기계', bgColor: 'bg-orange-50', textColor: 'text-orange-700' }
            ]}
          />
          {/* Finance - ID added for navigation */}
          <ServiceCard 
            id="finance"
            icon={<Wallet size={32} strokeWidth={1.5} />}
            title="금융 솔루션"
            desc="장비 렌탈 및 고객 맞춤형 할부금융 서비스를 제공하여 운용 효율을 개선합니다."
            features={[
              "산업·물류 장비 렌탈 프로그램",
              "상용차 할부금융 및 리스 상품 중개",
              "개별화물협회 회원 전용 상품",
              "(서울/광주/경북 MOU 체결)"
            ]}
          />
        </div>
      </div>
    </section>
  );
};

function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k] ?? "")}`)
    .join("&");
}

const CatalogForm: React.FC = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    await fetch("/.netlify/functions/send-consult", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project: "FINANCE",
        name: formData.contactName,
        phone: formData.phone,
        email: formData.email,
        memo: "",
      }),
    });

    alert("상담 신청이 접수되었습니다.\n담당자가 확인 후 연락드리겠습니다.");

    setFormData({
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
    });

  } catch (error) {
    alert("전송에 실패했습니다.\n대표번호 1551-1873 으로 문의 부탁드립니다.");
  } finally {
    setIsSubmitting(false);
  }
};

  // ✅ 높이 줄인 버전
  const inputBase =
    "w-full px-4 pt-4 pb-2.5 rounded-xl bg-white border border-gray-200 " +
    "focus:border-orange-400 focus:ring-4 focus:ring-orange-200/40 outline-none transition-all";

  const labelBase =
    "absolute left-4 top-2.5 text-[11px] font-bold text-gray-500 pointer-events-none";

  return (
    <section id="catalog-form">
      <div className="w-full bg-white overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 md:px-8 py-6 md:py-7 bg-navy-900">
          <h2 className="text-2xl font-bold text-[#0a192f]">
  견적 및 상담신청
</h2>
          <p className="text-gray-500 mt-2">
  연락처 또는 이메일만 입력하셔도 접수됩니다.
</p>
        </div>

        {/* 폼 */}
        <form
          ref={formRef}
          name="catalog"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          onSubmit={handleSubmit}
          className="px-6 md:px-8 py-6 md:py-7 space-y-4 flex flex-col"
        >
          <input type="hidden" name="form-name" value="catalog" />

          <p className="hidden">
            <label>
              Don’t fill this out:
              <input name="bot-field" />
            </label>
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <label className={labelBase}>회사명</label>
              <input
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder=" "
                className={inputBase}
                disabled={isSubmitting}
              />
            </div>

            <div className="relative">
              <label className={labelBase}>담당자명</label>
              <input
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                placeholder=" "
                className={inputBase}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <label className={labelBase}>연락처</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder=" "
                className={inputBase}
                disabled={isSubmitting}
              />
            </div>

            <div className="relative">
              <label className={labelBase}>이메일 주소</label>
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder=" "
                className={inputBase}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="
              w-full rounded-2xl py-3.5 font-extrabold text-base
              bg-orange-500 text-white
              hover:bg-orange-600 transition-all
              disabled:opacity-60
              flex items-center justify-center gap-2
              mt-2
            "
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Send size={18} />
                문의하기
              </>
            )}
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            * 연락처 또는 이메일 중 하나만 입력하셔도 됩니다.
          </p>
        </form>
      </div>
    </section>
  );
};

const CTASection: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-white text-center px-7 md:px-10 py-10 md:py-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-4">
        지금 바로 비용 절감을 시작하세요
      </h2>

      <p className="text-base text-gray-300 mb-6 font-light leading-relaxed max-w-[34rem]">
        전문 상담원이 대표님의 현장 상황에 딱 맞는 최적의 솔루션을 제안해 드립니다.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <a
          href="tel:1551-1873"
          className="
            bg-lime-300 text-[#0a192f] font-bold text-lg
            px-8 py-3.5 rounded-xl
            hover:bg-lime-400 transition-colors
            shadow-[0_12px_30px_rgba(0,0,0,0.22)]
            flex items-center justify-center gap-3
            focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-200/60
          "
        >
          <Phone size={20} />
          상담문의 1551-1873
        </a>
        <Link
          to="/login"
          className="
            border border-white/30 text-white font-semibold text-base
            px-5 py-3.5 rounded-xl
            hover:bg-white/10 transition-colors
            flex items-center justify-center gap-2
            focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30
          "
        >
          <LogIn size={18} />
          로그인
        </Link>
      </div>

      <p className="mt-6 text-gray-300/80 text-sm">
        상담가능시간 : 09:00 - 20:00 (연중무휴)
      </p>
    </div>
  );
};
const HomePage: React.FC = () => (
  <>

    <Hero />

<section id="business" className="pt-14 pb-12 md:pb-14 bg-white">
  <div className="container mx-auto px-4">
    <h2 className="text-3xl font-bold text-navy-900 mb-10">사업영역</h2>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

      {/* 타이어 */}
      <Link
        to="/tires"
        className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
        aria-label="타이어 페이지로 이동"
      >
        <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
          <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
  타이어 구매 프로그램
</h3>
<p className="text-gray-600">
  타이어 공급 + 금융 적용 구조
</p>
        </div>

        <div className="absolute top-0 right-0 h-full w-[48%]">
          <img
            src="/home/tires.jpg"
            alt="타이어"
            className="h-full w-full object-cover scale-100 group-hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
      </Link>

      {/* LFP 배터리 */}
      <Link
        to="/battery"
        className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
        aria-label="배터리 페이지로 이동"
      >
        <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
          <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
  배터리 전환 프로그램
</h3>
<p className="text-gray-600">
  LFP 전환 + 금융 결합 구조 설계
</p>
        </div>

        <div className="absolute top-0 right-0 h-full w-[48%]">
          <img
            src="/home/battery.jpg"
            alt="배터리"
            className="h-full w-full object-cover scale-100 hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
      </Link>

      {/* 장비 수출 */}
      <Link
        to="/export"
        className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
        aria-label="장비수출 페이지로 이동"
      >
        <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
          <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
  장비 재상품화 프로그램
</h3>
<p className="text-gray-600">
  노후 산업장비 선별·정비·수출 구조 설계
</p>
        </div>

        <div className="absolute top-0 right-0 h-full w-[48%]">
          <img
            src="/home/export.jpg"
            alt="장비수출"
            className="h-full w-full object-cover scale-100 hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
      </Link>

      {/* 금융 솔루션 */}
      <Link
        to="/finance"
        className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
        aria-label="금융솔루션 페이지로 이동"
      >
        <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
          <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
  프로젝트 금융 구조
</h3>
<p className="text-gray-600">
  배터리·타이어 도입을 위한 렌탈·할부 설계
</p>
        </div>

        <div className="absolute top-0 right-0 h-full w-[48%]">
          <img
            src="/home/finance.jpg"
            alt="금융솔루션"
            className="h-full w-full object-cover scale-100 hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
      </Link>

{/* 개인(개별)화물협회 금융상품 */}
<Link
  to="/cargo-finance"
  className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
             focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
  aria-label="개인화물협회 금융상품 페이지로 이동"
>
  <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
    <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
      개인(개별)화물협회 금융상품
    </h3>
    <p className="text-gray-600">
      화물운송 종사자 전용 협약 금융 프로그램
    </p>
  </div>

  <div className="absolute top-0 right-0 h-full w-[48%]">
    <img
      src="/home/indivi.jpg"
      alt="화물협회 금융"
      className="h-full w-full object-cover hover:scale-[1.03] transition-transform duration-500"
      loading="lazy"
    />
    <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
  </div>
</Link>

    </div>
  </div>
</section>

<ContactSplitSection />
  </>
);

const ContactSplitSection: React.FC = () => {
  const cardShadow = "shadow-[0_12px_40px_rgba(15,23,42,0.10)]";

  return (
    <section className="bg-gray-50 py-14 md:py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-10 items-stretch">
          {/* LEFT */}
          <div className={`h-full rounded-3xl overflow-hidden bg-white ${cardShadow}`}>
            <CatalogForm />
          </div>

          {/* RIGHT */}
          <div className={`h-full rounded-3xl overflow-hidden bg-[#0a192f] ${cardShadow}`}>
  <CTASection />
</div>
        </div>
      </div>
    </section>
  );
};

export default HomePage;