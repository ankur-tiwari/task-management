import { useAuth } from '../context/AuthContext';
import MfaSettings from '../components/MfaSettings';

export default function SecurityPage() {
  const { user } = useAuth();
  return (
    <section>
      <div className="page-header"><h1>Security</h1></div>
      <div className="card">
        <h2>Account</h2>
        <p>{user.first_name} {user.last_name} · {user.email}</p>
      </div>
      <div className="card">
        <h2>Two-factor authentication</h2>
        <MfaSettings />
      </div>
    </section>
  );
}
