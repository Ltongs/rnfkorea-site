import React from "react";

type IconProps = { className?: string };

const base =
  "fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]";

export const IconConsult: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} aria-hidden="true">
    {/* chat bubble */}
    <path d="M7 17l-3 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9" />
    {/* dots */}
    <path d="M9 10h.01M12 10h.01M15 10h.01" />
  </svg>
);

export const IconReview: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} aria-hidden="true">
    {/* document */}
    <path d="M8 3h6l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v4h4" />
    {/* magnifier */}
    <path d="M11 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M14 14l2.2 2.2" />
  </svg>
);

export const IconProposal: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} aria-hidden="true">
    {/* stacked papers */}
    <path d="M8 7h10a2 2 0 0 1 2 2v10H10a2 2 0 0 1-2-2V7z" />
    <path d="M6 5h10a2 2 0 0 1 2 2" />
    <path d="M4 3h10a2 2 0 0 1 2 2" />
    {/* lines */}
    <path d="M11 11h7M11 14h7M11 17h5" />
  </svg>
);

export const IconContract: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={`${base} ${className ?? ""}`} aria-hidden="true">
    {/* single page */}
    <path d="M8 3h6l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v4h4" />
    {/* signature / check */}
    <path d="M8.5 16.5c2.2-2.2 3.5 2.2 6.2 0 1.2-1 2.2-.7 3.2.3" />
    <path d="M8.5 12h7" />
  </svg>
);