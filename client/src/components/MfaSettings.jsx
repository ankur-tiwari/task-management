import { useState } from 'react';
import { authService } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { TextField } from './Field';
import Button from './Button';
import Alert from './Alert';
import { useForm } from '../hooks/useForm';
import { totpSchema, disableMfaSchema } from '../validation/schemas';

function EnableFlow({ onDone }) {
  const [setup, setSetup] = useState(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const form = useForm({ code: '' }, totpSchema);

  const start = async () => {
    setStarting(true); setError('');
    try { setSetup((await authService.mfaSetup()).data); }
    catch (err) { setError(err.message); }
    finally { setStarting(false); }
  };

  const confirm = async (e) => {
    e.preventDefault();
    const data = form.validateAll();
    if (!data) return;
    setSaving(true);
    try { await authService.mfaEnable(data); await onDone(); }
    catch (err) { form.setServerErrors(err); }
    finally { setSaving(false); }
  };

  if (!setup) {
    return (
      <>
        <Alert>{error}</Alert>
        <p>Add a second step at sign-in using an authenticator app (Google Authenticator, 1Password, Authy…).</p>
        <Button onClick={start} loading={starting}>Set up two-factor authentication</Button>
      </>
    );
  }
  return (
    <form onSubmit={confirm} noValidate>
      <p>1. Scan this QR code with your authenticator app.</p>
      <img className="qr" src={setup.qr_data_url} alt="QR code for authenticator app setup" width="200" height="200" />
      <p className="hint">Can’t scan? Enter this key manually: <code>{setup.secret}</code></p>
      <p>2. Enter the 6-digit code it shows.</p>
      <Alert>{form.errors.form}</Alert>
      <TextField label="Authentication code" name="code" inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} value={form.values.code} onChange={form.handleChange} error={form.errors.code} />
      <Button type="submit" loading={saving}>Enable</Button>
    </form>
  );
}

function DisableFlow({ onDone }) {
  const [saving, setSaving] = useState(false);
  const form = useForm({ password: '', code: '' }, disableMfaSchema);

  const submit = async (e) => {
    e.preventDefault();
    const data = form.validateAll();
    if (!data) return;
    setSaving(true);
    try { await authService.mfaDisable(data); await onDone(); }
    catch (err) { form.setServerErrors(err); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <p>Two-factor authentication is <strong>on</strong>. To turn it off, confirm your password and a current code.</p>
      <Alert>{form.errors.form}</Alert>
      <TextField label="Password" name="password" type="password" autoComplete="current-password"
        value={form.values.password} onChange={form.handleChange} error={form.errors.password} />
      <TextField label="Authentication code" name="code" inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} value={form.values.code} onChange={form.handleChange} error={form.errors.code} />
      <Button type="submit" variant="danger" loading={saving}>Disable two-factor authentication</Button>
    </form>
  );
}

export default function MfaSettings() {
  const { user, refresh } = useAuth();
  return user.mfa_enabled ? <DisableFlow onDone={refresh} /> : <EnableFlow onDone={refresh} />;
}
