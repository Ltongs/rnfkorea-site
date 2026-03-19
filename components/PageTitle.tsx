import React from "react";

type Props = {
  title: string;
  desc?: string;
};

const PageTitle: React.FC<Props> = ({ title, desc }) => {
  return (
    <div className="border-b border-gray-200 pb-6">
      <div className="flex items-start gap-3">
        {/* 오렌지 바 */}
        <div className="w-1.5 rounded bg-orange-500 self-stretch" />

        {/* 텍스트 영역 */}
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-navy-900 leading-tight">
            {title}
          </h1>

          {desc && (
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              {desc}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageTitle;