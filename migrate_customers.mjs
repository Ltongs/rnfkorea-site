import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 환경변수가 없습니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const XLSX = await import('xlsx');

  console.log('📂 엑셀 파일 읽는 중...');
  const buf = readFileSync('./Dashboard_RNF.xlsx');
  const wb = XLSX.read(buf);
  const ws = wb.Sheets['Backdata'];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // 데이터는 3번째 행(인덱스 2)부터 시작
  const dataRows = allRows.slice(2);

  const records = dataRows
    .map((row) => {
      if (!row || !row[6] || !row[7]) return null;
      const name   = row[6].toString().trim();
      const bizNo  = row[7].toString().trim();
      if (!name || !bizNo) return null;
      return {
        name,
        business_no:    bizNo,
        representative: row[9]  ? row[9].toString().trim()  : null,
        address:        row[10] ? row[10].toString().trim() : null,
        business_type:  row[11] ? row[11].toString().trim() : null,
        business_item:  row[19] ? row[19].toString().trim() : null,
        is_active:      true,
      };
    })
    .filter(Boolean);

  console.log(`📊 유효한 거래처: ${records.length}개`);
  console.log('샘플:', JSON.stringify(records[0], null, 2));

  const answer = process.argv[2];
  if (answer !== '--run') {
    console.log('\n⚠️  드라이런 완료. 실제 삽입하려면: node --env-file=.env.local migrate_customers.mjs --run');
    return;
  }

  let inserted = 0;
  for (const record of records) {
    const { error } = await supabase
      .from('customers')
      .upsert(record, { onConflict: 'name', ignoreDuplicates: false });
    if (error) {
      console.error(`❌ 오류 (${record.name}):`, error.message);
    } else {
      inserted++;
      process.stdout.write(`\r  → ${inserted}/${records.length} 완료`);
    }
  }

  console.log(`\n\n🎉 거래처 마이그레이션 완료! 총 ${inserted}개 삽입/업데이트됨`);
}

main().catch(console.error);
