export interface PaletteColor {
  background: string;
  foreground: string;
  accent: string;
}

export type ThemeKind = 'light' | 'dark' | 'highContrast' | 'highContrastLight';

export const DARK_PALETTE: PaletteColor[] = [
  { background: '#1f6feb', foreground: '#ffffff', accent: '#58a6ff' },
  { background: '#238636', foreground: '#ffffff', accent: '#3fb950' },
  { background: '#8957e5', foreground: '#ffffff', accent: '#a371f7' },
  { background: '#bc4c00', foreground: '#ffffff', accent: '#ec6547' },
  { background: '#9e6a03', foreground: '#ffffff', accent: '#d29922' },
  { background: '#cf222e', foreground: '#ffffff', accent: '#f85149' },
  { background: '#1b7c83', foreground: '#ffffff', accent: '#39c5cf' },
  { background: '#bf3989', foreground: '#ffffff', accent: '#db61a2' },
];

export const LIGHT_PALETTE: PaletteColor[] = [
  { background: '#ddf4ff', foreground: '#0a3069', accent: '#0969da' },
  { background: '#dafbe1', foreground: '#0a3d1f', accent: '#1a7f37' },
  { background: '#fbefff', foreground: '#3c1e70', accent: '#8250df' },
  { background: '#fff1e5', foreground: '#6c3b00', accent: '#bc4c00' },
  { background: '#fff8c5', foreground: '#4d3800', accent: '#9a6700' },
  { background: '#ffebe9', foreground: '#6e0a0a', accent: '#cf222e' },
  { background: '#d9fbfb', foreground: '#04494d', accent: '#1b7c83' },
  { background: '#ffeff7', foreground: '#6e2564', accent: '#bf3989' },
];

export function selectPalette(kind: ThemeKind): PaletteColor[] {
  return kind === 'light' || kind === 'highContrastLight' ? LIGHT_PALETTE : DARK_PALETTE;
}
