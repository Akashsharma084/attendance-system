import { useState } from 'react'
import { Link } from 'react-router-dom'
import './SWLDesignShowcase.css'

// Professional sample avatar photos matching the design
const AVATARS = {
  rahul: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&h=400&q=80',
  amit: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80',
  neha: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80',
  rohit: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&h=400&q=80',
  pooja: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400&q=80',
  sahil: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&h=400&q=80',
  anjali: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&h=400&q=80',
}

// Crisp inline SVG Icons matching the exact legend and screens
export const Icons = {
  Logo: () => (
    <img
      src="/softwind-logo.png"
      alt="Softwind Labs"
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  ),
  LogoWave: () => (
    <img
      src="/softwind-logo.png"
      alt="Softwind Labs"
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  ),
  Home: ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Attendance: ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <path d="M9 16l2 2 4-4" stroke={active ? '#1E5AE6' : 'currentColor'} strokeWidth="2"/>
    </svg>
  ),
  Leave: ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Profile: ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Dashboard: ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Employees: ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Reports: ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  BackArrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill="#10B981"/>
      <polyline points="9 12 11 14 15 10" stroke="#FFFFFF"/>
    </svg>
  ),
  LocationPin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Download: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Edit: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Lock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Eye: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Camera: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Help: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Logout: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  RightChevron: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
    Google: () => (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>
  ),
  Mail: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  Document: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

// Reusable Phone Frame Component
function PhoneMockup({ children, isDark = false }) {
  return (
    <div className="swl-phone-chassis">
      <div className="swl-phone-viewport" style={{ borderRadius: 36 }}>
        {children}
      </div>
    </div>
  )
}

