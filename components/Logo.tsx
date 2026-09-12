// Знак «Верный путь» (утверждён 11.09, вариант «W-путь», фон — палитра «Хвоя»):
// буква W как зигзаг-тропа, последняя нога уходит в оранжевую стрелку вверх.
// SVG-компонент вместо картинки — масштабируется любым size, не грузит сеть.
// Тот же рисунок лежит в app/icon.svg (иконка таба) — держим синхронно.

export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1e5c48" />
          <stop offset="1" stopColor="#2f7a5f" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#logo-grad)" />
      <path
        d="M9 14 L16 34 L24 20 L31 32 L38 10"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="translate(38 10) rotate(-72)">
        <path
          d="M-9 -5.5 L0 0 L-9 5.5"
          fill="none"
          stroke="#d97a2b"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}