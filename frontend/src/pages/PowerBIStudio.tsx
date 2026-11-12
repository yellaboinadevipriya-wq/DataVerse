import { BookOpen, Calculator, LayoutDashboard, Link2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import EmbedPanel from '../components/Embed'
import PowerBISim from '../components/PowerBISim'
import { Notice, Tabs } from '../components/ui'
import { useApp } from '../ctx'
import { LEVELS } from '../data/curriculum'

type K = 'lessons' | 'report' | 'measures' | 'embed'
export default function PowerBIStudio() {
  const [sp, setSp] = useSearchParams()
  const { user, progress } = useApp()
  const tab = (sp.get('tab') as K) || 'lessons'
  const mod = LEVELS.find((l) => l.n === 8)!
  const done = new Set(progress.completed.map((c) => c.lesson_id))
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Power BI <span className="grad">Studio</span></h1>
      <p className="muted" style={{ maxWidth: 760 }}>Lessons on modelling, DAX and report design, a report-editor simulation with slicers and cross-filtering, a DAX filter-context explorer, and embedding for your own published reports. The simulations are educational models, not Power BI itself.</p>
      <Tabs id="pb" value={tab} onChange={(k) => setSp({ tab: k })} tabs={[{ key: 'lessons', label: 'Lessons', icon: <BookOpen size={16} /> }, { key: 'report', label: 'Report editor', icon: <LayoutDashboard size={16} /> }, { key: 'measures', label: 'Measures (DAX)', icon: <Calculator size={16} /> }, { key: 'embed', label: 'My Power BI reports', icon: <Link2 size={16} /> }]} />
      {tab === 'lessons' && <div className="grid g2">{mod.lessons.map((l, i) => (
        <Link key={l.id} to={`/academy/${l.id}`} className="card hover" style={{ color: 'inherit' }}><span className="chip">{i + 1} · {l.minutes} min{done.has(l.id) ? ' · done' : ''}</span><h3 style={{ marginTop: '.6rem' }}>{l.title}</h3><p className="muted small" style={{ margin: 0 }}>{l.objectives[0]}</p></Link>))}</div>}
      {(tab === 'report' || tab === 'measures') && <PowerBISim tab={tab} analysisId={sp.get('analysis')} />}
      {tab === 'embed' && (user ? <EmbedPanel kind="powerbi" /> : <Notice>Sign in to save and embed your own reports. <Link to="/auth">Sign in</Link></Notice>)}
    </>
  )
}
