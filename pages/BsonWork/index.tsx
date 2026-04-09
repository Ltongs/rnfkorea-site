import React, { useEffect, useMemo, useState } from "react";
import PageTitle from "../../components/PageTitle";

type Row = {
  no?: string;
  assetNo?: string; // 자산번호(또는 장비번호)
  equipNo?: string; // 장비번호
  model?: string; // 모델명
  vin?: string; // 차대번호
  siteName?: string; // 현장명
  siteAddress?: string; // 현장주소
};

/**
 * ✅ 허용 딜 이름(=시트명)
 * 새 딜이 생기면 배열에 시트명과 URL만 추가하면 됩니다.
 */
const ALLOWED_SHEET_NAMES = ["삼우", "삼우2"] as const;

/**
 * ✅ 기존 공개 CSV URL(삼우)
 * - 현재 작동이 확인된 URL
 */
const CSV_URL_MAP: Record<string, string[]> = {
  삼우: [
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=347572598&single=true&output=csv",
  ],
  삼우2: [
    // ✅ 1순위: publish된 시트명 직접 지정
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=352624719&single=true&output=csv",
    
  ],
};

const PHOTO_BASE = "/asset/samwoo"; // public/asset/samwoo
const EXT = "webp" as const;

// -------------------------
// CSV Parser (quotes/commas 지원)
// -------------------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(cell);
        cell = "";
      } else if (ch === "\n") {
        cur.push(cell);
        rows.push(cur);
        cur = [];
        cell = "";
      } else if (ch === "\r") {
        // ignore
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }
  return rows;
}

function norm(s: string) {
  return (s ?? "").toString().trim();
}

function pickIndex(headers: string[], candidates: string[]) {
  const h = headers.map((x) => norm(x).replace(/\s+/g, ""));
  for (const c of candidates) {
    const idx = h.indexOf(norm(c).replace(/\s+/g, ""));
    if (idx >= 0) return idx;
  }
  return -1;
}

// ✅ 문자열 끝 4자리(영숫자 그대로)
function last4FromText(value: string) {
  const s = norm(value);
  if (!s) return "";
  return s.slice(-4);
}

function getPhotoMatchKey(row: Row, dealName: string) {
  // 삼우2는 자산번호 끝 4자리로 매칭
  if (norm(dealName) === "삼우2") {
    return last4FromText(row.assetNo ?? row.equipNo ?? "");
  }

  // 기본값(삼우): 차대번호 끝 4자리로 매칭
  return last4FromText(row.vin ?? "");
}

function photoUrl(last4: string, which: 1 | 2) {
  return encodeURI(`${PHOTO_BASE}/${last4}(${which}).${EXT}`);
}

function downloadName(last4: string, which: 1 | 2) {
  return `${last4}(${which}).${EXT}`;
}


function escapeHtml(value: string) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * ✅ 존재 여부 판정 (SPA fallback 방지)
 * - 없는 파일인데 index.html이 떨어지는 경우 content-type: text/html
 * - 이 경우 false 처리
 */
async function existsStaticFile(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!head.ok) return false;
    const ct = (head.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return false;
    return true;
  } catch {
    try {
      const get = await fetch(url, { method: "GET", cache: "no-store" });
      if (!get.ok) return false;
      const ct = (get.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html")) return false;
      return true;
    } catch {
      return false;
    }
  }
}

