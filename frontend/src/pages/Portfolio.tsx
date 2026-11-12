import { motion } from 'framer-motion'
import { Copy, Download, Eye, EyeOff, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, errMsg, saveBlob } from '../api'
import PortfolioView from '../components/PortfolioView'
import { Notice, Skeletons, Tabs } from '../components/ui'
import { useApp } from '../ctx'
import { findProject, PROJECTS } from '../data/projects'

const blankProject = () => ({ title: '', summary: '', tools: [] as string[], dataset: '', methodology: '', findings: '', links: {} as Record<string, string>, public: false })
type T = 'profile' | 'projects' | 'links' | 'publish' | 'preview'

export default function Portfolio() {
  const { user, toast } = useApp()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const [d, setD] = useState<any>(null)
  const [tab, setTab] = useState<T>('profile')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (patch: any) => { setD((x: any) => ({ ...x, ...patch })); setDirty(true) }
  useEffect(() => {
    Promise.all([api.get('/portfolio'), api.get('/projects/progress')]).then(([r, pr]) => {
      let data = r.data
      const add = findProject(sp.get('add') || '')
      if (add && !data.projects.some((p: any) => p.title === add.title)) {
        data = { ...data, projects: [...data.projects, { ...blankProject(), title: add.title, tools: add.tools, dataset: add.sample ? `Synthetic “${add.sample}” sample dataset from DataVerse` : add.datasetNote || '', findings: pr.data[add.id]?.findings || '' }] }
        setDirty(true); setTab('projects'); setSp({}, { replace: true })
      }
      setD(data)
    }).catch((e) => toast(errMsg(e), 'error'))
  }, [])
  if (!d) return <Skeletons n={3} />
  const url = d.slug ? `${location.origin}/p/${d.slug}` : ''
  const body = () => ({ headline: d.headline, bio: d.bio, education: d.education, goals: d.goals, skills: d.skills, links: d.links, resume_url: d.resume_url, is_public: d.is_public, show_progress: d.show_progress, projects: d.projects })
  const save = async () => {
    setBusy(true)
    try { const r = await api.put('/portfolio', body()); setD({ ...d, ...r.data }); setDirty(false); toast('Portfolio saved.', 'success') } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }
  const setProj = (i: number, patch: any) => set({ projects: d.projects.map((p: any, k: number) => (k === i ? { ...p, ...patch } : p)) })
  const exportMd = () => {
    const md = [`# ${user?.name}`, d.headline && `**${d.headline}**`, d.bio, d.skills.length && `## Skills\n${d.skills.join(', ')}`, d.education && `## Education\n${d.education}`, d.goals && `## Career goals\n${d.goals}`,
      d.projects.length && '## Projects\n' + d.projects.map((p: any) => [`### ${p.title}`, p.summary, p.tools.length && `Tools: ${p.tools.join(', ')}`, p.dataset && `Dataset: ${p.dataset}`, p.methodology && `Method: ${p.methodology}`, p.findings && `Findings: ${p.findings}`, ...Object.entries(p.links).map(([k, u]) => `- ${k}: ${u}`)].filter(Boolean).join('\n\n')).join('\n\n')].filter(Boolean).join('\n\n')
    saveBlob(new Blob([md], { type: 'text/markdown' }), 'portfolio.md')
  }
  const done = PROJECTS.length
  const preview = { ...body(), name: user?.name, projects: d.projects }
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Portfolio <span className="grad">Studio</span></h1>
      <Notice>Present real outcomes honestly: describe what you actually did and found, with real numbers. Do not add certificates, jobs or results you have not earned, and say when a project used synthetic data. Your portfolio is <b>private</b> until you publish it.</Notice>
      <div className="row" style={{ justifyContent: 'space-between' }}><Tabs id="pf" value={tab} onChange={setTab} tabs={[{ key: 'profile', label: 'Profile' }, { key: 'projects', label: `Projects (${d.projects.length})` }, { key: 'links', label: 'Links & resume' }, { key: 'publish', label: 'Privacy & sharing' }, { key: 'preview', label: 'Preview' }]} />
        <div className="row" style={{ marginBottom: '1.2rem' }}>{dirty && <span className="chip warn">Unsaved changes</span>}<button className="btn primary" onClick={save} disabled={busy}><Save size={16} />Save</button></div></div>
      <motion.div key={tab} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .25 }}>
        {tab === 'profile' && <div className="card">
          <div className="field"><label htmlFor="hl">Professional headline</label><input id="hl" maxLength={140} placeholder="Aspiring Data Analyst · SQL · Power BI" value={d.headline} onChange={(e) => set({ headline: e.target.value })} /></div>
          <div className="field"><label htmlFor="bio">About you</label><textarea id="bio" rows={5} maxLength={2000} value={d.bio} onChange={(e) => set({ bio: e.target.value })} /></div>
          <div className="field"><label htmlFor="sk">Skills (comma separated)</label><input id="sk" value={d.skills.join(', ')} onChange={(e) => set({ skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40) })} /></div>
          <div className="grid g2"><div className="field"><label htmlFor="ed">Education</label><textarea id="ed" rows={3} maxLength={500} value={d.education} onChange={(e) => set({ education: e.target.value })} /></div>
            <div className="field"><label htmlFor="go">Career goals</label><textarea id="go" rows={3} maxLength={800} value={d.goals} onChange={(e) => set({ goals: e.target.value })} /></div></div>
        </div>}
        {tab === 'projects' && <div className="grid">
          {!d.projects.length && <Notice>No projects yet. Add one below, or complete a guided project and use “Add to portfolio” on its findings tab.</Notice>}
          {d.projects.map((p: any, i: number) => (
            <div key={i} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>Project {i + 1}</h3><button className="btn sm danger" onClick={() => set({ projects: d.projects.filter((_: any, k: number) => k !== i) })}><Trash2 size={14} />Remove</button></div>
              <div className="grid g2" style={{ marginTop: '.8rem' }}>
                <div className="field"><label>Title</label><input maxLength={120} value={p.title} onChange={(e) => setProj(i, { title: e.target.value })} /></div>
                <div className="field"><label>Tools (comma separated)</label><input value={p.tools.join(', ')} onChange={(e) => setProj(i, { tools: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15) })} /></div>
              </div>
              <div className="field"><label>Summary</label><textarea rows={2} maxLength={600} value={p.summary} onChange={(e) => setProj(i, { summary: e.target.value })} /></div>
              <div className="field"><label>Dataset</label><input maxLength={200} value={p.dataset} onChange={(e) => setProj(i, { dataset: e.target.value })} /></div>
              <div className="grid g2"><div className="field"><label>Methodology</label><textarea rows={3} maxLength={1500} value={p.methodology} onChange={(e) => setProj(i, { methodology: e.target.value })} /></div>
                <div className="field"><label>Findings (your real results)</label><textarea rows={3} maxLength={1500} value={p.findings} onChange={(e) => setProj(i, { findings: e.target.value })} /></div></div>
              <div className="grid g3">{['github', 'tableau', 'powerbi'].map((k) => <div className="field" key={k}><label>{k === 'powerbi' ? 'Power BI' : k[0].toUpperCase() + k.slice(1)} link</label><input type="url" placeholder="https://…" value={p.links[k] || ''} onChange={(e) => setProj(i, { links: { ...p.links, [k]: e.target.value } })} /></div>)}</div>
              <label className={'check' + (p.public ? ' on' : '')} style={{ display: 'inline-flex' }}><input type="checkbox" checked={p.public} onChange={(e) => setProj(i, { public: e.target.checked })} />Show this project on my public portfolio</label>
            </div>))}
          {d.projects.length < 20 && <button className="btn" onClick={() => set({ projects: [...d.projects, blankProject()] })}><Plus size={16} />Add project</button>}
        </div>}
        {tab === 'links' && <div className="card">
          {['github', 'linkedin', 'website'].map((k) => <div className="field" key={k}><label>{k[0].toUpperCase() + k.slice(1)}</label><input type="url" placeholder="https://…" value={d.links[k] || ''} onChange={(e) => set({ links: { ...d.links, [k]: e.target.value } })} /></div>)}
          <div className="field"><label>Resume link (https)</label><input type="url" placeholder="https://drive.google.com/…" value={d.resume_url} onChange={(e) => set({ resume_url: e.target.value })} /></div>
          <p className="muted small" style={{ marginBottom: 0 }}>Resume file upload and screenshot upload are not supported yet: link to a resume you host elsewhere.</p>
        </div>}
        {tab === 'publish' && <div className="card">
          <h3>{d.is_public ? <Eye size={18} style={{ verticalAlign: -3 }} /> : <EyeOff size={18} style={{ verticalAlign: -3 }} />} Visibility</h3>
          <label className={'check' + (d.is_public ? ' on' : '')} style={{ display: 'inline-flex', marginBottom: '.6rem' }}><input type="checkbox" checked={d.is_public} onChange={(e) => set({ is_public: e.target.checked })} />Publish my portfolio at a public link</label><br />
          <label className={'check' + (d.show_progress ? ' on' : '')} style={{ display: 'inline-flex' }}><input type="checkbox" checked={d.show_progress} onChange={(e) => set({ show_progress: e.target.checked })} />Show learning-progress counts</label>
          <p className="muted small">Public pages show your name, headline, bio, skills, education, goals, links, resume link and only the projects you marked public. Your email is never shown. Save after changing these options.</p>
          {url ? <div className="row"><code style={{ flex: 1, wordBreak: 'break-all' }}>{url}</code><button className="btn sm" onClick={() => { navigator.clipboard?.writeText(url); toast('Link copied.', 'success') }}><Copy size={14} />Copy</button>
            <button className="btn sm" onClick={async () => { if (confirm('Generate a new link? The old link will stop working.')) { try { const r = await api.post('/portfolio/regenerate-slug'); setD({ ...d, slug: r.data.slug }) } catch (e) { toast(errMsg(e), 'error') } } }}><RefreshCw size={14} />New link</button>
            {d.is_public && !dirty && <a className="btn sm" href={url} target="_blank" rel="noopener noreferrer">Open</a>}</div> : <Notice>Save once to generate your shareable link.</Notice>}
          <h3 style={{ marginTop: '1.2rem' }}>Export</h3><div className="row"><button className="btn" onClick={exportMd}><Download size={16} />Markdown</button><button className="btn" onClick={() => saveBlob(new Blob([JSON.stringify(body(), null, 2)], { type: 'application/json' }), 'portfolio.json')}><Download size={16} />JSON</button></div>
        </div>}
        {tab === 'preview' && <><p className="muted small">This is how your public page looks (all projects shown here; only “public” ones appear publicly).</p><PortfolioView d={preview} /></>}
      </motion.div>
    </>
  )
}
