export type LibrarySort = 'newest' | 'oldest' | 'title';
export type LibraryFilter = 'all' | 'favorites';

interface Props {
  query: string;
  onQuery: (v: string) => void;
  sort: LibrarySort;
  onSort: (v: LibrarySort) => void;
  filter: LibraryFilter;
  onFilter: (v: LibraryFilter) => void;
}

/** Search + sort + filter, grouped with the list they act on — not in the header. */
export function LibraryToolbar({ query, onQuery, sort, onSort, filter, onFilter }: Props) {
  return (
    <div className="library-toolbar">
      <input
        placeholder="Search songs, styles, lyrics"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <select value={sort} onChange={(e) => onSort(e.target.value as LibrarySort)}>
        <option value="newest">SORT: NEWEST</option>
        <option value="oldest">SORT: OLDEST</option>
        <option value="title">SORT: TITLE A&#8211;Z</option>
      </select>
      <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => onFilter('all')}>
        <span>ALL</span>
      </button>
      <button className={filter === 'favorites' ? 'chip active' : 'chip'} onClick={() => onFilter('favorites')}>
        <span>FAVORITES</span>
      </button>
    </div>
  );
}
