import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TextField } from '../components/Field';
import Button from '../components/Button';
import Alert from '../components/Alert';
import { useForm } from '../hooks/useForm';
import { loginSchema, totpSchema } from '../validation/schemas';

function MfaStep({ mfaToken, onBack }) {
  const { completeMfa } = useAuth();
  const [saving, setSaving] = useState(false);
  const form = useForm({ code: '' }, totpSchema);

  const submit = async (e) => {
    e.preventDefault();
    const data = form.validateAll();
    if (!data) return;
    setSaving(true);
    try { await completeMfa(mfaToken, data.code); }
    catch (err) { form.setServerErrors(err); setSaving(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1>Two-factor authentication</h1>
      <p>Enter the 6-digit code from your authenticator app.</p>
      <Alert>{form.errors.form}</Alert>
      <TextField label="Authentication code" name="code" inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} autoFocus value={form.values.code} onChange={form.handleChange} error={form.errors.code} />
      <Button type="submit" loading={saving}>Verify</Button>
      <p className="form-footer"><button type="button" className="link-btn" onClick={onBack}>Back to sign in</button></p>
    </form>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const [saving, setSaving] = useState(false);
  const [mfaToken, setMfaToken] = useState(null); // memory only — never persisted
  const form = useForm({ email: '', password: '' }, loginSchema);

  const submit = async (e) => {
    e.preventDefault();
    const data = form.validateAll();
    if (!data) return;
    setSaving(true);
    try {
      const result = await login(data);
      if (result.mfaToken) setMfaToken(result.mfaToken);
    } catch (err) {
      form.setServerErrors(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        {mfaToken ? (
          <MfaStep mfaToken={mfaToken} onBack={() => setMfaToken(null)} />
        ) : (
          <form onSubmit={submit} noValidate>
            <h1>Sign in</h1>
            <Alert>{form.errors.form}</Alert>
            <TextField label="Email" name="email" type="email" autoComplete="email" autoFocus
              value={form.values.email} onChange={form.handleChange} error={form.errors.email} />
            <TextField label="Password" name="password" type="password" autoComplete="current-password"
              value={form.values.password} onChange={form.handleChange} error={form.errors.password} />
            <Button type="submit" loading={saving}>Sign in</Button>
            <p className="form-footer">No account? <Link to="/register">Create one</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
