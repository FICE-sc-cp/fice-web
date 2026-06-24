interface FrogMascotProps {
  className?: string;
}

/**
 * Cute cartoon frog mascot, drawn as inline SVG (no image asset needed —
 * scalable, recolorable, and swappable for a real illustration later).
 */
export function FrogMascot({ className }: FrogMascotProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      {/* head */}
      <path
        d="M32 14C18 14 8 24 8 38c0 12 10 20 24 20s24-8 24-20C56 24 46 14 32 14Z"
        fill="#54c46a"
      />
      {/* lighter tummy */}
      <ellipse cx="32" cy="45" rx="15" ry="11" fill="#74d885" opacity="0.55" />
      {/* eye bumps */}
      <circle cx="20" cy="18" r="11" fill="#54c46a" />
      <circle cx="44" cy="18" r="11" fill="#54c46a" />
      {/* eye whites */}
      <circle cx="20" cy="17" r="7" fill="#ffffff" />
      <circle cx="44" cy="17" r="7" fill="#ffffff" />
      {/* pupils */}
      <circle cx="21" cy="18" r="3.4" fill="#1b1b1b" />
      <circle cx="43" cy="18" r="3.4" fill="#1b1b1b" />
      {/* highlights */}
      <circle cx="22.6" cy="16.2" r="1.2" fill="#ffffff" />
      <circle cx="44.6" cy="16.2" r="1.2" fill="#ffffff" />
      {/* smile */}
      <path
        d="M22 40c4 6 16 6 20 0"
        stroke="#2f8f43"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* nostrils */}
      <circle cx="29" cy="33" r="1.4" fill="#2f8f43" />
      <circle cx="35" cy="33" r="1.4" fill="#2f8f43" />
      {/* blush cheeks */}
      <circle cx="15" cy="38" r="4" fill="#ff9ecf" opacity="0.55" />
      <circle cx="49" cy="38" r="4" fill="#ff9ecf" opacity="0.55" />
    </svg>
  );
}
