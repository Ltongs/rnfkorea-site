// pages/FaxCampaign/index.tsx
// 골프장 팩스 자동발송 관리: 골프장 리스트/필터, 브로셔 업로드 + 캠페인 생성, 발송 실행, 발송이력 조회
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Send, Upload, FileText, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import AppTabBar from "../../components/AppTabBar";

type GolfCourseContact = {
  id: string;
  region: string;
  name: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  holes_type: string | null;
  homepage: string | null;
  note: string | null;
  is_active: boolean;
};

type FaxCampaign = {
  id: string;
  campaign_name: string;
  file_id: string | null;
  target_region: string | null;
  scheduled_at: string | null;
  status: string;
  created_at: string;
};

type FaxSendLog = {
  id: string;
  campaign_id: string;
  contact_id: string;
  fax_number: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
};

const cardClass =
  "border border-gray-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all";
const sectionTitleClass =
  "text-xs font-medium tracking-[0.12em] uppercase text-orange-500";
const inputClass =
  "h-[44px] w-full px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-navy-900 " +
  "placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all";

const STATUS_LABEL: Record<string, string> = {
  draft: "임시저장",
  scheduled: "예약됨",
  sending: "발송중",
  done: "완료",
};

function formatDateTime(v: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function formatDateTimeShort(v: string | null) {
  if (!v) return "";
  return new Date(v).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function formatFaxNumberPretty(digits: string) {
  const d = digits.slice(0, 11);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return digits;
}

// send-fax-campaign Edge Function과 동일한 패턴 — 팩스 필드 하나에 번호가 여러 개
// 있으면(예: "031-672-6011, 033-573-0876") 전부 별도 발송 대상으로 파싱한다.
const FAX_NUMBER_PATTERN = /(?:0\d{1,2}|1\d{3})[-.\s)]?\d{3,4}[-.\s]?\d{4}/g;
function parseFaxNumbers(raw: string): string[] {
  const matches = raw.match(FAX_NUMBER_PATTERN) ?? [];
  return matches.map((m) => m.replace(/[^0-9]/g, ""));
}

export default function FaxCampaignPage() {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<GolfCourseContact[]>([]);
  const [campaigns, setCampaigns] = useState<FaxCampaign[]>([]);
  const [logs, setLogs] = useState<FaxSendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [regionFilter, setRegionFilter] = useState("all");
  const [unsentOnly, setUnsentOnly] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [targetRegion, setTargetRegion] = useState("all");
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [sendResultMsg, setSendResultMsg] = useState("");

  const [historyFilter, setHistoryFilter] = useState<string>("all");

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [contactsRes, campaignsRes, logsRes] = await Promise.all([
        supabase.from("golf_course_contacts").select("*").order("region").order("name"),
        supabase.from("fax_campaigns").select("*").order("created_at", { ascending: false }),
        supabase
          .from("fax_send_log")
          .select("id, campaign_id, contact_id, fax_number, status, error_message, sent_at"),
      ]);
      if (contactsRes.error) throw contactsRes.error;
      if (campaignsRes.error) throw campaignsRes.error;
      if (logsRes.error) throw logsRes.error;
      setContacts((contactsRes.data ?? []) as GolfCourseContact[]);
      setCampaigns((campaignsRes.data ?? []) as FaxCampaign[]);
      setLogs((logsRes.data ?? []) as FaxSendLog[]);
    } catch (e: any) {
      setError(e?.message || "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const regions = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.region))).sort(),
    [contacts],
  );

  // 골프장+팩스번호 조합별 "가장 최근" 발송 로그 — 번호별 상세 발송상태 표시에 사용
  const latestLogByContactFax = useMemo(() => {
    const m = new Map<string, FaxSendLog>();
    for (const l of logs) {
      const key = `${l.contact_id}|${l.fax_number}`;
      const prev = m.get(key);
      if (!prev || (l.sent_at ?? "") > (prev.sent_at ?? "")) m.set(key, l);
    }
    return m;
  }, [logs]);

  // 골프장 1곳의 팩스번호별 발송상태 상세 — 번호가 여러 개면 각각 별도로 판정한다.
  const getContactSendDetail = (c: GolfCourseContact) => {
    if (!c.is_active || !c.fax) return { numbers: [] as { num: string; log?: FaxSendLog }[], allSuccess: false, anySuccess: false };
    const parsed = parseFaxNumbers(c.fax);
    const numbers = parsed.length > 0 ? parsed : [c.fax.replace(/[^0-9]/g, "") || c.fax];
    const details = numbers.map((num) => ({ num, log: latestLogByContactFax.get(`${c.id}|${num}`) }));
    return {
      numbers: details,
      allSuccess: details.every((d) => d.log?.status === "success"),
      anySuccess: details.some((d) => d.log?.status === "success"),
    };
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (regionFilter !== "all" && c.region !== regionFilter) return false;
      // 번호가 여러 개인 골프장은 "모든 번호가 발송완료"일 때만 발송완료로 취급한다.
      if (unsentOnly && c.is_active && c.fax && getContactSendDetail(c).allSuccess) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, regionFilter, unsentOnly, latestLogByContactFax]);

  const campaignById = useMemo(() => {
    const m = new Map<string, FaxCampaign>();
    campaigns.forEach((c) => m.set(c.id, c));
    return m;
  }, [campaigns]);

  const contactById = useMemo(() => {
    const m = new Map<string, GolfCourseContact>();
    contacts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contacts]);

  const filteredLogs = useMemo(() => {
    const rows = historyFilter === "all" ? logs : logs.filter((l) => l.campaign_id === historyFilter);
    return [...rows].sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));
  }, [logs, historyFilter]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormMsg("");
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error: fnErr } = await supabase.functions.invoke("upload-fax-brochure", {
        body: { fileBase64: base64, fileName: file.name },
      });
      if (fnErr) throw fnErr;
      if (!data?.fileId) throw new Error(data?.error || "업로드에 실패했습니다.");
      setUploadedFileId(data.fileId);
      setUploadedFileName(file.name);
    } catch (e: any) {
      setFormMsg(e?.message || "브로셔 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const createCampaign = async () => {
    if (!campaignName.trim()) { setFormMsg("캠페인명을 입력해주세요."); return; }
    if (!uploadedFileId) { setFormMsg("브로셔 PDF를 먼저 업로드해주세요."); return; }
    setCreatingCampaign(true);
    setFormMsg("");
    try {
      const { error: insertErr } = await supabase.from("fax_campaigns").insert({
        campaign_name: campaignName.trim(),
        file_id: uploadedFileId,
        target_region: targetRegion === "all" ? null : targetRegion,
        status: "draft",
      });
      if (insertErr) throw insertErr;
      setCampaignName("");
      setTargetRegion("all");
      setUploadedFileId(null);
      setUploadedFileName(null);
      setFormMsg("캠페인이 생성되었습니다.");
      await loadAll();
    } catch (e: any) {
      setFormMsg(e?.message || "캠페인 생성에 실패했습니다.");
    } finally {
      setCreatingCampaign(false);
    }
  };

  const sendCampaignNow = async (campaign: FaxCampaign) => {
    // 이 캠페인에서 이미 성공적으로 발송된 (골프장, 팩스번호) 조합 — 재발송 시 스킵 대상
    const sentPairsForCampaign = new Set(
      logs
        .filter((l) => l.campaign_id === campaign.id && l.status === "success")
        .map((l) => `${l.contact_id}|${l.fax_number}`),
    );

    let targetCourseCount = 0;
    let targetFaxCount = 0;
    for (const c of contacts) {
      if (!c.is_active || !c.fax) continue;
      if (campaign.target_region && c.region !== campaign.target_region) continue;
      const parsed = parseFaxNumbers(c.fax);
      const numbers = parsed.length > 0 ? parsed : [c.fax.replace(/[^0-9]/g, "") || c.fax];
      const pending = numbers.filter((n) => !sentPairsForCampaign.has(`${c.id}|${n}`));
      if (pending.length > 0) targetCourseCount += 1;
      targetFaxCount += pending.length;
    }

    const confirmed = window.confirm(
      `"${campaign.campaign_name}" 캠페인을 지금 발송합니다.\n` +
      `대상: ${campaign.target_region ?? "전체 지역"} (미발송 ${targetCourseCount}곳 / 총 ${targetFaxCount}건 발송 — 번호가 2개 이상인 골프장은 모든 번호로 발송됩니다)\n` +
      `실제 골프장 팩스로 발송되며 되돌릴 수 없습니다. 계속할까요?`,
    );
    if (!confirmed) return;

    setSendingCampaignId(campaign.id);
    setSendResultMsg("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("send-fax-campaign", {
        body: { campaignId: campaign.id },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSendResultMsg(
        `"${campaign.campaign_name}" 발송 완료 — 성공 ${data.success}건 / 실패 ${data.failed}건 / 스킵(이미발송) ${data.skipped}건`,
      );
      await loadAll();
    } catch (e: any) {
      setSendResultMsg(e?.message || "발송 중 오류가 발생했습니다.");
    } finally {
      setSendingCampaignId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 + 탭 헤더 ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate("/work/secretary")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all"
            >
              ← AI비서
            </button>
            <span className="text-sm font-semibold text-[#0f172a]">📠 팩스발송</span>
            <span className="text-xs text-gray-400">
              총 {contacts.length}곳 · 팩스보유 {contacts.filter((c) => c.is_active).length}곳
            </span>
          </div>
        </div>
        <div className="px-4 pb-2.5">
          <AppTabBar activeTab="faxcampaign" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white flex items-center justify-center gap-3 py-16 text-gray-400 shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="text-sm font-medium">데이터를 불러오는 중입니다.</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-6 py-4 text-sm font-semibold">
            {error}
          </div>
        ) : (
          <>
            {/* ── 캠페인 생성 ── */}
            <section className={`${cardClass} p-6 space-y-4`}>
              <div>
                <p className={sectionTitleClass}>Campaign</p>
                <h2 className="mt-1 text-lg font-semibold text-navy-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  캠페인 생성
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">캠페인명</label>
                  <input
                    className={inputClass}
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="예: 2026년 8월 골프카트 배터리 브로셔"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">대상 지역</label>
                  <select className={inputClass} value={targetRegion} onChange={(e) => setTargetRegion(e.target.value)}>
                    <option value="all">전체 지역</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">브로셔 PDF</label>
                  <label className="flex items-center justify-center gap-2 h-[44px] rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-orange-400 hover:text-orange-500 cursor-pointer transition-all">
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> 업로드 중...
                      </>
                    ) : uploadedFileId ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" /> {uploadedFileName}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> PDF 선택
                      </>
                    )}
                    <input type="file" accept="application/pdf" className="hidden" onChange={onFileChange} disabled={uploading} />
                  </label>
                </div>
              </div>
              {!!formMsg && (
                <div className="text-sm font-medium text-orange-600">{formMsg}</div>
              )}
              <button
                onClick={createCampaign}
                disabled={creatingCampaign}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50"
              >
                {creatingCampaign ? "생성 중..." : "캠페인 생성"}
              </button>
            </section>

            {/* ── 캠페인 목록 ── */}
            <section className={`${cardClass} p-6 space-y-4`}>
              <p className={sectionTitleClass}>Campaigns</p>
              <h2 className="text-lg font-semibold text-navy-900">캠페인 목록</h2>
              {!!sendResultMsg && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-navy-900">
                  {sendResultMsg}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-400 uppercase border-b border-gray-200">
                      <th className="py-2 pr-4">캠페인명</th>
                      <th className="py-2 pr-4">대상지역</th>
                      <th className="py-2 pr-4">상태</th>
                      <th className="py-2 pr-4">생성일</th>
                      <th className="py-2 pr-4">발송</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-gray-400">생성된 캠페인이 없습니다.</td></tr>
                    )}
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-gray-100">
                        <td className="py-2.5 pr-4 font-medium text-navy-900">{c.campaign_name}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{c.target_region ?? "전체"}</td>
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            {STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500">{formatDateTime(c.created_at)}</td>
                        <td className="py-2.5 pr-4">
                          <button
                            onClick={() => sendCampaignNow(c)}
                            disabled={!c.file_id || sendingCampaignId === c.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-semibold hover:bg-navy-800 transition-all disabled:opacity-40"
                          >
                            {sendingCampaignId === c.id ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 발송 중...</>
                            ) : (
                              <><Send className="w-3.5 h-3.5" /> 지금 발송</>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 골프장 리스트 ── */}
            <section className={`${cardClass} p-6 space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={sectionTitleClass}>Contacts</p>
                  <h2 className="text-lg font-semibold text-navy-900">골프장 리스트</h2>
                </div>
                <div className="flex items-center gap-3">
                  <select className={inputClass} value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                    <option value="all">전체 지역</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-600 whitespace-nowrap">
                    <input type="checkbox" checked={unsentOnly} onChange={(e) => setUnsentOnly(e.target.checked)} />
                    미발송만 보기
                  </label>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-xs font-medium text-gray-400 uppercase border-b border-gray-200">
                      <th className="py-2 pr-4">지역</th>
                      <th className="py-2 pr-4">골프장명</th>
                      <th className="py-2 pr-4">발송상태 (번호별)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((c) => {
                      const detail = getContactSendDetail(c);
                      return (
                        <tr key={c.id} className="border-b border-gray-100">
                          <td className="py-2 pr-4 text-gray-600 whitespace-nowrap align-top">{c.region}</td>
                          <td className="py-2 pr-4 font-medium text-navy-900 whitespace-nowrap align-top">{c.name}</td>
                          <td className="py-2 pr-4">
                            {!c.is_active ? (
                              <span className="text-xs font-medium text-gray-400">팩스없음</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {detail.numbers.map(({ num, log }) => (
                                  <div key={num} className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="text-xs text-gray-500 font-mono">{formatFaxNumberPretty(num)}</span>
                                    {log?.status === "success" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> 성공
                                        {log.sent_at && <span className="text-gray-400 font-normal">· {formatDateTimeShort(log.sent_at)}</span>}
                                      </span>
                                    ) : log?.status === "failed" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500" title={log.error_message ?? ""}>
                                        <XCircle className="w-3.5 h-3.5" /> 실패
                                        {log.sent_at && <span className="text-gray-400 font-normal">· {formatDateTimeShort(log.sent_at)}</span>}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-500">
                                        <XCircle className="w-3.5 h-3.5" /> 미발송
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 발송이력 ── */}
            <section className={`${cardClass} p-6 space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={sectionTitleClass}>History</p>
                  <h2 className="text-lg font-semibold text-navy-900">발송이력</h2>
                </div>
                <select className={inputClass} value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                  <option value="all">전체 캠페인</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.campaign_name}</option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-xs font-medium text-gray-400 uppercase border-b border-gray-200">
                      <th className="py-2 pr-4">캠페인</th>
                      <th className="py-2 pr-4">골프장</th>
                      <th className="py-2 pr-4">팩스번호</th>
                      <th className="py-2 pr-4">상태</th>
                      <th className="py-2 pr-4">발송시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-gray-400">발송 이력이 없습니다.</td></tr>
                    )}
                    {filteredLogs.map((l) => (
                      <tr key={l.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{campaignById.get(l.campaign_id)?.campaign_name ?? "-"}</td>
                        <td className="py-2 pr-4 font-medium text-navy-900 whitespace-nowrap">{contactById.get(l.contact_id)?.name ?? "-"}</td>
                        <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{l.fax_number}</td>
                        <td className="py-2 pr-4">
                          {l.status === "success" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 성공
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500" title={l.error_message ?? ""}>
                              <XCircle className="w-3.5 h-3.5" /> 실패
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{formatDateTime(l.sent_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
