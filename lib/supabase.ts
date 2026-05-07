// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

const isSSR = typeof window === "undefined";

const dummySubscription = { unsubscribe: () => {} };

const dummyAuth = {
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: dummySubscription } }),
  signInWithPassword: () => Promise.resolve({ data: null, error: null }),
  signOut: () => Promise.resolve({ error: null }),
};

const dummyQuery: any = {
  select: function() { return dummyQuery; },
  eq: function() { return dummyQuery; },
  or: function() { return dummyQuery; },
  gte: function() { return dummyQuery; },
  lte: function() { return dummyQuery; },
  order: function() { return dummyQuery; },
  limit: function() { return dummyQuery; },
  neq: function() { return dummyQuery; },
  single: () => Promise.resolve({ data: null, error: null }),
  then: function(resolve: any) { return resolve({ data: [], error: null }); },
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

// SSR 환경: 더미 클라이언트 사용 (네트워크 연결 없음)
// 브라우저 환경: realtime 비활성화로 WebSocket 연결 방지 (prerender 후 프로세스 종료 보장)
export const supabase = isSSR
  ? (dummyClient as any)
  : createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 0 },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

export default supabase;