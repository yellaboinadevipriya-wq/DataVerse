import { ExternalLink, FileText } from 'lucide-react'

export default function PortfolioView({ d }: { d: any }) {
  const link = (u: string, label: string) => <a key={label + u} className="btn sm" href={u} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink size={13} />{label}</a>
  return (
    <div className="grid">
      <div className="card">
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', marginBottom: '.2rem' }}>{d.name || 'Your name'}</h1>
        <p className="grad" style={{ font: '600 1.15rem Space Grotesk' }}>{d.headline || 'Your professional headline'}</p>
        {d.bio && <p style={{ whiteSpace: 'pre-wrap' }}>{d.bio}</p>}
        <div className="row">{Object.entries(d.links || {}).filter(([, u]) => u).map(([k, u]) => link(u as string, k[0].toUpperCase() + k.slice(1)))}
          {d.resume_url && <a className="btn sm" href={d.resume_url} target="_blank" rel="noopener noreferrer nofollow"><FileText size={13} />Resume</a>}</div>
      </div>
      <div className="grid g2">
        {d.skills?.length > 0 && <div className="card"><h3>Skills</h3><div className="row">{d.skills.map((s: string) => <span key={s} className="chip">{s}</span>)}</div></div>}
        {(d.education || d.goals) && <div className="card">{d.education && <><h3>Education</h3><p style={{ whiteSpace: 'pre-wrap' }}>{d.education}</p></>}{d.goals && <><h3>Career goals</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.goals}</p></>}</div>}
        {d.progress && <div className="card"><h3>Learning progress</h3><p className="muted small" style={{ margin: 0 }}>{d.progress.lessons_completed} lessons completed · {d.progress.sql_challenges_solved} SQL challenges solved · {d.progress.projects_completed} guided projects completed (self-tracked on DataVerse)</p></div>}
      </div>
      {d.projects?.length > 0 && <><h2>Projects</h2><div className="grid g2">{d.projects.map((p: any, i: number) => (
        <div className="card" key={i}><h3>{p.title}</h3>{p.summary && <p>{p.summary}</p>}
          {p.tools?.length > 0 && <div className="row" style={{ marginBottom: '.6rem' }}>{p.tools.map((t: string) => <span key={t} className="chip">{t}</span>)}</div>}
          {p.dataset && <p className="small"><b>Dataset:</b> {p.dataset}</p>}{p.methodology && <p className="small"><b>Method:</b> {p.methodology}</p>}{p.findings && <p className="small"><b>Findings:</b> {p.findings}</p>}
          <div className="row">{Object.entries(p.links || {}).filter(([, u]) => u).map(([k, u]) => <a key={k} className="btn sm" href={u as string} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink size={13} />{k[0].toUpperCase() + k.slice(1)}</a>)}</div></div>))}</div></>}
    </div>
  )
}
