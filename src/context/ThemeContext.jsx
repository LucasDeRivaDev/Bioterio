import { createContext, useContext, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [modoBrillo, setModoBrillo] = useState(
    () => localStorage.getItem('appMosca_brillo') === 'true'
  )

  function toggleBrillo() {
    setModoBrillo(v => {
      const next = !v
      localStorage.setItem('appMosca_brillo', String(next))
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ modoBrillo, toggleBrillo }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
