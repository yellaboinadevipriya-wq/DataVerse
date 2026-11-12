import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Brain, ChevronLeft, ChevronRight, Database, Download, Eraser, FileSearch, Save, Send, Table2, Undo2, Upload, RotateCcw, Eye, Check } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, downloadFile, fmt, rowsToCsv, saveBlob } from '../api'
import ChartView from '../components/ChartView'
import { Empty, Notice, Skeletons, Spinner, Tabs } from '../components/ui'
import { errMsg, useApp } from '../ctx'

type TabKey = 'preview' | 'profile' | 'clean' | 'charts' | 'ask' | 'export'
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'preview', label: 'Preview', icon: <Table2 size={16} /> }, { key: 'profile', label: 'Profile', icon: <FileSearch size={16} /> },
  { key: 'clean', label: 'Clean', icon: <Eraser size={16} /> }, { key: 'charts', label: 'Visualize', icon: <BarChart3 size={16} /> },
  { key: 'ask', label: 'Ask AI', icon: <Brain size={16} /> }, { key: 'export', label: 'Export', icon: <Download size={16} /> },
]

export default function Workspace() {
  const [sp, setSp] = useSearchParams()
  const { toast, refreshSummary } = useApp()
  const id = sp.get('dataset'), tab = (sp.get('tab') as TabKey) || 'preview'
  const [list, setList] = useState<any[] | null>(null)
  const [prof, setProf] = useState<any>(null)
  const [rev, setRev] = useState(0)
  const prevTab = useRef(tab)

  const loadList = useCallback(() => api.get('/datasets').then((r) => setList(r.data)).catch((e) => toast(errMsg(e), 'error')), [])
  useEffect(() => { loadList() }, [rev])
  const meta = list?.find((d) => d.id === id)
  useEffect(() => {
    setProf(null)
    if (id && meta) api.get(`/datasets/${id}/profile`).then((r) => setProf(r.data)).catch((e) => toast(errMsg(e), 'error'))
  }, [id, rev, !!meta])
  const go = (p: Record<string, string | null>) => { const n = new URLSearchParams(sp); Object.entries(p).forEach(([k, v]) => (v == null ? n.delete(k) : n.set(k, v))); setSp(n, { replace: false }) }
  const changed = () => { setRev((r) => r + 1); refreshSummary() }
  const order = TABS.map((t) => t.key)
  const dir = order.indexOf(tab) >= order.indexOf(prevTab.current) ? 1 : -1
  useEffect(() => { prevTab.current = tab }, [tab])

  if (list === null) return <Skeletons n={3} />
  if (!id || !meta) return <Landing list={list} stale={!!id} onOpen={(d) => go({ dataset: d, tab: 'preview', analysis: null })} onUploaded={(d) => { changed(); go({ dataset: d, tab: 'preview', analysis: null }) }} />

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div><h1 style={{ fontSize: 'clamp(1.6rem,3.4vw,2.4rem)', marginBottom: '.2rem' }}>{meta.name}</h1>
          <span className="muted small">{meta.rows.toLocaleString()} rows × {meta.cols} columns · {meta.operations.length} cleaning step(s) applied</span></div>
        <button className="btn" onClick={() => go({ dataset: null, tab: null, analysis: null })}><Database size={16} />Switch dataset</button>
      </div>
      <Tabs id="ws" value={tab} onChange={(k) => go({ tab: k })} tabs={TABS} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ x: 60 * dir, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60 * dir, opacity: 0 }} transition={{ duration: .26, ease: [.22, 1, .36, 1] }}>
          {tab === 'preview' && <PreviewTab id={id} rev={rev} />}
          {tab === 'profile' && <ProfileTab id={id} prof={prof} rev={rev} />}
          {tab === 'clean' && <CleanTab id={id} prof={prof} meta={meta} onChanged={changed} />}
          {tab === 'charts' && <ChartsTab id={id} prof={prof} rev={rev} analysisId={sp.get('analysis')} />}
          {tab === 'ask' && <AskTab id={id} />}
          {tab === 'export' && <ExportTab id={id} meta={meta} />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

/* ------------------------------------------------------------------ upload / landing */
function Landing({ list, stale, onOpen, onUploaded }: { list: any[]; stale: boolean; onOpen: (id: string) => void; onUploaded: (id: string) => void }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const upload = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { const fd = new FormData(); fd.append('file', f); const r = await api.post('/datasets', fd); toast(`Uploaded ${r.data.name}: ${r.data.rows.toLocaleString()} rows × ${r.data.cols} columns.`, 'success'); onUploaded(r.data.id) }
    catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }
  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Analytics <span className="grad">Workspace</span></h1>
      {stale && <Notice kind="warn">That dataset was not found in your account.</Notice>}
      <div className={'drop' + (over ? ' over' : '')} role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files[0]) }}>
        {busy ? <Spinner /> : <Upload size={38} color="var(--accent2)" />}
        <h3 style={{ marginTop: '.6rem' }}>{busy ? 'Validating and reading your file…' : 'Drop a CSV or Excel file here, or click to browse'}</h3>
        <p className="muted" style={{ margin: 0 }}>.csv, .xlsx, .xls · up to 20 MB · files are private to your account</p>
        <input ref={input} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <div className="section" style={{ marginTop: '2rem' }}>
        <h2>Your datasets</h2>
        {!list.length ? <div className="card"><Empty icon={<Database size={34} />} title="No datasets yet">Upload your first file above to profile, clean and chart it.</Empty></div> : (
          <div className="grid g3">{list.map((d, i) => (
            <motion.button key={d.id} className="card hover" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit' }} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * .06 }} onClick={() => onOpen(d.id)}>
              <h3>{d.name}</h3><span className="muted small">{d.rows.toLocaleString()} rows × {d.cols} cols · {d.operations.length} step(s)</span></motion.button>))}</div>
        )}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- preview */
