// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,       // 세션을 localStorage에 저장 (새로고침 후에도 유지)
    autoRefreshToken: true,     // 토큰 만료 전 자동 갱신
    detectSessionInUrl: true,   // OAuth 리다이렉트 후 URL에서 세션 자동 감지
    storageKey: "rnfkorea-auth", // localStorage 키 이름 (다른 프로젝트와 충돌 방지)
  },
});

export default supabase;