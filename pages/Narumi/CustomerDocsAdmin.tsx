// 나르미 관리자 전용: 영수증 첨부 / 차량등록 비용 정산서 작성 / 고객 문자(MMS) 발송
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { supabase } from "../../lib/supabase";

export type SettlementItem = { label: string; amount: number; note: string };

export type Settlement = {
  issue_no: string;
  issue_date: string; // YYYY-MM-DD
  recipient: string;
  biz_no: string;
  address: string;
  items: SettlementItem[];
};

type Row = {
  id: string | number;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_phone_scrubbed_at?: string | null;
  vehicle_doc_path?: string | null;
  receipt_doc_path?: string | null;
  settlement?: Settlement | null;
  customer_docs_sent_at?: string | null;
};

const BANK_ACCOUNT = "신한은행 652-04-095597 이 동 수";

const DEFAULT_ITEMS: SettlementItem[] = [
  { label: "취득세", amount: 0, note: "" },
  { label: "등록세", amount: 0, note: "" },
  { label: "공채", amount: 0, note: "" },
  { label: "번호판", amount: 20500, note: "필름형" },
  { label: "인지대", amount: 3000, note: "" },
  { label: "등록수수료", amount: 2000, note: "" },
  { label: "등록대행비", amount: 50000, note: "" },
];

const btnBase = "inline-flex items-center justify-center px-3 py-1.5 rounded-xl border font-semibold text-xs hover:shadow-md transition-all disabled:opacity-50";
const inputCls = "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300";

