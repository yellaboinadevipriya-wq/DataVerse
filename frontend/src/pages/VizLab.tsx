import { RotateCcw } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errMsg } from '../api'
import { ChartCard, Chips, KpiCard, tick, tip } from '../components/dash'
import { Empty, Notice, Skeletons } from '../components/ui'
import { useApp } from '../ctx'
import { applyFilters, Filters, groupSum, histogram, kpis, Metric, money, monthly, NO_FILTERS, PALETTE, pct, Row, stacked, toggle, unique, useSample } from '../lib/retail'

const SAMPLES = [['customers', 'Customers'], ['hr', 'HR analytics'], ['finance', 'Department finance'], ['accidents', 'Road accidents']]

export default function VizLab() {
  const { rows, error, retry } = useSample<Row>('retail')
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [metric, setMetric] = useState<Metric>('sales')
  const [sort, setSort] = useState<'value' | 'label'>('value')
  const { toast } = useApp()
  const nav = useNavigate()
  const data = useMemo(() => (rows ? applyFilters(rows, f) : []), [rows, f])
  const k = useMemo(() => kpis(data), [data])
  const active = f.regions.length + f.categories.length + f.segments.length + (f.year !== 'all' ? 1 : 0) + (f.q ? 1 : 0)

  if (error) return <Notice kind="bad">{error} <button className="btn sm" onClick={retry}>Retry</button></Notice>
  if (!rows) return <Skeletons n={4} />
  const regionData = stacked(data, 'region', 'product_category', metric)
  const trend = monthly(data, metric)
  const cat = groupSum(data, 'product_category', metric)
  const top = groupSum(data, 'product', metric).sort((a, b) => (sort === 'value' ? b.value - a.value : a.label.localeCompare(b.label))).slice(0, 8)
  const heat = stacked(data, 'region', 'product_category', metric)
  const hmax = Math.max(1, ...heat.data.flatMap((d) => heat.keys.map((c) => Math.abs(d[c] || 0))))
  const scatter = data.slice(0, 600).map((r) => ({ x: r.sales, y: r.profit }))
  const hist = histogram(data.map((r) => r.sales), 12)
  const fmt = (v: number) => (metric === 'quantity' ? v.toLocaleString() : money(v))
  const importSample = async (key: string) => { try { const r = await api.post(`/samples/${key}/import`); nav(`/workspace?dataset=${r.data.id}`) } catch (e) { toast(errMsg(e), 'error') } }

  return (
    <>
      <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>Visualization <span className="grad">Lab</span></h1>
      <p className="muted" style={{ maxWidth: 760 }}>A native DataVerse dashboard on the built-in <b>synthetic</b> retail dataset ({rows.length.toLocaleString()} orders, 2023–2024). Every KPI and chart is computed from the filtered records, and clicking a region or category cross-filters everything. This is a React dashboard, not Tableau or Power BI.</p>
      <div className="card" style={{ margin: '1rem 0' }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: '1.4rem' }}>
          <Chips label="Region" options={unique(rows, 'region')} value={f.regions} onChange={(v) => setF({ ...f, regions: v })} />
          <Chips label="Product category" options={unique(rows, 'product_category')} value={f.categories} onChange={(v) => setF({ ...f, categories: v })} />
          <Chips label="Customer segment" options={unique(rows, 'customer_segment')} value={f.segments} onChange={(v) => setF({ ...f, segments: v })} />
          <div><label htmlFor="yr">Year</label><select id="yr" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}><option value="all">All years</option><option>2023</option><option>2024</option></select></div>
          <div><label htmlFor="mt">Metric</label><select id="mt" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}><option value="sales">Sales</option><option value="profit">Profit</option><option value="quantity">Quantity</option></select></div>
          <div><label htmlFor="sq">Search product / order</label><input id="sq" placeholder="e.g. Laptop" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" disabled={!active} onClick={() => setF(NO_FILTERS)}><RotateCcw size={15} />Reset filters{active ? ` (${active})` : ''}</button></div>
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: '1rem' }}>
        <KpiCard label="Total sales" value={k.sales} format={(v) => '₹' + money(v)} /><KpiCard label="Total profit" value={k.profit} format={(v) => '₹' + money(v)} />
        <KpiCard label="Profit margin" value={k.margin} format={pct} hint="Profit ÷ Sales" /><KpiCard label="Orders" value={k.orders} format={(v) => Math.round(v).toLocaleString()} />
        <KpiCard label="Avg order value" value={k.aov} format={(v) => '₹' + money(v)} />
      </div>
      <p className="muted small">{data.length.toLocaleString()} of {rows.length.toLocaleString()} records match the current filters. (Currency symbol is cosmetic for the synthetic data.)</p>
      {!data.length ? <div className="card"><Empty icon={<RotateCcw size={34} />} title="No records match these filters">Remove a filter to see data again.</Empty></div> : (
        <div className="grid g2">
          <ChartCard title="Region × category (stacked)" explain="Compare totals across regions and see what each category contributes. Click a bar to filter by region." data={regionData.data}>
            <ResponsiveContainer><BarChart data={regionData.data}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={tick} /><YAxis tick={tick} tickFormatter={fmt} /><Tooltip {...tip} formatter={(v: any) => fmt(Number(v))} /><Legend wrapperStyle={{ fontSize: 12 }} />
              {regionData.keys.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={PALETTE[i]} cursor="pointer" onClick={(d: any) => setF({ ...f, regions: toggle(f.regions, d.label ?? d.payload?.label) })} />)}</BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Monthly trend" explain="Use a line or area chart to see change over time. Peaks in Nov–Dec reflect the dataset's seasonality." data={trend}>
            <ResponsiveContainer><AreaChart data={trend}><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ee6ff" stopOpacity={.6} /><stop offset="100%" stopColor="#2ee6ff" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={tick} minTickGap={24} /><YAxis tick={tick} tickFormatter={fmt} /><Tooltip {...tip} formatter={(v: any) => fmt(Number(v))} /><Area type="monotone" dataKey="value" name={metric} stroke="#2ee6ff" fill="url(#ga)" strokeWidth={2} /></AreaChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Category share" explain="A donut shows parts of a whole; keep to a few categories. Click a slice to filter." data={cat}>
            <ResponsiveContainer><PieChart><Pie data={cat} dataKey="value" nameKey="label" innerRadius="50%" outerRadius="80%" paddingAngle={2} cursor="pointer" onClick={(d: any) => setF({ ...f, categories: toggle(f.categories, d.label ?? d.name) })}>
              {cat.map((c, i) => <Cell key={c.label} fill={PALETTE[i % PALETTE.length]} stroke="none" opacity={!f.categories.length || f.categories.includes(c.label) ? 1 : .35} />)}</Pie><Tooltip {...tip} formatter={(v: any) => fmt(Number(v))} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top products" explain="Ranked bars answer 'which items drive the total?'. Change the sort below." data={top}>
            <div style={{ height: '100%' }}><div className="row" style={{ marginBottom: 4 }}><label style={{ margin: 0 }}>Sort</label><select style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as any)}><option value="value">By value</option><option value="label">A–Z</option></select></div>
              <ResponsiveContainer height="88%"><BarChart data={top} layout="vertical" margin={{ left: 30 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" tick={tick} tickFormatter={fmt} /><YAxis type="category" dataKey="label" tick={tick} width={80} /><Tooltip {...tip} formatter={(v: any) => fmt(Number(v))} /><Bar dataKey="value" fill="#7c6cff" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
          </ChartCard>
          <ChartCard title="Sales vs profit per order" explain="A scatter plot shows relationships. Points below zero are loss-making orders (first 600 shown)." data={scatter}>
            <ResponsiveContainer><ScatterChart><CartesianGrid stroke="var(--border)" /><XAxis type="number" dataKey="x" name="Sales" tick={tick} /><YAxis type="number" dataKey="y" name="Profit" tick={tick} /><Tooltip {...tip} cursor={{ strokeDasharray: '3 3' }} /><Scatter data={scatter} fill="#ff5fd2" fillOpacity={.55} /></ScatterChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Order value distribution" explain="A histogram shows how values are spread; most orders are small, a few are large." data={hist}>
            <ResponsiveContainer><BarChart data={hist}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={tick} interval={1} angle={-30} textAnchor="end" height={50} /><YAxis tick={tick} /><Tooltip {...tip} /><Bar dataKey="value" name="Orders" fill="#3ddc97" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Heatmap: region × category" explain="Darker cells mean larger values; good for spotting where combinations stand out." data={heat.data} h={240}>
            <div className="heat" style={{ gridTemplateColumns: `90px repeat(${heat.keys.length}, 1fr)` }}>
              <div className="hl" />{heat.keys.map((c) => <div key={c} className="hl" title={c}>{c}</div>)}
              {heat.data.map((d) => (<Fragment key={d.label}><div className="hl" style={{ justifyContent: 'start' }}>{d.label}</div>{heat.keys.map((c) => <div key={d.label + c} title={`${d.label} · ${c}: ${fmt(d[c] || 0)}`} style={{ background: `rgba(124,108,255,${.12 + .85 * Math.abs(d[c] || 0) / hmax})`, height: 52 }}>{fmt(d[c] || 0)}</div>)}</Fragment>))}
            </div>
          </ChartCard>
        </div>
      )}
      <div className="section card" style={{ marginTop: '2rem' }}>
        <h2>Explore other practice datasets</h2>
        <p className="muted">All are synthetic. Import one into your Analytics Workspace to profile, clean, chart and ask questions about it. You can also <Link to="/workspace">upload your own file</Link>.</p>
        <div className="row">{SAMPLES.map(([key, label]) => <button key={key} className="btn" onClick={() => importSample(key)}>Open “{label}” in Workspace</button>)}</div>
      </div>
    </>
  )
}
