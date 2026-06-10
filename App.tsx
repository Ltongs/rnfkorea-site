import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// ✅ 기존 App.tsx 상단의 shared 코드(로고/헤더/유틸/컨텍스트)는 아래로 이동했습니다.
import { Header, ScrollToTop, ScrollToTopButton, LangContext, COPY } from "./components/appShared";
import Footer from "./components/Footer";

// ✅ pages 폴더로 분리된 각 페이지
import HomePage from "./pages/Home";
import TiresPage from "./pages/Tires";
import BatteryPage from "./pages/Battery";
import ExportPage from "./pages/Export";
import FinancePage from "./pages/Finance";
import NarumiPage from "./pages/Narumi";
import OrderConfirmPage from "./pages/OrderConfirm";

// App.tsx는 라우팅/레이아웃만 담당 (기존 페이지 코드는 pages/*로 이동)
const App = () => {
  const [lang, setLang] = useState<"ko" | "en">("ko");
  const t = (key: keyof typeof COPY["ko"]) => COPY[lang][key];

  const ctxValue = useMemo(() => ({ lang, setLang, t }), [lang]);

  return (
    <LangContext.Provider value={ctxValue}>
      <BrowserRouter>
        <ScrollToTop />

        <div className="min-h-screen bg-gray-50 text-navy-900">
          <Header />

          <main className="min-h-[65vh]">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/tires" element={<TiresPage />} />
              <Route path="/battery" element={<BatteryPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/narumi" element={<NarumiPage />} />
              <Route path="/order/confirm" element={<OrderConfirmPage />} />
              <Route path="/order/confirm/:action" element={<OrderConfirmPage />} />
              <Route path="/order/confirm/:action/:id" element={<OrderConfirmPage />} />
            </Routes>
          </main>

          <Footer />
          <ScrollToTopButton />
        </div>
      </BrowserRouter>
    </LangContext.Provider>
  );
};

export default App;
