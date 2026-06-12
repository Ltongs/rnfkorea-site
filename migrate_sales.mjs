import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 환경변수가 없습니다. .env.local을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Excel 날짜 시리얼 → ISO 변환
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

function normalizeCategory(val) {
  if (!val) return '기타';
  const v = val.toString().trim();
  if (v === '타이어') return '타이어';
  if (v === '렌탈') return '렌탈';
  if (v === 'LFP(지게차)') return 'LFP(지게차)';
  if (v === 'LFP(고소작업대)') return 'LFP(고소작업대)';
  return '기타';
}

function toBool(val) {
  if (!val) return false;
  return ['O', 'Y', 'TRUE', '1', 'o'].includes(val.toString().trim().toUpperCase());
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n);
}

async function main() {
  // XLSX을 dynamic import로 처리
  const XLSX = await import('xlsx');
  
  console.log('📂 엑셀 파일 읽는 중...');
  const buf = readFileSync('./Dashboard_RNF.xlsx');
  const wb = XLSX.read(buf);
  const ws = wb.Sheets['RAW'];

  if (!ws) {
    console.error('❌ RAW 시트를 찾을 수 없습니다.');
    process.exit(1);
  }

  // header: 1 로 읽어서 2번째 행(실제 헤더)부터 처리
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  
  // 실제 데이터 헤더 찾기 (순번이 있는 행)
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i] && allRows[i].includes('순번')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    console.error('❌ 헤더 행을 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`✅ 헤더 행: ${headerRowIdx + 1}번째 행`);
  const headers = allRows[headerRowIdx];
  const dataRows = allRows.slice(headerRowIdx + 1);

  // 헤더 인덱스 매핑
  const col = (name) => headers.indexOf(name);

  const records = dataRows
    .map((row) => {
      if (!row || !row[col('날짜')]) return null;
      return {
        sale_date:          excelDateToISO(row[col('날짜')]),
        customer_name:      (row[col('고객명')] || '').toString().trim(),
        business_no:        (row[col('사업자번호')] || '').toString().trim() || null,
        category:           normalizeCategory(row[col('종류')]),
        maker:              (row[col('Maker')] || '').toString().trim() || null,
        spec:               (row[col('규격')] || '').toString().trim() || null,
        quantity:           toNum(row[col('수량')]),
        unit_price:         toNum(row[col('판매단가')]),
        unit_cost:          toNum(row[col('매입단가')]),
        tax_invoice:        toBool(row[col('계산서')]),
        payment_confirmed:  typeof row[col('입금')] === 'number' ? true : toBool(row[col('입금')]),
        payment_date:       typeof row[col('입금')] === 'number' ? excelDateToISO(row[col('입금')]) : null,
        delivery_date:      excelDateToISO(row[col('배송일자')]),
        delivery_confirmed: (row[col('배송확인')] || '').toString().trim() === '완료',
        wheel_returned:     toBool(row[col('휠반납 확인')]),
        closing:            toBool(row[col('Closing')]),
        note:               (row[col('비고')] || '').toString().trim() || null,
      };
    })
    .filter((r) => r && r.sale_date && r.customer_name);

  console.log(`📊 유효한 데이터: ${records.length}개`);
  console.log('샘플:', JSON.stringify(records[0], null, 2));

  const answer = process.argv[2];
  if (answer !== '--run') {
    console.log('\n⚠️  드라이런 완료. 실제 삽입하려면: node --env-file=.env.local migrate_sales.mjs --run');
    return;
  }

  // 100개씩 배치 insert
  const BATCH = 100;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase.from('sales_records').insert(batch);
    if (error) {
      console.error(`❌ 오류 (행 ${i}~${i + BATCH}):`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  → ${inserted}/${records.length} 완료`);
    }
  }

  console.log(`\n\n🎉 마이그레이션 완료! 총 ${inserted}개 삽입됨`);
}

main().catch(console.error);
