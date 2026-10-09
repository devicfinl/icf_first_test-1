import type { ReactNode } from "react";

type Props = { title: string; subtitle?: string; children?: ReactNode };

/** The white title card at the top of each Pravasi Vayana page; actions sit on the right. */
function PvPageHeader({ title, subtitle, children }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold text-navy">{title}</h1>
        {subtitle && <p className="text-[13px] text-[#6b6b6b]">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

export default PvPageHeader;
