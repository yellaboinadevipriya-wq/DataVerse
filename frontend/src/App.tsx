import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BarChart3, Briefcase, FolderKanban, GraduationCap, Home as HomeIcon, LayoutDashboard, LogIn, Menu, Moon, PieChart, Sparkles, Sun, Trophy, UserRound, X } from 'lucide-react'
import { Component, lazy, ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './ctx'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Academy from './pages/Academy'
import LessonPage from './pages/Lesson'
const Workspace = lazy(() => import('./pages/Workspace'))
import Saved from './pages/Saved'
import PublicPortfolio from './pages/PublicPortfolio'
import { ProjectDetail, ProjectList } from './pages/Projects'
const TableauStudio = lazy(() => import('./pages/TableauStudio'))
const PowerBIStudio = lazy(() => import('./pages/PowerBIStudio'))
const VizLab = lazy(() => import('./pages/VizLab'))
const SqlLab = lazy(() => import('./pages/SqlLab'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
import ProgressPage from './pages/Progress'
import Profile from './pages/Profile'

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/academy', label: 'Academy', icon: GraduationCap },
  { to: '/tableau', label: 'Tableau', icon: PieChart },
  { to: '/powerbi', label: 'Power BI', icon: LayoutDashboard },
  { to: '/viz-lab', label: 'Viz Lab', icon: BarChart3 },
  { to: '/workspace', label: 'Workspace', icon: Sparkles },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/progress', label: 'Progress', icon: Trophy },
]
const ORDER = ['/', '/academy', '/sql-lab', '/tableau', '/powerbi', '/viz-lab', '/workspace', '/saved', '/projects', '/portfolio', '/p/', '/progress', '/profile', '/auth']
const rank = (p: string) => { const i = ORDER.findIndex((o) => (o === '/' ? p === '/' : p.startsWith(o))); return i < 0 ? 0 : i }

/** Keeps a crashing page from blanking the whole app. */
class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="empty" role="alert">
        <h2 style={{ color: 'var(--text)' }}>This page hit an unexpected error</h2>
        <p>{this.state.err.message}</p>
        <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={() => location.reload()}>Reload</button><Link className="btn" to="/" onClick={() => this.setState({ err: null })}>Go home</Link></div>
      </div>
    )
  }
}

/** Redirects once (in an effect) instead of rendering <Navigate>, which can re-fire inside AnimatePresence's exiting tree. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const sent = useRef(false)
  useEffect(() => {
    if (ready && !user && !sent.current) { sent.current = true; nav('/auth', { replace: true, state: { from: loc.pathname + loc.search } }) }
  }, [ready, user])
  if (!ready || !user) return <div className="center" style={{ padding: '4rem' }}><span className="spin" role="status" aria-label="Loading" /></div>
  return <>{children}</>
}

function Nav() {
  const { user, theme, toggleTheme, signOut } = useApp()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const active = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to))
  return (
    <>
      <header className="nav">
        <Link to="/" className="logo"><span className="logo-mark"><Sparkles size={17} /></span>DataVerse</Link>
        <nav className="links" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={'link' + (active(n.to) ? ' active' : '')}>
              {active(n.to) && <motion.span layoutId="nav-pill" className="pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <button className="icon-btn" onClick={toggleTheme} aria-label={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme'}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: .18 }} style={{ display: 'grid' }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </motion.span>
          </AnimatePresence>
        </button>
        {user ? (
          <Link to="/profile" className="btn hide-m"><UserRound size={16} />{user.name.split(' ')[0]}</Link>
        ) : (
          <Link to="/auth" className="btn primary hide-m"><LogIn size={16} />Sign in</Link>
        )}
        <button className="icon-btn burger" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} aria-label="Menu">
              <button className="icon-btn" style={{ alignSelf: 'flex-end' }} onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
              {NAV.map((n, i) => (
                <motion.div key={n.to} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: .05 + i * .05 }}>
                  <NavLink to={n.to} className={'link' + (active(n.to) ? ' active' : '')} style={{ display: 'flex', gap: '.7rem', alignItems: 'center' }}><n.icon size={18} />{n.label}</NavLink>
                </motion.div>
              ))}
              <div className="spacer" />
              {user ? (<><Link className="btn" to="/profile">Profile & settings</Link><button className="btn danger" onClick={signOut}>Sign out</button></>) : <Link className="btn primary" to="/auth">Sign in</Link>}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default function App() {
  const loc = useLocation()
  const reduce = useReducedMotion()
  const { toasts } = useApp()
  const prev = useRef(rank(loc.pathname))
  const now = rank(loc.pathname)
  const dir = now >= prev.current ? 1 : -1
  useEffect(() => { prev.current = now; window.scrollTo({ top: 0 }) }, [loc.pathname])
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="grid-bg" aria-hidden="true" />
      <Nav />
      <main id="main">
        {/* CSS slide-in (visible by default, so it can never leave a page invisible) */}
        <div key={loc.pathname} className={'page ' + (dir > 0 ? 'in-right' : 'in-left')}>
            <Suspense fallback={<div className="center" style={{ padding: '4rem' }}><span className="spin" /></div>}>
            <Boundary key={loc.pathname}><Routes location={loc}>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/academy" element={<Academy />} />
              <Route path="/academy/:lessonId" element={<LessonPage />} />
              <Route path="/tableau" element={<TableauStudio />} />
              <Route path="/powerbi" element={<PowerBIStudio />} />
              <Route path="/viz-lab" element={<VizLab />} />
              <Route path="/sql-lab" element={<RequireAuth><SqlLab /></RequireAuth>} />
              <Route path="/projects" element={<RequireAuth><ProjectList /></RequireAuth>} />
              <Route path="/projects/:id" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
              <Route path="/portfolio" element={<RequireAuth><Portfolio /></RequireAuth>} />
              <Route path="/p/:slug" element={<PublicPortfolio />} />
              <Route path="/workspace" element={<RequireAuth><Workspace /></RequireAuth>} />
              <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
              <Route path="/progress" element={<RequireAuth><ProgressPage /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="*" element={<div className="empty"><h2>Page not found</h2><Link className="btn primary" to="/">Back home</Link></div>} />
              </Routes></Boundary>
            </Suspense>
        </div>
      </main>
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} className={'toast ' + t.kind} initial={{ x: 120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 120, opacity: 0 }} layout>{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
