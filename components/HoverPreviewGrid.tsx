import React from "react";

type HoverPreviewGridProps = {
  images: string[];
  alt?: string;
  thumbClassName?: string;
  centerRatio?: number;
  openDelayMs?: number;
  closeDelayMs?: number;
};

const HoverPreviewGrid: React.FC<HoverPreviewGridProps> = ({
  images,
  alt = "",
  thumbClassName = "h-28 md:h-36",
}) => {
  if (!images?.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {images.map((src, idx) => (
        <div
          key={`${src}-${idx}`}
          className="border border-gray-200 rounded-xl bg-white overflow-hidden"
        >
          <img
            src={src}
            alt={alt}
            className={`w-full object-cover ${thumbClassName}`}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default HoverPreviewGrid;