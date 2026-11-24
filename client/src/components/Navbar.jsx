import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './Button';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <span className="brand">✓ Task Manager</span>
        <nav aria-label="Main">
          <NavLink to="/" end>Tasks</NavLink>
          <NavLink to="/security">Security</NavLink>
        </nav>
        <div className="navbar-user">
          <span>{user.first_name} {user.last_name}</span>
          <Button variant="secondary" onClick={logout}>Sign out</Button>
        </div>
      </div>
    </header>
  );
}
