const CLASS = {
  'Pending': 'status-pending',
  'In-progress': 'status-progress',
  'Completed': 'status-completed',
  'Blocked': 'status-blocked',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${CLASS[status] ?? ''}`}>{status}</span>;
}
