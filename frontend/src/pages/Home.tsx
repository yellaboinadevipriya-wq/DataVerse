import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, Brain, Download, Eraser, FileSearch, GraduationCap, Sparkles, Upload, Database } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import Universe from '../components/Universe'
import { Empty, Reveal } from '../components/ui'
import { useApp } from '../ctx'
import { ALL_LESSONS } from '../data/curriculum'

const STEPS = [
  { i: Upload, t: 'Upload', d: 'CSV or Excel up to 20 MB, validated on the server.' },
  { i: FileSearch, t: 'Profile', d: 'Real Pandas statistics: types, missing values, duplicates, outliers.' },
  { i: Eraser, t: 'Clean', d: 'Preview every change, apply it, undo it, or reset to the original.' },
  { i: BarChart3, t: 'Visualize', d: 'Bar, line, scatter, histogram, pie, box and correlation heatmaps.' },
  { i: Brain, t: 'Ask AI', d: 'Gemini plans a safe operation; Pandas computes; the answer shows its evidence.' },
  { i: Download, t: 'Export', d: 'Cleaned CSV/Excel, plus a report built from computed facts.' },
]

function Dashboard() {
  const { user, summary, progress } = useApp()
  const [datasets, setDatasets] = useState<any[] | null>(null)
  const [analyses, setAnalyses] = useState<any[] | null>(null)
  useEffect(() => {
    api.get('/datasets').then((r) => setDatasets(r.data)).catch(() => setDatasets([]))
    api.get('/analyses').then((r) => setAnalyses(r.data)).catch(() => setAnalyses([]))
  }, [])
  const done = new Set(progress.completed.map((c) => c.lesson_id))
  const next = ALL_LESSONS.find((l) => !done.has(l.id))
  const stats = [
    { n: summary?.lessons_completed ?? 0, l: `of ${ALL_LESSONS.length} lessons completed` },
    { n: summary?.datasets ?? 0, l: 'datasets uploaded' },
    { n: summary?.analyses ?? 0, l: 'analyses saved' },
    { n: summary?.quiz_attempts ?? 0, l: 'quiz attempts' },
  ]
  const brandNew = summary && !summary.datasets && !summary.lessons_completed
  return (
    <section className="section">
      <h2>Welcome back, {user!.name.split(' ')[0]}</h2>
      <div className="grid g4" style={{ marginBottom: '1rem' }}>
        {stats.map((s, i) => <Reveal key={s.l} i={i}><div className="card stat"><b>{s.n}</b><span>{s.l}</span></div></Reveal>)}
      </div>
      {brandNew && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>Start here</h3>
          <p className="muted">Nothing yet — that's fine. Pick a path: learn the basics in the Academy, or upload a dataset and explore it right away.</p>
          <div className="row"><Link className="btn primary" to="/academy/l1-intro"><GraduationCap size={16} />Start lesson 1</Link><Link className="btn" to="/workspace"><Upload size={16} />Upload a dataset</Link></div>
        </div>
      )}
      <div className="grid g3">
        <div className="card"><h3>Continue learning</h3>
          {next ? <><p className="muted">{next.levelTitle} · {next.minutes} min</p><p><b>{next.title}</b></p><Link className="btn primary sm" to={`/academy/${next.id}`}>Open lesson <ArrowRight size={14} /></Link></>
            : <p className="muted">You have completed every available lesson. More levels are planned.</p>}
        </div>
        <div className="card"><h3>Recent datasets</h3>
          {datasets === null ? <span className="spin" /> : !datasets.length ? <p className="muted">No datasets yet.</p> :
            datasets.slice(0, 4).map((d) => <Link key={d.id} className="lesson-row" to={`/workspace?dataset=${d.id}`}><Database size={16} /><span style={{ flex: 1 }}>{d.name}</span><span className="muted small">{d.rows.toLocaleString()} rows</span></Link>)}
        </div>
        <div className="card"><h3>Recent analyses</h3>
          {analyses === null ? <span className="spin" /> : !analyses.length ? <p className="muted">Saved analyses will show up here.</p> :
            analyses.slice(0, 4).map((a) => <Link key={a.id} className="lesson-row" to={`/workspace?dataset=${a.dataset_id}&tab=charts&analysis=${a.id}`}><BarChart3 size={16} /><span style={{ flex: 1 }}>{a.title}</span></Link>)}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const { user } = useApp()
  return (
    <>
      <section className="hero">
        <Universe />
        <div className="hero-inner">
          <motion.div className="eyebrow" initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: .1 }}><Sparkles size={14} />Learn · Clean · Analyze · Ask</motion.div>
          <motion.h1 initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: .2, duration: .6, ease: [.22, 1, .36, 1] }}>
            Explore your data <span className="grad">like a universe.</span>
          </motion.h1>
          <motion.p className="lead" initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: .35, duration: .6, ease: [.22, 1, .36, 1] }}>
            DataVerse teaches data analytics from the first lesson, then lets you upload real datasets, clean them, chart them, and ask questions answered from actual computed results.
          </motion.p>
          <motion.div className="row" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .5 }}>
            <Link to="/academy" className="btn primary"><GraduationCap size={17} />Start learning</Link>
            <Link to={user ? '/workspace' : '/auth'} className="btn"><BarChart3 size={17} />Open workspace</Link>
          </motion.div>
        </div>
      </section>
      {user && <Dashboard />}
      <section className="section">
        <div className="section-head"><div><h2>How the Workspace works</h2><p className="muted" style={{ margin: 0 }}>Six steps, all backed by real computation on your own data.</p></div></div>
        <div className="grid g3">
          {STEPS.map((s, i) => (
            <Reveal key={s.t} i={i}>
              <div className="card hover" style={{ height: '100%' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}><s.i size={26} color="var(--accent2)" /><span className="step-num">0{i + 1}</span></div>
                <h3>{s.t}</h3><p className="muted" style={{ margin: 0 }}>{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      {!user && (
        <Reveal className="section"><div className="card center">
          <h2>Ready to begin?</h2><p className="muted">Create a free local account to save progress, datasets and analyses.</p>
          <Link className="btn primary" to="/auth">Create account <ArrowRight size={16} /></Link>
        </div></Reveal>
      )}
    </>
  )
}
