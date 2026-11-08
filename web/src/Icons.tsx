import { color } from './design'

/** Trazos de los íconos del lienzo, en una caja de 24 × 24. */
const paths = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  building: <><rect x="4.5" y="3" width="15" height="18" rx="1.5" /><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M10.5 21v-3h3v3" /></>,
  panel: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  attendance: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  incidents: <><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 10v4.2M12 17.2v.1" /></>,
  closures: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.6 3 5.2" /></>,
  devices: <><rect x="7" y="2.8" width="10" height="18.4" rx="2.2" /><path d="M11 18h2" /></>,
  settings: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  users: <><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  reports: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  person: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pause: <><circle cx="12" cy="12" r="8.5" /><path d="M10 9v6M14 9v6" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  alert: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5M12 16v.1" /></>,
  check: <path d="m6 12.5 4 4 8-9" />,
  chevron: <path d="m9 5.5 6.5 6.5L9 18.5" />,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M9 8l-4 4 4 4M5 12h10" /></>,
  more: <path d="M4 7h16M4 12h16M4 17h16" />,
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 20, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>
}

/** Marca de Zenit: las dos ondas de la app, sobre fondo azul. */
export function ZenitMark({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
    <path d="M5 14.5c3.2-4.2 7.4-4.2 10.6 0s7.4 4.2 10.6 0c1.2-1.6 2.6-2.6 4.3-3" fill="none" stroke={color.waveLight} strokeWidth="4.5" strokeLinecap="round" />
    <path d="M5 23.5c3.2-4.2 7.4-4.2 10.6 0s7.4 4.2 10.6 0c1.2-1.6 2.6-2.6 4.3-3" fill="none" stroke={color.white} strokeWidth="4.5" strokeLinecap="round" />
  </svg>
}
