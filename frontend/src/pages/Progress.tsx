import { motion } from 'framer-motion'
import { Award, BarChart3, Database, Eraser, FolderKanban, GraduationCap, Rocket, Star } from 'lucide-react'
import { Reveal } from '../components/ui'
import { useApp } from '../ctx'
import { ALL_LESSONS, LEVELS } from '../data/curriculum'

export default function ProgressPage() {
  const { progress, summary } = useApp()
  const done = new Set(progress.completed.map((c) => c.lesson_id))
  const s = summary || { datasets: 0, analyses: 0, lessons_completed: 0, quiz_attempts: 0, perfect_quizzes: 0, cleaning_steps: 0, sql_solved: 0, projects_completed: 0 }
  const lvl1 = LEVELS[0].lessons.every((l) => done.has(l.id))
  const badges = [
    { i: GraduationCap, t: 'First Steps', d: 'Complete your first lesson', ok: s.lessons_completed >= 1 },
    { i: Star, t: 'Quiz Ace', d: 'Score 100% on a quiz', ok: s.perfect_quizzes >= 1 },
    { i: Rocket, t: 'Data Explorer', d: 'Upload your first dataset', ok: s.datasets >= 1 },
    { i: Eraser, t: 'Data Janitor', d: 'Apply a cleaning step', ok: s.cleaning_steps >= 1 },
    { i: BarChart3, t: 'Storyteller', d: 'Save an analysis', ok: s.analyses >= 1 },
    { i: Database, t: 'Query Apprentice', d: 'Solve 3 SQL Lab challenges', ok: s.sql_solved >= 3 },
    { i: FolderKanban, t: 'Project Builder', d: 'Complete a guided project', ok: s.projects_completed >= 1 },
    { i: Award, t: 'Foundations Done', d: 'Complete every Level 1 lesson', ok: lvl1 },
  ]
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Your <span className="grad">progress</span></h1>
      <p className="muted">Everything here is computed from your real activity — nothing is pre-filled.</p>
      <div className="grid g4" style={{ margin: '1.2rem 0' }}>
        {[[s.lessons_completed + '/' + ALL_LESSONS.length, 'lessons completed'], [s.quiz_attempts, 'quiz attempts'], [s.datasets, 'datasets'], [s.analyses, 'saved analyses'], [s.sql_solved + '/8', 'SQL challenges'], [s.projects_completed + '/10', 'projects completed']].map(([n, l], i) => (
          <Reveal key={l as string} i={i}><div className="card stat"><b>{n}</b><span>{l}</span></div></Reveal>))}
      </div>
      <div className="section" style={{ marginTop: '2rem' }}>
        <h2>Achievements</h2>
        <div className="grid g3">{badges.map((b, i) => (
          <Reveal key={b.t} i={i}><div className={'card badge-card' + (b.ok ? '' : ' locked')}>
            <motion.div animate={b.ok ? { rotate: [0, -8, 8, 0] } : {}} transition={{ delay: .5, duration: .6 }} style={{ display: 'inline-block' }}><b.i size={30} color={b.ok ? 'var(--accent2)' : 'var(--muted)'} /></motion.div>
            <h3>{b.t}</h3><p className="muted small" style={{ margin: 0 }}>{b.d} · {b.ok ? <span style={{ color: 'var(--good)' }}>Unlocked</span> : 'Locked'}</p></div></Reveal>))}</div>
      </div>
      <div className="section" style={{ marginTop: '2rem' }}>
        <h2>Level progress</h2>
        <div className="card">{LEVELS.map((lv) => { const c = lv.lessons.filter((l) => done.has(l.id)).length; const pct = lv.lessons.length ? (100 * c) / lv.lessons.length : 0
          return <div key={lv.n} style={{ marginBottom: '.9rem' }}><div className="row" style={{ justifyContent: 'space-between' }}><b>Level {lv.n} · {lv.title}</b><span className="muted small">{lv.lessons.length ? `${c}/${lv.lessons.length}` : 'lessons planned'}</span></div>
            <div className="bar"><motion.div initial={{ width: 0 }} animate={{ width: pct + '%' }} transition={{ duration: .8 }} /></div></div> })}</div>
      </div>
      <div className="section" style={{ marginTop: '2rem' }}>
        <h2>Quiz history</h2>
        {!progress.quiz_attempts.length ? <p className="muted">No attempts yet.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Lesson</th><th>Score</th><th>When</th></tr></thead><tbody>
            {progress.quiz_attempts.slice(0, 15).map((a) => <tr key={a.id}><td>{ALL_LESSONS.find((l) => l.id === a.lesson_id)?.title || a.lesson_id}</td><td>{a.score}/{a.total}</td><td>{new Date(a.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </>
  )
}