export default function SWLDesignShowcase({ onSwitchToApp }) {
  const [viewMode, setViewMode] = useState('board') // 'board' | 'interactive'
  const [activeInteractiveScreen, setActiveInteractiveScreen] = useState('emp_home')

  // Interactive local states for full preview
  const [checkInDone, setCheckInDone] = useState(true)
  const [leaveTab, setLeaveTab] = useState('apply')
  const [adminTab, setAdminTab] = useState('pending')
  const [empFilter, setEmpFilter] = useState('All')

  return (
    <div className="swl-showcase-container">
      {/* Top Bar Switcher */}
      <header className="swl-top-bar">
        <div className="swl-top-brand">
          <div className="swl-logo-badge">
            <Icons.Logo />
          </div>
          <div>
            <div className="swl-brand-title">SWL Attend</div>
            <div className="swl-brand-tagline">Track · Verify · Stay On Time</div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="swl-mode-tabs">
          <button
            className={`swl-mode-btn ${viewMode === 'board' ? 'active' : ''}`}
            onClick={() => setViewMode('board')}
          >
            <span>🖼️</span> Exact Design Showcase (All Screens)
          </button>
          <button
            className={`swl-mode-btn ${viewMode === 'interactive' ? 'active' : ''}`}
            onClick={() => setViewMode('interactive')}
          >
            <span>📱</span> Interactive Mobile Simulator
          </button>
        </div>

        <div className="swl-top-actions">
          {onSwitchToApp && (
            <button className="swl-btn-sm swl-btn-primary" onClick={onSwitchToApp}>
              🚀 Open Full Web App
            </button>
          )}
          <Link to="/login" className="swl-btn-sm swl-btn-outline">
            🔑 Portal Login
          </Link>
        </div>
      </header>

      {viewMode === 'interactive' ? (
        /* ================= SINGLE INTERACTIVE PHONE SIMULATOR ================= */
        <div className="swl-interactive-view">
          <div className="swl-interactive-wrapper">
            {/* Screen Pills Selector */}
            <div className="swl-screen-selector-bar">
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'emp_splash' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('emp_splash')}
              >
                1. Splash
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'emp_login' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('emp_login')}
              >
                2. Login
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'emp_home' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('emp_home')}
              >
                3. Home
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'emp_checkin' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('emp_checkin')}
              >
                4. Check In
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'emp_history' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('emp_history')}
              >
                5. Attendance
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'emp_leave' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('emp_leave')}
              >
                6. Apply Leave
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'emp_profile' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('emp_profile')}
              >
                7. Profile
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'adm_login' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('adm_login')}
              >
                8. Admin Login
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'adm_dashboard' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('adm_dashboard')}
              >
                9. Admin Dashboard
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'adm_employees' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('adm_employees')}
              >
                10. Employees
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'adm_details' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('adm_details')}
              >
                11. Employee Details
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'adm_approvals' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('adm_approvals')}
              >
                12. Approvals
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'adm_reports' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('adm_reports')}
              >
                13. Reports
              </button>
              <button
                className={`swl-screen-pill-btn ${activeInteractiveScreen === 'adm_profile' ? 'active' : ''}`}
                onClick={() => setActiveInteractiveScreen('adm_profile')}
              >
                14. Admin Profile
              </button>
            </div>

            {/* Selected Active Phone Mockup */}
            <div style={{ transform: 'scale(1.02)', transformOrigin: 'top center' }}>
              <PhoneMockup isDark={activeInteractiveScreen === 'emp_splash'}>
                {renderScreenContent(activeInteractiveScreen, {
                  checkInDone,
                  setCheckInDone,
                  leaveTab,
                  setLeaveTab,
                  adminTab,
                  setAdminTab,
                  empFilter,
                  setEmpFilter,
                  onNavigate: setActiveInteractiveScreen
                })}
              </PhoneMockup>
            </div>
          </div>
        </div>
      ) : (
        /* ================= FULL DESIGN SHOWCASE (IMAGE EXACT REPLICA) ================= */
        <>
          {/* Section 1: Employee App Screens */}
          <div className="swl-section-header">
            <span className="swl-banner-pill">Employee App Screens</span>
            <span className="swl-banner-sub">(Icons for each option)</span>
          </div>

          <div className="swl-screens-row">
            {/* Screen 1: Splash Screen */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('emp_splash'); setViewMode('interactive'); }}>
              <PhoneMockup isDark={true}>
                <SplashScreen />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">⚡</div>
                  <span>Splash Screen</span>
                </div>
                <div className="swl-caption-desc">App logo and loading screen</div>
              </div>
            </div>

            {/* Screen 2: Login Screen */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('emp_login'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <LoginScreen />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">🔑</div>
                  <span>Login Screen</span>
                </div>
                <div className="swl-caption-desc">Enter your credentials</div>
              </div>
            </div>

            {/* Screen 3: Home Screen */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('emp_home'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <HomeScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">🏠</div>
                  <span>Home Screen</span>
                </div>
                <div className="swl-caption-desc">Overview & quick actions</div>
              </div>
            </div>

            {/* Screen 4: Check-In Screen */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('emp_checkin'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <CheckInScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">📷</div>
                  <span>Check-In Screen</span>
                </div>
                <div className="swl-caption-desc">Selfie + Location verification</div>
              </div>
            </div>

            {/* Screen 5: Attendance History */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('emp_history'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <AttendanceHistoryScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">📅</div>
                  <span>Attendance History</span>
                </div>
                <div className="swl-caption-desc">Calendar & daily status</div>
              </div>
            </div>

            {/* Screen 6: Leave Application */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('emp_leave'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <LeaveAppScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">📝</div>
                  <span>Leave Application</span>
                </div>
                <div className="swl-caption-desc">Apply & track leave</div>
              </div>
            </div>

            {/* Screen 7: Profile */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('emp_profile'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <ProfileScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">👤</div>
                  <span>Profile</span>
                </div>
                <div className="swl-caption-desc">Personal info & settings</div>
              </div>
            </div>
          </div>

          {/* Section 2: Admin App Screens */}
          <div className="swl-section-header" style={{ marginTop: '24px' }}>
            <span className="swl-banner-pill">Admin App Screens</span>
            <span className="swl-banner-sub">(Icons for each option)</span>
          </div>

          <div className="swl-screens-row">
            {/* Screen 1: Admin Login */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('adm_login'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <AdminLoginScreen />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">🛡️</div>
                  <span>Admin Login</span>
                </div>
                <div className="swl-caption-desc">Secure access for admin</div>
              </div>
            </div>

            {/* Screen 2: Admin Dashboard */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('adm_dashboard'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <AdminDashboardScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">📊</div>
                  <span>Dashboard</span>
                </div>
                <div className="swl-caption-desc">Overview & quick actions</div>
              </div>
            </div>

            {/* Screen 3: Employees */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('adm_employees'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <AdminEmployeesScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">👥</div>
                  <span>Employees</span>
                </div>
                <div className="swl-caption-desc">View & manage employees</div>
              </div>
            </div>

            {/* Screen 4: Employee Details */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('adm_details'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <EmployeeDetailsScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">📋</div>
                  <span>Employee Details</span>
                </div>
                <div className="swl-caption-desc">View attendance & leave info</div>
              </div>
            </div>

            {/* Screen 5: Leave Approvals */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('adm_approvals'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <LeaveApprovalsScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">✅</div>
                  <span>Leave Approvals</span>
                </div>
                <div className="swl-caption-desc">Approve / Reject leaves</div>
              </div>
            </div>

            {/* Screen 6: Reports & Export */}
            <div className="swl-phone-card" onClick={() => { setActiveInteractiveScreen('adm_reports'); setViewMode('interactive'); }}>
              <PhoneMockup>
                <ReportsScreen onNavigate={setActiveInteractiveScreen} />
              </PhoneMockup>
              <div className="swl-phone-caption">
                <div className="swl-caption-title-row">
                  <div className="swl-caption-icon">📈</div>
                  <span>Reports & Export</span>
                </div>
                <div className="swl-caption-desc">Generate and download reports</div>
              </div>
            </div>
          </div>

          {/* Section 3: All App Icons (Legend) */}
          <div className="swl-legend-section">
            <h3 className="swl-legend-title">All App Icons (Legend)</h3>
            <div className="swl-legend-cards-grid">
              {/* Navigation Card */}
              <div className="swl-legend-card">
                <div className="swl-legend-card-header">Navigation</div>
                <div className="swl-legend-icons-grid">
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Home active={false} /></div>
                    <span className="swl-legend-icon-label">Home</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Attendance active={false} /></div>
                    <span className="swl-legend-icon-label">Attendance</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Leave active={false} /></div>
                    <span className="swl-legend-icon-label">Leave</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Profile active={false} /></div>
                    <span className="swl-legend-icon-label">Profile</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Dashboard active={false} /></div>
                    <span className="swl-legend-icon-label">Dashboard</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Employees active={false} /></div>
                    <span className="swl-legend-icon-label">Employees</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Reports active={false} /></div>
                    <span className="swl-legend-icon-label">Reports</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Menu /></div>
                    <span className="swl-legend-icon-label">Menu</span>
                  </div>
                </div>
              </div>

              {/* Actions Card */}
              <div className="swl-legend-card">
                <div className="swl-legend-card-header">Actions</div>
                <div className="swl-legend-icons-grid">
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge">📥</div>
                    <span className="swl-legend-icon-label">Check In</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge">📤</div>
                    <span className="swl-legend-icon-label">Check Out</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge">✍️</div>
                    <span className="swl-legend-icon-label">Apply Leave</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Download /></div>
                    <span className="swl-legend-icon-label">Download</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge">✔️</div>
                    <span className="swl-legend-icon-label">Submit</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge">➕</div>
                    <span className="swl-legend-icon-label">Add</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Edit /></div>
                    <span className="swl-legend-icon-label">Edit</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge">🗑️</div>
                    <span className="swl-legend-icon-label">Delete</span>
                  </div>
                </div>
              </div>

              {/* Status Card */}
              <div className="swl-legend-card">
                <div className="swl-legend-card-header">Status</div>
                <div className="swl-legend-icons-grid">
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#10B981' }}>🟢</div>
                    <span className="swl-legend-icon-label">Present</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#EF4444' }}>🔴</div>
                    <span className="swl-legend-icon-label">Absent</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#F59E0B' }}>🟠</div>
                    <span className="swl-legend-icon-label">Late</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#D97706' }}>⏳</div>
                    <span className="swl-legend-icon-label">Pending</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#10B981' }}>✅</div>
                    <span className="swl-legend-icon-label">Approved</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#EF4444' }}>❌</div>
                    <span className="swl-legend-icon-label">Rejected</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#1E5AE6' }}>ℹ️</div>
                    <span className="swl-legend-icon-label">Info</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#10B981' }}><Icons.LocationPin /></div>
                    <span className="swl-legend-icon-label">Location</span>
                  </div>
                </div>
              </div>

              {/* Profile & Security Card */}
              <div className="swl-legend-card">
                <div className="swl-legend-card-header">Profile & Security</div>
                <div className="swl-legend-icons-grid">
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.User /></div>
                    <span className="swl-legend-icon-label">User</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Settings /></div>
                    <span className="swl-legend-icon-label">Settings</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Help /></div>
                    <span className="swl-legend-icon-label">Help</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge" style={{ color: '#EF4444' }}><Icons.Logout /></div>
                    <span className="swl-legend-icon-label">Logout</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Lock /></div>
                    <span className="swl-legend-icon-label">Lock</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge"><Icons.Camera /></div>
                    <span className="swl-legend-icon-label">Camera</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge">✉️</div>
                    <span className="swl-legend-icon-label">Email</span>
                  </div>
                  <div className="swl-legend-icon-cell">
                    <div className="swl-legend-icon-badge">📞</div>
                    <span className="swl-legend-icon-label">Phone</span>
                  </div>
                </div>
              </div>

              {/* Colors Used Card */}
              <div className="swl-legend-card">
                <div className="swl-legend-card-header">Colors Used</div>
                <div className="swl-color-swatches-grid">
                  <div className="swl-color-swatch-row">
                    <div className="swl-color-box" style={{ background: '#1E5AE6' }} />
                    <span>Primary Blue <small style={{ color: '#94A3B8' }}>#1E5AE6</small></span>
                  </div>
                  <div className="swl-color-swatch-row">
                    <div className="swl-color-box" style={{ background: '#10B981' }} />
                    <span>Success Green <small style={{ color: '#94A3B8' }}>#10B981</small></span>
                  </div>
                  <div className="swl-color-swatch-row">
                    <div className="swl-color-box" style={{ background: '#F59E0B' }} />
                    <span>Warning / Late <small style={{ color: '#94A3B8' }}>#F59E0B</small></span>
                  </div>
                  <div className="swl-color-swatch-row">
                    <div className="swl-color-box" style={{ background: '#EF4444' }} />
                    <span>Danger Red <small style={{ color: '#94A3B8' }}>#EF4444</small></span>
                  </div>
                  <div className="swl-color-swatch-row">
                    <div className="swl-color-box" style={{ background: '#64748B' }} />
                    <span>Neutral Gray <small style={{ color: '#94A3B8' }}>#64748B</small></span>
                  </div>
                  <div className="swl-color-swatch-row">
                    <div className="swl-color-box" style={{ background: '#F7F8FC', border: '1px solid #CBD5E1' }} />
                    <span>Background <small style={{ color: '#94A3B8' }}>#F7F8FC</small></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ================= SCREEN IMPLEMENTATIONS ================= */

// Helper to switch active screen in interactive simulator
function renderScreenContent(screenId, props) {
  switch (screenId) {
    case 'emp_splash': return <SplashScreen onNavigate={props.onNavigate} />
    case 'emp_login': return <LoginScreen onNavigate={props.onNavigate} />
    case 'emp_home': return <HomeScreen onNavigate={props.onNavigate} />
    case 'emp_checkin': return <CheckInScreen onNavigate={props.onNavigate} />
    case 'emp_history': return <AttendanceHistoryScreen onNavigate={props.onNavigate} />
    case 'emp_leave': return <LeaveAppScreen onNavigate={props.onNavigate} />
    case 'emp_profile': return <ProfileScreen onNavigate={props.onNavigate} />
    case 'adm_login': return <AdminLoginScreen onNavigate={props.onNavigate} />
    case 'adm_dashboard': return <AdminDashboardScreen onNavigate={props.onNavigate} />
    case 'adm_employees': return <AdminEmployeesScreen onNavigate={props.onNavigate} />
    case 'adm_details': return <EmployeeDetailsScreen onNavigate={props.onNavigate} />
    case 'adm_approvals': return <LeaveApprovalsScreen onNavigate={props.onNavigate} />
    case 'adm_reports': return <ReportsScreen onNavigate={props.onNavigate} />
    case 'adm_profile': return <AdminProfileScreen onNavigate={props.onNavigate} />
    default: return <HomeScreen onNavigate={props.onNavigate} />
  }
}

// 1. Employee Splash Screen
function SplashScreen({ onNavigate }) {
  return (
    <div className="swl-splash-screen" onClick={() => onNavigate && onNavigate('emp_login')}>
      <div className="swl-splash-logo-circle">
        <Icons.LogoWave />
      </div>
      <div className="swl-splash-title">SWL Attend</div>
      <div className="swl-splash-tagline">Track · Verify · Stay On Time</div>
      <div className="swl-splash-spinner" />
      <div className="swl-splash-loading-text">Loading...</div>
    </div>
  )
}

// 2. Employee Login Screen (with 2 Profile options: Employee & Admin)
function LoginScreen({ onNavigate }) {
  const [profileRole, setProfileRole] = useState('employee') // 'employee' | 'admin'

  return (
    <div className="swl-login-viewport">
      <div>
        <div className="swl-login-header">
          <div className="swl-login-brand-row">
            <div className="swl-logo-badge" style={{ width: 28, height: 28, borderRadius: 8 }}>
              <Icons.Logo />
            </div>
            <span className="swl-login-brand-name">SWL Attend</span>
          </div>

          {/* 2 Profile Login Options */}
          <div className="swl-tab-pill-row" style={{ margin: '8px 0 12px 0' }}>
            <button
              type="button"
              className={`swl-tab-pill ${profileRole === 'employee' ? 'active' : ''}`}
              onClick={() => setProfileRole('employee')}
            >
              👤 Employee
            </button>
            <button
              type="button"
              className={`swl-tab-pill ${profileRole === 'admin' ? 'active' : ''}`}
              onClick={() => setProfileRole('admin')}
            >
              🛡️ Admin
            </button>
          </div>

          <h2 className="swl-login-title">
            {profileRole === 'admin' ? 'Admin Login' : 'Welcome Back'}
          </h2>
          <p className="swl-login-sub">
            {profileRole === 'admin'
              ? 'Sign in via email or Google'
              : 'Login with email and password'}
          </p>
        </div>

        <div className="swl-form-group">
          <div className="swl-input-box">
            <Icons.User />
            <input
              type="text"
              placeholder={profileRole === 'admin' ? 'Admin Email / Mobile' : 'Email or Mobile Number'}
              defaultValue={profileRole === 'admin' ? 'admin@company.com' : 'rahul.sharma@softwindlabs.com'}
              key={profileRole}
            />
          </div>
        </div>

        <div className="swl-form-group">
          <div className="swl-input-box">
            <Icons.Lock />
            <input type="password" placeholder="Password" defaultValue="••••••••••••" />
            <Icons.Eye />
          </div>
        </div>

        <a href="#forgot" className="swl-forgot-link">Forgot Password?</a>

        <button
          className="swl-btn-login"
          onClick={() => onNavigate && onNavigate(profileRole === 'admin' ? 'adm_dashboard' : 'emp_home')}
        >
          {profileRole === 'admin' ? 'Login as Admin' : 'Login'}
        </button>

        {/* Google option ONLY shown when Admin profile is selected */}
        {profileRole === 'admin' && (
          <>
            <div className="swl-divider">or</div>

            <button
              className="swl-btn-google"
              onClick={() => onNavigate && onNavigate('adm_dashboard')}
            >
              <Icons.Google />
              <span>Login with Google</span>
            </button>
          </>
        )}
      </div>

      <div className="swl-login-footer">
        Don't have an account? <span>Sign Up</span>
      </div>
    </div>
  )
}

// 3. Employee Home Screen
function HomeScreen({ onNavigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="swl-home-viewport" style={{ flex: 1, overflowY: 'auto' }}>
        {/* User Header */}
        <div className="swl-user-header">
          <div>
            <p className="swl-user-info-greeting">Good Morning,</p>
            <h3 className="swl-user-info-name">Rahul Sharma 👋</h3>
            <p className="swl-user-info-role">Software Developer</p>
          </div>
          <div className="swl-bell-btn">
            <Icons.Bell />
            <div className="swl-bell-badge" />
          </div>
        </div>

        {/* Hero Attendance Card */}
        <div className="swl-status-hero-card">
          <div className="swl-status-hero-top">
            <span>Today, 10 Oct 2026</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Friday</span>
              <span style={{ color: '#94A3B8' }}>♡</span>
            </div>
          </div>
          <div className="swl-status-hero-badge-row">
            <div className="swl-green-check-circle">✓</div>
            <span className="swl-hero-status-text">You are Present</span>
          </div>
          <div className="swl-hero-hours">Working Hours: 09:12 AM - 06:00 PM</div>
        </div>

        {/* 2 Quick Punch Cards */}
        <div className="swl-punch-cards-row">
          <div className="swl-punch-card" onClick={() => onNavigate && onNavigate('emp_checkin')}>
            <div className="swl-punch-icon in">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="swl-punch-title">Check In</div>
            <div className="swl-punch-sub done">09:12 AM Done</div>
          </div>
          <div className="swl-punch-card">
            <div className="swl-punch-icon out">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="swl-punch-title">Check Out</div>
            <div className="swl-punch-sub pending">Not Yet</div>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="swl-summary-card">
          <div className="swl-summary-title">Monthly Summary</div>
          <div className="swl-donut-row">
            <div className="swl-donut-container">
              <svg className="swl-donut-svg" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="3.8"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3.8"
                  strokeDasharray="84, 100"
                />
              </svg>
              <div className="swl-donut-center-text">22/26</div>
            </div>
            <div className="swl-donut-legend">
              <div className="swl-legend-row"><span className="swl-dot green"></span> Present 22</div>
              <div className="swl-legend-row"><span className="swl-dot yellow"></span> Late 1</div>
              <div className="swl-legend-row"><span className="swl-dot red"></span> Absent 3</div>
            </div>
          </div>
          <div
            className="swl-view-details-link"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigate && onNavigate('emp_history')}
          >
            View Details &gt;
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('emp_home')}>
          <Icons.Home active={true} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_history')}>
          <Icons.Attendance active={false} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_leave')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

// 4. Employee Check-In Screen
function CheckInScreen({ onNavigate }) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate && onNavigate('emp_home')}>
            <Icons.BackArrow />
          </button>
          <span>Check In</span>
          <div style={{ width: 18 }} />
        </div>

        {/* Circular Camera Selfie Viewfinder */}
        <div style={{ textAlign: 'center', margin: '8px 0 6px 0' }}>
          <div className="swl-camera-frame face-detected" style={{ width: 220, height: 220, borderRadius: '50%', margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
            <img src={AVATARS.rahul} alt="Rahul Sharma Selfie" className="swl-camera-photo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            <div className="swl-cam-shutter-btn">
              <Icons.Camera />
            </div>
          </div>
          <div style={{ marginTop: 6, marginBottom: 4 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', background: '#D1FAE5', border: '1px solid #6EE7B7', padding: '3px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              🟢 Face Detected • Circle Verified
            </span>
          </div>
        </div>

        {/* Location Verified Card */}
        <div className="swl-location-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.LocationPin />
            <div className="swl-loc-text-col">
              <span className="swl-loc-title">Location Verified</span>
              <span className="swl-loc-coords">28.6129° N, 77.2090° E</span>
            </div>
          </div>
          <div className="swl-gps-badge">GPS</div>
        </div>

        {/* Checklist */}
        <div className="swl-checklist">
          <div className="swl-check-item">
            <div className="swl-check-icon">✓</div>
            <span>Selfie captured</span>
          </div>
          <div className="swl-check-item">
            <div className="swl-check-icon">✓</div>
            <span>Location verified</span>
          </div>
          <div className="swl-check-item">
            <div className="swl-check-icon">✓</div>
            <span>You are within office area</span>
          </div>
        </div>

        {/* Confirm Check In button */}
        <div className="swl-checkin-btn-wrap">
          <button
            className="swl-btn-login"
            style={{ background: confirmed ? '#10B981' : '#1E5AE6' }}
            onClick={() => setConfirmed(!confirmed)}
          >
            {confirmed ? '✓ Check-In Confirmed!' : 'Confirm Check In'}
          </button>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_home')}>
          <Icons.Home active={false} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('emp_history')}>
          <Icons.Attendance active={true} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_leave')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

// 5. Employee Attendance History Screen
function AttendanceHistoryScreen({ onNavigate }) {
  // Calendar data matching image
  // Sun(0) Mon(1) Tue(2) Wed(3) Thu(4) Fri(5) Sat(6)
  // Oct 1 is Thursday (index 4)
  const days = [
    { num: '', type: 'empty' }, { num: '', type: 'empty' }, { num: '', type: 'empty' }, { num: '', type: 'empty' },
    { num: 1, type: 'p' }, { num: 2, type: 'p' }, { num: 3, type: 'p' },
    { num: 4, type: 'empty' }, { num: 5, type: 'p' }, { num: 6, type: 'p' }, { num: 7, type: 'p' }, { num: 8, type: 'p' }, { num: 9, type: 'p' }, { num: 10, type: 'p' },
    { num: 11, type: 'empty' }, { num: 12, type: 'p' }, { num: 13, type: 'a' }, { num: 14, type: 'p' }, { num: 15, type: 'p' }, { num: 16, type: 'p' }, { num: 17, type: 'p' },
    { num: 18, type: 'empty' }, { num: 19, type: 'p' }, { num: 20, type: 'l' }, { num: 21, type: 'p' }, { num: 22, type: 'p' }, { num: 23, type: 'a' }, { num: 24, type: 'p' },
    { num: 25, type: 'empty' }, { num: 26, type: 'p' }, { num: 27, type: 'p' }, { num: 28, type: 'p' }, { num: 29, type: 'p' }, { num: 30, type: 'p' }, { num: 31, type: 'p' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate && onNavigate('emp_home')}>
            <Icons.BackArrow />
          </button>
          <span>Attendance</span>
          <Icons.Calendar />
        </div>

        {/* Calendar Widget */}
        <div className="swl-calendar-card">
          <div className="swl-month-header">
            <span>&lt;</span>
            <span>October 2026</span>
            <span>&gt;</span>
          </div>

          <div className="swl-cal-weekdays">
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>

          <div className="swl-cal-grid">
            {days.map((d, i) => (
              <div key={i} className={`swl-cal-day ${d.type}`}>
                {d.num}
              </div>
            ))}
          </div>

          <div className="swl-cal-legend">
            <span>🟢 Present</span>
            <span>🔴 Absent</span>
            <span>🟠 Late</span>
            <span>🔵 Leave</span>
          </div>
        </div>

        {/* Today's Attendance Box */}
        <div className="swl-today-box">
          <div className="swl-today-box-title">Today's Attendance</div>
          <div className="swl-today-row">
            <span>Check In 09:12 AM</span>
            <span className="swl-badge-pill green">Present</span>
          </div>
          <div className="swl-today-row">
            <span>Check Out</span>
            <span className="swl-badge-pill yellow">Pending</span>
          </div>
        </div>

        {/* October Summary 4 columns */}
        <div className="swl-stat-cols-4">
          <div>
            <div className="swl-stat-col-num green">22</div>
            <div className="swl-stat-col-label">Present</div>
          </div>
          <div>
            <div className="swl-stat-col-num yellow">1</div>
            <div className="swl-stat-col-label">Late</div>
          </div>
          <div>
            <div className="swl-stat-col-num red">3</div>
            <div className="swl-stat-col-label">Absent</div>
          </div>
          <div>
            <div className="swl-stat-col-num gray">0</div>
            <div className="swl-stat-col-label">Leave</div>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_home')}>
          <Icons.Home active={false} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('emp_history')}>
          <Icons.Attendance active={true} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_leave')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

// 6. Employee Leave Application Screen
function LeaveAppScreen({ onNavigate }) {
  const [tab, setTab] = useState('apply')
  const [submitted, setSubmitted] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate && onNavigate('emp_home')}>
            <Icons.BackArrow />
          </button>
          <span>Apply Leave</span>
          <Icons.Leave active={false} />
        </div>

        <div className="swl-tab-pill-row">
          <button
            className={`swl-tab-pill ${tab === 'apply' ? 'active' : ''}`}
            onClick={() => setTab('apply')}
          >
            Apply Leave
          </button>
          <button
            className={`swl-tab-pill ${tab === 'requests' ? 'active' : ''}`}
            onClick={() => setTab('requests')}
          >
            My Requests
          </button>
        </div>

        <div className="swl-leave-form">
          <div>
            <label className="swl-form-label">Leave Type</label>
            <div className="swl-input-box">
              <select style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: '#1E293B' }}>
                <option>Select Leave Type</option>
                <option>Casual Leave</option>
                <option>Sick Leave</option>
                <option>Earned Leave</option>
              </select>
            </div>
          </div>

          <div>
            <label className="swl-form-label">From Date</label>
            <div className="swl-input-box">
              <input type="text" defaultValue="10 Oct 2026" />
              <Icons.Calendar />
            </div>
          </div>

          <div>
            <label className="swl-form-label">To Date</label>
            <div className="swl-input-box">
              <input type="text" defaultValue="10 Oct 2026" />
              <Icons.Calendar />
            </div>
          </div>

          <div>
            <label className="swl-form-label">Reason</label>
            <textarea
              style={{
                width: '100%',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                padding: '8px 12px',
                fontSize: '0.78rem',
                outline: 'none',
                minHeight: 50,
                resize: 'none'
              }}
              placeholder="Enter reason for leave..."
              defaultValue=""
            />
          </div>

          <button
            className="swl-btn-login"
            style={{ marginTop: 4, background: submitted ? '#10B981' : '#1E5AE6' }}
            onClick={() => setSubmitted(true)}
          >
            {submitted ? '✓ Request Submitted' : 'Submit Request'}
          </button>
        </div>

        {/* Leave Balance Box */}
        <div className="swl-leave-balances">
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Leave Balance</div>
          <div className="swl-balances-grid">
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E5AE6' }}>5</div>
              <div style={{ fontSize: '0.62rem', color: '#64748B' }}>Sick Leave</div>
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10B981' }}>7</div>
              <div style={{ fontSize: '0.62rem', color: '#64748B' }}>Casual Leave</div>
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F59E0B' }}>10</div>
              <div style={{ fontSize: '0.62rem', color: '#64748B' }}>Earned Leave</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_home')}>
          <Icons.Home active={false} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_history')}>
          <Icons.Attendance active={false} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('emp_leave')}>
          <Icons.Leave active={true} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

// 7. Employee Profile Screen
function ProfileScreen({ onNavigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-profile-hero">
          <img src={AVATARS.rahul} alt="Rahul Sharma" className="swl-profile-avatar" />
          <h3 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Rahul Sharma</h3>
          <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748B' }}>Software Developer</p>
        </div>

        <div className="swl-menu-list">
          <div className="swl-menu-item">
            <div className="swl-menu-left">
              <Icons.User />
              <span>My Profile</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item" onClick={() => onNavigate && onNavigate('emp_history')}>
            <div className="swl-menu-left">
              <Icons.Attendance active={false} />
              <span>Attendance History</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item" onClick={() => onNavigate && onNavigate('emp_leave')}>
            <div className="swl-menu-left">
              <Icons.Leave active={false} />
              <span>Leave Requests</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item">
            <div className="swl-menu-left">
              <Icons.Settings />
              <span>Settings</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item">
            <div className="swl-menu-left">
              <Icons.Help />
              <span>Help & Support</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item logout" onClick={() => onNavigate && onNavigate('emp_login')}>
            <div className="swl-menu-left">
              <Icons.Logout />
              <span>Logout</span>
            </div>
            <Icons.RightChevron />
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_home')}>
          <Icons.Home active={false} />
          <span>Home</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_history')}>
          <Icons.Attendance active={false} />
          <span>Attendance</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('emp_leave')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('emp_profile')}>
          <Icons.Profile active={true} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

// 8. Admin Login Screen
function AdminLoginScreen({ onNavigate }) {
  return (
    <div className="swl-login-viewport">
      <div>
        <div className="swl-login-header">
          <div className="swl-login-brand-row">
            <div className="swl-logo-badge" style={{ width: 28, height: 28, borderRadius: 8 }}>
              <Icons.Logo />
            </div>
            <span className="swl-login-brand-name">SWL Attend</span>
          </div>
          <h2 className="swl-login-title">Admin Login</h2>
          <p className="swl-login-sub">Access your dashboard</p>
        </div>

        <div className="swl-form-group">
          <div className="swl-input-box">
            <Icons.User />
            <input type="text" placeholder="Email or Mobile Number" defaultValue="admin@company.com" />
          </div>
        </div>

        <div className="swl-form-group">
          <div className="swl-input-box">
            <Icons.Lock />
            <input type="password" placeholder="Password" defaultValue="••••••••••••" />
            <Icons.Eye />
          </div>
        </div>

        <button className="swl-btn-login" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
          Login
        </button>

        <div className="swl-divider">or</div>

        <button className="swl-btn-google" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
          <Icons.Google />
          <span>Login with Google</span>
        </button>

        <a href="#forgot" className="swl-forgot-link" style={{ textAlign: 'center', marginTop: 10, display: 'block' }}>
          Forgot Password?
        </a>
      </div>

      {/* Bottom security shield graphic */}
      <div style={{ textAlign: 'center', opacity: 0.85, paddingBottom: 10 }}>
        <svg width="100" height="60" viewBox="0 0 100 60" fill="none">
          <path d="M50 8L30 16V28C30 40 50 50 50 50C50 50 70 40 70 28V16L50 8Z" fill="#EEF4FF" stroke="#1E5AE6" strokeWidth="2"/>
          <path d="M46 28L50 32L56 24" stroke="#1E5AE6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="20" cy="38" r="6" fill="#CBD5E1"/>
          <circle cx="80" cy="38" r="6" fill="#CBD5E1"/>
        </svg>
      </div>
    </div>
  )
}

// 9. Admin Dashboard Screen
function AdminDashboardScreen({ onNavigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <Icons.Menu />
          <span>Dashboard</span>
          <div className="swl-bell-btn" style={{ width: 30, height: 30 }}>
            <Icons.Bell />
            <div className="swl-bell-badge" />
          </div>
        </div>

        {/* 4 Stats in 2x2 Grid */}
        <div className="swl-admin-stats-2x2">
          <div className="swl-admin-stat-card">
            <div className="swl-admin-stat-icon blue">👥</div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Total Employees</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>48</div>
            </div>
          </div>

          <div className="swl-admin-stat-card">
            <div className="swl-admin-stat-icon green">✓</div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Present</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10B981' }}>42</div>
            </div>
          </div>

          <div className="swl-admin-stat-card">
            <div className="swl-admin-stat-icon red">✕</div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Absent</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EF4444' }}>4</div>
            </div>
          </div>

          <div className="swl-admin-stat-card">
            <div className="swl-admin-stat-icon orange">🕒</div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Late</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F59E0B' }}>2</div>
            </div>
          </div>
        </div>

        {/* Today's Attendance Donut Card */}
        <div className="swl-summary-card" style={{ margin: '0 16px' }}>
          <div className="swl-summary-title">Today's Attendance</div>
          <div className="swl-donut-row">
            <div className="swl-donut-container">
              <svg className="swl-donut-svg" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="3.8"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3.8"
                  strokeDasharray="88, 100"
                />
              </svg>
              <div className="swl-donut-center-text" style={{ fontSize: '0.72rem' }}>88%<br/><span style={{ fontSize: '0.55rem', color: '#10B981' }}>Present</span></div>
            </div>
            <div className="swl-donut-legend">
              <div className="swl-legend-row"><span className="swl-dot green"></span> Present 42</div>
              <div className="swl-legend-row"><span className="swl-dot red"></span> Absent 4</div>
              <div className="swl-legend-row"><span className="swl-dot yellow"></span> Late 2</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ margin: '12px 16px 4px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>Quick Actions</div>
        <div className="swl-quick-actions-grid">
          <div className="swl-action-btn-card" onClick={() => onNavigate && onNavigate('adm_employees')}>
            <Icons.Employees active={false} />
            <span>Manage Employees</span>
          </div>

          <div className="swl-action-btn-card" onClick={() => onNavigate && onNavigate('adm_approvals')}>
            <Icons.Leave active={false} />
            <span>Leave Approvals</span>
            <div className="swl-action-badge">3</div>
          </div>

          <div className="swl-action-btn-card" onClick={() => onNavigate && onNavigate('adm_reports')}>
            <Icons.Reports active={false} />
            <span>Monthly Report</span>
          </div>

          <div className="swl-action-btn-card" onClick={() => onNavigate && onNavigate('adm_reports')}>
            <Icons.Download />
            <span>Export Data</span>
          </div>
        </div>
      </div>

      {/* Admin Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={true} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_employees')}>
          <Icons.Employees active={false} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

// 10. Admin Employees Screen
function AdminEmployeesScreen({ onNavigate }) {
  const [filter, setFilter] = useState('All')

  const employees = [
    { name: 'Amit Kumar', role: 'Developer', status: 'Present', avatar: AVATARS.amit },
    { name: 'Neha Singh', role: 'Designer', status: 'Present', avatar: AVATARS.neha },
    { name: 'Rohit Verma', role: 'Testing', status: 'Late', avatar: AVATARS.rohit },
    { name: 'Pooja Sharma', role: 'HR', status: 'Present', avatar: AVATARS.pooja },
    { name: 'Sahil Gupta', role: 'Support', status: 'Absent', avatar: AVATARS.sahil },
    { name: 'Anjali Verma', role: 'Developer', status: 'Present', avatar: AVATARS.anjali },
  ]

  const filtered = filter === 'All' ? employees : employees.filter(e => e.status === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <Icons.Menu />
          <span>Employees</span>
          <Icons.Bell />
        </div>

        {/* Search */}
        <div style={{ padding: '8px 16px 4px 16px' }}>
          <div className="swl-input-box" style={{ padding: '8px 12px' }}>
            <Icons.Search />
            <input type="text" placeholder="Search by name or ID..." />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="swl-filter-chips">
          {['All (48)', 'Present (42)', 'Absent (4)', 'Late (2)'].map((chip) => {
            const label = chip.split(' ')[0]
            const isAct = filter === label
            return (
              <button
                key={chip}
                className={`swl-filter-chip ${isAct ? 'active' : ''}`}
                onClick={() => setFilter(label)}
              >
                {chip}
              </button>
            )
          })}
        </div>

        {/* Employee List */}
        <div className="swl-emp-list">
          {filtered.map((emp) => (
            <div
              key={emp.name}
              className="swl-emp-item"
              onClick={() => onNavigate && onNavigate('adm_details')}
              style={{ cursor: 'pointer' }}
            >
              <div className="swl-emp-item-left">
                <img src={emp.avatar} alt={emp.name} className="swl-emp-avatar-sm" />
                <div>
                  <p className="swl-emp-name">{emp.name}</p>
                  <p className="swl-emp-sub">{emp.role}</p>
                </div>
              </div>
              <span className={`swl-badge-pill ${emp.status === 'Present' ? 'green' : emp.status === 'Late' ? 'yellow' : 'red'}`}>
                {emp.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('adm_employees')}>
          <Icons.Employees active={true} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
      </div>
    </div>
  )
}

// 11. Admin Employee Details Screen
function EmployeeDetailsScreen({ onNavigate }) {
  const [tab, setTab] = useState('attendance')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate && onNavigate('adm_employees')}>
            <Icons.BackArrow />
          </button>
          <span>Employee Details</span>
          <Icons.Edit />
        </div>

        {/* Profile Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#FFFFFF', margin: '10px 16px', borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <img src={AVATARS.amit} alt="Amit Kumar" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>Amit Kumar</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: '#EEF4FF', color: '#1E5AE6', padding: '1px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700 }}>EMP001</span>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Developer</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="swl-tab-pill-row" style={{ margin: '8px 16px' }}>
          <button className={`swl-tab-pill ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>
            Attendance
          </button>
          <button className={`swl-tab-pill ${tab === 'leave' ? 'active' : ''}`} onClick={() => setTab('leave')}>
            Leave History
          </button>
        </div>

        {/* Mini Calendar Widget */}
        <div style={{ background: '#FFFFFF', margin: '0 16px 10px 16px', padding: '8px 12px', borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <div className="swl-month-header" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
            <span>&lt;</span>
            <span>October 2026</span>
            <span>&gt;</span>
          </div>
          <div className="swl-cal-weekdays" style={{ fontSize: '0.6rem' }}>
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.65rem', marginTop: 6, fontWeight: 700 }}>
            <span style={{ color: '#10B981' }}>🟢 Present 22</span>
            <span style={{ color: '#F59E0B' }}>🟠 Late 1</span>
            <span style={{ color: '#EF4444' }}>🔴 Absent 3</span>
          </div>
        </div>

        {/* Recent Records */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Recent Records</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>10 Oct 2026</div>
                <div style={{ fontSize: '0.62rem', color: '#64748B' }}>09:12 AM - 06:00 PM</div>
              </div>
              <span className="swl-badge-pill green">Present</span>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>09 Oct 2026</div>
                <div style={{ fontSize: '0.62rem', color: '#64748B' }}>09:05 AM - 05:58 PM</div>
              </div>
              <span className="swl-badge-pill green">Present</span>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>08 Oct 2026</div>
                <div style={{ fontSize: '0.62rem', color: '#64748B' }}>09:20 AM - 06:02 PM</div>
              </div>
              <span className="swl-badge-pill red">Absent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('adm_employees')}>
          <Icons.Employees active={true} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
      </div>
    </div>
  )
}

// 12. Admin Leave Approvals Screen
function LeaveApprovalsScreen({ onNavigate }) {
  const [tab, setTab] = useState('Pending (3)')
  const [leaves, setLeaves] = useState([
    { id: 1, name: 'Neha Singh', type: 'Casual Leave', dates: '10 Oct - 11 Oct 2026', avatar: AVATARS.neha, status: 'Pending' },
    { id: 2, name: 'Rohit Verma', type: 'Sick Leave', dates: '09 Oct 2026', avatar: AVATARS.rohit, status: 'Pending' },
    { id: 3, name: 'Pooja Sharma', type: 'Earned Leave', dates: '12 Oct - 14 Oct 2026', avatar: AVATARS.pooja, status: 'Pending' },
  ])

  function handleAction(id, newStatus) {
    setLeaves(leaves.map(l => l.id === id ? { ...l, status: newStatus } : l))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
            <Icons.BackArrow />
          </button>
          <span>Leave Approvals</span>
          <Icons.Calendar />
        </div>

        {/* Tabs */}
        <div className="swl-tab-pill-row">
          {['Pending (3)', 'Approved', 'Rejected'].map(t => (
            <button
              key={t}
              className={`swl-tab-pill ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div className="swl-approvals-list">
          {leaves.map((item) => (
            <div key={item.id} className="swl-approval-card">
              <div className="swl-approval-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={item.avatar} alt={item.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>{item.name}</p>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748B' }}>{item.type}</p>
                    <p style={{ margin: 0, fontSize: '0.65rem', color: '#94A3B8' }}>{item.dates}</p>
                  </div>
                </div>
                <span className={`swl-badge-pill ${item.status === 'Approved' ? 'green' : item.status === 'Rejected' ? 'red' : 'yellow'}`}>
                  {item.status}
                </span>
              </div>

              {item.status === 'Pending' && (
                <div className="swl-approval-actions">
                  <button className="swl-btn-approve" onClick={() => handleAction(item.id, 'Approved')}>
                    Approve
                  </button>
                  <button className="swl-btn-reject" onClick={() => handleAction(item.id, 'Rejected')}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Admin Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_employees')}>
          <Icons.Employees active={false} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('adm_approvals')}>
          <Icons.Leave active={true} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
      </div>
    </div>
  )
}

// 13. Admin Reports & Export Screen
function ReportsScreen({ onNavigate }) {
  const [timeframe, setTimeframe] = useState('Monthly')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
            <Icons.BackArrow />
          </button>
          <span>Reports</span>
          <div style={{ width: 18 }} />
        </div>

        {/* Timeframe pill tabs */}
        <div className="swl-tab-pill-row">
          {['Daily', 'Weekly', 'Monthly'].map(t => (
            <button
              key={t}
              className={`swl-tab-pill ${timeframe === t ? 'active' : ''}`}
              onClick={() => setTimeframe(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="swl-month-header" style={{ fontSize: '0.85rem', margin: '4px 0 10px 0' }}>
          <span>&lt;</span>
          <span>October 2026</span>
          <span>&gt;</span>
        </div>

        {/* Stats Grid */}
        <div className="swl-reports-grid">
          <div className="swl-report-stat">
            <div style={{ fontSize: '0.62rem', color: '#64748B' }}>Total Days</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>31</div>
          </div>
          <div className="swl-report-stat">
            <div style={{ fontSize: '0.62rem', color: '#10B981' }}>Present</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10B981' }}>22</div>
          </div>
          <div className="swl-report-stat">
            <div style={{ fontSize: '0.62rem', color: '#EF4444' }}>Absent</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#EF4444' }}>4</div>
          </div>
          <div className="swl-report-stat">
            <div style={{ fontSize: '0.62rem', color: '#F59E0B' }}>Late</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F59E0B' }}>2</div>
          </div>
          <div className="swl-report-stat">
            <div style={{ fontSize: '0.62rem', color: '#06B6D4' }}>Leave</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#06B6D4' }}>3</div>
          </div>
        </div>

        {/* Download Report Button */}
        <div style={{ margin: '14px 16px' }}>
          <button className="swl-btn-login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icons.Download />
            <span>Download Report</span>
          </button>
        </div>

        {/* Export Format */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Export Format</div>
          <div className="swl-export-format-row">
            <div className="swl-export-fmt-btn">
              <span>📄</span> PDF
            </div>
            <div className="swl-export-fmt-btn">
              <span>📊</span> CSV
            </div>
          </div>
        </div>
      </div>

      {/* Admin Bottom Nav */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_employees')}>
          <Icons.Employees active={false} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('adm_reports')}>
          <Icons.Reports active={true} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_profile')}>
          <Icons.Profile active={false} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

// 14. Admin Profile Screen
function AdminProfileScreen({ onNavigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="swl-screen-top-nav">
          <button className="swl-nav-back-btn" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
            <Icons.BackArrow />
          </button>
          <span>Admin Profile</span>
          <div style={{ width: 18 }} />
        </div>

        <div className="swl-profile-hero" style={{ padding: '20px 16px 16px 16px' }}>
          <img
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400&q=80"
            alt="Administrator"
            className="swl-profile-avatar"
            style={{ width: 72, height: 72, border: '3px solid #1E5AE6' }}
          />
          <h3 style={{ margin: '8px 0 2px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
            Administrator
          </h3>
          <span style={{
            background: '#EEF4FF',
            color: '#1E5AE6',
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: '0.68rem',
            fontWeight: 800,
            display: 'inline-block',
            marginTop: 4
          }}>
            🛡️ Workspace Administrator
          </span>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: '#64748B' }}>admin@softwindlabs.com</p>
        </div>

        <div className="swl-menu-list">
          <div className="swl-menu-item" onClick={() => onNavigate && onNavigate('adm_dashboard')} style={{ cursor: 'pointer' }}>
            <div className="swl-menu-left">
              <Icons.Dashboard active={false} />
              <span>Admin Dashboard</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item" onClick={() => onNavigate && onNavigate('adm_employees')} style={{ cursor: 'pointer' }}>
            <div className="swl-menu-left">
              <Icons.Employees active={false} />
              <span>Manage Employees</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item" onClick={() => onNavigate && onNavigate('adm_reports')} style={{ cursor: 'pointer' }}>
            <div className="swl-menu-left">
              <Icons.Reports active={false} />
              <span>Attendance Reports</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item" style={{ cursor: 'pointer' }}>
            <div className="swl-menu-left">
              <Icons.Mail />
              <span>Official Admin Contact Desk</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item" style={{ cursor: 'pointer' }}>
            <div className="swl-menu-left">
              <Icons.Lock />
              <span>Change Password</span>
            </div>
            <Icons.RightChevron />
          </div>

          <div className="swl-menu-item logout" onClick={() => onNavigate && onNavigate('adm_login')} style={{ cursor: 'pointer' }}>
            <div className="swl-menu-left">
              <Icons.Logout />
              <span>Logout</span>
            </div>
            <Icons.RightChevron />
          </div>
        </div>
      </div>

      {/* Admin Bottom Nav with Profile active */}
      <div className="swl-mobile-nav">
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_dashboard')}>
          <Icons.Dashboard active={false} />
          <span>Dashboard</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_employees')}>
          <Icons.Employees active={false} />
          <span>Employees</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_approvals')}>
          <Icons.Leave active={false} />
          <span>Leave</span>
        </div>
        <div className="swl-nav-item" onClick={() => onNavigate && onNavigate('adm_reports')}>
          <Icons.Reports active={false} />
          <span>Reports</span>
        </div>
        <div className="swl-nav-item active" onClick={() => onNavigate && onNavigate('adm_profile')}>
          <Icons.Profile active={true} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  )
}

