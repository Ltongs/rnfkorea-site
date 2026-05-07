// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// SSR(prerender) 환경에서는 더미 클라이언트 반환 — 네트워크 연결 없음
const isSSR = typeof window === "undefined";

const noop = () => Promise.resolve({ data: null, error: null });
const noopSync = () => ({ data: null, error: null });

const dummySubscription = { unsubscribe: () => {} };

const dummyAuth = {
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: dummySubscription } }),
  signInWithPassword: noop,
  signOut: noop,
};

const dummyStorage = {
  from: () => ({
    upload: noop,
    download: noop,
    remove: noop,
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
  }),
};

const dummyFrom = () => ({
  select: () => dummyQuery,
  insert: noop,
  update: () => dummyQuery,
  delete: () => dummyQuery,
  eq: () => dummyQuery,
  or: () => dummyQuery,
  gte: () => dummyQuery,
  lte: () => dummyQuery,
  order: () => dummyQuery,
  limit: () => dummyQuery,
  neq: () => dummyQuery,
  single: noop,
});

const dummyQuery: any = {
  select: () => dummyQuery,
  eq: () => dummyQuery,
  or: () => dummyQuery,
  gte: () => dummyQuery,
  lte: () => dummyQuery,
  order: () => dummyQuery,
  limit: () => dummyQuery,
  neq: () => dummyQuery,
  single: noop,
  then: (resolve: any) => resolve({ data: [], error: null }),
};

const dummyClient = {
  auth: dummyAuth,
  storage: dummyStorage,
  from: dummyFrom,
};

export const supabase = isSSR
  ? (dummyClient as any)
  : createClient(supabaseUrl, supabaseAnonKey);

export default supabase;