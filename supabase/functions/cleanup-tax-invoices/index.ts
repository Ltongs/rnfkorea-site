import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET    = "tax-invoices";
const TTL_HOURS = 72;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cutoff = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { data: expiredRows, error: selectError } = await supabase
    .from("tax_invoice_uploads")
    .select("id, storage_path")
    .lt("uploaded_at", cutoff);

  if (selectError) {
    return new Response(JSON.stringify({ error: selectError.message }), { status: 500 });
  }

  if (!expiredRows || expiredRows.length === 0) {
    return new Response(JSON.stringify({ deleted: 0, message: "만료된 파일 없음" }), { status: 200 });
  }

  const storagePaths = expiredRows.map((r) => r.storage_path);
  const recordIds    = expiredRows.map((r) => r.id);

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove(storagePaths);

  if (storageError) {
    return new Response(JSON.stringify({ error: storageError.message }), { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("tax_invoice_uploads")
    .delete()
    .in("id", recordIds);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({ deleted: expiredRows.length, paths: storagePaths }),
    { status: 200 }
  );
});
