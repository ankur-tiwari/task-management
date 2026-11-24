import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../api/services';
import { TextField } from '../components/Field';
import Button from '../components/Button';
import Alert from '../components/Alert';
import { useForm } from '../hooks/useForm';
import { registerSchema } from '../validation/schemas';

const INITIAL = { first_name: '', last_name: '', email: '', password: '', confirm_password: '' };

export default function RegisterPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const form = useForm(INITIAL, registerSchema);

  const submit = async (e) => {
    e.preventDefault();
    const data = form.validateAll();
    if (!data) return;
    setSaving(true);
    try {
      const { confirm_password, ...payload } = data; // never send the confirmation field
      await authService.register(payload);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      form.setServerErrors(err);
      setSaving(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <form onSubmit={submit} noValidate>
          <h1>Create account</h1>
          {done && <Alert type="success">Account created. Redirecting to sign in…</Alert>}
          <Alert>{form.errors.form}</Alert>
          <div className="grid-2">
            <TextField label="First name" name="first_name" autoComplete="given-name" maxLength={50} autoFocus
              value={form.values.first_name} onChange={form.handleChange} error={form.errors.first_name} />
            <TextField label="Last name" name="last_name" autoComplete="family-name" maxLength={50}
              value={form.values.last_name} onChange={form.handleChange} error={form.errors.last_name} />
          </div>
          <TextField label="Email" name="email" type="email" autoComplete="email" maxLength={254}
            value={form.values.email} onChange={form.handleChange} error={form.errors.email} />
          <TextField label="Password" name="password" type="password" autoComplete="new-password" maxLength={128}
            hint="12+ characters with upper & lower case, a number and a symbol."
            value={form.values.password} onChange={form.handleChange} error={form.errors.password} />
          <TextField label="Confirm password" name="confirm_password" type="password" autoComplete="new-password" maxLength={128}
            value={form.values.confirm_password} onChange={form.handleChange} error={form.errors.confirm_password} />
          <Button type="submit" loading={saving} disabled={done}>Create account</Button>
          <p className="form-footer">Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
