import React from "react";

type PageTitleProps = {
  title: string;
  desc?: string;
  className?: string;
};

const PageTitle: React.FC<PageTitleProps> = ({
  title,
  desc,
  className = "",
}) => {
  return (
    <section className={`pt-2 md:pt-4 space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1 h-5 md:h-6 w-1.5 rounded bg-orange-500 shrink-0" />

        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-3xl lg:text-4xl font-extrabold text-navy-900 tracking-tight leading-[1.18] break-keep">
            {title}
          </h1>

          {desc ? (
            <p className="mt-2 max-w-3xl text-sm sm:text-base text-gray-600 leading-relaxed break-keep">
              {desc}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default PageTitle;