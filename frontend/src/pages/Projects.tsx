import { motion } from 'framer-motion'
import { ArrowLeft, Briefcase, Check, Download, ExternalLink, FolderOpen, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_BASE, api, errMsg } from '../api'
import { Notice, Reveal, Skeletons, Tabs } from '../components/ui'
import { useApp } from '../ctx'
import { checklistOf, DICT, findProject, PROJECTS } from '../data/projects'

type Prog = Record<string, { checklist: string[]; findings: string; completed: boolean }>
export function useProjectProgress() {
  const [p, setP] = useState<Prog | null>(null)
  const load = () => api.get('/projects/progress').then((r) => setP(r.data)).catch(() => setP({}))
  useEffect(() => { load() }, [])
  return { p, reload: load }
}

export function ProjectList() {
  const { p } = useProjectProgress()
  const [lvl, setLvl] = useState('All')
  const list = PROJECTS.filter((x) => lvl === 'All' || x.level === lvl)
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Guided <span className="grad">Projects</span></h1>
      <p className="muted" style={{ maxWidth: 760 }}>Ten portfolio-style projects. Each has a business problem, a dataset (built-in synthetic data or the SQL Lab database), a data dictionary, steps, validation checks and a place for your own findings. A project counts as complete only when every checklist item is ticked and you have written findings.</p>
      <div className="row" style={{ margin: '1rem 0' }}>{['All', 'Beginner', 'Intermediate', 'Advanced'].map((l) => <button key={l} className={'btn sm' + (lvl === l ? ' primary' : '')} onClick={() => setLvl(l)}>{l}</button>)}</div>
      {!p ? <Skeletons n={3} /> : <div className="grid g3">{list.map((x, i) => {
        const n = checklistOf(x).length, d = p[x.id]?.checklist.length || 0
        return (
          <Reveal key={x.id} i={i}><Link to={`/projects/${x.id}`} className="card hover" style={{ color: 'inherit', display: 'block', height: '100%' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="chip">{x.level}</span>{p[x.id]?.completed && <span className="chip good"><Check size={12} />Completed</span>}</div>
            <h3 style={{ marginTop: '.6rem' }}>{x.title}</h3><p className="muted small">{x.problem}</p>
            <div className="row" style={{ marginBottom: '.6rem' }}>{x.tools.map((t) => <span key={t} className="chip" style={{ fontSize: '.7rem' }}>{t}</span>)}</div>
            <div className="bar"><motion.div initial={{ width: 0 }} animate={{ width: `${(100 * d) / n}%` }} transition={{ duration: .7 }} /></div><span className="muted small">{d}/{n} checklist items</span></Link></Reveal>)
      })}</div>}
    </>
  )
}

type T = 'brief' | 'data' | 'work' | 'findings'
export function ProjectDetail() {
  const { id } = useParams()
  const proj = findProject(id)
  const { toast, refreshSummary } = useApp()
  const nav = useNavigate()
  const { p, reload } = useProjectProgress()
  const [tab, setTab] = useState<T>('brief')
  const [done, setDone] = useState<string[]>([])
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { if (p && proj && !loaded) { setDone(p[proj.id]?.checklist || []); setText(p[proj.id]?.findings || ''); setLoaded(true) } }, [p])
  if (!proj) return <div className="empty"><h2>Project not found</h2><Link className="btn primary" to="/projects">All projects</Link></div>
  const items = checklistOf(proj)
  const complete = done.length >= items.length && items.every((i) => done.includes(i.id)) && text.trim().length >= 40
  const persist = async (d = done, t = text) => {
    const ok = items.every((i) => d.includes(i.id)) && t.trim().length >= 40
    try { await api.put(`/projects/${proj.id}`, { checklist: d, findings: t, completed: ok }); reload(); refreshSummary(); return ok } catch (e) { toast(errMsg(e), 'error'); return false }
  }
  const tick = (iid: string) => { const d = done.includes(iid) ? done.filter((x) => x !== iid) : [...done, iid]; setDone(d); persist(d) }
  const importData = async () => { try { const r = await api.post(`/samples/${proj.sample}/import`); nav(`/workspace?dataset=${r.data.id}`) } catch (e) { toast(errMsg(e), 'error') } }
  const dict = proj.sample ? DICT[proj.sample] : null
  return (
    <>
      <Link to="/projects" className="btn sm"><ArrowLeft size={14} />All projects</Link>
      <div className="row" style={{ margin: '1rem 0 .4rem' }}><span className="chip">{proj.level}</span>{proj.tools.map((t) => <span key={t} className="chip">{t}</span>)}{p?.[proj.id]?.completed && <span className="chip good"><Check size={12} />Completed</span>}</div>
      <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{proj.title}</h1>
      <Tabs id="proj" value={tab} onChange={setTab} tabs={[{ key: 'brief', label: 'Brief' }, { key: 'data', label: 'Dataset' }, { key: 'work', label: `Checklist (${done.length}/${items.length})` }, { key: 'findings', label: 'My findings' }]} />
      <motion.div key={tab} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .25 }}>
        {tab === 'brief' && <div className="grid g2">
          <div className="card"><h3>Business problem</h3><p>{proj.problem}</p><h3>Objectives</h3><ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{proj.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>
          <div className="card"><h3>Questions to answer</h3><ul style={{ paddingLeft: '1.2rem' }}>{proj.questions.map((o) => <li key={o}>{o}</li>)}</ul><h3>Suggested KPIs</h3><div className="row">{proj.kpis.map((k) => <span key={k} className="chip">{k}</span>)}</div><h3 style={{ marginTop: '1rem' }}>Suggested visuals</h3><ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{proj.visuals.map((o) => <li key={o}>{o}</li>)}</ul></div>
          <div className="card"><h3>Expected outcome</h3><p style={{ margin: 0 }}>{proj.expected}</p></div>
          <div className="card"><h3>Publishing guidance</h3><p style={{ margin: 0 }}>{proj.publish}</p></div>
          {proj.lab && <Link className="btn primary" to={proj.lab.to}><ExternalLink size={16} />{proj.lab.label}</Link>}
        </div>}
        {tab === 'data' && <div className="card">
          {proj.sample ? <>
            <p>Built-in <b>synthetic</b> dataset “{proj.sample}” (generated, not real people or companies; it is separate from anything you upload).</p>
            <div className="row" style={{ marginBottom: '1rem' }}><a className="btn" href={`${API_BASE}/api/samples/${proj.sample}/download`}><Download size={16} />Download CSV</a><button className="btn primary" onClick={importData}><FolderOpen size={16} />Open in Analytics Workspace</button></div>
            <h3>Data dictionary</h3><div className="table-wrap"><table><thead><tr><th>Field</th><th>Description</th></tr></thead><tbody>{dict!.map(([f, d]) => <tr key={f}><td><code>{f}</code></td><td style={{ whiteSpace: 'normal' }}>{d}</td></tr>)}</tbody></table></div>
          </> : <p>{proj.datasetNote}</p>}
        </div>}
        {tab === 'work' && <div className="card">
          {['Steps', 'Validation'].map((g) => <div key={g}><h3>{g}</h3>{items.filter((i) => i.group === g).map((i) => <label key={i.id} className={'check' + (done.includes(i.id) ? ' on' : '')} style={{ display: 'flex', borderRadius: 12, marginBottom: '.4rem', fontSize: '.92rem' }}><input type="checkbox" checked={done.includes(i.id)} onChange={() => tick(i.id)} />{i.t}</label>)}</div>)}
          <p className="muted small">Ticks are saved to your account automatically.</p>
        </div>}
        {tab === 'findings' && <div className="card">
          <h3>Your findings</h3><Notice>Write what <b>you</b> found, in your own words, with the actual numbers you computed. A project is marked complete when all checklist items are ticked and your findings are at least 40 characters.</Notice>
          <textarea rows={9} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. North had the highest sales (₹…), but West had the best margin…" aria-label="Findings" />
          <div className="row" style={{ marginTop: '.8rem' }}><button className="btn primary" onClick={async () => { const ok = await persist(); toast(ok ? 'Saved — project complete!' : 'Findings saved.', 'success') }}><Save size={16} />Save findings</button>
            <span className="muted small">{text.length}/4000 · {complete ? 'Ready to complete' : 'Not complete yet'}</span>
            {p?.[proj.id]?.completed && <Link className="btn" to={`/portfolio?add=${proj.id}`}><Briefcase size={16} />Add to portfolio</Link>}</div>
        </div>}
      </motion.div>
    </>
  )
}