async function resolveCsvText(urls: string[]) {
  let lastStatus = "";
  for (const rawUrl of urls) {
    try {
      const url = rawUrl.includes("?") ? `${rawUrl}&v=${Date.now()}` : `${rawUrl}?v=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastStatus = `${res.status}`;
        continue;
      }
      const text = await res.text();
      if (norm(text)) {
        return text;
      }
    } catch {
      // try next
    }
  }
  throw new Error(`CSV fetch failed${lastStatus ? `: ${lastStatus}` : ""}`);
}

export default function BsonWorkPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [dealName, setDealName] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");

  // 파일 존재 캐시
  const [photoExistMap, setPhotoExistMap] = useState<
    Record<string, { p1: boolean; p2: boolean }>
  >({});

  const normalizedDealName = useMemo(() => norm(dealName), [dealName]);
  const normalizedEquipmentSearch = useMemo(() => norm(equipmentSearch), [equipmentSearch]);

  const isUnlocked = useMemo(
    () => ALLOWED_SHEET_NAMES.includes(normalizedDealName as (typeof ALLOWED_SHEET_NAMES)[number]),
    [normalizedDealName]
  );

  useEffect(() => {
    let alive = true;

    if (!isUnlocked) {
      setRows([]);
      setErr(null);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const urls = CSV_URL_MAP[normalizedDealName] || [];
        if (urls.length === 0) throw new Error("허용된 시트 URL이 없습니다.");

        const csvText = await resolveCsvText(urls);
        const grid = parseCsv(csvText).filter((r) => r.some((c) => norm(c) !== ""));
        if (grid.length < 2) throw new Error("CSV data is empty");

        const headers = grid[0].map((x) => norm(x));

        const idxNo = pickIndex(headers, ["순번", "No", "No.", "번호"]);
        const idxAsset = pickIndex(headers, [
          "자산번호",
          "장비번호",
          "자산번호(장비번호)",
          "AssetNo",
        ]);
        const idxEquip = pickIndex(headers, ["장비번호", "EquipmentNo"]);
        const idxModel = pickIndex(headers, ["모델명", "모델", "Model"]);
        const idxVin = pickIndex(headers, ["차대번호", "VIN", "vin"]);
        const idxSiteName = pickIndex(headers, ["현장명", "현장"]);
        const idxSiteAddress = pickIndex(headers, ["현장주소", "주소"]);

        const out: Row[] = [];
        for (let i = 1; i < grid.length; i++) {
          const r = grid[i];
          const no = idxNo >= 0 ? r[idxNo] : String(i);
          const assetNo = idxAsset >= 0 ? (r[idxAsset] ?? "") : "";
          const equipNo = idxEquip >= 0 ? (r[idxEquip] ?? "") : "";
          const model = idxModel >= 0 ? (r[idxModel] ?? "") : "";
          const vin = idxVin >= 0 ? (r[idxVin] ?? "") : "";
          const siteName = idxSiteName >= 0 ? (r[idxSiteName] ?? "") : "";
          const siteAddress = idxSiteAddress >= 0 ? (r[idxSiteAddress] ?? "") : "";

          if (!assetNo && !equipNo && !vin && !model && !siteName && !siteAddress) continue;

          out.push({
            no,
            assetNo,
            equipNo,
            model,
            vin,
            siteName,
            siteAddress,
          });
        }

        if (!alive) return;
        setRows(out);
      } catch (e: any) {
        if (!alive) return;
        setRows([]);
        setErr(e?.message ?? "unknown error");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isUnlocked, normalizedDealName]);

  // ✅ 잠금 상태면 자산을 “아예 안 보여줌”
  const visibleRows = useMemo(() => {
    if (!isUnlocked) return [];

    if (!normalizedEquipmentSearch) return rows;

    return rows.filter((r) => {
      const equipmentNo = norm(r.equipNo || r.assetNo || "");
      return equipmentNo.slice(-4) === normalizedEquipmentSearch;
    });
  }, [isUnlocked, rows, normalizedEquipmentSearch]);

  // ✅ 사진 존재 체크도 “잠금 해제된 경우에만”
  useEffect(() => {
    if (!isUnlocked) return;

    let alive = true;

    (async () => {
      const targets = visibleRows
        .map((r) => getPhotoMatchKey(r, normalizedDealName))
        .filter((k) => k && !photoExistMap[k]);

      if (targets.length === 0) return;

      const chunkSize = 8;

      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);

        const results = await Promise.all(
          chunk.map(async (k) => {
            const u1 = photoUrl(k, 1);
            const u2 = photoUrl(k, 2);
            const [p1, p2] = await Promise.all([existsStaticFile(u1), existsStaticFile(u2)]);
            return { k, p1, p2 };
          })
        );

        if (!alive) return;

        setPhotoExistMap((prev) => {
          const next = { ...prev };
          for (const r of results) next[r.k] = { p1: r.p1, p2: r.p2 };
          return next;
        });
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, visibleRows, normalizedDealName]);

  // ✅ 진척율 (사진 1 또는 2 중 하나라도 있으면 “있음”)
  const progress = useMemo(() => {
    const total = visibleRows.length;
    if (total === 0) return { total: 0, hasAny: 0, pct: 0 };

    let hasAny = 0;
    for (const r of visibleRows) {
      const k = getPhotoMatchKey(r, normalizedDealName);
      if (!k) continue;
      const ex = photoExistMap[k];
      if (ex && (ex.p1 || ex.p2)) hasAny++;
    }

    const pct = Math.round((hasAny / total) * 100);
    return { total, hasAny, pct };
  }, [visibleRows, photoExistMap, normalizedDealName]);

  const badge = (ok: boolean) =>
    ok
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-gray-50 text-gray-500 border-gray-200";

  // ✅ 다운로드 버튼: 흰 배경 + 진한 글자(테두리) → 글자 안 보이는 이슈 제거
  const dlBtnEnabled =
    "inline-flex items-center justify-center px-4 py-2 rounded-xl " +
    "bg-white border border-navy-900 text-navy-900 font-extrabold " +
    "hover:bg-navy-900 hover:text-white transition";

  const dlBtnDisabled =
    "inline-flex items-center justify-center px-4 py-2 rounded-xl " +
    "bg-gray-100 border border-gray-200 text-gray-400 font-extrabold cursor-not-allowed";


  const exportBtnClass =
    "inline-flex items-center justify-center w-auto px-3 py-1.5 text-sm font-bold " +
    "text-white bg-gray-800 rounded-md hover:bg-gray-700 whitespace-nowrap transition";

  const exportBtnDisabledClass =
    "inline-flex items-center justify-center w-auto px-3 py-1.5 text-sm font-bold " +
    "text-gray-400 bg-gray-100 border border-gray-200 rounded-md whitespace-nowrap cursor-not-allowed";

  const handleExportNoPhotoExcel = async () => {
    const targets = visibleRows
      .map((r) => ({ row: r, key: getPhotoMatchKey(r, normalizedDealName) }))
      .filter((item) => !!item.key);

    const missingKeys = Array.from(
      new Set(
        targets
          .map((item) => item.key as string)
          .filter((key) => !photoExistMap[key])
      )
    );

    let mergedMap: Record<string, { p1: boolean; p2: boolean }> = { ...photoExistMap };

    if (missingKeys.length > 0) {
      const results = await Promise.all(
        missingKeys.map(async (key) => {
          const [p1, p2] = await Promise.all([
            existsStaticFile(photoUrl(key, 1)),
            existsStaticFile(photoUrl(key, 2)),
          ]);
          return { key, p1, p2 };
        })
      );

      mergedMap = { ...mergedMap };
      for (const item of results) {
        mergedMap[item.key] = { p1: item.p1, p2: item.p2 };
      }
      setPhotoExistMap((prev) => ({ ...prev, ...mergedMap }));
    }

    const noPhotoRows = targets
      .filter(({ key }) => {
        const ex = mergedMap[key as string];
        return ex && !ex.p1 && !ex.p2;
      })
      .map(({ row, key }) => ({
        no: row.no ?? "",
        assetNo: row.assetNo ?? "",
        equipNo: row.equipNo ?? "",
        model: row.model ?? "",
        vin: row.vin ?? "",
        siteName: row.siteName ?? "",
        siteAddress: row.siteAddress ?? "",
        fileKey: key ?? "",
        photo1: "없음",
        photo2: "없음",
      }));

    const tableRows = noPhotoRows
      .map(
        (r) => `
          <tr>
            <td>${escapeHtml(String(r.no))}</td>
            <td>${escapeHtml(r.assetNo)}</td>
            <td>${escapeHtml(r.equipNo)}</td>
            <td>${escapeHtml(r.model)}</td>
            <td>${escapeHtml(r.vin)}</td>
            <td>${escapeHtml(r.siteName)}</td>
            <td>${escapeHtml(r.siteAddress)}</td>
            <td>${escapeHtml(r.fileKey)}</td>
            <td>${r.photo1}</td>
            <td>${r.photo2}</td>
          </tr>`
      )
      .join("");

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>순번</th>
                <th>자산번호</th>
                <th>장비번호</th>
                <th>모델명</th>
                <th>차대번호</th>
                <th>현장명</th>
                <th>현장주소</th>
                <th>파일키</th>
                <th>사진1</th>
                <th>사진2</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>`;

    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `samwoo2_no_photo_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-10 space-y-6">
      <PageTitle
        title="BS_ON 업무"
        desc="RNF KOREA 내부 자산 및 딜 관리 페이지입니다. 사진 업로드 진행 상태와 자산 정보를 관리합니다."
      />

      {/* 상단 */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-gray-500">BS_ON · 렌탈 딜 자산 관리</div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-navy-900 mt-1">
            딜: {dealName || "—"}
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          {/* 딜 이름 */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-[11px] font-extrabold text-gray-500">
              딜 이름(시트명 정확히 입력)
            </div>
            <input
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              className="mt-1 w-[260px] outline-none font-extrabold text-navy-900"
              placeholder="예: RNF"
            />
            <div className="mt-2 text-[11px] font-bold">
              {isUnlocked ? (
                <span className="text-emerald-700">✅ 일치: 자산 표시</span>
              ) : (
                <span className="text-gray-500">⛔ 미일치: 자산 숨김 (허용 시트: 별도)</span>
              )}
            </div>
          </div>

          {/* 장비번호 검색 */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="text-[11px] font-extrabold text-gray-500">
              장비번호 검색(끝 4자리)
            </div>
            <input
              value={equipmentSearch}
              onChange={(e) => {
                const raw = e.target.value.replace(/\s+/g, "");
                setEquipmentSearch(raw.slice(0, 4));
              }}
              className="mt-1 w-[180px] outline-none font-extrabold text-navy-900"
              placeholder="예: 1234"
              inputMode="numeric"
              maxLength={4}
            />
            <div className="mt-2 text-[11px] font-bold text-gray-500">
              {normalizedEquipmentSearch
                ? `입력값: ${normalizedEquipmentSearch}`
                : "미입력 시 전체 표시"}
            </div>
          </div>

          {/* 진척율 박스 (잠금 해제 시만 의미있게 표시) */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 min-w-[280px]">
            <div className="text-[11px] font-extrabold text-gray-500">사진 진척율</div>

            {!isUnlocked ? (
              <div className="mt-2 text-sm font-extrabold text-gray-500 leading-relaxed">
                딜 이름을 입력하세요
              </div>
            ) : (
              <>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div className="text-2xl font-extrabold text-navy-900">{progress.pct}%</div>
                  <div className="text-sm font-extrabold text-gray-700">
                    {progress.hasAny}/{progress.total}
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${progress.pct}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  * 사진1 또는 사진2 중 <b>하나라도 있으면</b> “사진있음”으로 계산
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 안내 */}
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
        <div className="font-extrabold text-orange-700">다운로드 전용 안내</div>
        <div className="text-sm text-orange-700/90 mt-1 leading-relaxed">
          이 페이지는 <b>있음/없음 + 다운로드</b> 전용입니다.
        </div>
      </div>

      {/* 잠금 안내 (자산 숨김 상태) */}
      {!isUnlocked && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="text-lg font-extrabold text-navy-900">딜 이름 입력 필요</div>
          <div className="mt-2 text-sm text-gray-600 leading-relaxed">
            딜 이름(=시트명)을 정확히 입력하면 자산 목록이 표시됩니다.
          </div>
          <div className="mt-4 text-[12px] text-gray-500">
            * 목록은 숨기지만, CSV는 내부적으로 로드될 수 있습니다(표시/검증 로직만 잠금).
          </div>
        </div>
      )}

      {/* 테이블 (잠금 해제 시만 표시) */}
      {isUnlocked && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <div className="font-extrabold text-navy-900">
                자산 {visibleRows.length.toLocaleString()}개
              </div>
              {normalizedEquipmentSearch && (
                <div className="text-[12px] text-gray-500 mt-1">
                  장비번호 끝 4자리 <b>{normalizedEquipmentSearch}</b> 검색 결과
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {normalizedDealName === "삼우2" && (
                <button
                  type="button"
                  onClick={handleExportNoPhotoExcel}
                  className={loading ? exportBtnDisabledClass : exportBtnClass}
                  disabled={loading}
                  title="삼우2 목록에서 사진이 하나도 없는 장비만 엑셀로 다운로드"
                >
                  사진없는 장비 엑셀 다운로드
                </button>
              )}

              {loading && <div className="text-sm font-bold text-gray-500">불러오는 중…</div>}
              {err && <div className="text-sm font-extrabold text-red-600">에러: {err}</div>}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1550px] w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3 font-extrabold w-[70px]">순번</th>
                  <th className="px-4 py-3 font-extrabold w-[180px]">장비번호</th>
                  <th className="px-4 py-3 font-extrabold w-[240px]">모델명</th>
                  <th className="px-4 py-3 font-extrabold w-[240px]">차대번호</th>
                  <th className="px-4 py-3 font-extrabold w-[180px]">현장명</th>
                  <th className="px-4 py-3 font-extrabold w-[320px]">현장주소</th>
                  <th className="px-4 py-3 font-extrabold w-[140px]">사진1</th>
                  <th className="px-4 py-3 font-extrabold w-[180px]">다운로드1</th>
                  <th className="px-4 py-3 font-extrabold w-[140px]">사진2</th>
                  <th className="px-4 py-3 font-extrabold w-[180px]">다운로드2</th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((r, idx) => {
                  const last4 = getPhotoMatchKey(r, normalizedDealName);
                  const u1 = last4 ? photoUrl(last4, 1) : "";
                  const u2 = last4 ? photoUrl(last4, 2) : "";

                  const ex = last4 ? photoExistMap[last4] : undefined;
                  const p1 = !!ex?.p1;
                  const p2 = !!ex?.p2;

                  return (
                    <tr
                      key={`${r.vin ?? ""}-${idx}`}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-extrabold text-gray-700">
                        {r.no ?? idx + 1}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-extrabold text-navy-900">
                          {r.equipNo || r.assetNo || "-"}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          파일키({normalizedDealName === "삼우2" ? "자산번호끝4" : "VIN끝4"}): <span className="font-bold">{last4 || "—"}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-bold text-gray-700">{r.model || "-"}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">{r.vin || "-"}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">
                        {r.siteName || "-"}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-700">
                        {r.siteAddress || "-"}
                      </td>

                      {/* 사진1 */}
                      <td className="px-4 py-3">
                        {last4 ? (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-extrabold ${badge(
                              p1
                            )}`}
                          >
                            {p1 ? "있음" : "없음"}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-bold">키 없음</span>
                        )}
                      </td>

                      {/* 다운로드1 */}
                      <td className="px-4 py-3">
                        {last4 ? (
                          p1 ? (
                            <a
                              href={u1}
                              download={downloadName(last4, 1)}
                              className={dlBtnEnabled}
                              title="다운로드"
                            >
                              다운로드
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className={dlBtnDisabled}
                              title="파일이 없습니다"
                            >
                              다운로드
                            </button>
                          )
                        ) : (
                          <span className="text-gray-400 font-bold">—</span>
                        )}
                      </td>

                      {/* 사진2 */}
                      <td className="px-4 py-3">
                        {last4 ? (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-extrabold ${badge(
                              p2
                            )}`}
                          >
                            {p2 ? "있음" : "없음"}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-bold">키 없음</span>
                        )}
                      </td>

                      {/* 다운로드2 */}
                      <td className="px-4 py-3">
                        {last4 ? (
                          p2 ? (
                            <a
                              href={u2}
                              download={downloadName(last4, 2)}
                              className={dlBtnEnabled}
                              title="다운로드"
                            >
                              다운로드
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className={dlBtnDisabled}
                              title="파일이 없습니다"
                            >
                              다운로드
                            </button>
                          )
                        ) : (
                          <span className="text-gray-400 font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!loading && !err && visibleRows.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-gray-500 font-bold"
                      colSpan={10}
                    >
                      표시할 자산이 없습니다. 장비번호 끝 4자리 검색값을 확인해주세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 text-[12px] text-gray-500 bg-white border-t border-gray-100">
            사진 파일은 <b>{PHOTO_BASE}</b> 아래에 {normalizedDealName === "삼우2" ? (<><b>자산번호끝4자리(1).webp</b>, <b>자산번호끝4자리(2).webp</b></>) : (<><b>VIN끝4자리(1).webp</b>, <b>VIN끝4자리(2).webp</b></>)} 규칙으로 두면 자동 연결됩니다.
          </div>
        </div>
      )}
    </div>
  );
}