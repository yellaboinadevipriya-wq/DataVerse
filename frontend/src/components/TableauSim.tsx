import { Check, Circle, Save, Trash2, X } from 'lucide-react'
import { DragEvent, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { api, errMsg } from '../api'
import { useApp } from '../ctx'
import { Notice, Skeletons } from './ui'
import { tick, tip } from './dash'
import { PALETTE, Row, useSample } from '../lib/retail'

type Agg = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'CNT'
type Pill = { f: string; agg?: Agg }
type Mark = 'auto' | 'bar' | 'line' | 'table'
type St = { cols: Pill[]; rows: Pill[]; color: Pill | null; filter: { f: string; values: string[] } | null; mark: Mark }
const EMPTY: St = { cols: [], rows: [], color: null, filter: null, mark: 'auto' }

const DIMS: Record<string, { label: string; get: (r: Row) => string; date?: boolean }> = {
  region: { label: 'Region', get: (r) => r.region }, product_category: { label: 'Product Category', get: (r) => r.product_category },
  product: { label: 'Product', get: (r) => r.product }, customer_segment: { label: 'Customer Segment', get: (r) => r.customer_segment },
  month: { label: 'Order Date (Month)', get: (r) => r.order_date.slice(0, 7), date: true }, year: { label: 'Order Date (Year)', get: (r) => r.order_date.slice(0, 4), date: true },
}
const MEASURES: Record<string, { label: string; calc?: boolean; get?: (r: Row) => number }> = {
  sales: { label: 'Sales', get: (r) => r.sales }, profit: { label: 'Profit', get: (r) => r.profit }, quantity: { label: 'Quantity', get: (r) => r.quantity },
  profit_ratio: { label: 'Profit Ratio (calculated)', calc: true },
}
const isDim = (f: string) => f in DIMS
const pillLabel = (p: Pill) => (isDim(p.f) ? DIMS[p.f].label : MEASURES[p.f].calc ? 'Profit Ratio' : `${p.agg || 'SUM'}(${MEASURES[p.f].label})`)
function measureValue(rows: Row[], p: Pill): number {
  if (p.f === 'profit_ratio') { const s = rows.reduce((a, r) => a + r.sales, 0); return s ? rows.reduce((a, r) => a + r.profit, 0) / s : 0 }
  const v = rows.map(MEASURES[p.f].get!); const agg = p.agg || 'SUM'
  return agg === 'CNT' ? v.length : agg === 'SUM' ? v.reduce((a, b) => a + b, 0) : agg === 'AVG' ? v.reduce((a, b) => a + b, 0) / (v.length || 1) : agg === 'MIN' ? Math.min(...v) : Math.max(...v)
}
const r2 = (v: number) => Math.round(v * 100) / 100

function groupRows(rows: Row[], dims: string[]) {
  const m = new Map<string, Row[]>()
  rows.forEach((r) => { const k = dims.map((d) => DIMS[d].get(r)).join(' | '); (m.get(k) || m.set(k, []).get(k)!).push(r) })
  return m
}

const CHECKS: { t: string; ok: (s: St) => boolean }[] = [
  { t: 'Bar chart: SUM(Sales) by Region', ok: (s) => { const a = [...s.cols, ...s.rows]; return a.some((p) => p.f === 'region') && a.some((p) => p.f === 'sales') } },
  { t: 'Split the bars by Product Category using Color', ok: (s) => s.color?.f === 'product_category' && [...s.cols, ...s.rows].some((p) => p.f === 'sales') },
  { t: 'Monthly profit trend (Order Date Month + Profit)', ok: (s) => [...s.cols, ...s.rows].some((p) => p.f === 'month') && [...s.cols, ...s.rows].some((p) => p.f === 'profit') },
  { t: 'Scatter: Sales (Columns) vs Profit (Rows), Product as Color', ok: (s) => s.cols.some((p) => p.f === 'sales') && s.rows.some((p) => p.f === 'profit') && s.color?.f === 'product' },
  { t: 'Compare the Profit Ratio calculated field by Region', ok: (s) => [...s.cols, ...s.rows].some((p) => p.f === 'profit_ratio') && [...s.cols, ...s.rows].some((p) => p.f === 'region') },
  { t: 'Heatmap: Region × Category coloured by Sales', ok: (s) => { const a = [...s.cols, ...s.rows].map((p) => p.f); return a.includes('region') && a.includes('product_category') && s.color?.f === 'sales' } },
]

export default function TableauSim({ analysisId }: { analysisId: string | null }) {
  const { rows, error } = useSample<Row>('retail')
  const { toast, refreshSummary, user } = useApp()
  const [s, setS] = useState<St>(EMPTY)
  const [title, setTitle] = useState('')
  useEffect(() => { if (analysisId) api.get(`/analyses/${analysisId}`).then((r) => { if (r.data.config?.kind === 'tableau-sim') { setS({ ...EMPTY, ...r.data.config.state }); setTitle(r.data.title) } }).catch((e) => toast(errMsg(e), 'error')) }, [analysisId])

  const add = (shelf: 'cols' | 'rows' | 'color', f: string) => {
    const p: Pill = isDim(f) ? { f } : { f, agg: MEASURES[f].calc ? undefined : 'SUM' }
    if (shelf === 'color') return setS({ ...s, color: p })
    if (s[shelf].some((x) => x.f === f)) return
    setS({ ...s, [shelf]: [...s[shelf], p] })
  }
  const drop = (shelf: 'cols' | 'rows' | 'color') => (e: DragEvent) => { e.preventDefault(); const f = e.dataTransfer.getData('text/plain'); if (f in DIMS || f in MEASURES) add(shelf, f) }
  const remove = (shelf: 'cols' | 'rows', i: number) => setS({ ...s, [shelf]: s[shelf].filter((_, k) => k !== i) })
  const setAgg = (shelf: 'cols' | 'rows' | 'color', i: number, agg: Agg) => {
    if (shelf === 'color') return setS({ ...s, color: { ...s.color!, agg } })
    setS({ ...s, [shelf]: s[shelf].map((p, k) => (k === i ? { ...p, agg } : p)) })
  }

  const data = useMemo(() => (rows ? (s.filter ? rows.filter((r) => s.filter!.values.includes(DIMS[s.filter!.f].get(r))) : rows) : []), [rows, s.filter])
  const view = useMemo(() => build(data, s), [data, s])
  const done = CHECKS.map((c) => c.ok(s))
  const save = async () => {
    if (!user) return toast('Sign in to save worksheets.', 'error')
    if (!title.trim()) return toast('Give the worksheet a title first.', 'error')
    try { await api.post('/analyses', { title: title.trim(), config: { kind: 'tableau-sim', state: s } }); toast('Worksheet saved under Saved.', 'success'); refreshSummary() } catch (e) { toast(errMsg(e), 'error') }
  }
  if (error) return <Notice kind="bad">{error}</Notice>
  if (!rows) return <Skeletons n={2} />
  const filterVals = s.filter ? Array.from(new Set(rows.map(DIMS[s.filter.f].get))).sort() : []
  const Shelf = ({ id, label, pills }: { id: 'cols' | 'rows'; label: string; pills: Pill[] }) => (
    <div className="row" style={{ gap: '.5rem', flexWrap: 'nowrap', marginBottom: '.5rem' }}>
      <b className="small muted" style={{ width: 62 }}>{label}</b>
      <div onDragOver={(e) => e.preventDefault()} onDrop={drop(id)} className="row" style={{ flex: 1, minHeight: 40, padding: '.3rem .5rem', border: '1px dashed var(--border)', borderRadius: 12, gap: '.4rem' }} aria-label={label + ' shelf'}>
        {!pills.length && <span className="muted small">Drop a field here</span>}
        {pills.map((p, i) => <PillView key={p.f} p={p} onRemove={() => remove(id, i)} onAgg={(a) => setAgg(id, i, a)} />)}
      </div>
    </div>
  )
  return (
    <>
      <Notice>This is a <b>DataVerse learning simulation</b> of Tableau's worksheet on the synthetic retail data, not the real Tableau Desktop application. Drag fields (or use the small buttons) onto the shelves.</Notice>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(210px,250px) 1fr', alignItems: 'start' }}>
        <div className="card flat">
          <h3>Data</h3><p className="muted small" style={{ margin: 0 }}>Retail sales (sample)</p>
          <label style={{ marginTop: '.7rem' }}>Dimensions</label>
          {Object.entries(DIMS).map(([k, d]) => <FieldRow key={k} k={k} label={d.label} kind="dim" add={add} />)}
          <label style={{ marginTop: '.7rem' }}>Measures</label>
          {Object.entries(MEASURES).map(([k, m]) => <FieldRow key={k} k={k} label={m.label} kind="measure" add={add} />)}
        </div>
        <div>
          <div className="card flat" style={{ marginBottom: '1rem' }}>
            <Shelf id="cols" label="Columns" pills={s.cols} /><Shelf id="rows" label="Rows" pills={s.rows} />
            <div className="row" style={{ gap: '.5rem', flexWrap: 'nowrap' }}>
              <b className="small muted" style={{ width: 62 }}>Marks</b>
              <div className="row" style={{ flex: 1 }}>
                <select style={{ width: 'auto' }} aria-label="Mark type" value={s.mark} onChange={(e) => setS({ ...s, mark: e.target.value as Mark })}><option value="auto">Automatic</option><option value="bar">Bar</option><option value="line">Line</option><option value="table">Text table</option></select>
                <div onDragOver={(e) => e.preventDefault()} onDrop={drop('color')} className="row" style={{ minHeight: 40, padding: '.3rem .5rem', border: '1px dashed var(--border)', borderRadius: 12, flex: 1 }} aria-label="Color">
                  <span className="muted small">Color:</span>{s.color ? <PillView p={s.color} onRemove={() => setS({ ...s, color: null })} onAgg={(a) => setAgg('color', 0, a)} /> : <span className="muted small">drop a field</span>}
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: '.6rem' }}>
              <b className="small muted" style={{ width: 62 }}>Filter</b>
              <select style={{ width: 'auto' }} aria-label="Filter field" value={s.filter?.f || ''} onChange={(e) => setS({ ...s, filter: e.target.value ? { f: e.target.value, values: Array.from(new Set(rows.map(DIMS[e.target.value].get))) } : null })}><option value="">No filter</option>{Object.entries(DIMS).filter(([, d]) => !d.date).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}</select>
              {s.filter && filterVals.map((v) => { const on = s.filter!.values.includes(v); return <label key={v} className={'check' + (on ? ' on' : '')}><input type="checkbox" checked={on} onChange={() => setS({ ...s, filter: { ...s.filter!, values: on ? s.filter!.values.filter((x) => x !== v) : [...s.filter!.values, v] } })} />{v}</label> })}
            </div>
            <div className="row" style={{ marginTop: '.8rem' }}><button className="btn sm" onClick={() => setS(EMPTY)}><Trash2 size={14} />Clear sheet</button></div>
          </div>
          <div className="card" style={{ minHeight: 360 }}>
            <h3>{view.title}</h3>
            {view.kind === 'hint' && <p className="muted">{view.msg}</p>}
            {view.kind !== 'hint' && <Canvas v={view} />}
            {view.note && <p className="muted small">{view.note}</p>}
          </div>
          <div className="row" style={{ marginTop: '1rem' }}><input style={{ flex: 1, minWidth: 180 }} placeholder="Worksheet title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /><button className="btn" onClick={save}><Save size={16} />Save worksheet</button></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: '1rem' }}><h3>Practice checkpoints ({done.filter(Boolean).length}/{CHECKS.length})</h3>
        {CHECKS.map((c, i) => <div key={c.t} className="row" style={{ marginBottom: '.3rem' }}>{done[i] ? <Check size={16} color="var(--good)" /> : <Circle size={16} color="var(--muted)" />}<span style={{ opacity: done[i] ? 1 : .75 }}>{c.t}</span></div>)}
        <p className="muted small" style={{ marginBottom: 0 }}>Checkpoints tick automatically when your sheet matches the task.</p></div>
    </>
  )
}

