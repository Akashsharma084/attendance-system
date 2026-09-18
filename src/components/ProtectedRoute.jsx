import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isAdmin, isDisabled, loading } = useAuth()

  if (loading) return <div className="screen-center">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (isDisabled) return <div className="screen-center">Your account has been disabled. Contact your admin.</div>
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />

  return children
}
