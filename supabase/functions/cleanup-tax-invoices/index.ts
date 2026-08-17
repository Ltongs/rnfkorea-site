import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 스토리지 오브젝트 삭제 + DB 레코드 삭제를 하나의 Postgres 함수(트랜잭션) 안에서
  // 원자적으로 처리한다. (이전 구현은 storage.remove() 이후 별도 DB delete 호출로
  // 나뉘어 있어, 중간에 실패하면 DB 레코드만 남는 orphan record가 발생했다.)
  const { error } = await supabase.rpc("clear_expired_hcm_tax_invoices");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