function FieldRow({ k, label, kind, add }: { k: string; label: string; kind: 'dim' | 'measure'; add: (s: 'cols' | 'rows' | 'color', f: string) => void }) {
  return (
    <div className="row" style={{ gap: '.25rem', marginBottom: '.3rem', flexWrap: 'nowrap' }}>
      <span draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', k)} className="chip" style={{ cursor: 'grab', flex: 1, background: kind === 'dim' ? 'color-mix(in srgb,#4f7bff 25%,transparent)' : 'color-mix(in srgb,#3ddc97 22%,transparent)', color: 'var(--text)' }}>{label}</span>
      {(['cols', 'rows', 'color'] as const).map((sh) => <button key={sh} className="btn sm" style={{ padding: '.15rem .4rem' }} aria-label={`Add ${label} to ${sh}`} onClick={() => add(sh, k)}>{sh === 'cols' ? 'C' : sh === 'rows' ? 'R' : '◐'}</button>)}
    </div>
  )
}
function PillView({ p, onRemove, onAgg }: { p: Pill; onRemove: () => void; onAgg: (a: Agg) => void }) {
  const dim = isDim(p.f)
  return (
    <span className="chip" style={{ background: dim ? 'color-mix(in srgb,#4f7bff 30%,transparent)' : 'color-mix(in srgb,#3ddc97 28%,transparent)', color: 'var(--text)' }} title={dim ? 'Dimension (discrete)' : 'Measure (continuous)'}>
      {!dim && !MEASURES[p.f].calc ? <select aria-label="Aggregation" style={{ width: 'auto', padding: '0 .2rem', border: 0, background: 'transparent', fontSize: '.75rem' }} value={p.agg} onChange={(e) => onAgg(e.target.value as Agg)}>{['SUM', 'AVG', 'MIN', 'MAX', 'CNT'].map((a) => <option key={a}>{a}</option>)}</select> : null}
      {dim ? DIMS[p.f].label : `${MEASURES[p.f].calc ? 'Profit Ratio' : '(' + MEASURES[p.f].label + ')'}`}
      <button onClick={onRemove} aria-label={'Remove ' + pillLabel(p)} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
    </span>
  )
}

type View = { kind: 'hint'; title: string; msg: string; note?: string } | { kind: 'bar' | 'line'; title: string; data: any[]; series: string[]; horizontal: boolean; mname: string; note?: string }
  | { kind: 'scatter'; title: string; data: any[]; xn: string; yn: string; note?: string } | { kind: 'table'; title: string; rowsH: string[]; colsH: string[]; cells: Record<string, number>; mname: string; note?: string }
function build(rows: Row[], s: St): View {
  const all = [...s.cols, ...s.rows]
  const measuresOn = all.filter((p) => !isDim(p.f)), dimsOn = all.filter((p) => isDim(p.f))
  if (!all.length && !s.color) return { kind: 'hint', title: 'Empty worksheet', msg: 'Drag a dimension (blue) to Columns and a measure (green) to Rows to start. Try: Region → Columns, Sales → Rows.' }
  if (!rows.length) return { kind: 'hint', title: 'No data', msg: 'The filter removes every record. Tick at least one value.' }
  const colorDim = s.color && isDim(s.color.f) ? s.color.f : null
  // Heat table: dims on both shelves, measure on color
  const cd = s.cols.filter((p) => isDim(p.f)), rd = s.rows.filter((p) => isDim(p.f))
  if (cd.length && rd.length && !measuresOn.length && (s.mark === 'table' || s.mark === 'auto')) {
    const m: Pill = s.color && !isDim(s.color.f) ? s.color : { f: 'sales', agg: 'SUM' }
    const g = groupRows(rows, [...cd.map((p) => p.f), ...rd.map((p) => p.f)])
    const cells: Record<string, number> = {}; const colsH = new Set<string>(), rowsH = new Set<string>()
    g.forEach((rs, key) => { const parts = key.split(' | '); const c = parts.slice(0, cd.length).join(' · '), r = parts.slice(cd.length).join(' · '); colsH.add(c); rowsH.add(r); cells[r + '||' + c] = r2(measureValue(rs, m)) })
    return { kind: 'table', title: `${pillLabel(m)} by ${[...rd, ...cd].map((p) => DIMS[p.f].label).join(' and ')}`, rowsH: [...rowsH].sort(), colsH: [...colsH].sort(), cells, mname: pillLabel(m), note: s.color ? undefined : 'No measure on Color, so SUM(Sales) is used. Drop a measure on Color to change it.' }
  }
  if (measuresOn.length >= 2) {
    const xm = s.cols.find((p) => !isDim(p.f)), ym = s.rows.find((p) => !isDim(p.f))
    if (!xm || !ym) return { kind: 'hint', title: 'Scatter needs one measure on each shelf', msg: 'Put one measure on Columns and another on Rows.' }
    const detail = [...dimsOn.map((p) => p.f), ...(colorDim ? [colorDim] : [])].filter((v, i, a) => a.indexOf(v) === i)
    const g = detail.length ? groupRows(rows, detail) : new Map([['All records', rows]])
    return { kind: 'scatter', title: `${pillLabel(ym)} vs ${pillLabel(xm)}`, data: Array.from(g, ([k, rs]) => ({ name: k, x: r2(measureValue(rs, xm)), y: r2(measureValue(rs, ym)) })), xn: pillLabel(xm), yn: pillLabel(ym), note: detail.length ? `One point per ${detail.map((d) => DIMS[d].label).join(' + ')}.` : 'Add a dimension (e.g. Product to Color) to get more than one point.' }
  }
  if (measuresOn.length === 1) {
    const m = measuresOn[0]
    const catDims = dimsOn.map((p) => p.f)
    if (!catDims.length) return { kind: 'hint', title: pillLabel(m), msg: `Total ${pillLabel(m)}: ${r2(measureValue(rows, m)).toLocaleString()}. Add a dimension to break it down.` }
    const horizontal = s.cols.some((p) => !isDim(p.f))
    const isDate = catDims.some((d) => DIMS[d].date)
    const kind = s.mark === 'bar' ? 'bar' : s.mark === 'line' ? 'line' : isDate ? 'line' : 'bar'
    const g = groupRows(rows, [...catDims, ...(colorDim && !catDims.includes(colorDim) ? [colorDim] : [])])
    const bucket = new Map<string, Record<string, any>>(); const series = new Set<string>()
    g.forEach((rs, key) => { const parts = key.split(' | '); const cat = parts.slice(0, catDims.length).join(' · '); const ser = colorDim && !catDims.includes(colorDim) ? parts[parts.length - 1] : m.f === 'profit_ratio' ? 'Profit Ratio' : pillLabel(m); series.add(ser); const o = bucket.get(cat) || { name: cat }; o[ser] = r2(measureValue(rs, m)); bucket.set(cat, o) })
    if (s.mark === 'table') return { kind: 'table', title: `${pillLabel(m)} by ${catDims.map((d) => DIMS[d].label).join(' and ')}`, rowsH: Array.from(bucket.keys()).sort(), colsH: [...series], cells: Object.fromEntries(Array.from(bucket).flatMap(([r, o]) => [...series].map((c) => [r + '||' + c, o[c] ?? 0]))), mname: pillLabel(m) }
    return { kind, title: `${pillLabel(m)} by ${catDims.map((d) => DIMS[d].label).join(' and ')}`, data: Array.from(bucket.values()).sort((a, b) => a.name.localeCompare(b.name)), series: [...series], horizontal: horizontal && kind === 'bar', mname: pillLabel(m) }
  }
  return { kind: 'hint', title: 'Add a measure', msg: 'You have only dimensions. Add a measure (green) such as Sales to Rows or Columns.' }
}

function Canvas({ v }: { v: View }) {
  if (v.kind === 'hint') return null
  if (v.kind === 'table') {
    const vals = Object.values(v.cells), max = Math.max(1, ...vals.map(Math.abs))
    return <div className="table-wrap"><table><thead><tr><th /> {v.colsH.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{v.rowsH.map((r) => <tr key={r}><td><b>{r}</b></td>{v.colsH.map((c) => { const x = v.cells[r + '||' + c]; return <td key={c} style={{ background: `rgba(124,108,255,${x == null ? 0 : .1 + .8 * Math.abs(x) / max})` }}>{x == null ? '' : x.toLocaleString()}</td> })}</tr>)}</tbody></table></div>
  }
  if (v.kind === 'scatter') return <div style={{ height: 320 }}><ResponsiveContainer><ScatterChart><CartesianGrid stroke="var(--border)" /><XAxis type="number" dataKey="x" name={v.xn} tick={tick} label={{ value: v.xn, position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 12 }} /><YAxis type="number" dataKey="y" name={v.yn} tick={tick} /><ZAxis range={[70, 70]} /><Tooltip {...tip} cursor={{ strokeDasharray: '3 3' }} content={({ payload }: any) => payload?.[0] ? <div style={{ ...tip.contentStyle, padding: 8, fontSize: 12 }}><b>{payload[0].payload.name}</b><br />{v.xn}: {payload[0].payload.x.toLocaleString()}<br />{v.yn}: {payload[0].payload.y.toLocaleString()}</div> : null} /><Scatter data={v.data} fill="#ff5fd2" /></ScatterChart></ResponsiveContainer></div>
  if (v.kind === 'line') return <div style={{ height: 320 }}><ResponsiveContainer><LineChart data={v.data}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={tick} minTickGap={24} /><YAxis tick={tick} /><Tooltip {...tip} /><Legend />{v.series.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % 8]} strokeWidth={2.4} dot={false} />)}</LineChart></ResponsiveContainer></div>
  return <div style={{ height: 320 }}><ResponsiveContainer><BarChart data={v.data} layout={v.horizontal ? 'vertical' : 'horizontal'}><CartesianGrid stroke="var(--border)" vertical={!v.horizontal} horizontal={v.horizontal ? false : true} />{v.horizontal ? <><XAxis type="number" tick={tick} /><YAxis type="category" dataKey="name" tick={tick} width={90} /></> : <><XAxis dataKey="name" tick={tick} interval={0} /><YAxis tick={tick} /></>}<Tooltip {...tip} cursor={{ fill: 'rgba(124,108,255,.12)' }} />{v.series.length > 1 && <Legend />}{v.series.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={PALETTE[i % 8]} radius={v.series.length === 1 ? [6, 6, 0, 0] : 0} />)}</BarChart></ResponsiveContainer></div>
}
