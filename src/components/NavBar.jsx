import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLeaves } from '../services/leaveService'
import DemoBanner from './DemoBanner'
import InstallPwaButton from './InstallPwaButton'

export default function NavBar() {
  const { profile, user, isAdmin, logout, updateUserProfile, changePassword, isDemoMode } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [showProfileSheet, setShowProfileSheet] = useState(false)
  const [profileView, setProfileView] = useState('menu') // 'menu' | 'edit' | 'password' | 'contact'
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    const unsubscribe = subscribeLeaves({
      onUpdate: (list) => {
        const pending = list.filter((l) => l.status === 'pending').length
        setPendingLeavesCount(pending)
      },
      onError: () => {}
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [isAdmin])

  // Profile Edit State
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPhotoURL, setEditPhotoURL] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

  // Change Password State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')

  // Contact Admin State
  const [contactCategory, setContactCategory] = useState('Punch correction')
  const [contactMsg, setContactMsg] = useState('')
  const [contactSaving, setContactSaving] = useState(false)
  const [contactSuccess, setContactSuccess] = useState(false)
  const [contactScreenshot, setContactScreenshot] = useState(null)
  const [contactScreenshotName, setContactScreenshotName] = useState('')
  const [selectedSupportPhoto, setSelectedSupportPhoto] = useState(null)

  function handleContactScreenshotUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG) for the screenshot.')
      return
    }
    setContactScreenshotName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 1200
        let w = img.width
        let h = img.height
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          } else {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        setContactScreenshot(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  async function handleSignOut() {
    setShowProfileSheet(false)
    setProfileView('menu')
    await logout()
    navigate('/login')
  }

  function handleGoBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate(isAdmin ? '/admin' : '/')
    }
  }

  function handleOpenEdit() {
    setEditName(profile?.name || user?.displayName || user?.email?.split('@')[0] || '')
    setEditPhone(profile?.phone || '')
    setEditPhotoURL(profile?.photoURL || user?.photoURL || '')
    setEditError('')
    setEditSuccess('')
    setProfileView('edit')
  }

  function handleOpenPassword() {
    setNewPassword('')
    setConfirmPassword('')
    setPwdError('')
    setPwdSuccess('')
    setProfileView('password')
  }

  function handleOpenContact() {
    setContactMsg('')
    setContactSuccess(false)
    setProfileView('contact')
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setEditError('Please select a valid image file.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 240
        let width = img.width
        let height = img.height
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setEditPhotoURL(compressedDataUrl)
        setEditError('')
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    if (!editName.trim()) {
      setEditError('Name cannot be empty.')
      return
    }
    setEditSaving(true)
    setEditError('')
    setEditSuccess('')
    try {
      await updateUserProfile({
        name: editName.trim(),
        photoURL: editPhotoURL || null,
        phone: editPhone.trim()
      })
      setEditSuccess('✅ Profile updated successfully!')
      setTimeout(() => {
        setProfileView('menu')
        setEditSuccess('')
      }, 1100)
    } catch (err) {
      setEditError(err.message || 'Failed to update profile. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPwdError('')
    setPwdSuccess('')

    if (!newPassword) {
      setPwdError('Please enter a new password.')
      return
    }
    if (newPassword.length < 6) {
      setPwdError('Password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match. Please recheck.')
      return
    }

    setPwdSaving(true)
    try {
      const res = await changePassword(newPassword)
      if (res?.requiresReauth) {
        setPwdSuccess(res.message)
      } else {
        setPwdSuccess('🔒 Password updated successfully! Your account credentials are now secured.')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          setProfileView('menu')
          setPwdSuccess('')
        }, 1500)
      }
    } catch (err) {
      setPwdError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setPwdSaving(false)
    }
  }

  async function handleContactSubmit(e) {
    e.preventDefault()
    if (!contactMsg.trim()) return
    setContactSaving(true)

    try {
      const existing = JSON.parse(localStorage.getItem('punch_admin_messages') || '[]')
      existing.unshift({
        id: 'msg-' + Date.now(),
        senderName: profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Employee',
        senderEmail: user?.email,
        category: contactCategory,
        message: contactMsg.trim(),
        screenshotUrl: contactScreenshot || null,
        status: 'open',
        createdAt: new Date().toISOString()
      })
      localStorage.setItem('punch_admin_messages', JSON.stringify(existing.slice(0, 50)))
    } catch (e) {
      console.warn('Could not save support message to local store:', e)
    }

    setTimeout(() => {
      setContactSaving(false)
      setContactSuccess(true)
      setContactMsg('')
      setContactScreenshot(null)
      setContactScreenshotName('')
    }, 600)
  }

  // Navigation Items
  const navItems = isAdmin
    ? [
        {
          to: '/admin',
          label: 'Attendance',
          fullLabel: 'Live Attendance',
          icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '1.5' : '2'}>
              <rect width="18" height="18" x="3" y="3" rx="3" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          )
        },
        {
          to: '/admin/users',
          label: 'Team',
          fullLabel: 'Manage Team',
          icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '1.5' : '2'}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          )
        },
        {
          to: '/admin/leaves',
          label: 'Leaves',
          fullLabel: 'Leave Requests',
          badge: pendingLeavesCount > 0 ? pendingLeavesCount : null,
          icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '1.5' : '2'}>
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" />
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <path d="m9 16 2 2 4-4" />
            </svg>
          )
        }
      ]
    : [
        {
          to: '/',
          label: 'Punch',
          fullLabel: 'Punch Attendance',
          icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '1.5' : '2'}>
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          )
        },
        {
          to: '/dashboard',
          label: 'History',
          fullLabel: 'My Records',
          icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '1.5' : '2'}>
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
              <path d="m9 16 2 2 4-4" />
            </svg>
          )
        },
        {
          to: '/leaves',
          label: 'Leaves',
          fullLabel: 'My Leaves',
          icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? '1.5' : '2'}>
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" />
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <circle cx="12" cy="15" r="2" />
            </svg>
          )
        }
      ]

  const photoSrc = profile?.photoURL || user?.photoURL
  const displayName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'User'
  const userInitial = displayName.charAt(0).toUpperCase()

  return (
    <>
      {isDemoMode && <DemoBanner />}

      {/* Top Header Bar (Desktop & Mobile) */}
      <header className="sw-app-header">
        <div className="sw-app-header-inner">
          {/* Top Left: Back Button + Brand Logo */}
          <div className="sw-header-left-group">
            <button
              type="button"
              className="sw-nav-back-btn"
              onClick={handleGoBack}
              aria-label="Go Back"
              title="Go back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="sw-app-brand" style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <img src="/icon-192.png" alt="Softwind Labs Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain', background: '#ffffff', padding: '2px', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)' }} />
              <span className="sw-brand-text">
                SOFTWIND<span className="sw-brand-highlight">.LABS</span>
              </span>
              <span className="sw-brand-role-tag">{isAdmin ? 'Admin' : 'Portal'}</span>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <div className="sw-desktop-nav-items">
            {navItems.map((item) => {
              const isActive = pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`sw-nav-tab-desktop ${isActive ? 'active' : ''}`}
                >
                  <span className="sw-tab-icon" style={{ position: 'relative' }}>
                    {item.icon(isActive)}
                    {item.badge ? <span className="sw-nav-badge">{item.badge}</span> : null}
                  </span>
                  <span className="sw-tab-label">{item.fullLabel}</span>
                  {isActive && <span className="sw-active-indicator" />}
                </Link>
              )
            })}
          </div>

          {/* Header Right Actions */}
          <div className="sw-header-actions">
            <InstallPwaButton className="sw-header-pwa-btn" />

            {/* User Profile Trigger Button */}
            <button
              type="button"
              className="sw-user-profile-btn"
              onClick={() => {
                setProfileView('menu')
                setShowProfileSheet(true)
              }}
              title="View Account Profile & Settings"
            >
              <div className="sw-avatar-circle">
                {photoSrc ? (
                  <img src={photoSrc} alt={displayName} className="sw-avatar-img" />
                ) : (
                  <span>{userInitial}</span>
                )}
                <span className="sw-online-pip" />
              </div>
              <div className="sw-user-details-desktop">
                <span className="sw-user-name">{displayName}</span>
                <span className="sw-user-role-label">{isAdmin ? 'Administrator' : 'Verified Staff'}</span>
              </div>
            </button>

            {/* Desktop Direct Sign Out */}
            <button
              type="button"
              className="sw-desktop-signout-btn"
              onClick={handleSignOut}
              title="Sign Out"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Instagram-Style Mobile Bottom App Bar (Dock) */}
      <nav className="sw-insta-bottom-bar" aria-label="Mobile Navigation Bar">
        <div className="sw-bottom-bar-inner">
          {navItems.map((item) => {
            const isActive = pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}
                className={`sw-bottom-tab ${isActive ? 'active' : ''}`}
              >
                <div className="sw-bottom-icon-wrap" style={{ position: 'relative' }}>
                  {item.icon(isActive)}
                  {item.badge ? <span className="sw-bottom-nav-badge">{item.badge}</span> : null}
                  {isActive && <span className="sw-bottom-active-dot" />}
                </div>
                <span className="sw-bottom-label">{item.label}</span>
              </Link>
            )
          })}

          {/* Profile / Account Tab (Instagram Style) */}
          <button
            type="button"
            className={`sw-bottom-tab ${showProfileSheet ? 'active' : ''}`}
            onClick={() => {
              setProfileView('menu')
              setShowProfileSheet(true)
            }}
          >
            <div className="sw-bottom-icon-wrap">
              <div className={`sw-bottom-avatar ${showProfileSheet ? 'ring-active' : ''}`}>
                {photoSrc ? (
                  <img src={photoSrc} alt={displayName} className="sw-avatar-img" />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>
              {showProfileSheet && <span className="sw-bottom-active-dot" />}
            </div>
            <span className="sw-bottom-label">Profile</span>
          </button>
        </div>
      </nav>

      {/* Modern App-Like Profile Modal Dialog */}
      {showProfileSheet && (
        <div className="modal-overlay" onClick={() => setShowProfileSheet(false)}>
          <div
            className="sw-profile-sheet sw-app-profile-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header with Contextual Back Navigation */}
            <div className="sw-modal-top-bar">
              {profileView !== 'menu' ? (
                <button
                  type="button"
                  className="sw-modal-sub-back-btn"
                  onClick={() => setProfileView('menu')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Back</span>
                </button>
              ) : (
                <span className="sw-modal-top-title">Account Profile</span>
              )}

              {profileView !== 'menu' && (
                <span className="sw-modal-top-title">
                  {profileView === 'edit' && 'Edit Profile'}
                  {profileView === 'password' && 'Change Password'}
                  {profileView === 'contact' && 'Contact Admin'}
                </span>
              )}

              <button
                type="button"
                className="sw-modal-close-icon-btn"
                onClick={() => setShowProfileSheet(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* ================= VIEW 1: APP PROFILE MENU (DEFAULT) ================= */}
            {profileView === 'menu' && (
              <div className="sw-app-profile-content">
                {/* User Identity Header Card */}
                <div className="sw-app-user-header">
                  <div className="sw-app-avatar-wrap">
                    {photoSrc ? (
                      <img src={photoSrc} alt={displayName} className="sw-app-avatar-img" />
                    ) : (
                      <span className="sw-app-avatar-fallback">{userInitial}</span>
                    )}
                    <span className="sw-app-online-badge" />
                  </div>

                  <div className="sw-app-user-meta">
                    <h3 className="sw-app-user-name">{displayName}</h3>
                    <span className="sw-app-user-email">{user?.email}</span>
                    <div className="sw-app-badge-row">
                      <span className={`sw-app-role-pill ${isAdmin ? 'admin' : 'employee'}`}>
                        {isAdmin ? '🛡️ Administrator' : '👤 Verified Staff'}
                      </span>
                      <span className="sw-app-status-pill">
                        <span className="sw-app-dot-green" /> Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section Group 1: Account & Security */}
                <div className="sw-app-menu-section">
                  <span className="sw-app-section-title">ACCOUNT &amp; SECURITY</span>
                  <div className="sw-app-menu-group">
                    <button
                      type="button"
                      className="sw-app-menu-item"
                      onClick={handleOpenEdit}
                    >
                      <div className="sw-app-menu-icon-box blue">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="sw-app-menu-info">
                        <span className="sw-app-menu-label">Personal Information</span>
                        <span className="sw-app-menu-sub">Name, profile photo &amp; phone</span>
                      </div>
                      <span className="sw-app-chevron">›</span>
                    </button>

                    <button
                      type="button"
                      className="sw-app-menu-item"
                      onClick={handleOpenPassword}
                    >
                      <div className="sw-app-menu-icon-box amber">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div className="sw-app-menu-info">
                        <span className="sw-app-menu-label">Change Password</span>
                        <span className="sw-app-menu-sub">Update account security password</span>
                      </div>
                      <span className="sw-app-chevron">›</span>
                    </button>
                  </div>
                </div>

                {/* Section Group 2: Support & Operations */}
                <div className="sw-app-menu-section">
                  <span className="sw-app-section-title">WORKFORCE SUPPORT</span>
                  <div className="sw-app-menu-group">
                    <button
                      type="button"
                      className="sw-app-menu-item"
                      onClick={handleOpenContact}
                    >
                      <div className="sw-app-menu-icon-box teal">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div className="sw-app-menu-info">
                        <span className="sw-app-menu-label">Contact Admin / Support</span>
                        <span className="sw-app-menu-sub">Official HR &amp; Admin email desk</span>
                      </div>
                      <span className="sw-app-chevron">›</span>
                    </button>

                    <div className="sw-app-menu-item non-clickable">
                      <div className="sw-app-menu-icon-box green">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                      <div className="sw-app-menu-info">
                        <span className="sw-app-menu-label">Biometrics &amp; Geofence</span>
                        <span className="sw-app-menu-sub">Camera selfie &amp; GPS verification</span>
                      </div>
                      <span className="sw-app-status-badge">Enabled</span>
                    </div>
                  </div>
                </div>

                {/* Section Group 3: Session Actions */}
                <div className="sw-app-menu-section">
                  <div className="sw-app-menu-group">
                    <button
                      type="button"
                      className="sw-app-menu-item danger"
                      onClick={handleSignOut}
                    >
                      <div className="sw-app-menu-icon-box rose">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                      </div>
                      <div className="sw-app-menu-info">
                        <span className="sw-app-menu-label" style={{ color: '#ef4444' }}>Sign Out</span>
                        <span className="sw-app-menu-sub">Safely end current portal session</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* App Version Footer */}
                <div className="sw-app-version-footer">
                  <span>Softwind Attendance Cloud • v2.4.0</span>
                </div>
              </div>
            )}

            {/* ================= VIEW 2: EDIT PROFILE SUB-SCREEN ================= */}
            {profileView === 'edit' && (
              <form onSubmit={handleSaveProfile} className="sw-profile-edit-mode">
                <div className="sw-sheet-header">
                  <div className="sw-photo-edit-container">
                    <div className="sw-sheet-avatar-large">
                      {editPhotoURL ? (
                        <img src={editPhotoURL} alt="Preview" className="sw-avatar-img" />
                      ) : (
                        <span>{userInitial}</span>
                      )}
                    </div>
                    <label className="sw-photo-upload-badge" title="Upload new photo">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  {editPhotoURL && (
                    <button
                      type="button"
                      className="sw-photo-remove-btn"
                      onClick={() => setEditPhotoURL('')}
                    >
                      Remove Photo
                    </button>
                  )}

                  <h3 className="sw-sheet-title" style={{ marginTop: '0.4rem' }}>{displayName}</h3>
                  <span className="sw-sheet-email">{user?.email}</span>
                </div>

                {editSuccess && (
                  <div className="form-notice" style={{ margin: '0.75rem 0' }}>
                    {editSuccess}
                  </div>
                )}
                {editError && (
                  <div className="form-error" style={{ margin: '0.75rem 0' }}>
                    {editError}
                  </div>
                )}

                <div className="sw-edit-fields-group">
                  <div className="sw-input-group">
                    <label>Full Display Name</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your full name"
                      className="sw-input"
                    />
                  </div>

                  <div className="sw-input-group" style={{ marginTop: '0.85rem' }}>
                    <label>Phone Number (Optional)</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="sw-input"
                    />
                  </div>
                </div>

                <div className="sw-sheet-actions" style={{ marginTop: '1.25rem' }}>
                  <button
                    type="submit"
                    className="sw-btn-save-profile"
                    disabled={editSaving}
                  >
                    {editSaving ? (
                      <>
                        <span className="sw-btn-spinner-ring" />
                        <span>Saving Profile…</span>
                      </>
                    ) : (
                      <>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="sw-btn-sheet-cancel"
                    disabled={editSaving}
                    onClick={() => setProfileView('menu')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* ================= VIEW 3: CHANGE PASSWORD SUB-SCREEN ================= */}
            {profileView === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="sw-app-subview-content">
                <div className="sw-subview-banner-card amber">
                  <div className="sw-subview-banner-icon">🔒</div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Update Account Password</h4>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', opacity: 0.85 }}>
                      Choose a secure password of at least 6 characters.
                    </p>
                  </div>
                </div>

                {pwdSuccess && (
                  <div className="form-notice" style={{ margin: '0.85rem 0' }}>
                    {pwdSuccess}
                  </div>
                )}
                {pwdError && (
                  <div className="form-error" style={{ margin: '0.85rem 0' }}>
                    ⚠️ {pwdError}
                  </div>
                )}

                <div className="sw-edit-fields-group" style={{ marginTop: '1rem' }}>
                  <div className="sw-input-group">
                    <label>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="sw-input"
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        className="sw-pwd-toggle-btn"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                      >
                        {showNewPassword ? '👁️' : '🔒'}
                      </button>
                    </div>
                  </div>

                  <div className="sw-input-group" style={{ marginTop: '0.85rem' }}>
                    <label>Confirm New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="sw-input"
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        className="sw-pwd-toggle-btn"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? '👁️' : '🔒'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sw-sheet-actions" style={{ marginTop: '1.25rem' }}>
                  <button
                    type="submit"
                    className="sw-btn-save-profile"
                    disabled={pwdSaving}
                  >
                    {pwdSaving ? (
                      <>
                        <span className="sw-btn-spinner-ring" />
                        <span>Updating Password…</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Confirm &amp; Update Password</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="sw-btn-sheet-cancel"
                    disabled={pwdSaving}
                    onClick={() => setProfileView('menu')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* ================= VIEW 4: CONTACT ADMIN SUB-SCREEN ================= */}
            {profileView === 'contact' && (
              <div className="sw-app-subview-content">
                {/* Admin Contact Email Card Only */}
                <div className="sw-contact-admin-grid">
                  <div className="sw-contact-card" style={{ padding: '1rem', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderColor: '#bae6fd' }}>
                    <div className="sw-contact-card-icon" style={{ fontSize: '1.75rem' }}>✉️</div>
                    <div className="sw-contact-card-body">
                      <span className="sw-contact-card-title" style={{ color: '#0369a1', fontWeight: 800 }}>Official HR &amp; Admin Email</span>
                      <strong className="sw-contact-card-value" style={{ fontSize: '0.98rem', color: '#0c4a6e' }}>admin@softwind.com</strong>
                      <span className="sw-contact-card-sub" style={{ color: '#0284c7' }}>Replies usually within 24 hours</span>
                    </div>
                    <a
                      href={`mailto:admin@softwind.com?subject=Attendance%20Portal%20Inquiry%20-%20${encodeURIComponent(displayName)}`}
                      className="sw-contact-action-btn"
                      title="Send Direct Email"
                      style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                    >
                      ✉️ Email Us
                    </a>
                  </div>
                </div>

                {/* Send In-App Query to Admin */}
                <form onSubmit={handleContactSubmit} className="sw-contact-form-wrap">
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.92rem', color: '#0f172a' }}>
                    📝 Send Quick Query to Admin
                  </h4>

                  {contactSuccess ? (
                    <div className="sw-contact-success-card">
                      <span style={{ fontSize: '1.5rem' }}>✓</span>
                      <div>
                        <strong>Message Sent to Administrator!</strong>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                          The administration team has received your inquiry and will review it shortly.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="sw-btn-sheet-cancel"
                        style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => setContactSuccess(false)}
                      >
                        Send Another Note
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="sw-input-group">
                        <label>Category</label>
                        <select
                          value={contactCategory}
                          onChange={(e) => setContactCategory(e.target.value)}
                          className="sw-input"
                        >
                          <option value="Punch correction">Punch / Timing Correction</option>
                          <option value="Leave inquiry">Leave / Holiday Balance Query</option>
                          <option value="Biometric error">Biometric / Camera Issue</option>
                          <option value="Account details">Account / Profile Details Change</option>
                          <option value="General support">General Support / Feedback</option>
                        </select>
                      </div>

                      <div className="sw-input-group" style={{ marginTop: '0.75rem' }}>
                        <label>Your Message</label>
                        <textarea
                          rows={3}
                          required
                          value={contactMsg}
                          onChange={(e) => setContactMsg(e.target.value)}
                          placeholder="Describe your issue or request clearly for the admin team…"
                          className="sw-input"
                          style={{ resize: 'vertical' }}
                        />
                      </div>

                      {/* Screenshot Upload Option */}
                      <div className="sw-input-group" style={{ marginTop: '0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                          <span>Attach Screenshot / Photo of Problem</span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(Optional)</span>
                        </label>
                        {!contactScreenshot ? (
                          <div style={{ marginTop: '4px' }}>
                            <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
                              <span>📸 Upload Screenshot</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleContactScreenshotUpload}
                                style={{ display: 'none' }}
                              />
                            </label>
                          </div>
                        ) : (
                          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(15, 23, 42, 0.7)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                            <img
                              src={contactScreenshot}
                              alt="Problem screenshot"
                              style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #38bdf8' }}
                              onClick={() => setSelectedSupportPhoto(contactScreenshot)}
                              title="Click to zoom screenshot"
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                ✓ {contactScreenshotName || 'Screenshot attached'}
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedSupportPhoto(contactScreenshot)}
                                style={{ background: 'none', border: 'none', padding: 0, color: '#38bdf8', fontSize: '0.74rem', cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                View full image
                              </button>
                            </div>
                            <button
                              type="button"
                              className="btn-ghost"
                              style={{ color: '#ef4444', fontSize: '0.78rem', padding: '2px 6px' }}
                              onClick={() => {
                                setContactScreenshot(null)
                                setContactScreenshotName('')
                              }}
                            >
                              ✕ Remove
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="sw-sheet-actions" style={{ marginTop: '1rem' }}>
                        <button
                          type="submit"
                          className="sw-btn-save-profile"
                          disabled={contactSaving || !contactMsg.trim()}
                        >
                          {contactSaving ? (
                            <>
                              <span className="sw-btn-spinner-ring" />
                              <span>Submitting…</span>
                            </>
                          ) : (
                            <>
                              <span>📤 Submit Message to Admin</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </form>

                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="sw-btn-sheet-cancel"
                    onClick={() => setProfileView('menu')}
                  >
                    Back to Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Support Photo Zoom Modal */}
      {selectedSupportPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedSupportPhoto(null)} style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '560px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Problem Screenshot</h2>
              <button className="btn-close" onClick={() => setSelectedSupportPhoto(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '1rem' }}>
              <img
                src={selectedSupportPhoto}
                alt="Enlarged screenshot"
                style={{ width: '100%', maxHeight: '460px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => setSelectedSupportPhoto(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
