export default function Button({ variant = 'primary', loading = false, disabled, children, type = 'button', ...rest }) {
  return (
    <button type={type} className={`btn btn-${variant}`} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}
