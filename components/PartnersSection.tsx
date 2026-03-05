import React from "react";
import { ExternalLink, MapPin, Phone } from "lucide-react";

type Partner = {
  name: string;
  tagline?: string;
  description?: string;
  bullets?: string[];
  website?: string;
  phone?: string;
  location?: string;
  highlights?: string[];
  accent?: "orange" | "blue" | "gray";
};

const accentClass = (accent: Partner["accent"]) => {
  switch (accent) {
    case "orange":
      return {
        badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
        border: "border-orange-200",
        titleDot: "bg-orange-500",
        link: "text-orange-700 hover:text-orange-800",
      };
    case "blue":
      return {
        badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
        border: "border-blue-200",
        titleDot: "bg-blue-500",
        link: "text-blue-700 hover:text-blue-800",
      };
    default:
      return {
        badge: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
        border: "border-slate-200",
        titleDot: "bg-slate-500",
        link: "text-slate-700 hover:text-slate-800",
      };
  }
};

export default function PartnersSection({
  title = "파트너사",
  subtitle = "RNF KOREA와 함께 배터리 솔루션을 제공합니다.",
  partners,
}: {
  title?: string;
  subtitle?: string;
  partners: Partner[];
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-orange-500" />
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h2>
        </div>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {partners.map((p) => {
          const a = accentClass(p.accent || "orange");
          return (
            <div
              key={p.name}
              className={`rounded-2xl border ${a.border} bg-white p-5 shadow-sm`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${a.titleDot}`} />
                    <h3 className="truncate text-lg font-bold text-slate-900">
                      {p.name}
                    </h3>
                    {p.tagline ? (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${a.badge}`}>
                        {p.tagline}
                      </span>
                    ) : null}
                  </div>

                  {p.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {p.description}
                    </p>
                  ) : null}
                </div>

                {p.website ? (
                  <a
                    href={p.website}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold ${a.link}`}
                    aria-label={`${p.name} 홈페이지 바로가기`}
                  >
                    <ExternalLink className="h-4 w-4" />
                    바로가기
                  </a>
                ) : null}
              </div>

              {(p.location || p.phone) && (
                <div className="mt-4 flex flex-col gap-2 text-sm text-slate-700">
                  {p.location ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span className="break-words">{p.location}</span>
                    </div>
                  ) : null}
                  {p.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-500" />
                      <span className="break-words">{p.phone}</span>
                    </div>
                  ) : null}
                </div>
              )}

              {p.highlights?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.highlights.map((h, idx) => (
                    <span
                      key={`${p.name}-h-${idx}`}
                      className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              ) : null}

              {p.bullets?.length ? (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {p.bullets.map((b, idx) => (
                    <li key={`${p.name}-b-${idx}`} className="leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}