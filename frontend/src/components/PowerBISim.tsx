import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errMsg } from '../api'
import { useApp } from '../ctx'
import { applyFilters, Filters, kpis, money, monthly, NO_FILTERS, PALETTE, pct, Row, stacked, toggle, unique, useSample } from '../lib/retail'
import { Chips, tick, tip } from './dash'
import { Notice, Skeletons } from './ui'

type MeasureKey = 'sales' | 'profit' | 'margin' | 'orders' | 'aov' | 'units'
const MEASURES: Record<MeasureKey, { label: string; fmt: (v: number) => string; calc: (rows: Row[]) => number }> = {
  sales: { label: 'Total Sales', fmt: (v) => '₹' + money(v), calc: (r) => kpis(r).sales }, profit: { label: 'Total Profit', fmt: (v) => '₹' + money(v), calc: (r) => kpis(r).profit },
  margin: { label: 'Profit Margin %', fmt: pct, calc: (r) => kpis(r).margin }, orders: { label: 'Orders', fmt: (v) => Math.round(v).toLocaleString(), calc: (r) => kpis(r).orders },
  aov: { label: 'Avg Order Value', fmt: (v) => '₹' + money(v), calc: (r) => kpis(r).aov }, units: { label: 'Units', fmt: (v) => Math.round(v).toLocaleString(), calc: (r) => kpis(r).units },
}
const CATS: Record<string, { label: string; get: (r: Row) => string; filter?: 'regions' | 'categories' | 'segments' }> = {
  region: { label: 'Region', get: (r) => r.region, filter: 'regions' }, product_category: { label: 'Product Category', get: (r) => r.product_category, filter: 'categories' },
  customer_segment: { label: 'Customer Segment', get: (r) => r.customer_segment, filter: 'segments' }, product: { label: 'Product', get: (r) => r.product },
  year: { label: 'Order Year', get: (r) => r.order_date.slice(0, 4) },
}
type VType = 'card' | 'column' | 'line' | 'donut' | 'matrix' | 'table'
type Visual = { id: number; type: VType; measure: MeasureKey; cat: string }
const DEFAULT: Visual[] = [
  { id: 1, type: 'card', measure: 'sales', cat: 'region' }, { id: 2, type: 'card', measure: 'profit', cat: 'region' }, { id: 3, type: 'card', measure: 'margin', cat: 'region' }, { id: 4, type: 'card', measure: 'orders', cat: 'region' },
  { id: 5, type: 'column', measure: 'sales', cat: 'product_category' }, { id: 6, type: 'line', measure: 'sales', cat: 'region' }, { id: 7, type: 'matrix', measure: 'sales', cat: 'region' },
]

function groupBy(rows: Row[], cat: string, m: MeasureKey) {
  const g = new Map<string, Row[]>(); rows.forEach((r) => { const k = CATS[cat].get(r); (g.get(k) || g.set(k, []).get(k)!).push(r) })
  return Array.from(g, ([label, rs]) => ({ label, value: Math.round(MEASURES[m].calc(rs) * 1000) / 1000 })).sort((a, b) => b.value - a.value)
}

export function Slicers({ rows, f, setF }: { rows: Row[]; f: Filters; setF: (f: Filters) => void }) {
  const active = f.regions.length + f.categories.length + f.segments.length + (f.year !== 'all' ? 1 : 0)
  return (
    <div className="card flat" style={{ marginBottom: '1rem' }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: '1.4rem' }}>
        <Chips label="Region" options={unique(rows, 'region')} value={f.regions} onChange={(v) => setF({ ...f, regions: v })} />
        <Chips label="Product Category" options={unique(rows, 'product_category')} value={f.categories} onChange={(v) => setF({ ...f, categories: v })} />
        <Chips label="Customer Segment" options={unique(rows, 'customer_segment')} value={f.segments} onChange={(v) => setF({ ...f, segments: v })} />
        <div><label htmlFor="pby">Year</label><select id="pby" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}><option value="all">All</option><option>2023</option><option>2024</option></select></div>
        <div style={{ alignSelf: 'end' }}><button className="btn sm" disabled={!active} onClick={() => setF(NO_FILTERS)}><RotateCcw size={13} />Clear slicers</button></div>
      </div>
    </div>
  )
}

