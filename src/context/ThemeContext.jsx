import { createContext, useContext, useState, useEffect } from 'react'

// ── Paleta oscura (default) ─────────────────────────────────────────────────
export const TEMA_OSCURO = {
  bgMain:         '#050810',
  bgMainGrad:     'linear-gradient(rgba(0,230,118,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,118,0.03) 1px, transparent 1px)',
  bgSidebar:      'linear-gradient(180deg, #080d1a 0%, #050810 100%)',
  bgSidebarBorde: 'rgba(0,230,118,0.12)',
  bgTopbar:       '#050810',
  bgTopbarBorde:  'rgba(0,230,118,0.12)',
  bgCard:         'rgba(13,21,40,0.8)',
  bgCardBorde:    'rgba(30,51,82,0.8)',
  textPrimary:    '#c9d4e0',
  textSecondary:  '#8a9bb0',
  textMuted:      '#4a5f7a',
  textCode:       '#c9d4e0',
  accent:         '#00e676',
  accentDim:      'rgba(0,230,118,0.08)',
  accentBorde:    'rgba(0,230,118,0.25)',
  blue:           '#40c4ff',
  blueDim:        'rgba(64,196,255,0.08)',
  blueBorde:      'rgba(64,196,255,0.25)',
  purple:         '#ce93d8',
  purpleDim:      'rgba(206,147,216,0.08)',
  amber:          '#ffb300',
  red:            '#ff6b80',
  green:          '#00e676',
  greenDim:       'rgba(0,230,118,0.08)',
  greenBorde:     'rgba(0,230,118,0.25)',
  bgInput:        'rgba(8,13,26,0.8)',
  bgInputBorde:   'rgba(30,51,82,0.8)',
}

// ── Paleta clara (biomédica / institucional) ────────────────────────────────
export const TEMA_CLARO = {
  bgMain:         '#F4F4EF',
  bgMainGrad:     'linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)',
  bgSidebar:      'linear-gradient(180deg, #EEEEE9 0%, #E8E8E3 100%)',
  bgSidebarBorde: 'rgba(0,0,0,0.08)',
  bgTopbar:       '#F4F4EF',
  bgTopbarBorde:  'rgba(0,0,0,0.07)',
  bgCard:         '#FFFFFF',
  bgCardBorde:    '#D4D4CE',
  textPrimary:    '#111827',
  textSecondary:  '#374151',
  textMuted:      '#6b7280',
  textCode:       '#111827',
  accent:         '#059669',
  accentDim:      'rgba(5,150,105,0.08)',
  accentBorde:    'rgba(5,150,105,0.3)',
  blue:           '#0369a1',
  blueDim:        'rgba(3,105,161,0.08)',
  blueBorde:      'rgba(3,105,161,0.3)',
  purple:         '#7e22ce',
  purpleDim:      'rgba(126,34,206,0.08)',
  amber:          '#b45309',
  red:            '#dc2626',
  green:          '#059669',
  greenDim:       'rgba(5,150,105,0.08)',
  greenBorde:     'rgba(5,150,105,0.3)',
  bgInput:        '#FFFFFF',
  bgInputBorde:   '#D4D4CE',
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
