/** Inline stroke icons used across the app (decorative unless labelled). */

type P = { size?: number; color?: string; strokeWidth?: number };

const base = (size: number, color: string, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="sc-logo-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6BB3F7" />
          <stop offset=".55" stopColor="#2F86E8" />
          <stop offset="1" stopColor="#1A5FC0" />
        </linearGradient>
        <linearGradient id="sc-logo-hl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sc-logo-y" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE95C" />
          <stop offset="1" stopColor="#FFD400" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#sc-logo-g)" />
      <rect x="1.5" y="1.5" width="37" height="18" rx="9.5" fill="url(#sc-logo-hl)" />
      <path
        d="M8 25.5c2.6-5.8 5.6-10 7.6-9.4 2.2.7-1.8 8.4.2 8.9 1.8.4 4.2-4.6 6-4 1.3.4.2 2.6 1.6 2.9"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M23.4 23.9l3.4 3.4 7-9.6" fill="none" stroke="url(#sc-logo-y)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const WalletIcon = ({ size = 22, color = "currentColor", strokeWidth = 1.9 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M4 7a2 2 0 0 1 2-2h11v4" />
    <rect x="4" y="7" width="16" height="12" rx="2" />
    <path d="M16 13h.01" />
  </svg>
);

export const CheckIcon = ({ size = 20, color = "currentColor", strokeWidth = 2.4 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const ArrowRight = ({ size = 18, color = "currentColor", strokeWidth = 2.2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const InfoIcon = ({ size = 18, color = "#1F6FD6", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.01" />
  </svg>
);

export const AlertIcon = ({ size = 20, color = "#C23B3B", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </svg>
);

export const ExternalIcon = ({ size = 16, color = "currentColor", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

export const CloseIcon = ({ size = 22, color = "currentColor", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const RetryIcon = ({ size = 18, color = "currentColor", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const ShieldIcon = ({ size = 18, color = "currentColor", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
  </svg>
);

export const MailIcon = ({ size = 18, color = "currentColor", strokeWidth = 1.9 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5l8.5 6 8.5-6" />
  </svg>
);

export const LockIcon = ({ size = 18, color = "currentColor", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const PersonIcon = ({ size = 18, color = "currentColor", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
  </svg>
);

export const SignatureIcon = ({ size = 22, color = "currentColor", strokeWidth = 2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M3 17c2-4.2 4-7 5.4-6.6 1.6.5-1.3 6 .2 6.4 1.3.3 3-3.3 4.3-2.9.9.3.1 1.9 1.1 2.1" />
    <path d="M14 16l2.4 2.4L21 12" />
  </svg>
);

export const PlusIcon = ({ size = 18, color = "currentColor", strokeWidth = 2.2 }: P) => (
  <svg {...base(size, color, strokeWidth)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.6" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
