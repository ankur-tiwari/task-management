import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-note">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Navbar />
      <main className="container"><Outlet /></main>
    </>
  );
}

export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-note">Loading…</p>;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
