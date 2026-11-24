import { TextField, SelectField } from './Field';
import { TASK_STATUSES } from '../validation/schemas';

const OPTIONS = TASK_STATUSES.map((s) => ({ value: s, label: s }));

export default function TaskFilters({ search, status, onSearch, onStatus }) {
  return (
    <div className="filters">
      <TextField label="Search" type="search" value={search} maxLength={100} placeholder="Name or description"
        onChange={(e) => onSearch(e.target.value)} />
      <SelectField label="Status" value={status} onChange={(e) => onStatus(e.target.value)}
        options={OPTIONS} placeholder="All statuses" />
    </div>
  );
}
