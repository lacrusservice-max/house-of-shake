// Animated SVG icon library — House of Shake
// Replaces all emoji across the app with professional animated icons

const b = (s) => ({ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...s });

export function CoffeeIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      {animated && <>
        <path d="M8.5 7C8.5 7 7.5 5.5 8.5 4C9.5 5.5 8.5 7 8.5 7Z" fill={color} opacity="0.65"
          style={{ animation: 'steamFloat 2s ease-in-out infinite', transformOrigin: '8.5px 5.5px' }} />
        <path d="M12 6C12 6 11 4.5 12 3C13 4.5 12 6 12 6Z" fill={color} opacity="0.65"
          style={{ animation: 'steamFloat 2s ease-in-out infinite 0.6s', transformOrigin: '12px 4.5px' }} />
      </>}
      <path d="M6 9.5h12l-1.5 8.5a1.5 1.5 0 01-1.5 1.5H9a1.5 1.5 0 01-1.5-1.5L6 9.5z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 11h1.5a1.5 1.5 0 010 3H18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 21.5h16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IceIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <g style={animated ? { animation: 'iceRotate 8s linear infinite', transformOrigin: '12px 12px' } : undefined}>
        <line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5.1" y1="5.1" x2="18.9" y2="18.9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="18.9" y1="5.1" x2="5.1" y2="18.9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="4" x2="12" y2="2" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        <line x1="14" y1="4" x2="12" y2="2" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        <line x1="10" y1="20" x2="12" y2="22" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        <line x1="14" y1="20" x2="12" y2="22" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function LeafIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M3 21s6-8 15-6c-1 4-5 7-9 7-2 0-4-.5-6-1z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
        style={animated ? { animation: 'leafSway 2.5s ease-in-out infinite', transformOrigin: '12px 17px' } : undefined} />
      <path d="M3 21L9 15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 13c2-3 5-5 7-4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function BerryIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <circle cx="9" cy="14" r="5" stroke={color} strokeWidth="1.5"
        style={animated ? { animation: 'starPulse 2s ease-in-out infinite', transformOrigin: '9px 14px' } : undefined} />
      <circle cx="16" cy="10" r="4" stroke={color} strokeWidth="1.5" />
      <path d="M9 9C9 6 10.5 4.5 12 4.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 9C7 7 7 5 8 4.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ChaiIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      {animated && (
        <path d="M11 6C11 6 10 4.5 11 3C12 4.5 11 6 11 6Z" fill={color} opacity="0.65"
          style={{ animation: 'steamFloat 2s ease-in-out infinite', transformOrigin: '11px 4.5px' }} />
      )}
      <path d="M5 8h14v2a7 7 0 01-14 0V8z" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M5 8V7a7 7 0 0114 0v1" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M19 10c1.5 0 3-.5 3-2s-1.5-2-3-2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 18.5h14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 21.5h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ShakeIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M8 21h8l1.5-13h-11L8 21z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"
        style={animated ? { animation: 'shakeFill 2s ease-in-out infinite', transformOrigin: '12px 15px' } : undefined} />
      <path d="M6.5 8h11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 8V5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.5 8V5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.5 5L16.5 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function PastryIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M4 17c0-4.4 3.6-8 8-8s8 3.6 8 8H4z" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M4 17c1-2.5 4-4.5 8-4.5s7 2 8 4.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" fill="none" />
      <path d="M8 9C7 6 8.5 4 12 4s5 2 4 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M4 17h16v2.5H4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function SparkleIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
        stroke={color} strokeWidth="1.4" strokeLinejoin="round"
        style={animated ? { animation: 'starPulse 2s ease-in-out infinite', transformOrigin: '12px 12px' } : undefined} />
    </svg>
  );
}

export function StarIcon({ size = 20, color = 'currentColor', fill = false, animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={fill ? color : 'none'}
        style={animated ? { animation: 'starPulse 1.5s ease-in-out infinite', transformOrigin: '12px 12px' } : undefined} />
    </svg>
  );
}

