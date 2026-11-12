import { BookOpen, Link2, MousePointerClick } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import EmbedPanel from '../components/Embed'
import TableauSim from '../components/TableauSim'
import { Notice, Tabs } from '../components/ui'
import { useApp } from '../ctx'
import { LEVELS } from '../data/curriculum'

type K = 'lessons' | 'sim' | 'embed'
export default function TableauStudio() {
  const [sp, setSp] = useSearchParams()
  const { user, progress } = useApp()
  const tab = (sp.get('tab') as K) || 'lessons'
  const mod = LEVELS.find((l) => l.n === 7)!
  const done = new Set(progress.completed.map((c) => c.lesson_id))
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Tableau <span className="grad">Studio</span></h1>
      <p className="muted" style={{ maxWidth: 760 }}>Learn Tableau concepts with lessons and a hands-on worksheet simulation, then embed your own published Tableau Public dashboards. The simulator is an educational model, not Tableau itself.</p>
      <Tabs id="tb" value={tab} onChange={(k) => setSp({ tab: k })} tabs={[{ key: 'lessons', label: 'Lessons', icon: <BookOpen size={16} /> }, { key: 'sim', label: 'Worksheet simulator', icon: <MousePointerClick size={16} /> }, { key: 'embed', label: 'My Tableau dashboards', icon: <Link2 size={16} /> }]} />
      {tab === 'lessons' && <div className="grid g2">{mod.lessons.map((l, i) => (
        <Link key={l.id} to={`/academy/${l.id}`} className="card hover" style={{ color: 'inherit' }}><span className="chip">{i + 1} · {l.minutes} min{done.has(l.id) ? ' · done' : ''}</span><h3 style={{ marginTop: '.6rem' }}>{l.title}</h3><p className="muted small" style={{ margin: 0 }}>{l.objectives[0]}</p></Link>))}</div>}
      {tab === 'sim' && <TableauSim analysisId={sp.get('analysis')} />}
      {tab === 'embed' && (user ? <EmbedPanel kind="tableau" /> : <Notice>Sign in to save and embed your own dashboards. <Link to="/auth">Sign in</Link></Notice>)}
    </>
  )
}
