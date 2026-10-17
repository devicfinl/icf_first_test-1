import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import StatusBadge from "./StatusBadge";
import TablePager from "./TablePager";
import { formatAmount, formatDate, modeLabel, titleCase } from "../../lib/pv";
import type { RegistrationListItem, RegistrationPage } from "../../types/pv";
import Loader from "../loading-ui/Loader";
import { clickableRowClass, onRowClick, subscriberPath } from "../../lib/rowLink";

const COLUMNS = ["No.", "Name", "Mobile", "Unit", "Mode", "Amount", "Cash", "Status", "Subscribed on"];

const STATUS_TONE = { APPROVED: "green", PENDING: "amber", REJECTED: "red" } as const satisfies Record<
  RegistrationListItem["approval_status"],
  string
>;

type Props = {
  data: RegistrationPage | null;
  loading: boolean;
  onPageChange: (page: number) => void;
  /** The page's title row (title, year, Add New), shown inside the same card as the table. */
  header: ReactNode;
};

/** New Pravasi Vayana subscribers in the leader's branch, one page at a time, under the page header. */
function NewRegistrationsTable({ data, loading, onPageChange, header }: Props) {
  const navigate = useNavigate();
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const pageSize = data?.page_size ?? 10;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;

  return (
    <section className="rounded-2xl bg-white px-4 pt-6 pb-8 sm:px-6">
      {header}

      <div className={`mt-5 overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="bg-[#f3ebe2] text-[12px] font-medium text-[#555]">
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-2.5 py-3.5 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#333]">
            {items.map((row, index) => (
              <tr
                key={row.subscriber_id}
                className={clickableRowClass}
                onClick={onRowClick(() => navigate(subscriberPath(row.subscriber_id, data?.year)))}
              >
                <td className="px-2.5 py-3">{from + index}</td>
                <td className="px-2.5 py-3 font-medium text-navy">
                  <Link to={subscriberPath(row.subscriber_id, data?.year)} className="hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td className="px-2.5 py-3 whitespace-nowrap">
                  {row.mobile ? `${row.mobile_country ? `+${row.mobile_country} ` : ""}${row.mobile}` : "—"}
                </td>
                <td className="px-2.5 py-3">{row.unit.name ?? "—"}</td>
                <td className="px-2.5 py-3 whitespace-nowrap">{modeLabel(row.subscription_mode)}</td>
                <td className="px-2.5 py-3 whitespace-nowrap">
                  {row.amount !== null && row.currency ? formatAmount(row.amount, row.currency) : "—"}
                </td>
                <td className="px-2.5 py-3">{row.cash_received === "Y" ? "Yes" : "No"}</td>
                <td className="px-2.5 py-3">
                  <StatusBadge tone={STATUS_TONE[row.approval_status]}>{titleCase(row.approval_status)}</StatusBadge>
                </td>
                <td className="px-2.5 py-3 whitespace-nowrap">{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Outside the scrolling table, so it stays centred on narrow screens. */}
      {items.length === 0 && (
        <p className="border-b border-[#e7e1da] px-2.5 py-10 text-center text-[14px] text-[#6b6b6b]">
          {loading ? <Loader variant="inline" /> : "No new subscribers yet."}
        </p>
      )}

      <TablePager page={page} pageSize={pageSize} total={total} loading={loading} onPageChange={onPageChange} />
    </section>
  );
}

export default NewRegistrationsTable;
