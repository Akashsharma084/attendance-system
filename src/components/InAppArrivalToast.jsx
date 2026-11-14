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
    if (isAdmin) {
      navigate('/admin')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <aside
      className="sw-arrival-toast-wrapper"
      role="status"
      aria-live="polite"
      aria-label="Staff arrival notification"
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        width: 'calc(100% - 24px)',
        maxWidth: 420,
        pointerEvents: 'auto',
        animation: 'swlToastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div
        className={`sw-arrival-toast-card ${isCheckIn ? 'check-in' : 'check-out'}`}
        onClick={handleClick}
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 16,
          border: isCheckIn ? '1.5px solid #10B981' : '1.5px solid #F59E0B',
          boxShadow: isCheckIn
            ? '0 16px 36px -6px rgba(16, 185, 129, 0.25), 0 4px 12px rgba(15, 23, 42, 0.12)'
            : '0 16px 36px -6px rgba(245, 158, 11, 0.25), 0 4px 12px rgba(15, 23, 42, 0.12)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          boxSizing: 'border-box'
        }}
      >
        {/* Avatar Box */}
        <div
          className="sw-toast-avatar-box"
          style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}
        >
          {activeToast.photoUrl ? (
            <img
              src={activeToast.photoUrl}
              alt={activeToast.name}
              className="sw-toast-avatar-img"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                objectFit: 'cover',
                border: isCheckIn ? '2px solid #10B981' : '2px solid #F59E0B'
              }}
            />
          ) : (
            <div
              className="sw-toast-avatar-initial"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: isCheckIn
                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                color: '#FFFFFF',
                fontSize: '1.1rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              {activeToast.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <span
            className={`sw-toast-status-pip ${isCheckIn ? 'online' : 'offline'}`}
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: isCheckIn ? '#10B981' : '#F59E0B',
              border: '2px solid #FFFFFF'
            }}
          />
        </div>

        {/* Content */}
        <div className="sw-toast-content" style={{ flex: 1, minWidth: 0 }}>
          <div
            className="sw-toast-header-row"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}
          >
            <span
              className="sw-toast-badge"
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                color: isCheckIn ? '#065F46' : '#92400E',
                background: isCheckIn ? '#D1FAE5' : '#FEF3C7',
                padding: '1px 8px',
                borderRadius: 999,
                letterSpacing: '0.02em'
              }}
            >
              {activeToast.isSelf
                ? (isCheckIn ? '🟢 Attendance Punched' : '🏁 Check-Out Recorded')
                : (isCheckIn ? '🟢 Staff Arrived' : '🏁 Staff Departure')}
            </span>
            <span className="sw-toast-time" style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B' }}>
              {activeToast.time}
            </span>
          </div>

          <div
            className="sw-toast-title"
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#0F172A',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            <strong>{activeToast.name}</strong> {isCheckIn ? 'just punched in!' : 'punched out.'}
          </div>

          <div
            className="sw-toast-sub"
            style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 1 }}
          >
            Tap to view live attendance ›
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          className="sw-toast-close-btn"
          onClick={(e) => {
            e.stopPropagation()
            dismissToast()
          }}
          title="Dismiss alert"
          aria-label="Close notification"
          style={{
            background: '#F1F5F9',
            border: 'none',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748B',
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          ✕
        </button>
      </div>
    </aside>
  )
}