function PreviewTab({ id, rev }: { id: string; rev: number }) {
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState<'current' | 'original'>('current')
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  useEffect(() => { setData(null); api.get(`/datasets/${id}/preview`, { params: { page, size: 25, version } }).then((r) => setData(r.data)).catch((e) => setErr(errMsg(e))) }, [id, page, version, rev])
  if (err) return <Notice kind="bad">{err}</Notice>
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '.8rem' }}>
        <div className="row">{(['current', 'original'] as const).map((v) => <button key={v} className={'btn sm' + (version === v ? ' primary' : '')} onClick={() => { setVersion(v); setPage(1) }}>{v === 'current' ? 'Cleaned (current)' : 'Original upload'}</button>)}</div>
        {data && <span className="muted small">{data.total_rows.toLocaleString()} rows · page {data.page}/{data.pages}</span>}
      </div>
      {!data ? <Skeletons n={1} /> : (
        <>
          <div className="table-wrap"><table><thead><tr><th>#</th>{data.columns.map((c: any) => <th key={c.name}>{c.name}<br /><span className="chip" style={{ fontSize: '.65rem' }}>{c.kind}</span></th>)}</tr></thead>
            <tbody>{data.rows.map((r: any, i: number) => <tr key={i}><td className="muted">{(data.page - 1) * data.page_size + i + 1}</td>{data.columns.map((c: any) => r[c.name] == null ? <td key={c.name} className="null">null</td> : <td key={c.name} title={String(r[c.name])}>{String(r[c.name])}</td>)}</tr>)}</tbody></table></div>
          <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
            <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} />Prev</button>
            <button className="btn sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next<ChevronRight size={14} /></button>
          </div>
        </>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- profile */
function ProfileTab({ id, prof, rev }: { id: string; prof: any; rev: number }) {
  const [eda, setEda] = useState<any>(null)
  useEffect(() => { setEda(null); api.get(`/datasets/${id}/eda`).then((r) => setEda(r.data)).catch(() => setEda({ insights: [], correlation: null })) }, [id, rev])
  if (!prof) return <Skeletons n={4} />
  const stats = [[prof.rows.toLocaleString(), 'rows'], [prof.columns, 'columns'], [prof.missing_cells.toLocaleString(), 'missing cells'], [prof.duplicates, 'duplicate rows']]
  return (
    <>
      <div className="grid g4">{stats.map(([n, l]) => <div className="card stat" key={l as string}><b>{n}</b><span>{l}</span></div>)}</div>
      <div className="row" style={{ margin: '1rem 0' }}>{Object.entries(prof.kinds).map(([k, v]) => <span className="chip" key={k}>{String(v)} {k}</span>)}</div>
      <div className="grid g2">
        <div className="card"><h3>Data-quality issues</h3>
          {!prof.issues.length ? <p className="muted" style={{ margin: 0 }}>No missing values, duplicates or type problems detected.</p> : <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>{prof.issues.map((i: any, k: number) => <li key={k}>{i.message}</li>)}</ul>}
        </div>
        <div className="card"><h3>Automatic insights <span className="chip">computed</span></h3>
          {!eda ? <Spinner /> : !eda.insights.length ? <p className="muted" style={{ margin: 0 }}>Nothing notable found yet.</p> : <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>{eda.insights.map((i: string, k: number) => <li key={k}>{i}</li>)}</ul>}
        </div>
      </div>
      <h2 style={{ marginTop: '1.5rem' }}>Columns</h2>
      <div className="table-wrap"><table><thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Min</th><th>Max</th><th>Mean</th><th>Median</th><th>Std</th><th>Top values</th></tr></thead>
        <tbody>{prof.column_info.map((c: any) => (
          <tr key={c.name}><td><b>{c.name}</b></td><td><span className="chip">{c.kind}</span></td>
            <td style={{ color: c.missing ? 'var(--warn)' : undefined }}>{c.missing} ({c.missing_pct}%)</td><td>{c.unique}</td>
            <td>{fmt(c.min)}</td><td>{fmt(c.max)}</td><td>{fmt(c.mean)}</td><td>{fmt(c.median)}</td><td>{fmt(c.std)}</td>
            <td title={(c.top_values || []).map((t: any) => `${t.value}: ${t.count}`).join('\n')}>{(c.top_values || []).slice(0, 3).map((t: any) => `${t.value} (${t.count})`).join(', ')}</td></tr>))}</tbody></table></div>
      {eda?.correlation && <div className="card" style={{ marginTop: '1rem' }}><h3>Correlation matrix</h3><ChartView result={eda.correlation} /></div>}
    </>
  )
}

/* ---------------------------------------------------------------------------- clean */
type Field = { k: string; label: string; type: 'col' | 'cols' | 'select' | 'text' | 'number' | 'rename'; opts?: string[]; when?: (p: any) => boolean }
const OPS: { key: string; label: string; desc: string; fields: Field[] }[] = [
  { key: 'drop_duplicates', label: 'Remove duplicates', desc: 'Delete repeated rows.', fields: [{ k: 'columns', type: 'cols', label: 'Compare only these columns (none selected = all)' }] },
  { key: 'fill_missing', label: 'Fill missing values', desc: 'Replace blanks using a statistic or constant.', fields: [
    { k: 'columns', type: 'cols', label: 'Columns (none selected = every column with missing values)' },
    { k: 'strategy', type: 'select', label: 'Strategy', opts: ['median', 'mean', 'mode', 'constant', 'ffill', 'bfill'] },
    { k: 'value', type: 'text', label: 'Constant value', when: (p) => p.strategy === 'constant' }] },
  { key: 'drop_missing', label: 'Drop rows with missing', desc: 'Remove rows that contain blanks.', fields: [{ k: 'columns', type: 'cols', label: 'Only consider these columns (none = all)' }, { k: 'how', type: 'select', label: 'Drop when', opts: ['any', 'all'] }] },
  { key: 'drop_columns', label: 'Drop columns', desc: 'Remove columns you do not need.', fields: [{ k: 'columns', type: 'cols', label: 'Columns to drop' }] },
  { key: 'rename_columns', label: 'Rename columns', desc: 'Give columns clearer names.', fields: [{ k: 'mapping', type: 'rename', label: 'New names (leave blank to keep)' }] },
  { key: 'convert_type', label: 'Convert type', desc: 'Change a column to numeric, date or text.', fields: [{ k: 'column', type: 'col', label: 'Column' }, { k: 'to', type: 'select', label: 'Convert to', opts: ['numeric', 'datetime', 'text'] }] },
  { key: 'filter_rows', label: 'Filter rows', desc: 'Keep only rows matching a condition.', fields: [{ k: 'column', type: 'col', label: 'Column' }, { k: 'operator', type: 'select', label: 'Condition', opts: ['==', '!=', '>', '>=', '<', '<=', 'contains', 'not_contains', 'is_null', 'not_null'] }, { k: 'value', type: 'text', label: 'Value', when: (p) => !['is_null', 'not_null'].includes(p.operator) }] },
  { key: 'sort', label: 'Sort', desc: 'Order rows by a column.', fields: [{ k: 'column', type: 'col', label: 'Column' }, { k: 'ascending', type: 'select', label: 'Order', opts: ['true', 'false'] }] },
  { key: 'outliers', label: 'Outliers', desc: 'Flag or remove unusual numeric values.', fields: [{ k: 'column', type: 'col', label: 'Numeric column' }, { k: 'method', type: 'select', label: 'Method', opts: ['iqr', 'zscore'] }, { k: 'threshold', type: 'number', label: 'Threshold (blank = 1.5 IQR / 3 z-score)' }, { k: 'action', type: 'select', label: 'Action', opts: ['flag', 'remove'] }] },
]
const DEFAULTS: Record<string, any> = { strategy: 'median', how: 'any', to: 'numeric', operator: '==', ascending: 'true', method: 'iqr', action: 'flag' }

function CleanTab({ id, prof, meta, onChanged }: { id: string; prof: any; meta: any; onChanged: () => void }) {
  const { toast } = useApp()
  const [op, setOp] = useState(OPS[0])
  const [p, setP] = useState<any>({ ...DEFAULTS })
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const cols: { name: string; kind: string }[] = prof?.column_info || []
  const pick = (o: typeof OPS[0]) => { setOp(o); setP({ ...DEFAULTS }); setRes(null); setErr('') }
  const body = (apply: boolean) => {
    const params: any = { ...p }
    if (op.key === 'sort') params.ascending = p.ascending !== 'false'
    if (op.key === 'outliers' && (params.threshold === '' || params.threshold == null)) delete params.threshold
    return { operation: op.key, params, apply }
  }
  const run = async (apply: boolean) => {
    setBusy(true); setErr('')
    try { const r = await api.post(`/datasets/${id}/clean`, body(apply)); setRes(r.data); if (apply) { toast(r.data.summary, 'success'); onChanged() } }
    catch (e) { setErr(errMsg(e)); setRes(null) } finally { setBusy(false) }
  }
  const act = async (path: string, msg: string) => { try { await api.post(`/datasets/${id}/${path}`); setRes(null); toast(msg, 'success'); onChanged() } catch (e) { toast(errMsg(e), 'error') } }
  const delta = (a: number, b: number) => (b === a ? 'var(--muted)' : b < a ? 'var(--good)' : 'var(--warn)')
  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '.5rem', marginBottom: '1rem' }}>
          {OPS.map((o) => (
            <button key={o.key} className="card flat hover" style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', borderColor: op.key === o.key ? 'var(--accent2)' : undefined, position: 'relative' }} onClick={() => pick(o)} title={o.desc}>
              {op.key === o.key && <motion.span layoutId="opsel" style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }} />}
              <b style={{ position: 'relative', fontSize: '.88rem' }}>{o.label}</b></button>))}
        </div>
        <div className="card">
          <h3>{op.label}</h3><p className="muted small">{op.desc}</p>
          {op.fields.filter((f) => !f.when || f.when(p)).map((f) => (
            <div className="field" key={f.k}>
              <label>{f.label}</label>
              {f.type === 'col' && <select value={p[f.k] || ''} onChange={(e) => setP({ ...p, [f.k]: e.target.value })}><option value="">Select column…</option>{cols.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.kind})</option>)}</select>}
              {f.type === 'cols' && <div className="checks">{cols.map((c) => { const on = (p[f.k] || []).includes(c.name); return <label key={c.name} className={'check' + (on ? ' on' : '')}><input type="checkbox" checked={on} onChange={() => setP({ ...p, [f.k]: on ? p[f.k].filter((x: string) => x !== c.name) : [...(p[f.k] || []), c.name] })} />{c.name}</label> })}</div>}
              {f.type === 'select' && <select value={p[f.k]} onChange={(e) => setP({ ...p, [f.k]: e.target.value })}>{f.opts!.map((o) => <option key={o}>{o}</option>)}</select>}
              {f.type === 'text' && <input value={p[f.k] || ''} onChange={(e) => setP({ ...p, [f.k]: e.target.value })} />}
              {f.type === 'number' && <input type="number" step="any" value={p[f.k] ?? ''} onChange={(e) => setP({ ...p, [f.k]: e.target.value })} />}
              {f.type === 'rename' && <div style={{ maxHeight: 220, overflow: 'auto' }}>{cols.map((c) => <div className="row" key={c.name} style={{ marginBottom: '.35rem', flexWrap: 'nowrap' }}><span className="small muted" style={{ width: 120, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span><input placeholder="new name" value={p.mapping?.[c.name] || ''} onChange={(e) => setP({ ...p, mapping: { ...(p.mapping || {}), [c.name]: e.target.value } })} /></div>)}</div>}
            </div>
          ))}
          {err && <Notice kind="bad">{err}</Notice>}
          <div className="row"><button className="btn" onClick={() => run(false)} disabled={busy}><Eye size={16} />Preview</button><button className="btn primary" onClick={() => run(true)} disabled={busy}><Check size={16} />Apply</button>{busy && <Spinner />}</div>
        </div>
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>History</h3>
            <div className="row"><button className="btn sm" disabled={!meta.operations.length} onClick={() => act('undo', 'Last step undone.')}><Undo2 size={14} />Undo</button>
              <button className="btn sm danger" disabled={!meta.operations.length} onClick={() => confirm('Reset to the original upload? All cleaning steps will be removed.') && act('reset', 'Reset to the original data.')}><RotateCcw size={14} />Reset</button></div></div>
          {!meta.operations.length ? <p className="muted small" style={{ margin: '.6rem 0 0' }}>No steps yet. The original upload is untouched and always recoverable.</p> : <ol style={{ margin: '.6rem 0 0', paddingLeft: '1.2rem' }}>{meta.operations.map((o: any) => <li key={o.id} className="small">{o.summary}</li>)}</ol>}
        </div>
      </div>
      <div>
        <AnimatePresence mode="wait">
          {res ? (
            <motion.div key="res" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}>
              <div className="card"><h3>{res.applied ? 'Applied' : 'Preview'} <span className={'chip ' + (res.applied ? 'good' : 'warn')}>{res.applied ? 'saved to dataset' : 'not applied yet'}</span></h3><p>{res.summary}</p>
                <div className="grid g4">{[['rows', 'Rows'], ['columns', 'Columns'], ['missing_cells', 'Missing'], ['duplicates', 'Duplicates']].map(([k, l]) => (
                  <div key={k} className="card flat stat" style={{ padding: '.6rem' }}><span>{l}</span><b style={{ fontSize: '1.2rem' }}>{res.before[k].toLocaleString()} → <span style={{ color: delta(res.before[k], res.after[k]) }}>{res.after[k].toLocaleString()}</span></b></div>))}</div>
                {res.columns.map((c: any) => <p key={c.column} className="small muted" style={{ margin: '.6rem 0 0' }}><b>{c.column}</b>: missing {c.before.missing} → {c.after.missing}{c.before.mean != null && ` · mean ${fmt(c.before.mean)} → ${fmt(c.after.mean)} · median ${fmt(c.before.median)} → ${fmt(c.after.median)}`}</p>)}
              </div>
              <div className="table-wrap" style={{ marginTop: '1rem' }}><table><thead><tr>{res.sample_columns.map((c: string) => <th key={c}>{c}</th>)}</tr></thead><tbody>{res.sample.map((r: any, i: number) => <tr key={i}>{res.sample_columns.map((c: string) => r[c] == null ? <td key={c} className="null">null</td> : <td key={c}>{String(r[c])}</td>)}</tr>)}</tbody></table></div>
              <p className="muted small">First 8 rows of the result.</p>
            </motion.div>
          ) : <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="card"><Empty icon={<Eye size={34} />} title="Preview before you apply">Choose an operation, then press Preview to see before/after statistics. Nothing changes until you press Apply.</Empty></div></motion.div>}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- charts */
