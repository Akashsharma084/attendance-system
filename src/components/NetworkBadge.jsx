export default function NetworkBadge({ network, networkType, isOffice, style }) {
  if (!network) {
    return <span className="empty-dash" style={style}>—</span>
  }

  const netLower = String(network).toLowerCase()
  const isWifi = isOffice || netLower.includes('wifi') || netLower.includes('wi-fi') || networkType === 'wifi'
  const isExternalWifi = netLower.includes('external')
  const isSim = netLower.includes('sim') || netLower.includes('cellular') || netLower.includes('mobile') || networkType === 'sim'

  let badgeClass = 'network-badge sim'
  let icon = '📱'

  if (isExternalWifi) {
    badgeClass = 'network-badge external'
    icon = '⚠️'
  } else if (isWifi) {
    badgeClass = 'network-badge wifi'
    icon = '📶'
  } else if (isSim) {
    badgeClass = 'network-badge sim'
    icon = '📱'
  }

  return (
    <span className={badgeClass} style={style} title={`Connected via ${network}`}>
      <span className="net-icon">{icon}</span>
      <span className="net-text">{network}</span>
    </span>
  )
}
