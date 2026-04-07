import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion]     = useState(null)   // objeto de sesión de Supabase
  const [cargando, setCargando] = useState(true)   // true mientras verifica si hay sesión activa

  useEffect(() => {
    // Verificar si ya hay una sesión guardada en el navegador
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    // Escuchar cambios de sesión (login / logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion)
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
  }

  return (
    <AuthCtx.Provider value={{ sesion, cargando, iniciarSesion, cerrarSesion, actualizarPassword }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
