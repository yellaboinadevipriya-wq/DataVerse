import { motion } from 'framer-motion'
import { Fragment } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt } from '../api'

const PALETTE = ['#7c6cff', '#2ee6ff', '#ff5fd2', '#4f7bff', '#3ddc97', '#ffb84d', '#ff6b81', '#a78bfa', '#22d3ee']
const tick = { fill: 'var(--muted)', fontSize: 11 }
const tip = { contentStyle: { background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }, labelStyle: { color: 'var(--text)' } }

function heatColor(r: number) {
  const a = Math.min(1, Math.abs(r))
  return r >= 0 ? `rgba(46,230,255,${0.15 + a * 0.8})` : `rgba(255,95,210,${0.15 + a * 0.8})`
}

export default function ChartView({ result }: { result: any }) {
  if (!result) return null
  const t = result.type
  const h = 340
  const axisLabel = (v: string) => (v && v.length > 12 ? v.slice(0, 11) + '…' : v)
  const wrap = (child: any) => (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .4 }}>
      <div style={{ width: '100%', height: h }}><ResponsiveContainer>{child}</ResponsiveContainer></div>
    </motion.div>
  )
  if (t === 'bar' || t === 'histogram') {
    const many = result.data.length > 8
    return wrap(
      <BarChart data={result.data} margin={{ bottom: many ? 30 : 5 }}>
        <defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ee6ff" /><stop offset="100%" stopColor="#7c6cff" /></linearGradient></defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={tick} tickFormatter={axisLabel} interval={0} angle={many ? -35 : 0} textAnchor={many ? 'end' : 'middle'} height={many ? 60 : 30} />
        <YAxis tick={tick} tickFormatter={(v) => fmt(v)} />
        <Tooltip {...tip} formatter={(v: any) => fmt(v)} cursor={{ fill: 'rgba(124,108,255,.12)' }} />
        <Bar dataKey="value" name={t === 'histogram' ? 'Count' : result.agg + (result.y ? ' of ' + result.y : '')} fill="url(#gb)" radius={[6, 6, 0, 0]} animationDuration={900} />
      </BarChart>,
    )
  }
  if (t === 'line') return wrap(
    <LineChart data={result.data}>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey="label" tick={tick} minTickGap={30} /><YAxis tick={tick} tickFormatter={(v) => fmt(v)} />
      <Tooltip {...tip} formatter={(v: any) => fmt(v)} />
      <Line type="monotone" dataKey="value" name={result.agg + (result.y ? ' of ' + result.y : '')} stroke="#2ee6ff" strokeWidth={2.5} dot={result.data.length < 40} animationDuration={1000} />
    </LineChart>,
  )
  if (t === 'scatter') return wrap(
    <ScatterChart>
      <CartesianGrid stroke="var(--border)" />
      <XAxis type="number" dataKey="x" name={result.x} tick={tick} tickFormatter={(v) => fmt(v)} label={{ value: result.x, position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 12 }} />
      <YAxis type="number" dataKey="y" name={result.y} tick={tick} tickFormatter={(v) => fmt(v)} />
      <Tooltip {...tip} cursor={{ strokeDasharray: '3 3' }} />
      <Scatter data={result.data} fill="#7c6cff" fillOpacity={0.7} animationDuration={900} />
    </ScatterChart>,
  )
  if (t === 'pie') return wrap(
    <PieChart>
      <Pie data={result.data} dataKey="value" nameKey="label" innerRadius="48%" outerRadius="80%" paddingAngle={2} animationDuration={900}>
        {result.data.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
      </Pie>
      <Tooltip {...tip} formatter={(v: any) => fmt(v)} /><Legend wrapperStyle={{ color: 'var(--muted)', fontSize: 12 }} />
    </PieChart>,
  )
  if (t === 'box') {
    const lo = Math.min(...result.data.map((d: any) => d.min)), hi = Math.max(...result.data.map((d: any) => d.max))
    const sc = (v: number) => (hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100)
    return (
      <div>
        {result.data.map((d: any, i: number) => (
          <div key={d.label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '.8rem', alignItems: 'center', marginBottom: '.7rem' }}>
            <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
            <div style={{ position: 'relative', height: 30 }} title={`min ${fmt(d.min)} · Q1 ${fmt(d.q1)} · median ${fmt(d.median)} · Q3 ${fmt(d.q3)} · max ${fmt(d.max)} · ${d.outliers} outliers`}>
              <div style={{ position: 'absolute', left: sc(d.min) + '%', width: sc(d.max) - sc(d.min) + '%', top: 14, height: 2, background: 'var(--muted)' }} />
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * .05 }} style={{ position: 'absolute', left: sc(d.q1) + '%', width: Math.max(0.8, sc(d.q3) - sc(d.q1)) + '%', top: 4, height: 22, borderRadius: 6, background: PALETTE[i % PALETTE.length], opacity: .85, transformOrigin: 'left' }} />
              <div style={{ position: 'absolute', left: sc(d.median) + '%', top: 2, width: 3, height: 26, background: '#fff', borderRadius: 2 }} />
            </div>
            <span />
            <span className="small muted">min {fmt(d.min)} · Q1 {fmt(d.q1)} · median {fmt(d.median)} · Q3 {fmt(d.q3)} · max {fmt(d.max)} · {d.outliers} outlier(s)</span>
          </div>
        ))}
      </div>
    )
  }
  if (t === 'heatmap') {
    const cols: string[] = result.columns
    return (
      <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}>
        <div className="heat" style={{ gridTemplateColumns: `110px repeat(${cols.length}, minmax(54px,1fr))` }}>
          <div className="hl" />
          {cols.map((c) => <div key={c} className="hl" title={c}>{c}</div>)}
          {cols.map((r, i) => (
            <Fragment key={r}>
              <div className="hl" title={r} style={{ justifyContent: 'start' }}>{r}</div>
              {cols.map((c, j) => <div key={r + c} style={{ background: heatColor(result.matrix[i][j] ?? 0), color: Math.abs(result.matrix[i][j] ?? 0) > .45 ? '#050612' : 'var(--text)' }} title={`${r} × ${c}: ${fmt(result.matrix[i][j])}`}>{result.matrix[i][j] == null ? '—' : result.matrix[i][j].toFixed(2)}</div>)}
            </Fragment>
          ))}
        </div>
        <p className="muted small">Pearson correlation. Cyan = positive, pink = negative. Correlation does not prove causation.</p>
      </motion.div>
    )
  }
  return <p className="muted">This chart type is not supported.</p>
}
