import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'

export default function NotificationBellMenu() {
  const { isAdmin } = useAuth()
  const {
    notifications,
    unreadCount,
    pushPermission,
    requestPushPermission,
    markAllAsRead,
    clearAllNotifications
  } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  function handleToggle() {
    setIsOpen((prev) => {
      const next = !prev
      if (next && unreadCount > 0) {
        markAllAsRead()
      }
      return next
    })
  }

  function handleItemClick(notif) {
    setIsOpen(false)
    navigate('/dashboard?tab=team')
  }

  return (
    <div className="sw-bell-menu-container" ref={menuRef}>
      <button
        type="button"
        className={`sw-bell-trigger-btn ${unreadCount > 0 ? 'has-unread' : ''} ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        title="Live Team Arrivals & Notifications"
        aria-label="View notifications"
        id="notification-bell-btn"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="sw-bell-badge-pill" id="notification-unread-count">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="sw-bell-dropdown" role="dialog" aria-label="Notifications list">
          {/* Header */}
          <div className="sw-bell-head">
            <div className="sw-bell-title-wrap">
              <span className="sw-bell-title">Staff Activity Feed</span>
              <span className="sw-bell-count-chip">{notifications.length} today</span>
            </div>

            <div className="sw-bell-actions-top">
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="sw-bell-clear-btn"
                  onClick={clearAllNotifications}
                  title="Clear all alerts"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Web Push Prompt Bar */}
          <div className="sw-bell-push-bar">
            {pushPermission === 'granted' ? (
              <div className="sw-push-status granted">
                <span className="sw-push-dot" />
                <span>Web Push Active (Instant alerts on screen)</span>
              </div>
            ) : pushPermission === 'denied' ? (
              <div className="sw-push-status denied">
                <span>⚠️ Browser alerts blocked in settings</span>
              </div>
            ) : (
              <button
                type="button"
                className="sw-push-enable-btn"
                onClick={requestPushPermission}
              >
                <span>🔔 Enable Browser Push Alerts</span>
              </button>
            )}
          </div>

          {/* Activity Feed List */}
          <div className="sw-bell-list">
            {notifications.length === 0 ? (
              <div className="sw-bell-empty">
                <div className="sw-bell-empty-icon">🔔</div>
                <div className="sw-bell-empty-title">No arrivals recorded yet</div>
                <p className="sw-bell-empty-sub">
                  As soon as any employee punches in today, you will receive an instant notification here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isIn = item.type === 'in'
                return (
                  <div
                    key={item.id}
                    className={`sw-bell-item ${!item.read ? 'unread' : ''}`}
                    onClick={() => handleItemClick(item)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="sw-bell-item-avatar">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.name} className="sw-avatar-img" />
                      ) : (
                        <span>{item.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                      )}
                      <span className={`sw-item-pip ${isIn ? 'in' : 'out'}`} />
                    </div>

                    <div className="sw-bell-item-body">
                      <div className="sw-bell-item-name-row">
                        <span className="sw-bell-item-name">{item.name}</span>
                        <span className="sw-bell-item-time">{item.time}</span>
                      </div>
                      <div className="sw-bell-item-msg">
                        {isIn ? (
                          <span style={{ color: '#10b981' }}>🟢 Arrived &amp; checked in</span>
                        ) : (
                          <span style={{ color: '#f43f5e' }}>🏁 Completed shift &amp; checked out</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="sw-bell-footer">
            <button
              type="button"
              className="sw-bell-view-team-btn"
              onClick={() => {
                setIsOpen(false)
                navigate('/dashboard?tab=team')
              }}
            >
              👥 View Team Attendance &amp; Arrivals ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
