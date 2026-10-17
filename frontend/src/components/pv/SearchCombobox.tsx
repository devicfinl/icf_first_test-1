import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { apiErrorMessage } from "../../api/axios";

export type SearchResult<T> = { items: T[]; more?: boolean };

type Props<T> = {
  id: string;
  /** The text in the box; the parent keeps it. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** Whether this text (with the scope) can be searched yet. */
  canSearch: (q: string) => boolean;
  search: (q: string) => Promise<SearchResult<T>>;
  /** Anything else the search depends on (e.g. the chosen place): a change searches again. */
  scope?: string;
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** An item shown but not choosable, e.g. already registered this year. */
  disabled?: (item: T) => boolean;
  onPick: (item: T) => void;
  /** Enter with nothing highlighted, e.g. a full number typed. */
  onEnter?: (q: string) => void;
  /** Shown when nothing matches, e.g. a button to add a new one. */
  empty: (q: string) => ReactNode;
  /** While the chosen item's details load. */
  busy?: boolean;
  invalid?: boolean;
};

/**
 * A search box with a dropdown of matches: typing searches (after a short pause), the arrow keys
 * move through the list, Enter chooses and Escape closes it.
 */
function SearchCombobox<T>({
  id,
  value,
  onValueChange,
  placeholder,
  canSearch,
  search,
  scope = "",
  itemKey,
  renderItem,
  disabled = () => false,
  onPick,
  onEnter,
  empty,
  busy = false,
  invalid = false,
}: Props<T>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<{ key: string; data?: SearchResult<T>; error?: string } | null>(null);
  // The latest search function, so a new one each render does not search again.
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  const q = value.trim();
  const searchable = canSearch(q);
  const key = `${scope}|${q}`;
  useEffect(() => {
    if (!searchable) return;
    let current = true;
    const timer = setTimeout(() => {
      searchRef
        .current(q)
        .then((data) => current && setResult({ key, data }))
        .catch((failure) => current && setResult({ key, error: apiErrorMessage(failure, "Could not search. Please try again.") }));
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // `key` covers the text and the scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, searchable]);

  const shown = searchable && result?.key === key ? result : null;
  const items = shown?.data?.items ?? [];
  const loading = searchable && !shown;
  const listOpen = open && searchable;

  function pick(item: T) {
    if (disabled(item)) return;
    setOpen(false);
    setActive(-1);
    onPick(item);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      // Enter chooses; it must not submit the surrounding form.
      event.preventDefault();
      const chosen = items[active] ?? (items.length === 1 ? items[0] : undefined);
      if (chosen) pick(chosen);
      else onEnter?.(q);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#999]" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        // Closing waits a moment so a click on an option still lands.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        className="h-10 bg-white pr-9 pl-9"
      />
      {(busy || (listOpen && loading)) && <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#999]" />}

      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-[#e2d6c8] bg-white py-1 shadow-lg"
        >
          {shown?.error && <li className="px-3 py-2 text-[13px] text-red-600">{shown.error}</li>}
          {loading && <li className="px-3 py-2 text-[13px] text-[#6b6b6b]">Searching…</li>}
          {shown?.data && items.length === 0 && (
            // mousedown inside keeps the list open long enough for a button in it to be clicked.
            <li className="px-3 py-2 text-[13px] text-[#6b6b6b]" onMouseDown={(event) => event.preventDefault()}>
              {empty(q)}
            </li>
          )}
          {items.map((item, index) => {
            const off = disabled(item);
            return (
              <li
                key={itemKey(item)}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                aria-disabled={off || undefined}
                // mousedown, not click: it runs before the input's blur closes the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(item);
                }}
                onMouseEnter={() => setActive(index)}
                className={`px-3 py-2 text-[13px] ${off ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${index === active && !off ? "bg-[#f6efe8]" : ""}`}
              >
                {renderItem(item)}
              </li>
            );
          })}
          {shown?.data?.more && (
            <li className="px-3 py-2 text-[12px] text-[#6b6b6b]">More match. Type more to narrow it down.</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default SearchCombobox;
