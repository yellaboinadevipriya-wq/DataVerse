import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, errMsg, getToken, setToken, setUnauthorizedHandler } from './api'

export type User = { id: number; email: string; name: string; language: string }
export type Progress = { completed: { lesson_id: string; completed_at: string }[]; quiz_attempts: any[] }
export type Summary = {
  datasets: number; analyses: number; lessons_completed: number; quiz_attempts: number; perfect_quizzes: number; cleaning_steps: number; sql_solved: number; projects_completed: number
}
type Toast = { id: number; msg: string; kind: 'info' | 'error' | 'success' }

type Ctx = {
  user: User | null; ready: boolean; theme: 'dark' | 'light'; toggleTheme: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>; setUser: (u: User) => void
  progress: Progress; refreshProgress: () => Promise<void>
  summary: Summary | null; refreshSummary: () => Promise<void>
  toasts: Toast[]; toast: (msg: string, kind?: Toast['kind']) => void
}
const C = createContext<Ctx>(null as any)
export const useApp = () => useContext(C)
const emptyProgress: Progress = { completed: [], quiz_attempts: [] }

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<Progress>(emptyProgress)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('dataverse.theme') as any) || 'dark')
  const nid = useRef(0)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('dataverse.theme', theme)
  }, [theme])

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'info') => {
    const id = ++nid.current
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4800)
  }, [])

  const refreshProgress = useCallback(async () => {
    try { setProgress((await api.get('/progress')).data) } catch { /* not signed in */ }
  }, [])
  const refreshSummary = useCallback(async () => {
    try { setSummary((await api.get('/summary')).data) } catch { /* not signed in */ }
  }, [])

  const clear = useCallback(() => { setToken(null); setUser(null); setProgress(emptyProgress); setSummary(null) }, [])
  useEffect(() => setUnauthorizedHandler(() => { clear(); toast('Your session expired. Please sign in again.', 'error') }), [clear, toast])

  useEffect(() => {
    if (!getToken()) return setReady(true)
    api.get('/auth/me').then((r) => { setUser(r.data); refreshProgress(); refreshSummary() }).catch(() => {}).finally(() => setReady(true))
  }, [])

  const start = (d: any) => { setToken(d.token); setUser(d.user); refreshProgress(); refreshSummary() }
  const value = useMemo<Ctx>(() => ({
    user, ready, theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    signIn: async (email, password) => start((await api.post('/auth/login', { email, password })).data),
    signUp: async (email, password, name) => start((await api.post('/auth/register', { email, password, name })).data),
    signOut: async () => { try { await api.post('/auth/logout') } catch { /* ignore */ } clear() },
    setUser, progress, refreshProgress, summary, refreshSummary, toasts, toast,
  }), [user, ready, theme, progress, summary, toasts, toast, refreshProgress, refreshSummary, clear])
  return <C.Provider value={value}>{children}</C.Provider>
}
export { errMsg }
