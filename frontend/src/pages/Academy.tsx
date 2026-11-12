import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Clock, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Notice, Reveal } from '../components/ui'
import { useApp } from '../ctx'
import { LEVELS } from '../data/curriculum'

export default function Academy() {
  const { user, progress } = useApp()
  const done = new Set(progress.completed.map((c) => c.lesson_id))
  const total = LEVELS.reduce((a, l) => a + l.lessons.length, 0)
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Data <span className="grad">Academy</span></h1>
      <p className="muted" style={{ maxWidth: 680 }}>An 11-module roadmap from absolute beginner to job-ready analyst. {total} lessons are fully written today (including Tableau and Power BI); topics marked “Planned” are not written yet but show where the path goes. Practice labs sit alongside the modules.</p>
      {!user && <Notice>You can read every lesson without an account. <Link to="/auth">Sign in</Link> to save completion and quiz scores.</Notice>}
      <div className="grid" style={{ marginTop: '1.4rem' }}>
        {LEVELS.map((lv, li) => {
          const c = lv.lessons.filter((l) => done.has(l.id)).length
          return (
            <Reveal key={lv.n} i={li}>
              <div className="card">
                <div className="row" style={{ alignItems: 'flex-start', gap: '1rem' }}>
                  <div className="level-badge">{lv.n}</div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <h2 style={{ marginBottom: '.2rem' }}>{lv.title}</h2>
                    <p className="muted" style={{ margin: 0 }}>{lv.blurb}</p>
                    {lv.lessons.length > 0 && <div style={{ marginTop: '.7rem' }}><div className="bar"><motion.div initial={{ width: 0 }} whileInView={{ width: `${(100 * c) / lv.lessons.length}%` }} viewport={{ once: true }} transition={{ duration: .8, ease: 'easeOut' }} /></div><span className="muted small">{c}/{lv.lessons.length} lessons complete</span></div>}
                  </div>
                  {lv.lab && <Link className="btn sm" to={lv.lab.to}>{lv.lab.label}</Link>}
                </div>
                <div style={{ marginTop: '1rem' }}>
                  {lv.lessons.map((l) => (
                    <Link key={l.id} to={`/academy/${l.id}`} className="lesson-row">
                      {done.has(l.id) ? <CheckCircle2 size={18} color="var(--good)" /> : <Circle size={18} color="var(--muted)" />}
                      <span style={{ flex: 1 }}><b>{l.title}</b></span><span className="chip"><Clock size={12} />{l.minutes} min</span>
                    </Link>
                  ))}
                  {lv.planned.map((t) => (
                    <div key={t} className="lesson-row planned"><Lock size={16} /><span style={{ flex: 1 }}>{t}</span><span className="chip warn">Planned</span></div>
                  ))}
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </>
  )
}