function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function extFromName(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

// 한글 이름(2~4자)은 원본 정산서처럼 "장 정 헌"으로 띄워 쓴다.
function spacedName(name: string) {
  const n = name.trim();
  return /^[가-힣]{2,4}$/.test(n) ? n.split("").join(" ") : n;
}

function defaultSettlement(row: Row): Settlement {
  return {
    issue_no: "",
    issue_date: todayKST(),
    recipient: spacedName(row.customer_name ?? ""),
    biz_no: "",
    address: "",
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
  };
}

function settlementTotal(s: Settlement) {
  return s.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

function formatPhone(digits: string) {
  return digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}

// send-narumi-customer-docs 함수가 보내는 본문과 같은 문구 (미리보기용)
function mmsText(customerName: string, label: string) {
  return `[나르미 차량등록] ${customerName ? `${customerName} 고객님\n` : ""}${label}을(를) 보내드립니다.\n문의: 1551-1873`;
}

function won(n: number) {
  return n ? n.toLocaleString("ko-KR") : "-";
}

// ─── 이미지 변환: Solapi MMS 제한(JPEG, 200KB 이하)에 맞춘다 ───────────────
const MAX_W = 1500, MAX_H = 1440, MAX_BYTES = 200 * 1024;

function canvasToMmsJpeg(src: HTMLCanvasElement): string {
  let canvas = src;
  if (canvas.width > MAX_W || canvas.height > MAX_H) {
    const ratio = Math.min(MAX_W / canvas.width, MAX_H / canvas.height);
    const r = document.createElement("canvas");
    r.width = Math.floor(canvas.width * ratio);
    r.height = Math.floor(canvas.height * ratio);
    const ctx = r.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.drawImage(canvas, 0, 0, r.width, r.height);
    canvas = r;
  }
  const size = (d: string) => Math.ceil((d.length - d.indexOf(",") - 1) * 3 / 4);
  // 품질만으로 안 줄어들면 해상도를 낮춰가며 다시 시도한다.
  for (let scale = 1; scale >= 0.4; scale -= 0.15) {
    let c = canvas;
    if (scale < 1) {
      c = document.createElement("canvas");
      c.width = Math.floor(canvas.width * scale);
      c.height = Math.floor(canvas.height * scale);
      c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
    }
    for (let q = 0.9; q >= 0.3; q -= 0.1) {
      const img = c.toDataURL("image/jpeg", q);
      if (size(img) <= MAX_BYTES) return img;
    }
  }
  throw new Error("이미지를 200KB 이하로 줄이지 못했습니다.");
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  if (blob.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

async function storageFileToMmsJpeg(path: string) {
  const { data, error } = await supabase.storage.from("vehicle_docs").download(path);
  if (error) throw error;
  // 저장 시 contentType이 비어 있을 수 있어 확장자로 PDF 여부를 보정한다.
  const blob = extFromName(path) === "pdf" && data.type !== "application/pdf"
    ? new Blob([data], { type: "application/pdf" })
    : data;
  return canvasToMmsJpeg(await blobToCanvas(blob));
}

// ─── 정산서 양식 (첨부 PDF "차량등록 비용 영수증" 기준) ─────────────────────
export const SettlementSheet = React.forwardRef<HTMLDivElement, { s: Settlement }>(({ s }, ref) => {
  const total = settlementTotal(s);
  const date = s.issue_date ? s.issue_date.replace(/-/g, ".") : "";
  const cell = "border border-black px-2 h-[30px]";
  return (
    <div ref={ref} style={{ width: 595, background: "#fff", color: "#000", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif" }} className="px-[70px] pt-[60px] pb-[70px]">
      <h1 className="text-center text-[20px] font-bold mb-10">[차량등록 비용 영수증]</h1>

      <div className="text-[12px] space-y-1.5 mb-6 pl-[28px]">
        <div className="flex"><span className="w-[60px] text-right">발행번호 :</span><span className="ml-3">{s.issue_no}</span></div>
        <div className="flex"><span className="w-[60px] text-right">발행일자 :</span><span className="ml-3 font-bold">{date}</span></div>
      </div>

      <div className="text-[12px] mb-8">
        <p className="mb-1.5">[공급받는자]</p>
        <div className="space-y-1.5 pl-[18px]">
          <div className="flex"><span className="w-[70px] text-right">상호 :</span><span className="ml-2">{s.recipient}{s.recipient ? " 고객님" : ""}</span></div>
          <div className="flex"><span className="w-[70px] text-right">사업자번호 :</span><span className="ml-2">{s.biz_no}</span></div>
          <div className="flex"><span className="w-[70px] text-right">주소 :</span><span className="ml-2">{s.address}</span></div>
        </div>
      </div>

      <table className="w-full border-collapse text-[12px] mb-7">
        <thead>
          <tr style={{ background: "#d9e1f2" }}>
            <th className={`${cell} w-[80px] font-bold`}>구분</th>
            <th className={`${cell} w-[122px] font-bold`}>금액</th>
            <th className={`${cell} font-bold`}>비고</th>
          </tr>
        </thead>
        <tbody>
          {s.items.map((i, idx) => (
            <tr key={idx}>
              <td className={`${cell} text-center`}>{i.label}</td>
              <td className={`${cell} text-right`}>{won(Number(i.amount) || 0)}</td>
              <td className={`${cell} text-center`}>{i.note}</td>
            </tr>
          ))}
          <tr>
            <td className={`${cell} text-center`}>합계</td>
            <td className={`${cell} text-right`}>{won(total)}</td>
            <td className={cell}></td>
          </tr>
        </tbody>
      </table>

      <div className="text-[12px] flex pl-[10px] mb-[70px]">
        <span>송금계좌 :</span><span className="ml-8">{BANK_ACCOUNT}</span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div style={{ color: "#e8562a", fontSize: 30, fontWeight: 900, letterSpacing: 1, lineHeight: 1 }}>NARMi</div>
          <div style={{ borderTop: "1px solid #e8562a", width: 120, marginTop: 6 }} />
        </div>
        <div className="text-left pr-[10px]">
          <p className="text-[11px]">[차량등록업무대행사]</p>
          <p className="text-[16px]">(주)알앤에프코리아</p>
        </div>
      </div>
    </div>
  );
});
SettlementSheet.displayName = "SettlementSheet";

// ─── 카드 버튼 + 모달 ──────────────────────────────────────────────────
export default function CustomerDocsAdmin({
  row,
  onChanged,
  openStorageFile,
}: {
  row: Row;
  onChanged: () => Promise<void> | void;
  openStorageFile: (path: string) => Promise<void>;
}) {
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settlement>(() => row.settlement ?? defaultSettlement(row));
  const [phone, setPhone] = useState("");
  const [pick, setPick] = useState({ vehicle: true, receipt: true, settlement: true });
  const [busy, setBusy] = useState<"" | "save" | "send" | "preview">("");
  const [preview, setPreview] = useState<{ digits: string; docs: { label: string; imageBase64: string }[] } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setS(row.settlement ?? defaultSettlement(row));
    // 마스킹(파기)된 번호는 쓸 수 없으므로 비워두고 직접 입력받는다.
    setPhone(row.customer_phone_scrubbed_at ? "" : (row.customer_phone ?? "").replace(/[^0-9]/g, ""));
    setPick({ vehicle: !!row.vehicle_doc_path, receipt: !!row.receipt_doc_path, settlement: true });
    setMsg("");
    setPreview(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(() => settlementTotal(s), [s]);

  useEffect(() => { setPreview(null); }, [s, phone, pick]);

  const onReceiptPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      alert("이미지 또는 PDF 파일만 첨부할 수 있습니다.");
      return;
    }
    if (!confirm(`이 파일을 영수증으로 첨부할까요?\n${file.name}`)) return;

    setReceiptUploading(true);
    try {
      const path = `${String(row.id)}/receipt.${extFromName(file.name) || "jpg"}`;
      const { error: upErr } = await supabase.storage
        .from("vehicle_docs")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      // 확장자가 바뀌면 이전 파일 경로가 달라지므로 정리한다.
      if (row.receipt_doc_path && row.receipt_doc_path !== path) {
        await supabase.storage.from("vehicle_docs").remove([row.receipt_doc_path]).catch(() => {});
      }
      const { error: dbErr } = await supabase
        .from("narumi_tasks")
        .update({ receipt_doc_path: path, receipt_doc_uploaded_at: new Date().toISOString() })
        .eq("id", row.id as any);
      if (dbErr) throw dbErr;
      await onChanged();
    } catch (err: any) {
      alert(err?.message || "영수증 첨부 실패");
    } finally {
      setReceiptUploading(false);
    }
  };

  const saveSettlement = async () => {
    const { error } = await supabase.from("narumi_tasks").update({ settlement: s }).eq("id", row.id as any);
    if (error) throw error;
  };

  const onSave = async () => {
    setBusy("save");
    setMsg("");
    try {
      await saveSettlement();
      await onChanged();
      setMsg("✅ 정산서를 저장했습니다.");
    } catch (e: any) {
      setMsg(e?.message || "저장 실패");
    } finally {
      setBusy("");
    }
  };

  // 입력 검증 후 실제로 보낼 MMS 이미지들을 만든다 (미리보기와 발송이 같은 결과를 쓴다).
  const buildDocs = async () => {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 10) throw new Error("받는 번호를 확인해주세요.");
    if (!(pick.vehicle && row.vehicle_doc_path) && !(pick.receipt && row.receipt_doc_path) && !pick.settlement) {
      throw new Error("보낼 서류를 선택해주세요.");
    }
    const docs: { label: string; imageBase64: string }[] = [];
    if (pick.vehicle && row.vehicle_doc_path) docs.push({ label: "차량등록증", imageBase64: await storageFileToMmsJpeg(row.vehicle_doc_path) });
    if (pick.receipt && row.receipt_doc_path) docs.push({ label: "영수증", imageBase64: await storageFileToMmsJpeg(row.receipt_doc_path) });
    if (pick.settlement) {
      const canvas = await html2canvas(sheetRef.current!, { scale: 2, backgroundColor: "#ffffff", logging: false });
      docs.push({ label: "정산서", imageBase64: canvasToMmsJpeg(canvas) });
    }
    return { digits, docs };
  };

  const onPreview = async () => {
    setBusy("preview");
    setMsg("");
    try {
      setPreview(await buildDocs());
    } catch (e: any) {
      setMsg(e?.message || "미리보기 실패");
    } finally {
      setBusy("");
    }
  };

  const onSend = async () => {
    setBusy("send");
    setMsg("");
    try {
      const { digits, docs } = preview ?? await buildDocs();
      if (!confirm(`${formatPhone(digits)}로 ${docs.map(d => d.label).join("·")}을(를) 문자(MMS ${docs.length}건)로 보낼까요?`)) return;
      if (pick.settlement) await saveSettlement();

      const { data, error } = await supabase.functions.invoke("send-narumi-customer-docs", {
        body: { taskId: row.id, recipientPhone: digits, customerName: row.customer_name ?? "", docs },
      });
      if (error) {
        let detail = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            if (body?.error) detail = body.error;
          }
        } catch { /* 본문 파싱 실패 시 기본 메시지 사용 */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      const results: { label: string; ok: boolean; error?: string }[] = data?.results ?? [];
      const failed = results.filter(r => !r.ok);
      await onChanged();
      setPreview(null);
      setMsg(failed.length === 0
        ? `✅ ${results.map(r => r.label).join("·")} 발송 완료`
        : `일부 실패: ${failed.map(r => `${r.label}(${r.error})`).join(", ")}`);
    } catch (e: any) {
      setMsg(e?.message || "발송 실패");
    } finally {
      setBusy("");
    }
  };

  const setItem = (idx: number, patch: Partial<SettlementItem>) =>
    setS(prev => ({ ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  return (
    <>
      <input ref={receiptInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onReceiptPicked} />

      {row.receipt_doc_path && (
        <button
          type="button"
          onClick={() => openStorageFile(row.receipt_doc_path!).catch((e: any) => alert(e?.message || "보기 실패"))}
          className={`${btnBase} border-gray-300 bg-white text-navy-900`}
        >
          영수증 보기
        </button>
      )}
      <button
        type="button"
        onClick={() => receiptInputRef.current?.click()}
        disabled={receiptUploading}
        className={`${btnBase} border-orange-200 bg-orange-50 text-orange-600`}
      >
        {receiptUploading ? "첨부중..." : row.receipt_doc_path ? "영수증 교체" : "영수증 첨부"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnBase} border-blue-200 bg-blue-50 text-blue-700`}
        title={row.customer_docs_sent_at ? `최근 발송: ${new Date(row.customer_docs_sent_at).toLocaleString("ko-KR")}` : undefined}
      >
        정산서·문자발송{row.customer_docs_sent_at ? " ✓" : ""}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6">
          <div className="w-full max-w-5xl rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500">관리자 전용</p>
                <h2 className="text-sm font-semibold text-navy-900">정산서 작성 · 고객 서류 문자 발송</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              {/* 입력 */}
              <div className="space-y-3 min-w-0">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">발행번호<input className={inputCls} value={s.issue_no} onChange={e => setS({ ...s, issue_no: e.target.value })} /></label>
                  <label className="text-xs text-gray-500">발행일자<input type="date" className={inputCls} value={s.issue_date} onChange={e => setS({ ...s, issue_date: e.target.value })} /></label>
                  <label className="text-xs text-gray-500">상호(고객님 앞)<input className={inputCls} value={s.recipient} onChange={e => setS({ ...s, recipient: e.target.value })} /></label>
                  <label className="text-xs text-gray-500">사업자번호<input className={inputCls} value={s.biz_no} onChange={e => setS({ ...s, biz_no: e.target.value })} /></label>
                  <label className="col-span-2 text-xs text-gray-500">주소<input className={inputCls} value={s.address} onChange={e => setS({ ...s, address: e.target.value })} /></label>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="text-left font-medium pb-1 w-[90px]">구분</th>
                      <th className="text-left font-medium pb-1">금액</th>
                      <th className="text-left font-medium pb-1">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="pr-2 py-0.5 text-gray-700">{it.label}</td>
                        <td className="pr-2 py-0.5">
                          <input
                            inputMode="numeric"
                            className={`${inputCls} text-right`}
                            value={it.amount ? it.amount.toLocaleString("ko-KR") : ""}
                            placeholder="0"
                            onChange={e => setItem(idx, { amount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                          />
                        </td>
                        <td className="py-0.5"><input className={inputCls} value={it.note} onChange={e => setItem(idx, { note: e.target.value })} /></td>
                      </tr>
                    ))}
                    <tr>
                      <td className="pr-2 pt-1.5 font-semibold">합계</td>
                      <td className="pr-2 pt-1.5 text-right font-semibold">{total.toLocaleString("ko-KR")}원</td>
                      <td />
                    </tr>
                  </tbody>
                </table>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <label className="block text-xs text-gray-500">
                    받는 번호 (고객번호 또는 별도 지정번호)
                    <input
                      inputMode="tel"
                      className={inputCls}
                      value={phone}
                      placeholder={row.customer_phone_scrubbed_at ? "고객번호가 파기되어 직접 입력해주세요" : "01012345678"}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <label className={`inline-flex items-center gap-1.5 ${row.vehicle_doc_path ? "" : "text-gray-400"}`}>
                      <input type="checkbox" disabled={!row.vehicle_doc_path} checked={pick.vehicle && !!row.vehicle_doc_path} onChange={e => setPick({ ...pick, vehicle: e.target.checked })} />
                      차량등록증{row.vehicle_doc_path ? "" : " (미첨부)"}
                    </label>
                    <label className={`inline-flex items-center gap-1.5 ${row.receipt_doc_path ? "" : "text-gray-400"}`}>
                      <input type="checkbox" disabled={!row.receipt_doc_path} checked={pick.receipt && !!row.receipt_doc_path} onChange={e => setPick({ ...pick, receipt: e.target.checked })} />
                      영수증{row.receipt_doc_path ? "" : " (미첨부)"}
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={pick.settlement} onChange={e => setPick({ ...pick, settlement: e.target.checked })} />
                      정산서
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500">서류마다 MMS 1건씩 발송됩니다. PDF는 첫 페이지를 이미지로 바꿔 보냅니다.</p>
                </div>

                {msg && (
                  <div className={`text-sm px-3 py-2 rounded border ${msg.startsWith("✅") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>{msg}</div>
                )}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={onSave} disabled={!!busy} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:shadow-md transition-all disabled:opacity-50">
                    {busy === "save" ? "저장중..." : "정산서 저장"}
                  </button>
                  <button type="button" onClick={onPreview} disabled={!!busy} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 hover:shadow-md transition-all disabled:opacity-50">
                    {busy === "preview" ? "준비중..." : "발송 미리보기"}
                  </button>
                  <button type="button" onClick={onSend} disabled={!!busy} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50">
                    {busy === "send" ? "발송중..." : "문자 발송"}
                  </button>
                </div>
              </div>

              {/* 미리보기 (이 영역이 그대로 이미지로 캡처된다) */}
              <div className="overflow-x-auto">
                <div className="border border-gray-200 shadow-sm w-fit">
                  <SettlementSheet ref={sheetRef} s={s} />
                </div>
              </div>
            </div>

            {/* 발송 미리보기: 고객이 받게 될 MMS를 건별로 그대로 보여준다 */}
            {preview && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-navy-900">
                    발송 미리보기 · 받는 번호 {formatPhone(preview.digits)} · MMS {preview.docs.length}건
                  </p>
                  <button type="button" onClick={() => setPreview(null)} className="text-xs text-gray-500 hover:text-gray-800">닫기</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {preview.docs.map(d => (
                    <div key={d.label} className="rounded-xl border border-gray-200 bg-white p-2.5">
                      <p className="text-xs font-semibold text-gray-800 mb-1">[나르미] {d.label}</p>
                      <img src={d.imageBase64} alt={d.label} className="w-full max-h-[420px] object-contain border border-gray-100 bg-gray-50 mb-2" />
                      <p className="text-xs text-gray-600 whitespace-pre-line">{mmsText(row.customer_name ?? "", d.label)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
