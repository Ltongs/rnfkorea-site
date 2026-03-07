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
    <section className={`space-y-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1 h-6 w-1.5 rounded bg-orange-500 shrink-0" />

        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-navy-900 tracking-tight">
            {title}
          </h1>

          {desc ? (
            <p className="mt-3 max-w-3xl text-gray-600 leading-relaxed">
              {desc}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default PageTitle;