const CHARTS = ['bar', 'line', 'scatter', 'histogram', 'pie', 'box', 'heatmap']
function ChartsTab({ id, prof, rev, analysisId }: { id: string; prof: any; rev: number; analysisId: string | null }) {
  const { toast, refreshSummary } = useApp()
  const [s, setS] = useState<any>({ type: 'bar', x: '', y: '', agg: 'count', bins: 12, limit: 20, filter: { column: '', operator: '==', value: '' } })
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const cols: { name: string; kind: string }[] = prof?.column_info || []
  const spec = (st = s) => {
    const o: any = { type: st.type, x: st.x || undefined, y: st.y || undefined, agg: st.agg, bins: Number(st.bins) || 12, limit: Number(st.limit) || 20 }
    if (st.filter?.column) o.filters = [{ column: st.filter.column, operator: st.filter.operator, value: st.filter.value }]
    return o
  }
  const generate = async (st = s) => {
    setBusy(true); setErr('')
    try { setRes((await api.post(`/datasets/${id}/chart`, { spec: spec(st) })).data) } catch (e) { setErr(errMsg(e)); setRes(null) } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!analysisId) return
    api.get(`/analyses/${analysisId}`).then((r) => { const c = r.data.config.spec || {}; const st = { ...s, ...c, filter: c.filters?.[0] || s.filter, y: c.y || '', x: c.x || '' }; setS(st); setTitle(r.data.title); generate(st) }).catch((e) => toast(errMsg(e), 'error'))
  }, [analysisId])
  useEffect(() => { if (!analysisId && res) generate() }, [rev])
  const save = async () => {
    if (!title.trim()) return toast('Give the analysis a title first.', 'error')
    try { await api.post('/analyses', { dataset_id: id, title: title.trim(), config: { tab: 'charts', spec: spec() } }); toast('Analysis saved — find it under Saved.', 'success'); refreshSummary() } catch (e) { toast(errMsg(e), 'error') }
  }
  const exportData = () => {
    if (!res) return
    const rows = res.type === 'heatmap' ? res.columns.flatMap((a: string, i: number) => res.columns.map((b: string, j: number) => ({ a, b, r: res.matrix[i][j] }))) : res.data
    saveBlob(new Blob([rowsToCsv(rows)], { type: 'text/csv' }), `chart_${res.type}.csv`)
  }
  const set = (k: string) => (e: any) => setS({ ...s, [k]: e.target.value })
  const needsY = ['scatter'].includes(s.type)
  const opt = <>{cols.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.kind})</option>)}</>
  return (
    <div className="grid g2" style={{ gridTemplateColumns: 'minmax(260px,340px) 1fr', alignItems: 'start' }}>
      <div className="card">
        <div className="field"><label>Chart type</label><select value={s.type} onChange={set('type')}>{CHARTS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        {s.type !== 'heatmap' && <div className="field"><label>{s.type === 'scatter' || s.type === 'histogram' || s.type === 'box' ? 'X (numeric)' : 'X / category'}</label><select value={s.x} onChange={set('x')}><option value="">Select…</option>{opt}</select></div>}
        {['bar', 'pie', 'line', 'scatter', 'box'].includes(s.type) && <div className="field"><label>{needsY ? 'Y (numeric)' : s.type === 'box' ? 'Group by (optional)' : 'Value column (optional)'}</label><select value={s.y} onChange={set('y')}><option value="">{needsY ? 'Select…' : 'None (count rows)'}</option>{opt}</select></div>}
        {['bar', 'pie', 'line'].includes(s.type) && <div className="field"><label>Aggregation</label><select value={s.agg} onChange={set('agg')}>{['count', 'sum', 'mean', 'median', 'min', 'max'].map((a) => <option key={a}>{a}</option>)}</select></div>}
        {s.type === 'histogram' && <div className="field"><label>Bins</label><input type="number" min={3} max={100} value={s.bins} onChange={set('bins')} /></div>}
        {s.type === 'bar' && <div className="field"><label>Max bars</label><input type="number" min={1} max={100} value={s.limit} onChange={set('limit')} /></div>}
        <details><summary className="small">Filter rows (optional)</summary>
          <div className="field"><select value={s.filter.column} onChange={(e) => setS({ ...s, filter: { ...s.filter, column: e.target.value } })}><option value="">No filter</option>{opt}</select></div>
          {s.filter.column && <div className="row" style={{ flexWrap: 'nowrap' }}><select value={s.filter.operator} onChange={(e) => setS({ ...s, filter: { ...s.filter, operator: e.target.value } })}>{['==', '!=', '>', '>=', '<', '<=', 'contains'].map((o) => <option key={o}>{o}</option>)}</select><input placeholder="value" value={s.filter.value} onChange={(e) => setS({ ...s, filter: { ...s.filter, value: e.target.value } })} /></div>}
        </details>
        <button className="btn primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => generate()} disabled={busy}>{busy ? <Spinner /> : <BarChart3 size={16} />}Generate chart</button>
      </div>
      <div>
        {err && <Notice kind="bad">{err}</Notice>}
        {res ? (
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '.6rem' }}>
              <h3 style={{ margin: 0 }}>{res.type === 'heatmap' ? 'Correlation heatmap' : `${res.agg ? res.agg + ' · ' : ''}${[res.y, res.x].filter(Boolean).join(' by ')}`}</h3>
              <button className="btn sm" onClick={exportData}><Download size={14} />Chart data (CSV)</button></div>
            {res.total_groups > (res.data?.length || 0) && res.type === 'bar' && <p className="muted small">Showing the top {res.data.length} of {res.total_groups} groups.</p>}
            <ChartView result={res} />
            <div className="row" style={{ marginTop: '1rem' }}><input style={{ flex: 1, minWidth: 180 }} placeholder="Title to save this analysis" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /><button className="btn" onClick={save}><Save size={16} />Save analysis</button></div>
          </div>
        ) : !err && <div className="card"><Empty icon={<BarChart3 size={36} />} title="Pick columns and generate">Charts are computed on the server from your current (cleaned) data.</Empty></div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------ ask */
const SUGGEST = ['Which columns contain missing values?', 'What are the main trends over time?', 'Which category has the highest total?', 'Are there any anomalies or outliers?', 'Explain the correlation between two numeric columns']
function AskTab({ id }: { id: string }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const ask = async (text = q) => {
    if (text.trim().length < 3) return
    setBusy(true); setErr(''); setRes(null)
    try { setRes((await api.post(`/datasets/${id}/ask`, { question: text })).data) } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const ev = res?.evidence
  return (
    <>
      <Notice>How it works: the model only sees your column names and types to choose one safe operation. Pandas computes it. Only the computed result rows are sent back for the explanation. No generated code is ever run.</Notice>
      <div className="row" style={{ flexWrap: 'nowrap' }}><input value={q} placeholder="Ask about your data…" maxLength={500} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} aria-label="Question" /><button className="btn primary" onClick={() => ask()} disabled={busy}>{busy ? <Spinner /> : <Send size={16} />}Ask</button></div>
      <div className="row" style={{ margin: '.8rem 0 1.2rem' }}>{SUGGEST.map((s) => <button key={s} className="chip" style={{ cursor: 'pointer' }} onClick={() => { setQ(s); ask(s) }}>{s}</button>)}</div>
      {err && <Notice kind="bad">{err}</Notice>}
      <AnimatePresence>
        {res && (
          <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="grid">
            {!res.ai_available && <Notice kind="warn">{res.message}</Notice>}
            {res.ai_available && res.message && <Notice kind={res.answer ? 'info' : 'warn'}>{res.message}</Notice>}
            {res.answer && <div className="card"><h3><Brain size={18} style={{ verticalAlign: -3 }} /> Answer</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{res.answer}</p></div>}
            {ev && ev.operation !== 'unanswerable' && (
              <div className="card"><h3>Evidence <span className="chip good">computed with Pandas</span></h3>
                <p className="small muted"><b>Calculation:</b> {ev.calculation}{ev.columns_used?.length ? <> · <b>Columns:</b> {ev.columns_used.join(', ')}</> : null}</p>
                {ev.note && <p className="small">{ev.note}</p>}
                {ev.stats && <div className="row" style={{ marginBottom: '.6rem' }}>{Object.entries(ev.stats).map(([k, v]) => <span key={k} className="chip">{k.replace(/_/g, ' ')}: {fmt(v)}</span>)}</div>}
                {ev.table?.length > 0 && <div className="table-wrap" style={{ maxHeight: 280 }}><table><thead><tr>{Object.keys(ev.table[0]).map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{ev.table.slice(0, 40).map((r: any, i: number) => <tr key={i}>{Object.values(r).map((v: any, j) => <td key={j}>{fmt(v)}</td>)}</tr>)}</tbody></table></div>}
              </div>)}
            {res.chart && <div className="card"><h3>Chart from the same data</h3><ChartView result={res.chart.result} /></div>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ---------------------------------------------------------------------------- export */
function ExportTab({ id, meta }: { id: string; meta: any }) {
  const { toast } = useApp()
  const dl = async (params: Record<string, string>, path = 'export') => { try { await downloadFile(`/datasets/${id}/${path}`, params, 'download') } catch (e) { toast(errMsg(e), 'error') } }
  const items = [
    { t: 'Cleaned data · CSV', d: `Current version (${meta.operations.length} step(s) applied).`, f: () => dl({ format: 'csv', version: 'cleaned' }) },
    { t: 'Cleaned data · Excel', d: 'Current version as an .xlsx workbook.', f: () => dl({ format: 'xlsx', version: 'cleaned' }) },
    { t: 'Original upload · CSV', d: 'Your untouched source data.', f: () => dl({ format: 'csv', version: 'original' }) },
    { t: 'Analysis report · HTML', d: 'Statistics, cleaning steps and computed findings.', f: () => dl({}, 'report') },
  ]
  return (
    <>
      <p className="muted">The original upload and the cleaned version are always kept separate. The report lists only facts computed from your data and does not include chart images (use the chart-data export on the Visualize tab).</p>
      <div className="grid g2">{items.map((i, k) => (
        <motion.div key={i.t} className="card hover" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: k * .07 }}><h3>{i.t}</h3><p className="muted small">{i.d}</p><button className="btn primary sm" onClick={i.f}><Download size={14} />Download</button></motion.div>))}</div>
    </>
  )
}
