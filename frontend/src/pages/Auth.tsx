import { motion } from 'framer-motion'
import { FormEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notice, Spinner } from '../components/ui'
import { errMsg, useApp } from '../ctx'

export default function Auth() {
  const { user, signIn, signUp } = useApp()
  const nav = useNavigate()
  const from = (useLocation().state as any)?.from || '/'
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (user) nav(from, { replace: true }) }, [user])
  if (user) return null
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { mode === 'login' ? await signIn(f.email, f.password) : await signUp(f.email, f.password, f.name) }
    catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  return (
    <div style={{ maxWidth: 440, margin: '3rem auto' }}>
      <div className="card">
        <div className="tabs" role="tablist" style={{ marginBottom: '1.2rem' }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} className={'tab' + (mode === m ? ' active' : '')} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setMode(m); setErr('') }} role="tab" aria-selected={mode === m}>
              {mode === m && <motion.span layoutId="auth-tab" className="tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
        <form onSubmit={submit}>
            <motion.div key={mode} initial={{ x: mode === 'login' ? -40 : 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .25 }}>
              {mode === 'register' && <div className="field"><label htmlFor="n">Name</label><input id="n" required maxLength={80} value={f.name} onChange={set('name')} autoComplete="name" /></div>}
              <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></div>
              <div className="field"><label htmlFor="p">Password {mode === 'register' && <span className="muted">(8+ characters)</span>}</label><input id="p" type="password" required minLength={mode === 'register' ? 8 : 1} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
            </motion.div>
          {err && <Notice kind="bad">{err}</Notice>}
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>{busy ? <Spinner /> : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="muted small" style={{ marginTop: '1rem', marginBottom: 0 }}>Local development accounts: passwords are hashed with Argon2 and stored in your own SQLite database. No data leaves your machine except AI questions (if you configure Gemini).</p>
      </div>
    </div>
  )
}
