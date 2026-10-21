/**
 * Schriftzug „miyummy“: Poppins (nur diese vier Zeichen werden geladen, siehe index.html),
 * „mi“ fett, „yummy“ leicht, der i-Punkt ist ein Teller-Ring in Koralle wie im App-Icon.
 */
export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block leading-none tracking-[-0.02em] text-brand-700 ${className}`}
      style={{ fontFamily: "'Poppins', 'Plus Jakarta Sans', sans-serif", fontSize: size }}
    >
      <span className="sr-only">miyummy</span>
      <span aria-hidden="true">
        <span className="font-extrabold">
          m
          <span className="relative inline-block">
            ı
            <svg
              viewBox="0 0 10 10"
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: '-0.22em', width: '0.36em', height: '0.36em' }}
            >
              <circle cx="5" cy="5" r="3.6" fill="none" stroke="#E8735A" strokeWidth="2.4" />
            </svg>
          </span>
        </span>
        <span className="font-normal">yummy</span>
      </span>
    </span>
  );
}
