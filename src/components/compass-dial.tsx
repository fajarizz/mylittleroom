const TICKS = Array.from({ length: 12 }, (_, index) => index * 30);

export function CompassDial() {
  return (
    <svg viewBox="0 0 80 80" className="size-full">
      <circle cx="40" cy="40" r="34" fill="none" stroke="#d4d4d8" strokeWidth="1" />
      {TICKS.map((angle) => (
        <line
          key={angle}
          x1="40"
          y1="7"
          x2="40"
          y2={angle % 90 === 0 ? 13 : 10}
          stroke="#a1a1aa"
          strokeWidth={angle % 90 === 0 ? 1.5 : 1}
          transform={`rotate(${angle} 40 40)`}
        />
      ))}
      <text x="40" y="22" textAnchor="middle" fontSize="10" fontWeight="600" fill="#18181b">
        N
      </text>
      <text x="63" y="43.5" textAnchor="middle" fontSize="9" fill="#71717a">
        E
      </text>
      <text x="40" y="64" textAnchor="middle" fontSize="9" fill="#71717a">
        S
      </text>
      <text x="17" y="43.5" textAnchor="middle" fontSize="9" fill="#71717a">
        W
      </text>
      <polygon points="40,26 43.5,42 40,38.5 36.5,42" fill="#18181b" />
      <polygon points="40,56 43.5,40 40,43.5 36.5,40" fill="#d4d4d8" />
    </svg>
  );
}
