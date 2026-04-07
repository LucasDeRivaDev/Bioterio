import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion]                   = useState(null)
  const [cargando, setCargando]               = useState(true)
  const [necesitaPassword, setNecesitaPassword] = useState(false)

  useEffect(() => {
    // Detectar link de invitación ANTES de que Supabase lo procese
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=signup')) {
      setNecesitaPassword(true)
    }

    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      setSesion(nuevaSesion)
      if (evento === 'SIGNED_IN' && (window.location.hash.includes('type=invite') || window.location.hash.includes('type=signup'))) {
        setNecesitaPassword(true)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function iniciarSesion(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  async function actualizarPassword(nuevaPassword) {
    const { error } = await supabase.auth.updateUser({ password: nuevaPassword })
    if (error) throw error
    setNecesitaPassword(false)
    window.history.replaceState(null, '', window.location.pathname)
  }

  return (
    <AuthCtx.Provider value={{ sesion, cargando, iniciarSesion, cerrarSesion, actualizarPassword, necesitaPassword }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
