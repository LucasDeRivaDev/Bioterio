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
  green:          '#00e676',
  greenDim:       'rgba(0,230,118,0.08)',
  greenBorde:     'rgba(0,230,118,0.25)',
}

// ── Paleta clara (biomédica / institucional) ────────────────────────────────
export const TEMA_CLARO = {
  bgMain:         '#ffffff',
  bgMainGrad:     'linear-gradient(rgba(5,150,105,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(5,150,105,0.03) 1px, transparent 1px)',
  bgSidebar:      'linear-gradient(180deg, #ffffff 0%, #f8f8f8 100%)',
  bgSidebarBorde: 'rgba(5,150,105,0.10)',
  bgTopbar:       '#ffffff',
  bgTopbarBorde:  'rgba(5,150,105,0.10)',
  bgCard:         '#ffffff',
  bgCardBorde:    '#e2e8f0',
  textPrimary:    '#000000',
  textSecondary:  '#374151',
  textMuted:      '#6b7280',
  green:          '#059669',
  greenDim:       'rgba(5,150,105,0.06)',
  greenBorde:     'rgba(5,150,105,0.18)',
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
