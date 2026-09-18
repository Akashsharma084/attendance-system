import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DemoBanner from './DemoBanner'
import InstallPwaButton from './InstallPwaButton'

export default function NavBar() {
  const { profile, user, isAdmin, logout, updateUserProfile, isDemoMode } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [showProfileSheet, setShowProfileSheet] = useState(false)

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPhotoURL, setEditPhotoURL] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

  async function handleSignOut() {
    setShowProfileSheet(false)
    setIsEditingProfile(false)
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
    setIsEditingProfile(true)
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
        // High quality compact avatar: max 240x240
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
        setIsEditingProfile(false)
        setEditSuccess('')
      }, 1200)
    } catch (err) {
      setEditError(err.message || 'Failed to update profile. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  // Navigation Items with Instagram-style SVG Icons
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
        }
      ]

  const photoSrc = profile?.photoURL || user?.photoURL
  const displayName = profile?.name || user?.email?.split('@')[0] || 'User'
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

            <div className="sw-app-brand">
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
                  <span className="sw-tab-icon">{item.icon(isActive)}</span>
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
                setIsEditingProfile(false)
                setShowProfileSheet(true)
              }}
              title="View Account Profile & Sign Out"
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
                <span className="sw-user-role-label">{isAdmin ? 'Administrator' : 'Employee'}</span>
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
                <div className="sw-bottom-icon-wrap">
                  {item.icon(isActive)}
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
              setIsEditingProfile(false)
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

      {/* Profile Modal - Opens gracefully from Top */}
      {showProfileSheet && (
        <div className="modal-overlay" onClick={() => setShowProfileSheet(false)}>
          <div
            className="sw-profile-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sw-modal-top-bar">
              <span className="sw-modal-top-title">{isEditingProfile ? 'Edit Profile' : 'Profile & Settings'}</span>
              <button
                type="button"
                className="sw-modal-close-icon-btn"
                onClick={() => setShowProfileSheet(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {!isEditingProfile ? (
              /* VIEW MODE */
              <>
                <div className="sw-sheet-header">
                  <div className="sw-sheet-avatar-large">
                    {photoSrc ? (
                      <img src={photoSrc} alt={displayName} className="sw-avatar-img" />
                    ) : (
                      <span>{userInitial}</span>
                    )}
                    <span className="sw-sheet-online-dot" />
                  </div>
                  <h3 className="sw-sheet-title">{displayName}</h3>
                  <span className="sw-sheet-email">{user?.email}</span>
                  <div style={{ marginTop: '0.4rem' }}>
                    <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-employee'}`}>
                      {isAdmin ? '🛡️ Workforce Administrator' : '👤 Verified Employee'}
                    </span>
                  </div>
                </div>

                <div className="sw-sheet-info-card">
                  <div className="sw-sheet-info-row">
                    <span>Account Status</span>
                    <strong style={{ color: '#10b981' }}>Active &amp; Verified</strong>
                  </div>
                  {profile?.phone && (
                    <div className="sw-sheet-info-row">
                      <span>Phone Number</span>
                      <strong>{profile.phone}</strong>
                    </div>
                  )}
                  <div className="sw-sheet-info-row">
                    <span>System Portal</span>
                    <strong>Softwind Cloud v2.4</strong>
                  </div>
                  <div className="sw-sheet-info-row">
                    <span>Biometrics &amp; GPS</span>
                    <strong style={{ color: '#0284c7' }}>Enabled</strong>
                  </div>
                </div>

                <div className="sw-sheet-actions">
                  <button
                    type="button"
                    className="sw-btn-sheet-edit"
                    onClick={handleOpenEdit}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>Edit Profile &amp; Photo</span>
                  </button>

                  <button
                    type="button"
                    className="sw-btn-sheet-signout"
                    onClick={handleSignOut}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign Out of Portal</span>
                  </button>

                  <button
                    type="button"
                    className="sw-btn-sheet-close"
                    onClick={() => setShowProfileSheet(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              /* EDIT MODE */
              <form onSubmit={handleSaveProfile} className="sw-profile-edit-mode">
                <div className="sw-sheet-header">
                  {/* Photo Edit Wrapper */}
                  <div className="sw-photo-edit-container">
                    <div className="sw-sheet-avatar-large">
                      {editPhotoURL ? (
                        <img src={editPhotoURL} alt="Preview" className="sw-avatar-img" />
                      ) : (
                        <span>{userInitial}</span>
                      )}
                    </div>
                    <label className="sw-photo-upload-badge" title="Change Profile Photo">
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

                  <h3 className="sw-sheet-title" style={{ marginTop: '0.4rem' }}>Edit Profile</h3>
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
                    <label>Full Name</label>
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
                    <label>Phone Number</label>
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
                    id="save-profile-btn"
                  >
                    {editSaving ? (
                      <>
                        <span className="sw-btn-spinner-ring" />
                        <span>Saving Profile Changes…</span>
                      </>
                    ) : (
                      <>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="sw-btn-sheet-cancel"
                    disabled={editSaving}
                    onClick={() => {
                      setIsEditingProfile(false)
                      setEditError('')
                      setEditSuccess('')
                    }}
                  >
                    ✕ Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

