import { BarChart3, Database, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Empty, Reveal, Skeletons } from '../components/ui'
import { errMsg, useApp } from '../ctx'

const KIND: Record<string, string> = { 'tableau-sim': 'Tableau simulator worksheet', 'pbi-sim': 'Power BI simulator report' }
const label = (x: any) => KIND[x.config?.kind] || x.dataset_name || 'Dataset deleted'
const reopen = (x: any) => x.config?.kind === 'tableau-sim' ? `/tableau?tab=sim&analysis=${x.id}` : x.config?.kind === 'pbi-sim' ? `/powerbi?tab=report&analysis=${x.id}` : `/workspace?dataset=${x.dataset_id}&tab=charts&analysis=${x.id}`

export default function Saved() {
  const { toast, refreshSummary } = useApp()
  const [a, setA] = useState<any[] | null>(null)
  const [d, setD] = useState<any[] | null>(null)
  const load = () => { api.get('/analyses').then((r) => setA(r.data)); api.get('/datasets').then((r) => setD(r.data)) }
  useEffect(load, [])
  const del = async (url: string, what: string) => {
    if (!confirm(`Delete this ${what}? This cannot be undone.`)) return
    try { await api.delete(url); load(); refreshSummary(); toast('Deleted.', 'success') } catch (e) { toast(errMsg(e), 'error') }
  }
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Saved <span className="grad">work</span></h1>
      <div className="section" style={{ marginTop: '1.5rem' }}>
        <h2>Analyses</h2>
        {a === null ? <Skeletons n={2} /> : !a.length ? <div className="card"><Empty icon={<BarChart3 size={34} />} title="No saved analyses yet">Build a chart in the Workspace and press “Save analysis”.</Empty></div> : (
          <div className="grid g3">{a.map((x, i) => (
            <Reveal key={x.id} i={i}><div className="card hover"><h3>{x.title}</h3><p className="muted small">{label(x)} · {new Date(x.created_at).toLocaleString()}</p>
              <div className="row"><Link className="btn primary sm" to={reopen(x)}>Reopen</Link><button className="btn sm danger" onClick={() => del(`/analyses/${x.id}`, 'analysis')}><Trash2 size={14} /></button></div></div></Reveal>))}</div>
        )}
      </div>
      <div className="section">
        <h2>Datasets</h2>
        {d === null ? <Skeletons n={2} /> : !d.length ? <div className="card"><Empty icon={<Database size={34} />} title="No datasets yet">Upload a CSV or Excel file in the Workspace.</Empty></div> : (
          <div className="grid g3">{d.map((x, i) => (
            <Reveal key={x.id} i={i}><div className="card hover"><h3>{x.name}</h3><p className="muted small">{x.rows.toLocaleString()} rows × {x.cols} cols · {x.operations.length} cleaning step(s)</p>
              <div className="row"><Link className="btn primary sm" to={`/workspace?dataset=${x.id}`}>Open</Link><button className="btn sm danger" onClick={() => del(`/datasets/${x.id}`, 'dataset and its files')}><Trash2 size={14} /></button></div></div></Reveal>))}</div>
        )}
      </div>
    </>
  )
}
