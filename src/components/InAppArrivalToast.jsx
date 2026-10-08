import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'

export default function InAppArrivalToast() {
  const { isAdmin } = useAuth()
  const { activeToast, dismissToast } = useNotifications()
  const navigate = useNavigate()

  if (!activeToast) return null

  const isCheckIn = activeToast.type === 'in'

  function handleClick() {
    dismissToast()
    navigate('/dashboard?tab=team')
  }

  return (
    <aside
      className="sw-arrival-toast-wrapper"
      role="status"
      aria-live="polite"
      aria-label="Staff arrival notification"
    >
      <div
        className={`sw-arrival-toast-card ${isCheckIn ? 'check-in' : 'check-out'}`}
        onClick={handleClick}
      >
        <div className="sw-toast-avatar-box">
          {activeToast.photoUrl ? (
            <img
              src={activeToast.photoUrl}
              alt={activeToast.name}
              className="sw-toast-avatar-img"
            />
          ) : (
            <div className="sw-toast-avatar-initial">
              {activeToast.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <span className={`sw-toast-status-pip ${isCheckIn ? 'online' : 'offline'}`} />
        </div>

        <div className="sw-toast-content">
          <div className="sw-toast-header-row">
            <span className="sw-toast-badge">
              {isCheckIn ? '🟢 Staff Arrived' : '🏁 Staff Departure'}
            </span>
            <span className="sw-toast-time">{activeToast.time}</span>
          </div>
          <div className="sw-toast-title">
            <strong>{activeToast.name}</strong> {isCheckIn ? 'just punched in!' : 'punched out.'}
          </div>
          <div className="sw-toast-sub">
            Tap to view live team attendance ›
          </div>
        </div>

        <button
          type="button"
          className="sw-toast-close-btn"
          onClick={(e) => {
            e.stopPropagation()
            dismissToast()
          }}
          title="Dismiss alert"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </aside>
  )
}
