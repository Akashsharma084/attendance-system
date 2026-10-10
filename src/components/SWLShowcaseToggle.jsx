import { Link, useLocation } from 'react-router-dom'

export default function SWLShowcaseToggle() {
  const location = useLocation()
  const isShowcase = location.pathname === '/showcase'

  return (
    <div
      className="swl-floating-showcase-toggle"
      style={{
        position: 'fixed',
        bottom: '18px',
        right: '18px',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'auto'
      }}
    >
      <Link
        to={isShowcase ? '/login' : '/showcase'}
        title={isShowcase ? 'Switch to Live Interactive App' : 'Switch to Image Replica Design Showcase'}
        style={{
          background: isShowcase
            ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #1E5AE6 0%, #1041B7 100%)',
          color: '#FFFFFF',
          padding: '9px 16px',
          borderRadius: '9999px',
          fontSize: '0.8rem',
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          border: '2px solid rgba(255, 255, 255, 0.9)',
          transition: 'all 0.2s ease',
          letterSpacing: '-0.01em',
          backdropFilter: 'blur(4px)'
        }}
      >
        <span style={{ fontSize: '1rem' }}>{isShowcase ? '🚀' : '🖼️'}</span>
        <span className="swl-toggle-label">{isShowcase ? 'Live App' : 'UI Showcase'}</span>
      </Link>
    </div>
  )
}
