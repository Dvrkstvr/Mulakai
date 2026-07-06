import { CustomSelect } from './CustomSelect';

export type LibrarySort = 'newest' | 'oldest' | 'title';
export type LibraryFilter = 'all' | 'favorites';

const SORT_OPTIONS = [
  { label: 'SORT: NEWEST', value: 'newest' },
  { label: 'SORT: OLDEST', value: 'oldest' },
  { label: 'SORT: TITLE A–Z', value: 'title' },
];

interface Props {
  query: string;
  onQuery: (v: string) => void;
  sort: LibrarySort;
  onSort: (v: LibrarySort) => void;
  filter: LibraryFilter;
  onFilter: (v: LibraryFilter) => void;
  onSettings: () => void;
}

/** Search + sort + filter, grouped with the list they act on — not in the header.
 * SETTINGS is the one nav-style action here (per PLAN.md's 4th peer screen), kept
 * at the trailing edge so it reads as "leaves the list" rather than acting on it. */
export function LibraryToolbar({ query, onQuery, sort, onSort, filter, onFilter, onSettings }: Props) {
  return (
    <div className="library-toolbar">
      <input
        placeholder="Search songs, styles, lyrics"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <CustomSelect value={sort} onChange={(v) => onSort(v as LibrarySort)} options={SORT_OPTIONS} />
      <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => onFilter('all')}>
        <span>ALL</span>
      </button>
      <button className={filter === 'favorites' ? 'chip active' : 'chip'} onClick={() => onFilter('favorites')}>
        <span>FAVORITES</span>
      </button>
      <button className="chip" onClick={onSettings} aria-label="Settings">
        <span>SETTINGS</span>
      </button>
    </div>
  );
}
