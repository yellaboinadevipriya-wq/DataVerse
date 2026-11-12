import { motion } from 'framer-motion'
import { CheckCircle2, Database, Lightbulb, Play, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errMsg, fmt } from '../api'
import { Notice, Skeletons, Spinner } from '../components/ui'
import { useApp } from '../ctx'

function ResultTable({ r }: { r: any }) {
  return (
    <>
      <div className="table-wrap" style={{ maxHeight: 320 }}><table><thead><tr>{r.columns.map((c: string, i: number) => <th key={i}>{c}</th>)}</tr></thead><tbody>
        {r.rows.map((row: any[], i: number) => <tr key={i}>{row.map((v, j) => v == null ? <td key={j} className="null">NULL</td> : <td key={j}>{typeof v === 'number' ? fmt(v) : String(v)}</td>)}</tr>)}</tbody></table></div>
      <p className="muted small">{r.row_count} row(s){r.truncated ? ' (showing the first 200)' : ''}</p>
    </>
  )
}

export default function SqlLab() {
  const { toast, refreshSummary } = useApp()
  const [schema, setSchema] = useState<any[] | null>(null)
  const [ch, setCh] = useState<any[] | null>(null)
  const [sel, setSel] = useState<any>(null)
  const [q, setQ] = useState('SELECT region, ROUND(SUM(sales), 2) AS total_sales\nFROM orders\nGROUP BY region\nORDER BY total_sales DESC')
  const [res, setRes] = useState<any>(null)
  const [verdict, setVerdict] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState(false)
  const loadCh = () => api.get('/sql/challenges').then((r) => { setCh(r.data); setSel((s: any) => (s ? r.data.find((c: any) => c.id === s.id) : null)) })
  useEffect(() => { api.get('/sql/schema').then((r) => setSchema(r.data)).catch((e) => setErr(errMsg(e))); loadCh().catch((e) => setErr(errMsg(e))) }, [])
  const run = async () => { setBusy(true); setErr(''); setVerdict(null); try { setRes((await api.post('/sql/run', { query: q })).data) } catch (e) { setErr(errMsg(e)); setRes(null) } finally { setBusy(false) } }
  const check = async () => {
    if (!sel) return
    setBusy(true); setErr('')
    try { const r = (await api.post('/sql/check', { challenge_id: sel.id, query: q })).data; setVerdict(r); setRes(r.result); if (r.correct) { toast('Challenge solved!', 'success'); loadCh(); refreshSummary() } }
    catch (e) { setErr(errMsg(e)); setVerdict(null) } finally { setBusy(false) }
  }
  const pick = (c: any) => { setSel(c); setVerdict(null); setHint(false) }
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>SQL <span className="grad">Lab</span></h1>
      <p className="muted" style={{ maxWidth: 760 }}>Practise on a safe, read-only copy of the synthetic retail database. Only single SELECT/WITH queries run, with a 2-second limit, and nothing you do can change the data. Challenges are checked by comparing your result with the expected result.</p>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(220px,280px) 1fr', alignItems: 'start' }}>
        <div>
          <div className="card flat"><h3><Database size={16} style={{ verticalAlign: -2 }} /> Tables</h3>
            {!schema ? <Spinner /> : schema.map((t) => <details key={t.table}><summary>{t.table} <span className="muted small">({t.rows.toLocaleString()} rows)</span></summary>{t.columns.map((c: any) => <div key={c.name} className="small muted">{c.name} <i>{c.type}</i></div>)}</details>)}</div>
          <div className="card flat" style={{ marginTop: '1rem' }}><h3>Challenges</h3>
            {!ch ? <Spinner /> : ch.map((c) => (
              <button key={c.id} className="lesson-row" style={{ width: '100%', background: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left', borderColor: sel?.id === c.id ? 'var(--accent2)' : undefined }} onClick={() => pick(c)}>
                {c.solved ? <CheckCircle2 size={16} color="var(--good)" /> : <span style={{ width: 16 }} />}<span style={{ flex: 1 }}>{c.title}</span><span className="chip" style={{ fontSize: '.65rem' }}>{c.level}</span></button>))}
            {ch && <p className="muted small" style={{ marginBottom: 0 }}>{ch.filter((c) => c.solved).length}/{ch.length} solved</p>}</div>
        </div>
        <div>
          {sel && <motion.div key={sel.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="card" style={{ marginBottom: '1rem' }}>
            <h3>{sel.title} <span className="chip">{sel.level}</span></h3><p style={{ margin: 0 }}>{sel.prompt}</p>
            <button className="btn sm" style={{ marginTop: '.6rem' }} onClick={() => setHint(!hint)}><Lightbulb size={14} />{hint ? 'Hide' : 'Show'} hint</button>{hint && <p className="muted small" style={{ marginBottom: 0 }}>{sel.hint}</p>}</motion.div>}
          <div className="card">
            <label htmlFor="sql">Query</label>
            <textarea id="sql" rows={7} spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run() }} style={{ fontFamily: 'Consolas, monospace', resize: 'vertical' }} />
            <div className="row" style={{ marginTop: '.7rem' }}><button className="btn primary" onClick={run} disabled={busy}>{busy ? <Spinner /> : <Play size={16} />}Run (Ctrl+Enter)</button>
              <button className="btn" onClick={check} disabled={busy || !sel}><Send size={16} />Check my answer</button>{!sel && <span className="muted small">Select a challenge to enable checking.</span>}</div>
          </div>
          {err && <div style={{ marginTop: '1rem' }}><Notice kind="bad">{err}</Notice></div>}
          {verdict && <div style={{ marginTop: '1rem' }}><Notice kind={verdict.correct ? 'info' : 'warn'}>{verdict.message}</Notice></div>}
          {res && <div style={{ marginTop: '1rem' }}><ResultTable r={res} /></div>}
        </div>
      </div>
    </>
  )
}
