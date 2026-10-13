/** App-Logo: Teller mit Besteck (gleiches Motiv wie Favicon und Homescreen-Icon) */
export default function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="flex-shrink-0">
      <rect width="512" height="512" rx="120" fill="#6B2E7A" />
      <circle cx="256" cy="256" r="124" fill="none" stroke="#E8735A" strokeWidth="28" />
      <path d="M190 150v70a26 26 0 0 0 52 0v-70M216 150v212" fill="none" stroke="#FAF7FA" strokeWidth="22" strokeLinecap="round" />
      <path
        d="M322 362V150c-30 18-40 64-40 108h40"
        fill="none"
        stroke="#FAF7FA"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
