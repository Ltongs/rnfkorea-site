import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, relative } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { readFileSync as readEnv } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// .env.local 직접 파싱
const envFile = readEnv(join(ROOT, ".env.local"), "utf8");
const env = Object.fromEntries(
  envFile.split("\n").filter(l => l.includes("=")).map(l => l.split("=").map((v,i) => i===0 ? v.trim() : l.slice(l.indexOf("=")+1).trim()))
);

const SUPABASE_URL     = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET           = "export-images";
const IMAGE_DIR        = join(ROOT, "public", "image");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ 환경변수 없음"); process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function collectFiles(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) result.push(...collectFiles(full));
    else {
      const ext = extname(entry).toLowerCase();
      if ([".jpg",".jpeg",".png",".webp"].includes(ext)) result.push(full);
    }
  }
  return result;
}

function mimeType(ext) {
  return {".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp"}[ext] ?? "image/jpeg";
}

const files = collectFiles(IMAGE_DIR);
console.log(`📁 총 ${files.length}개 파일 업로드 시작...\n`);
let ok=0, fail=0;
for (const file of files) {
  const storagePath = relative(IMAGE_DIR, file);
  try {
    const data = readFileSync(file);
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, data, { contentType: mimeType(extname(file).toLowerCase()), upsert: true });
    if (error) { console.error(`  ❌ ${storagePath}: ${error.message}`); fail++; }
    else { console.log(`  ✅ ${storagePath}`); ok++; }
  } catch(e) { console.error(`  ❌ ${storagePath}: ${e.message}`); fail++; }
}
console.log(`\n완료: ✅ ${ok}개 / ❌ ${fail}개`);
