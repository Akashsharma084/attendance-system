import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import Login from './pages/Login'
import CheckIn from './pages/CheckIn'
import EmployeeDashboard from './pages/EmployeeDashboard'
import EmployeeLeaves from './pages/EmployeeLeaves'
import AdminDashboard from './pages/AdminDashboard'
import AdminUsers from './pages/AdminUsers'
import AdminLeaves from './pages/AdminLeaves'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen-center" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ maxWidth: '480px', background: '#1e293b', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ color: '#f87171', margin: '0 0 1rem' }}>Application Notice</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              A display issue occurred while rendering this page:
              <br />
              <code style={{ background: '#0f172a', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem', display: 'inline-block', marginTop: '0.5rem' }}>
                {this.state.error?.message || 'Unknown error'}
              </code>
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RoleHome />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaves"
              element={
                <ProtectedRoute>
                  <EmployeeLeaves />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/leaves"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLeaves />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

// "/" means different things for each role: admins land on the org-wide view,
// employees land on their own check-in screen.
function RoleHome() {
  return (
    <ProtectedRoute>
      <RoleHomeInner />
    </ProtectedRoute>
  )
}

function RoleHomeInner() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <div className="screen-center">Loading…</div>
  return isAdmin ? <Navigate to="/admin" replace /> : <CheckIn />
}
