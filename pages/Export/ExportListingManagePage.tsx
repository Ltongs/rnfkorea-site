// pages/Export/ExportListingManagePage.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ====================================================
// 타입
// ====================================================
type Status = "active" | "sold" | "draft";

type Listing = {
  id: string;
  category: string;
  brand: string;
  model: string | null;
  year: number | null;
  tonnage: number | null;
  condition_grade: string | null;
  price_usd: number | null;
  price_negotiable: boolean;
  stock_qty: number;
  status: Status;
  images: string[];
  created_at: string;
};

const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  sold: "Sold",
  draft: "Draft",
};

const STATUS_COLOR: Record<Status, string> = {
  active: "bg-emerald-100 text-emerald-700",
  sold: "bg-slate-100 text-slate-500",
  draft: "bg-amber-100 text-amber-700",
};

const CATEGORY_LABEL: Record<string, string> = {
  forklift: "Forklift",
  mini_excavator: "Mini Excavator",
  excavator: "Excavator",
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/export-listings`;

function imgUrl(path: string) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${STORAGE_BASE}/${path}`;
}

// ====================================================
// 메인 컴포넌트
// ====================================================
const ExportListingManagePage: React.FC = () => {
  const { user, isHyundaiCM, isAdmin, isSubAdmin } = useAuth();
  const navigate = useNavigate();
  const canAccess = isHyundaiCM || isAdmin || isSubAdmin;

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("export_listings")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setListings((data as Listing[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  // 권한 없음
  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-bold text-slate-800">Access Denied</p>
          <button onClick={() => navigate("/export-shop")} className="text-orange-500 text-sm underline">
            Go back to shop
          </button>
        </div>
      </div>
    );
  }

  async function handleStatusChange(id: string, status: Status) {
    setStatusUpdating(id);
    try {
      const { error } = await supabase
        .from("export_listings")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } catch (e: any) {
      alert(`Failed to update status: ${e?.message}`);
    } finally {
      setStatusUpdating(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      // Storage 파일 삭제
      const target = listings.find((l) => l.id === id);
      if (target && target.images.length > 0) {
        await supabase.storage
          .from("export-listings")
          .remove(target.images);
      }
      // DB 삭제
      const { error } = await supabase
        .from("export_listings")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (e: any) {
      alert(`Failed to delete: ${e?.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/export-shop")} className="text-slate-400 hover:text-slate-700 transition-colors text-sm">
              ← Shop
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <h1 className="text-2xl font-bold text-slate-900">Manage Listings</h1>
            <span className="text-sm text-slate-400">({listings.length})</span>
          </div>
          <button
            onClick={() => navigate("/export-shop/listing/new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all"
          >
            <Plus size={16} />
            Add New
          </button>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="animate-spin" size={20} />
            <span>Loading...</span>
          </div>
        )}

        {/* 에러 */}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <p className="text-lg font-semibold">No listings yet</p>
            <button
              onClick={() => navigate("/export-shop/listing/new")}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all"
            >
              <Plus size={16} />
              Add First Listing
            </button>
          </div>
        )}

        {/* 목록 */}
        {!loading && !error && listings.length > 0 && (
          <div className="space-y-3">
            {listings.map((item) => {
              const thumb = item.images[0] ? imgUrl(item.images[0]) : null;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4"
                >
                  {/* 썸네일 */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                        No img
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-orange-500 font-semibold">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </span>
                      {item.condition_grade && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          Grade {item.condition_grade}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-bold text-slate-900 truncate">
                      {item.brand} {item.model ?? ""}
                      {item.year ? ` (${item.year})` : ""}
                      {item.tonnage ? ` / ${item.tonnage}T` : ""}
                    </p>
                    <p className="text-sm text-slate-500">
                      {item.price_usd
                        ? `USD ${item.price_usd.toLocaleString()}${item.price_negotiable ? " (Neg.)" : ""}`
                        : "Price on Request"}
                      {" · "}Qty: {item.stock_qty}
                    </p>
                  </div>

                  {/* 상태 변경 */}
                  <div className="shrink-0">
                    <select
                      value={item.status}
                      disabled={statusUpdating === item.id}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as Status)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border-0 outline-none cursor-pointer ${STATUS_COLOR[item.status]}`}
                    >
                      <option value="active">Active</option>
                      <option value="sold">Sold</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/export-shop/listing/edit/${item.id}`)}
                      className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all"
                      title="Edit"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-2 rounded-xl border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === item.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportListingManagePage;