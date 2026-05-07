// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// SSR(prerender) 환경에서는 더미 클라이언트 반환 — 네트워크 연결 없음
const isSSR = typeof window === "undefined";

export const supabase = isSSR
  ? (new Proxy({} as any, {
      get(_t, prop) {
        // 모든 메서드 호출을 빈 Promise로 반환
        if (prop === "auth") return new Proxy({}, { get: () => () => Promise.resolve({ data: null, error: null }) });
        if (prop === "from") return () => new Proxy({}, { get: () => () => Promise.resolve({ data: [], error: null }) });
        if (prop === "storage") return new Proxy({}, { get: () => new Proxy({}, { get: () => () => Promise.resolve({ data: null, error: null }) }) });
        return () => Promise.resolve({ data: null, error: null });
      },
    }))
  : createClient(supabaseUrl, supabaseAnonKey);

export default supabase;