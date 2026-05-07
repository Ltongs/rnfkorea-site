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

// ✅ 사진 확장자 후보
// - 기존 webp 우선
// - jpg/jpeg 원본이 public/asset/samwoo에 올라간 경우도 자동 인식
// - Netlify/Linux 배포 환경은 대소문자를 구분하므로 JPG/JPEG도 함께 확인
const PHOTO_EXTENSIONS = ["webp", "jpg", "jpeg", "JPG", "JPEG"] as const;
type PhotoExt = (typeof PHOTO_EXTENSIONS)[number];
type PhotoSlot = {
  exists: boolean;
  url: string;
  filename: string;
  ext: PhotoExt | "";
};
type PhotoExist = {
  p1: PhotoSlot;
  p2: PhotoSlot;
};

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

function photoUrl(last4: string, which: 1 | 2, ext: PhotoExt) {
  return encodeURI(`${PHOTO_BASE}/${last4}(${which}).${ext}`);
}

function downloadName(last4: string, which: 1 | 2, ext: PhotoExt) {
  return `${last4}(${which}).${ext}`;
}

function emptyPhotoSlot(): PhotoSlot {
  return { exists: false, url: "", filename: "", ext: "" };
}

async function resolvePhotoSlot(last4: string, which: 1 | 2): Promise<PhotoSlot> {
  for (const ext of PHOTO_EXTENSIONS) {
    const url = photoUrl(last4, which, ext);
    const exists = await existsStaticFile(url);
    if (exists) {
      return {
        exists: true,
        url,
        filename: downloadName(last4, which, ext),
        ext,
      };
    }
  }

  return emptyPhotoSlot();
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
    Record<string, PhotoExist>
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
            const [p1, p2] = await Promise.all([resolvePhotoSlot(k, 1), resolvePhotoSlot(k, 2)]);
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
      if (ex && (ex.p1.exists || ex.p2.exists)) hasAny++;
    }

    const pct = Math.round((hasAny / total) * 100);
    return { total, hasAny, pct };
  }, [visibleRows, photoExistMap, normalizedDealName]);

  // ─── 스타일 상수 ──────────────────────────────────────────
  const badge = (ok: boolean) =>
    ok
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-gray-100 text-gray-500 border-gray-200";

  const dlBtnEnabled =
    "inline-flex items-center justify-center px-4 py-2 rounded-2xl " +
    "border border-gray-300 bg-white text-navy-900 font-semibold text-xs " +
    "hover:shadow-md transition-all";

  const dlBtnDisabled =
    "inline-flex items-center justify-center px-4 py-2 rounded-2xl " +
    "bg-gray-100 border border-gray-200 text-gray-400 font-semibold text-xs cursor-not-allowed";

  const exportBtnClass =
    "inline-flex items-center justify-center px-5 py-2.5 rounded-2xl " +
    "bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all whitespace-nowrap";

  const exportBtnDisabledClass =
    "inline-flex items-center justify-center px-5 py-2.5 rounded-2xl " +
    "bg-gray-100 border border-gray-200 text-gray-400 font-semibold text-sm cursor-not-allowed whitespace-nowrap";

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

    let mergedMap: Record<string, PhotoExist> = { ...photoExistMap };

    if (missingKeys.length > 0) {
      const results = await Promise.all(
        missingKeys.map(async (key) => {
          const [p1, p2] = await Promise.all([
            resolvePhotoSlot(key, 1),
            resolvePhotoSlot(key, 2),
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
        return ex && !ex.p1.exists && !ex.p2.exists;
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
    <div className="min-h-screen bg-gray-50">

      {/* ── 히어로 헤더 ── */}
      <section className="relative bg-[#0a192f] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]" aria-hidden="true"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-12 md:py-16">
          <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">Business</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-[1.15] text-white break-keep">
            BS_ON 업무
          </h1>
          <p className="mt-3 text-base leading-7 text-white/75 break-keep">
            렌탈 딜 자산 관리 · 사진 업로드 진행 상태 및 다운로드
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">

        {/* ── 컨트롤 패널 ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* 딜 이름 입력 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500 mb-3">Deal Name</p>
            <p className="text-sm font-medium text-navy-900 mb-2">딜 이름 (시트명 정확히 입력)</p>
            <input
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              className="h-[44px] w-full px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-semibold text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all"
              placeholder="예: 삼우"
            />
            <div className="mt-3">
              {isUnlocked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  ✓ 일치 — 자산 표시
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-gray-100 border border-gray-200 text-gray-500 text-xs font-semibold">
                  미일치 — 자산 숨김
                </span>
              )}
            </div>
          </div>

          {/* 장비번호 검색 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500 mb-3">Search</p>
            <p className="text-sm font-medium text-navy-900 mb-2">장비번호 검색 (끝 4자리)</p>
            <input
              value={equipmentSearch}
              onChange={(e) => {
                const raw = e.target.value.replace(/\s+/g, "");
                setEquipmentSearch(raw.slice(0, 4));
              }}
              className="h-[44px] w-full px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-semibold text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all"
              placeholder="예: 1234"
              inputMode="numeric"
              maxLength={4}
            />
            <p className="mt-3 text-xs text-gray-400">
              {normalizedEquipmentSearch ? `검색 중: ${normalizedEquipmentSearch}` : "미입력 시 전체 표시"}
            </p>
          </div>

          {/* 사진 진척율 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500 mb-3">Progress</p>
            <p className="text-sm font-medium text-navy-900 mb-3">사진 진척율</p>
            {!isUnlocked ? (
              <p className="text-sm text-gray-400">딜 이름을 먼저 입력하세요.</p>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3 mb-2">
                  <span className="text-3xl font-semibold text-navy-900">{progress.pct}%</span>
                  <span className="text-sm font-medium text-gray-500 pb-1">{progress.hasAny} / {progress.total}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress.pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-400">* 사진1 또는 사진2 중 하나라도 있으면 "있음"으로 계산</p>
              </>
            )}
          </div>
        </div>

        {/* ── 안내 배너 ── */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-6 py-4">
          <p className="text-sm font-semibold text-orange-700">
            다운로드 전용 페이지 — 있음/없음 확인 및 사진 파일 다운로드만 가능합니다.
          </p>
        </div>

        {/* ── 잠금 안내 ── */}
        {!isUnlocked && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">Locked</p>
            <h2 className="text-xl font-semibold text-navy-900 mb-2">딜 이름 입력 필요</h2>
            <p className="text-sm leading-6 text-gray-600">딜 이름(=시트명)을 정확히 입력하면 자산 목록이 표시됩니다.</p>
            <p className="mt-3 text-xs text-gray-400">* 목록은 숨기지만 CSV는 내부적으로 로드될 수 있습니다 (표시/검증 로직만 잠금).</p>
          </div>
        )}

        {/* ── 테이블 (잠금 해제 시) ── */}
        {isUnlocked && (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500">Assets</p>
                <h2 className="mt-1 text-lg font-semibold text-navy-900">
                  자산 {visibleRows.length.toLocaleString()}개
                </h2>
                {normalizedEquipmentSearch && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    장비번호 끝 4자리 <strong>{normalizedEquipmentSearch}</strong> 검색 결과
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
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
                {loading && <span className="text-sm font-medium text-gray-400">불러오는 중…</span>}
                {err && <span className="text-sm font-medium text-red-500">에러: {err}</span>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1550px] w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[70px]">순번</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[180px]">장비번호</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[240px]">모델명</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[240px]">차대번호</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[180px]">현장명</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[320px]">현장주소</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[100px]">사진1</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[160px]">다운로드1</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[100px]">사진2</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wide text-gray-400 uppercase w-[160px]">다운로드2</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, idx) => {
                    const last4 = getPhotoMatchKey(r, normalizedDealName);
                    const ex    = last4 ? photoExistMap[last4] : undefined;
                    const p1    = !!ex?.p1.exists;
                    const p2    = !!ex?.p2.exists;
                    const u1    = ex?.p1.url || "";
                    const u2    = ex?.p2.url || "";
                    const name1 = ex?.p1.filename || "";
                    const name2 = ex?.p2.filename || "";

                    return (
                      <tr key={`${r.vin ?? ""}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-600">{r.no ?? idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-navy-900">{r.equipNo || r.assetNo || "-"}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            파일키 ({normalizedDealName === "삼우2" ? "자산번호끝4" : "VIN끝4"}):&nbsp;
                            <span className="font-semibold">{last4 || "—"}</span>
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{r.model || "-"}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{r.vin || "-"}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{r.siteName || "-"}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{r.siteAddress || "-"}</td>

                        <td className="px-4 py-3">
                          {last4 ? (
                            <span className={`inline-flex items-center px-3 py-1 rounded-2xl border text-xs font-semibold ${badge(p1)}`}>
                              {p1 ? "있음" : "없음"}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">키 없음</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {last4 ? (
                            p1 ? (
                              <a href={u1} download={name1} className={dlBtnEnabled} title="다운로드">다운로드</a>
                            ) : (
                              <button type="button" disabled className={dlBtnDisabled} title="파일이 없습니다">다운로드</button>
                            )
                          ) : (
                            <span className="text-gray-400 font-medium">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {last4 ? (
                            <span className={`inline-flex items-center px-3 py-1 rounded-2xl border text-xs font-semibold ${badge(p2)}`}>
                              {p2 ? "있음" : "없음"}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">키 없음</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {last4 ? (
                            p2 ? (
                              <a href={u2} download={name2} className={dlBtnEnabled} title="다운로드">다운로드</a>
                            ) : (
                              <button type="button" disabled className={dlBtnDisabled} title="파일이 없습니다">다운로드</button>
                            )
                          ) : (
                            <span className="text-gray-400 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && !err && visibleRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-12 text-center text-sm text-gray-400" colSpan={10}>
                        표시할 자산이 없습니다. 장비번호 끝 4자리 검색값을 확인해주세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 leading-relaxed">
                사진 파일은 <strong>{PHOTO_BASE}</strong> 아래에&nbsp;
                {normalizedDealName === "삼우2"
                  ? <><strong>자산번호끝4자리(1).webp/jpg/jpeg</strong>, <strong>자산번호끝4자리(2).webp/jpg/jpeg</strong></>
                  : <><strong>VIN끝4자리(1).webp/jpg/jpeg</strong>, <strong>VIN끝4자리(2).webp/jpg/jpeg</strong></>
                } 규칙으로 두면 자동 연결됩니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}