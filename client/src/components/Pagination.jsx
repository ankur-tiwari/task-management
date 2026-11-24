import Button from './Button';

export default function Pagination({ page, totalPages, total, onChange }) {
  if (total === 0) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <span>Page {page} of {totalPages} · {total} task{total === 1 ? '' : 's'}</span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
    </nav>
  );
}
