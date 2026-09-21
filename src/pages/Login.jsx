import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DemoBanner from '../components/DemoBanner'
import InstallPwaButton from '../components/InstallPwaButton'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotNotice, setForgotNotice] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)

  // Demo mode active preset state ('admin' | 'employee' | 'custom')
  const [selectedDemoRole, setSelectedDemoRole] = useState('admin')
  // Dedicated Portal Switcher ('employee' | 'admin')
  const [loginPortal, setLoginPortal] = useState('employee')

  const navigate = useNavigate()
  const { user, isAdmin, login, loginWithGoogle, resetPassword, isDemoMode } = useAuth()

  useEffect(() => {
    // Check remembered email
    const savedEmail = localStorage.getItem('punch_remember_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    } else if (isDemoMode) {
      if (loginPortal === 'admin') {
        setEmail('admin@company.com')
        setPassword('admin123')
      } else {
        setEmail('alex@company.com')
        setPassword('alex123')
      }
    }
  }, [isDemoMode, loginPortal])

  function handlePortalSwitch(portal) {
    setLoginPortal(portal)
    setError('')
    if (isDemoMode) {
      setSelectedDemoRole(portal)
      if (portal === 'admin') {
        setEmail('admin@company.com')
        setPassword('admin123')
      } else {
        setEmail('alex@company.com')
        setPassword('alex123')
      }
    } else {
      // Clear password on portal switch for security
      setPassword('')
    }
  }

  if (user) {
    return isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    if (rememberMe) {
      localStorage.setItem('punch_remember_email', email.trim())
    } else {
      localStorage.removeItem('punch_remember_email')
    }

    try {
      await login(email.trim(), password, loginPortal)
      if (loginPortal === 'admin') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(mapAuthError(err.code || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  function handleSelectDemo(role) {
    setSelectedDemoRole(role)
    setError('')
    if (role === 'admin') {
      setEmail('admin@company.com')
      setPassword('admin123')
    } else {
      setEmail('alex@company.com')
      setPassword('alex123')
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setSubmitting(true)
    try {
      await loginWithGoogle(loginPortal)
      if (loginPortal === 'admin') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPasswordSubmit(e) {
    e.preventDefault()
    setForgotNotice('')
    setForgotError('')
    setForgotSubmitting(true)
    try {
      await resetPassword(forgotEmail)
      setForgotNotice(`Password reset instructions sent to ${forgotEmail}.`)
    } catch (err) {
      setForgotError(err.message || 'Failed to send reset link. Please check the email.')
    } finally {
      setForgotSubmitting(false)
    }
  }

  return (
    <div className="sw-auth-page">
      {isDemoMode && <DemoBanner />}

      <div className="sw-auth-ambient-glow sw-glow-1" />
      <div className="sw-auth-ambient-glow sw-glow-2" />

      <div className="sw-auth-container">
        {/* Left Side: Brand & Product Showcase (Desktop) */}
        <div className="sw-brand-showcase">
          <div className="sw-showcase-badge">
            <span className="sw-pulsing-dot" />
            <span>Softwind Cloud • v2.4</span>
          </div>

          <div className="sw-showcase-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '0.85rem' }}>
              <img src="/icon-192.png" alt="Softwind Labs Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.15)' }} />
              <div className="sw-brand-text sw-brand-showcase-title" style={{ margin: 0 }}>
                SOFTWIND<span className="sw-brand-highlight">.LABS</span>
              </div>
            </div>
            <h1 className="sw-showcase-title">
              Attendance Intelligence <span className="sw-gradient-text">&amp; Workforce Portal</span>
            </h1>
            <p className="sw-showcase-desc">
              Next-generation verified workplace attendance with live camera facial capture,
              tamper-proof GPS coordinates, and real-time administrative intelligence.
            </p>
          </div>

          <div className="sw-features-list">
            <div className="sw-feature-item">
              <div className="sw-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <div className="sw-feature-text">
                <strong>Live Selfie Biometrics</strong>
                <span>Instant photo capture ensures authentic presence at check-in.</span>
              </div>
            </div>

            <div className="sw-feature-item">
              <div className="sw-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="sw-feature-text">
                <strong>Geofenced GPS Location</strong>
                <span>High-precision coordinate verification with Google Maps integration.</span>
              </div>
            </div>

            <div className="sw-feature-item">
              <div className="sw-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="sw-feature-text">
                <strong>Authoritative Server Timestamps</strong>
                <span>Immutable punch logs with automated work duration calculations.</span>
              </div>
            </div>
          </div>

          <div className="sw-showcase-footer">
            <div className="sw-security-pill">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Enterprise 256-bit Security &amp; Firebase Architecture</span>
            </div>
          </div>
        </div>

        {/* Right Side: High-End Glassmorphic Login Card */}
        <div className="sw-card-wrap">
          <div className="sw-login-card">
            {/* Dual Portal Switcher Tabs: Employee vs Admin */}
            <div className="sw-portal-tabs" role="tablist">
              <button
                type="button"
                className={`sw-portal-tab ${loginPortal === 'employee' ? 'active' : ''}`}
                onClick={() => handlePortalSwitch('employee')}
                id="tab-employee-login"
                role="tab"
                aria-selected={loginPortal === 'employee'}
              >
                <span className="sw-portal-tab-icon">👤</span>
                <div className="sw-portal-tab-text">
                  <strong>Employee Login</strong>
                  <span>Punch &amp; attendance</span>
                </div>
              </button>

              <button
                type="button"
                className={`sw-portal-tab ${loginPortal === 'admin' ? 'active' : ''}`}
                onClick={() => handlePortalSwitch('admin')}
                id="tab-admin-login"
                role="tab"
                aria-selected={loginPortal === 'admin'}
              >
                <span className="sw-portal-tab-icon">🛡️</span>
                <div className="sw-portal-tab-text">
                  <strong>Admin Login</strong>
                  <span>Workforce &amp; reports</span>
                </div>
              </button>
            </div>

            <div className="sw-card-header">
              <div className="sw-mobile-logo" style={{ marginBottom: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <img src="/icon-192.png" alt="Softwind Labs Logo" style={{ width: '64px', height: '64px', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', border: '1px solid rgba(226, 232, 240, 0.8)' }} />
                <span className="sw-brand-text" style={{ fontSize: '1.45rem', justifyContent: 'center' }}>
                  SOFTWIND<span className="sw-brand-highlight">.LABS</span>
                </span>
              </div>
              <div className="sw-card-eyebrow">
                {loginPortal === 'admin' ? '🛡️ Administrative Access' : '👤 Staff & Employee Workspace'}
              </div>
              <h2 className="sw-card-title">
                {loginPortal === 'admin' ? 'Workforce Admin Portal' : 'Employee Attendance Portal'}
              </h2>
              <p className="sw-card-sub">
                {loginPortal === 'admin'
                  ? 'Sign in with management credentials to view all live attendance & manage users.'
                  : 'Enter your employee email and password to verify your presence today.'}
              </p>
            </div>

            {/* Google Sign-In Button (Admin Portal Only) */}
            {loginPortal === 'admin' && (
              <>
                <button
                  type="button"
                  className="sw-google-login-btn"
                  onClick={handleGoogleLogin}
                  disabled={submitting}
                  id="sw-google-signin"
                >
                  <svg className="sw-google-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google (Admin)</span>
                </button>

                <div className="sw-auth-divider">
                  <span>or sign in with admin email</span>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="sw-login-form">
              {/* Email Input */}
              <div className="sw-form-group">
                <label htmlFor="sw-email" className="sw-input-label">Work Email</label>
                <div className="sw-input-wrap">
                  <span className="sw-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    id="sw-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="name@softwindlabs.com"
                    className="sw-input"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="sw-form-group">
                <div className="sw-label-row">
                  <label htmlFor="sw-password" className="sw-input-label">Password</label>
                  <button
                    type="button"
                    className="sw-forgot-link"
                    onClick={() => {
                      setForgotEmail(email)
                      setShowForgotModal(true)
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="sw-input-wrap">
                  <span className="sw-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="sw-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="sw-input sw-input-password"
                  />
                  <button
                    type="button"
                    className="sw-password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Options Row */}
              <div className="sw-options-row">
                <label className="sw-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sw-checkbox"
                  />
                  <span>Remember my work email</span>
                </label>
              </div>

              {/* Error Display */}
              {error && (
                <div className="sw-form-error" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="sw-submit-btn"
                id="sw-login-submit"
              >
                {submitting ? (
                  <span className="sw-btn-spinner-wrap">
                    <span className="sw-spinner" />
                    <span>Signing in…</span>
                  </span>
                ) : (
                  <span className="sw-btn-content">
                    <span>Sign In to Workspace</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                )}
              </button>
            </form>

            <InstallPwaButton className="sw-login-pwa-btn" />

            <div className="sw-card-footer">
              <span>Softwindlabs Attendance System</span>
              <span>•</span>
              <span>Biometric &amp; GPS Protected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Your Password</h2>
              <button className="btn-close" onClick={() => setShowForgotModal(false)}>✕</button>
            </div>
            <form onSubmit={handleForgotPasswordSubmit}>
              <div className="modal-body">
                <p>
                  Enter your registered workplace email address below. We'll send you instructions
                  to securely reset your login credentials.
                </p>

                <div className="sw-form-group" style={{ marginTop: '1rem' }}>
                  <label className="sw-input-label">Your Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="sw-input"
                    style={{ background: '#fff', color: '#0f172a' }}
                  />
                </div>

                {forgotNotice && (
                  <div className="form-notice" style={{ marginTop: '1rem' }}>
                    {forgotNotice}
                  </div>
                )}
                {forgotError && (
                  <div className="form-error" style={{ marginTop: '1rem' }}>
                    {forgotError}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowForgotModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="btn-primary"
                >
                  {forgotSubmitting ? 'Sending…' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address format looks invalid.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please verify your credentials.'
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Please wait a moment and try again.'
    case 'auth/user-disabled':
      return 'This account has been deactivated. Please contact your Softwind administrator.'
    default:
      return typeof code === 'string' && code ? code : 'Could not sign in. Please try again.'
  }
}