export default function PowerBISim({ tab, analysisId }: { tab: 'report' | 'measures'; analysisId: string | null }) {
  const { rows, error } = useSample<Row>('retail')
  const { toast, refreshSummary, user } = useApp()
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [visuals, setVisuals] = useState<Visual[]>(DEFAULT)
  const [nv, setNv] = useState<Visual>({ id: 0, type: 'column', measure: 'sales', cat: 'region' })
  const [title, setTitle] = useState('')
  useEffect(() => { if (analysisId) api.get(`/analyses/${analysisId}`).then((r) => { const c = r.data.config; if (c?.kind === 'pbi-sim') { setVisuals(c.visuals); setF({ ...NO_FILTERS, ...c.filters }); setTitle(r.data.title) } }).catch((e) => toast(errMsg(e), 'error')) }, [analysisId])
  const data = useMemo(() => (rows ? applyFilters(rows, f) : []), [rows, f])
  if (error) return <Notice kind="bad">{error}</Notice>
  if (!rows) return <Skeletons n={2} />
  const save = async () => {
    if (!user) return toast('Sign in to save reports.', 'error')
    if (!title.trim()) return toast('Give the report a title first.', 'error')
    try { await api.post('/analyses', { title: title.trim(), config: { kind: 'pbi-sim', visuals, filters: f } }); toast('Report saved under Saved.', 'success'); refreshSummary() } catch (e) { toast(errMsg(e), 'error') }
  }
  const crossFilter = (cat: string, label: string) => { const k = CATS[cat].filter; if (k) setF({ ...f, [k]: toggle(f[k], label) }) }
  return (
    <>
      <Notice>These are <b>DataVerse educational simulations</b> of Power BI Desktop, running on synthetic retail data in your browser. They are not Power BI itself.</Notice>
      <Slicers rows={rows} f={f} setF={setF} />
      {tab === 'report' ? (
        <>
          <p className="muted small">{data.length.toLocaleString()} of {rows.length.toLocaleString()} rows after slicers. Click a column or slice to cross-filter the other visuals (like Power BI).</p>
          <div className="grid" style={{ gridTemplateColumns: 'minmax(190px,230px) 1fr', alignItems: 'start' }}>
            <div className="card flat">
              <h3>Fields · Sales</h3>
              <label>Measures (Σ)</label>{Object.values(MEASURES).map((m) => <div key={m.label} className="chip" style={{ display: 'flex', marginBottom: 4 }}>{m.label}</div>)}
              <label style={{ marginTop: '.6rem' }}>Columns</label>{Object.values(CATS).map((c) => <div key={c.label} className="small muted" style={{ marginBottom: 2 }}>▸ {c.label}</div>)}
              <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '.8rem 0' }} />
              <h3>Add a visual</h3>
              <div className="field"><label htmlFor="vt">Visual</label><select id="vt" value={nv.type} onChange={(e) => setNv({ ...nv, type: e.target.value as VType })}>{['card', 'column', 'line', 'donut', 'matrix', 'table'].map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="field"><label htmlFor="vm">Value</label><select id="vm" value={nv.measure} onChange={(e) => setNv({ ...nv, measure: e.target.value as MeasureKey })}>{Object.entries(MEASURES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select></div>
              {!['card', 'line'].includes(nv.type) && <div className="field"><label htmlFor="vc">Axis / category</label><select id="vc" value={nv.cat} onChange={(e) => setNv({ ...nv, cat: e.target.value })}>{Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></div>}
              <button className="btn primary sm" style={{ width: '100%' }} onClick={() => visuals.length < 14 ? setVisuals([...visuals, { ...nv, id: Date.now() }]) : toast('A page holds up to 14 visuals.', 'error')}><Plus size={14} />Add to canvas</button>
            </div>
            <div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
                {visuals.map((v) => <VisualView key={v.id} v={v} rows={data} f={f} onCross={crossFilter} onRemove={() => setVisuals(visuals.filter((x) => x.id !== v.id))} />)}
              </div>
              {!visuals.length && <div className="card empty">The canvas is empty. Add a visual from the Fields pane.</div>}
              <div className="row" style={{ marginTop: '1rem' }}><input style={{ flex: 1, minWidth: 180 }} placeholder="Report title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /><button className="btn" onClick={save}><Save size={16} />Save report</button><button className="btn" onClick={() => setVisuals(DEFAULT)}>Reset layout</button></div>
            </div>
          </div>
        </>
      ) : <Measures rows={rows} f={f} />}
    </>
  )
}

function VisualView({ v, rows, f, onCross, onRemove }: { v: Visual; rows: Row[]; f: Filters; onCross: (cat: string, label: string) => void; onRemove: () => void }) {
  const M = MEASURES[v.measure]
  const wide = v.type === 'matrix' || v.type === 'table' || v.type === 'line'
  const head = <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><b className="small">{v.type === 'card' ? M.label : v.type === 'line' ? `${M.label} by Month` : v.type === 'matrix' ? `${M.label} by ${CATS[v.cat].label} × Category` : `${M.label} by ${CATS[v.cat].label}`}</b><button className="btn sm" style={{ padding: '.1rem .35rem' }} aria-label="Remove visual" onClick={onRemove}><Trash2 size={12} /></button></div>
  let body
  if (v.type === 'card') body = <div style={{ font: '700 2.2rem Space Grotesk', margin: '.6rem 0' }}>{rows.length ? M.fmt(M.calc(rows)) : '—'}</div>
  else if (!rows.length) body = <p className="muted small">No rows match the slicers.</p>
  else if (v.type === 'column') { const d = groupBy(rows, v.cat, v.measure); body = <div style={{ height: 210 }}><ResponsiveContainer><BarChart data={d}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={tick} /><YAxis tick={tick} tickFormatter={(x) => (v.measure === 'margin' ? pct(x) : money(x))} /><Tooltip {...tip} formatter={(x: any) => M.fmt(Number(x))} /><Bar dataKey="value" name={M.label} fill="#7c6cff" radius={[5, 5, 0, 0]} cursor="pointer" onClick={(d: any) => onCross(v.cat, d.label ?? d.payload?.label)}>{d.map((x) => <Cell key={x.label} fill="#7c6cff" opacity={(() => { const k = CATS[v.cat].filter; return !k || !f[k].length || f[k].includes(x.label) ? 1 : .35 })()} />)}</Bar></BarChart></ResponsiveContainer></div> }
  else if (v.type === 'line') { const months = Array.from(new Set(rows.map((r) => r.order_date.slice(0, 7)))).sort(); const d = months.map((m) => ({ label: m, value: M.calc(rows.filter((r) => r.order_date.startsWith(m))) })); body = <div style={{ height: 210 }}><ResponsiveContainer><LineChart data={d}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={tick} minTickGap={24} /><YAxis tick={tick} tickFormatter={(x) => (v.measure === 'margin' ? pct(x) : money(x))} /><Tooltip {...tip} formatter={(x: any) => M.fmt(Number(x))} /><Line type="monotone" dataKey="value" name={M.label} stroke="#2ee6ff" strokeWidth={2.2} dot={false} /></LineChart></ResponsiveContainer></div> }
  else if (v.type === 'donut') { const d = groupBy(rows, v.cat, v.measure); body = <div style={{ height: 210 }}><ResponsiveContainer><PieChart><Pie data={d} dataKey="value" nameKey="label" innerRadius="50%" outerRadius="80%" cursor="pointer" onClick={(x: any) => onCross(v.cat, x.label ?? x.name)}>{d.map((x, i) => <Cell key={x.label} fill={PALETTE[i % 8]} stroke="none" />)}</Pie><Tooltip {...tip} formatter={(x: any) => M.fmt(Number(x))} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div> }
  else if (v.type === 'matrix') {
    const cols = unique(rows, 'product_category'); const rs = Array.from(new Set(rows.map(CATS[v.cat].get))).sort()
    body = <div className="table-wrap" style={{ maxHeight: 230 }}><table><thead><tr><th>{CATS[v.cat].label}</th>{cols.map((c) => <th key={c}>{c}</th>)}<th>Total</th></tr></thead><tbody>{rs.map((r) => { const rr = rows.filter((x) => CATS[v.cat].get(x) === r); return <tr key={r}><td><b>{r}</b></td>{cols.map((c) => { const sub = rr.filter((x) => x.product_category === c); return <td key={c}>{sub.length ? M.fmt(M.calc(sub)) : ''}</td> })}<td><b>{M.fmt(M.calc(rr))}</b></td></tr> })}<tr><td><b>Total</b></td>{cols.map((c) => <td key={c}><b>{M.fmt(M.calc(rows.filter((x) => x.product_category === c)))}</b></td>)}<td><b>{M.fmt(M.calc(rows))}</b></td></tr></tbody></table></div>
  } else {
    const d = groupBy(rows, v.cat, v.measure).slice(0, 10)
    body = <div className="table-wrap" style={{ maxHeight: 230 }}><table><thead><tr><th>{CATS[v.cat].label}</th><th>{M.label}</th></tr></thead><tbody>{d.map((x) => <tr key={x.label}><td>{x.label}</td><td>{M.fmt(x.value)}</td></tr>)}</tbody></table></div>
  }
  return <div className="card flat" style={{ gridColumn: wide ? 'span 2' : undefined, minWidth: 0 }}>{head}{body}</div>
}

function Measures({ rows, f }: { rows: Row[]; f: Filters }) {
  const ctx = applyFilters(rows, f)
  const ctxTech = applyFilters(rows, { ...f, categories: ['Technology'] })
  const ctxAllRegion = applyFilters(rows, { ...f, regions: [] })
  const ly = f.year === 'all' ? null : applyFilters(rows, { ...f, year: String(Number(f.year) - 1) })
  const S = (r: Row[]) => kpis(r).sales
  const div = (a: number, b: number) => (b ? a / b : null)
  const list: { name: string; dax: string; value: string | null; note: string }[] = [
    { name: 'Total Sales', dax: 'Total Sales = SUM(Sales[Sales])', value: MEASURES.sales.fmt(S(ctx)), note: 'Sums Sales for rows left by the slicers.' },
    { name: 'Total Profit', dax: 'Total Profit = SUM(Sales[Profit])', value: MEASURES.profit.fmt(kpis(ctx).profit), note: 'Same idea for Profit.' },
    { name: 'Profit Margin %', dax: 'Profit Margin % = DIVIDE([Total Profit], [Total Sales])', value: ctx.length ? pct(kpis(ctx).margin) : null, note: 'Divide totals, never average row ratios. DIVIDE returns BLANK if the denominator is 0.' },
    { name: 'Orders', dax: 'Orders = DISTINCTCOUNT(Sales[Order ID])', value: String(kpis(ctx).orders), note: 'Counts unique order IDs.' },
    { name: 'Avg Order Value', dax: 'Avg Order Value = DIVIDE([Total Sales], [Orders])', value: ctx.length ? '₹' + money(kpis(ctx).aov) : null, note: 'A measure built from two other measures.' },
    { name: 'Technology Sales', dax: 'Technology Sales = CALCULATE([Total Sales], Sales[Product Category] = "Technology")', value: MEASURES.sales.fmt(S(ctxTech)), note: f.categories.length ? `CALCULATE replaced your category slicer (${f.categories.join(', ')}) with Technology. Other slicers still apply.` : 'CALCULATE forces category = Technology. Choose another category slicer: this value will not change.' },
    { name: 'Region Share %', dax: 'Region Share % = DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Sales[Region])))', value: (() => { const v = div(S(ctx), S(ctxAllRegion)); return v == null ? null : pct(v) })(), note: 'The denominator uses ALL(Sales[Region]) to ignore the region slicer, so this is your selection’s share of all regions.' },
    { name: 'Sales LY', dax: "Sales LY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))", value: ly ? MEASURES.sales.fmt(S(ly)) : null, note: ly ? `Sales for ${Number(f.year) - 1} under the other slicers.` : 'Pick a year slicer: with “All” the prior year is undefined, so DAX would return BLANK.' },
    { name: 'Sales YoY %', dax: 'Sales YoY % = DIVIDE([Total Sales] - [Sales LY], [Sales LY])', value: ly ? (() => { const v = div(S(ctx) - S(ly), S(ly)); return v == null ? null : pct(v) })() : null, note: 'Compare complete periods only; both years here are complete.' },
  ]
  return (
    <>
      <Notice kind="warn">DataVerse evaluates these measures with equivalent JavaScript on the filtered sample rows to show how DAX filter context behaves. It does not run a DAX engine, and you cannot type your own formulas here.</Notice>
      <p className="muted small">Active filter context: {[f.regions.length ? 'Region = ' + f.regions.join(', ') : '', f.categories.length ? 'Category = ' + f.categories.join(', ') : '', f.segments.length ? 'Segment = ' + f.segments.join(', ') : '', f.year !== 'all' ? 'Year = ' + f.year : ''].filter(Boolean).join(' · ') || 'none (all rows)'} · {ctx.length.toLocaleString()} rows</p>
      <div className="grid g2">{list.map((m) => (
        <div key={m.name} className="card flat"><div className="row" style={{ justifyContent: 'space-between' }}><b>{m.name}</b><span className="chip" style={{ fontSize: '1rem' }}>{m.value ?? 'BLANK'}</span></div><pre style={{ whiteSpace: 'pre-wrap' }}><code>{m.dax}</code></pre><p className="muted small" style={{ margin: 0 }}>{m.note}</p></div>))}</div>
    </>
  )
}