export function GiftIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <rect x="3" y="11" width="18" height="10" rx="1.5" stroke={color} strokeWidth="1.5"
        style={animated ? { animation: 'giftFloat 2s ease-in-out infinite', transformOrigin: '12px 16px' } : undefined} />
      <path d="M3 11V9a1 1 0 011-1h16a1 1 0 011 1v2" stroke={color} strokeWidth="1.5" />
      <path d="M12 8v13" stroke={color} strokeWidth="1.5" />
      <path d="M12 8C12 5 9 4.2 8.5 5.5S10 8 12 8z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <path d="M12 8C12 5 15 4.2 15.5 5.5S14 8 12 8z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function RegisterIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M12 20H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v5"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 10h6M9 14h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18" cy="18" r="4" stroke={color} strokeWidth="1.5"
        style={animated ? { animation: 'starPulse 2s ease-in-out infinite', transformOrigin: '18px 18px' } : undefined} />
      <path d="M16.5 18l1 1.2 2-2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PeopleIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.5" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrophyIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M8 21h8M12 17v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 3h14v7a7 7 0 01-14 0V3z" stroke={color} strokeWidth="1.5" fill="none"
        style={animated ? { animation: 'trophyShine 2.5s ease-in-out infinite', transformOrigin: '12px 8px' } : undefined} />
      <path d="M5 6H3a2 2 0 000 4h2M19 6h2a2 2 0 010 4h-2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MedalIcon({ size = 20, color = 'currentColor', medalColor, rank = 1, animated = false, style, className }) {
  const rankColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
  const c = medalColor || rankColors[rank] || color;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <circle cx="12" cy="15" r="6" stroke={c} strokeWidth="1.5" />
      <path d="M8.5 9L6 4h4l2-2 2 2h4L15.5 9" stroke={c} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function FlameIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M12 2C12 2 7 8 7 13a5 5 0 0010 0c0-3-3-8-5-11z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"
        style={animated ? { animation: 'flameDance 0.9s ease-in-out infinite', transformOrigin: '12px 14px' } : undefined} />
      <path d="M12 19c-1.1 0-2-.5-2.5-1.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function CakeIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      {animated && (
        <path d="M12 5C12 5 11 3.5 12 2C13 3.5 12 5 12 5Z" fill={color} opacity="0.7"
          style={{ animation: 'steamFloat 1.5s ease-in-out infinite', transformOrigin: '12px 3.5px' }} />
      )}
      <path d="M12 5.5v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3" y="10" width="18" height="11" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M3 16c3-2 6-2 9 0s6 2 9 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function TentIcon({ size = 20, color = 'currentColor', animated = true, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 24" fill="none" style={b(style)} className={className}>
      <path d="M2 22L13 3L24 22H2z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M10.5 22v-5h5v5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="3" x2="13" y2="0.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 0.5 L16.5 2.2" stroke={color} strokeWidth="1.2" strokeLinecap="round"
        style={animated ? { animation: 'tentFlag 1.5s ease-in-out infinite', transformOrigin: '13px 0.5px' } : undefined} />
    </svg>
  );
}

export function CardIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <rect x="1" y="4" width="22" height="16" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M1 10h22" stroke={color} strokeWidth="1.5" />
      <circle cx="6" cy="15" r="1.5" fill={color} />
      <circle cx="10" cy="15" r="1.5" fill={color} opacity="0.45" />
    </svg>
  );
}

export function CheckIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" />
      <path d="M7 12.5L10.5 16L17 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WarningIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M12 9v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill={color} />
    </svg>
  );
}

export function ChartIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M2 20h20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function RankIcon({ size = 20, rank = 1, style, className }) {
  const rankColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
  const c = rankColors[rank] || '#9ca3af';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.5" fill={`${c}1a`} />
      <text x="12" y="16.5" textAnchor="middle" fill={c} fontSize="10" fontWeight="800" fontFamily="'Montserrat',sans-serif">{rank}</text>
    </svg>
  );
}

export function SearchIcon({ size = 20, color = 'currentColor', style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="1.5" />
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LightningIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"
        style={animated ? { animation: 'starPulse 1.2s ease-in-out infinite', transformOrigin: '12px 12px' } : undefined} />
    </svg>
  );
}

export function UserPlusIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.5" />
      <path d="M20 8v6M17 11h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DeliveryIcon({ size = 20, color = 'currentColor', animated = false, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={b(style)} className={className}>
      <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="9" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="21" r="1.2" fill={color} />
      <circle cx="20" cy="21" r="1.2" fill={color} />
    </svg>
  );
}
