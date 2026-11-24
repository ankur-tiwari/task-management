import { useId } from 'react';

/** Shared label + error wrapper for every form control. */
function Field({ label, error, hint, id, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="error-text" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

const aria = (id, error, hint) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
});

export function TextField({ label, error, hint, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <input id={id} {...aria(id, error, hint)} {...props} />
    </Field>
  );
}

export function TextAreaField({ label, error, hint, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <textarea id={id} rows={4} {...aria(id, error, hint)} {...props} />
    </Field>
  );
}

export function SelectField({ label, error, hint, options, placeholder, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <select id={id} {...aria(id, error, hint)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}
