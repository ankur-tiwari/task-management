import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', loading, error, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
