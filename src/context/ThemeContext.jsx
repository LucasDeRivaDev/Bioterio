import { createContext, useContext, useState, useEffect } from 'react'

// Tokens alineados con el sistema visual de ITeRatE ICIVET: superficies planas
// azul noche, bordes finos y acentos con significado (no decorativos).
// Los valores son hex/rgba (no var()) porque varias páginas les concatenan alfa.

// ── Paleta oscura (default) ─────────────────────────────────────────────────
export const TEMA_OSCURO = {
  bgMain:         '#080d1a',
  bgMainGrad:     'none',
  bgSidebar:      '#0d1528',
  bgSidebarBorde: '#1e3352',
  bgTopbar:       '#080d1a',
  bgTopbarBorde:  '#1e3352',
  bgCard:         '#0d1528',
  bgCardBorde:    '#1e3352',
  bgRaised:       '#111d35',
  bgSunken:       '#060a14',
  lineSoft:       '#16253f',
  textPrimary:    '#d6dee8',
  textSecondary:  '#8a9bb0',
  textMuted:      '#5a6f8c',
  textCode:       '#d6dee8',
  accent:         '#00e676',
  accentDim:      'rgba(0,230,118,0.08)',
  accentBorde:    'rgba(0,230,118,0.30)',
  blue:           '#40c4ff',
  blueDim:        'rgba(64,196,255,0.08)',
  blueBorde:      'rgba(64,196,255,0.30)',
  purple:         '#ce93d8',
  purpleDim:      'rgba(206,147,216,0.08)',
  amber:          '#ffb300',
  red:            '#ff5c72',
  green:          '#00e676',
  greenDim:       'rgba(0,230,118,0.08)',
  greenBorde:     'rgba(0,230,118,0.30)',
  bgInput:        '#060a14',
  bgInputBorde:   '#1e3352',
  male:           '#64b5f6',
  female:         '#f48fb1',
}

// ── Paleta clara (institucional) ────────────────────────────────────────────
export const TEMA_CLARO = {
  bgMain:         '#eef1f5',
  bgMainGrad:     'none',
  bgSidebar:      '#ffffff',
  bgSidebarBorde: '#d3dae4',
  bgTopbar:       '#eef1f5',
  bgTopbarBorde:  '#d3dae4',
  bgCard:         '#ffffff',
  bgCardBorde:    '#d3dae4',
  bgRaised:       '#f5f7fa',
  bgSunken:       '#e4e9f0',
  lineSoft:       '#e4e9f0',
  textPrimary:    '#0f1a2b',
  textSecondary:  '#46566d',
  textMuted:      '#7a889c',
  textCode:       '#0f1a2b',
  accent:         '#00875a',
  accentDim:      'rgba(0,135,90,0.08)',
  accentBorde:    'rgba(0,135,90,0.30)',
  blue:           '#0277bd',
  blueDim:        'rgba(2,119,189,0.08)',
  blueBorde:      'rgba(2,119,189,0.30)',
  purple:         '#8e44ad',
  purpleDim:      'rgba(142,68,173,0.08)',
  amber:          '#b26a00',
  red:            '#d32f45',
  green:          '#00875a',
  greenDim:       'rgba(0,135,90,0.08)',
  greenBorde:     'rgba(0,135,90,0.30)',
  bgInput:        '#ffffff',
  bgInputBorde:   '#d3dae4',
  male:           '#1565c0',
  female:         '#c2185b',
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [modoBrillo, setModoBrillo] = useState(
    () => localStorage.getItem('appMosca_brillo') === 'true'
  )

  const tema = modoBrillo ? TEMA_CLARO : TEMA_OSCURO

  // Agrega/quita clase en <html> para overrides CSS globales
  useEffect(() => {
    document.documentElement.classList.toggle('modo-claro', modoBrillo)
    document.documentElement.dataset.theme = modoBrillo ? 'light' : 'dark'
    document.body.style.background = tema.bgMain
  }, [modoBrillo, tema.bgMain])

  function toggleBrillo() {
    setModoBrillo(v => {
      const next = !v
      localStorage.setItem('appMosca_brillo', String(next))
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ modoBrillo, toggleBrillo, tema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
