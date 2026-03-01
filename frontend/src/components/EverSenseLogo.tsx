export function EverSenseLogo({ width = 480, height = 82 }: { width?: number; height?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 82" width={width} height={height}>
      <defs>
        <linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#007acc' }} />
          <stop offset="100%" style={{ stopColor: '#1a9fdf' }} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Layer 1 — back */}
      <rect x="0" y="0" width="72" height="72" rx="12" fill="#252526" stroke="#3c3c3c" strokeWidth="1" />
      {/* Layer 2 — mid */}
      <rect x="5" y="5" width="72" height="72" rx="12" fill="#2d2d2d" stroke="#3c3c3c" strokeWidth="1" />
      {/* Layer 3 — front solid blue */}
      <rect x="10" y="10" width="72" height="72" rx="12" fill="#007acc" />
      {/* White ES on blue */}
      <text x="22" y="56" fontFamily="'Segoe UI', sans-serif" fontSize="28" fontWeight="700" fill="#ffffff">ES</text>

      {/* Wordmark */}
      <text x="100" y="54" fontFamily="'Segoe UI', sans-serif" fontSize="44" fontWeight="700" letterSpacing="-2">
        <tspan fill="#c0c0c0">Ever</tspan>
        <tspan fill="url(#acc)" filter="url(#glow)">Sense</tspan>
        <tspan fill="#505050" fontSize="30"> Ai</tspan>
      </text>
      {/* Tagline */}
      <text x="102" y="72" fontFamily="'Courier New', monospace" fontSize="9.5" fill="#505050" letterSpacing="3.5">
        INTELLIGENT PLATFORM
      </text>
    </svg>
  );
}
