// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

const isSSR = typeof window === "undefined";

const dummySubscription = { unsubscribe: () => {} };

const dummyAuth = {
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: dummySubscription } }),
  signInWithPassword: () => Promise.resolve({ data: null, error: null }),
  signOut: () => Promise.resolve({ error: null }),
};

const dummyQuery: any = {
  select: function () { return dummyQuery; },
  eq: function () { return dummyQuery; },
  or: function () { return dummyQuery; },
  gte: function () { return dummyQuery; },
  lte: function () { return dummyQuery; },
  order: function () { return dummyQuery; },
  limit: function () { return dummyQuery; },
  neq: function () { return dummyQuery; },
  single: () => Promise.resolve({ data: null, error: null }),
  then: function (resolve: any) { return resolve({ data: [], error: null }); },
};

const dummyClient = {
  auth: dummyAuth,
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: null, error: null }),
      download: () => Promise.resolve({ data: null, error: null }),
      remove: () => Promise.resolve({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }),
  },
  from: () => dummyQuery,
};

// SSR(프리렌더링) 환경에는 window/localStorage가 없어 실제 클라이언트 생성이 실패하므로
// 더미 클라이언트로 대체한다 (Vite 프리렌더 빌드가 Node에서 이 모듈을 그대로 import함).
export const supabase = isSSR
  ? (dummyClient as any)
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,       // 세션을 localStorage에 저장 (새로고침 후에도 유지)
        autoRefreshToken: true,     // 토큰 만료 전 자동 갱신
        detectSessionInUrl: true,   // OAuth 리다이렉트 후 URL에서 세션 자동 감지
      },
      realtime: {
        params: { eventsPerSecond: 0 }, // 미사용 기능 — 프리렌더 프로세스가 열린 커넥션 없이 정상 종료되도록 비활성화
      },
    });

export default supabase;