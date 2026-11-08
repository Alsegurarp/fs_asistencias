/**
 * Valores del lienzo aprobado del portal (2026-11-07). Toda pantalla nueva los
 * toma de aquí; el tema de MUI se arma con ellos. Si el lienzo cambia, se
 * cambian aquí y en la prueba de contraste de accessibility.test.ts.
 */
export const color = {
  ink: '#12233F',
  inkSoft: '#2B3B57',
  muted: '#4A5A75',
  subtle: '#5E6E89',
  accent: '#2F6BE0',
  link: '#1F4FA8',
  linkHover: '#173E86',
  deep: '#1C4A9C',
  waveLight: '#9CC4FF',
  line: '#E2E8F2',
  lineSoft: '#EEF2F8',
  tabLine: '#DDE5F1',
  field: '#C9D3E3',
  fieldSoft: '#D5DEEC',
  fieldHover: '#B9CEF5',
  hover: '#F2F6FE',
  rowHover: '#F7F9FD',
  selected: '#EEF4FE',
  tile: '#DCE7FC',
  page: '#F3F6FB',
  white: '#FFFFFF',
  warnBg: '#FFF1DD',
  warnInk: '#8A4200',
  error: '#B3261E',
  gradientFrom: '#2C66D0',
  gradientTo: '#1B4596',
} as const

export const gradient = {
  /** Barra superior. */
  top: 'radial-gradient(circle at 72% -60%, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.05) 150px, rgba(255,255,255,0) 260px), linear-gradient(90deg, #2C66D0 0%, #2257BB 50%, #1B4596 100%)',
  /** Fondo detrás de las tarjetas. */
  page: 'radial-gradient(640px 420px at 88% 6%, rgba(91,155,245,0.30) 0%, rgba(91,155,245,0) 70%), radial-gradient(620px 460px at 28% 100%, rgba(47,107,224,0.16) 0%, rgba(47,107,224,0) 70%), linear-gradient(180deg, #E8EFFB 0%, #F2F6FC 45%, #F5F8FC 100%)',
  /** Panel de marca de las pantallas sin menú (acceso, sin empresa, sesión terminada). */
  brand: 'radial-gradient(circle at 88% 10%, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.05) 180px, rgba(255,255,255,0) 320px), radial-gradient(circle at 0% 100%, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0) 260px), linear-gradient(160deg, #2C66D0 0%, #2257BB 55%, #1B4596 100%)',
  /** Encabezado de pantalla en teléfono. */
  phone: 'radial-gradient(circle at 92% 30%, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.06) 60px, rgba(255,255,255,0) 110px), linear-gradient(160deg, #2C66D0 0%, #2257BB 55%, #1B4596 100%)',
  button: 'linear-gradient(180deg, #2C64CC 0%, #1D4A9F 100%)',
  buttonHover: 'linear-gradient(180deg, #2459BE 0%, #183F8A 100%)',
  /** Mosaico de ícono y elemento seleccionado del menú. */
  tile: 'linear-gradient(145deg, #EEF4FE 0%, #DCE7FC 100%)',
  /** Ícono destacado de las pantallas de estado y avatar. */
  badge: 'linear-gradient(145deg, #2C66D0 0%, #1C4A9C 100%)',
} as const

export const shadow = {
  button: '0 8px 18px rgba(29,74,159,0.25)',
  card: '0 1px 2px rgba(18,35,63,0.04), 0 8px 20px rgba(31,79,168,0.06)',
  table: '0 1px 2px rgba(18,35,63,0.04), 0 8px 24px rgba(31,79,168,0.06)',
  menu: '0 24px 60px rgba(13,38,92,0.28)',
  bottomNav: '0 -6px 20px rgba(31,79,168,0.08)',
} as const

/** Tarjeta de vidrio del criterio de diseño; las tablas y fichas van en blanco sólido. */
export const glass = {
  background: 'rgba(255,255,255,0.7)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  border: '1px solid rgba(255,255,255,0.85)',
  boxShadow: '0 1px 2px rgba(18,35,63,0.04), 0 18px 40px rgba(31,79,168,0.10)',
} as const

export const font = 'Inter, system-ui, sans-serif'

/** Debajo de este ancho el portal usa la navegación de teléfono. */
export const phoneQuery = '(max-width:860px)'
