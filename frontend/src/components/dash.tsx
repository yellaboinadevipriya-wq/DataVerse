import { animate, useReducedMotion } from 'framer-motion'
import { Download } from 'lucide-react'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { rowsToCsv, saveBlob } from '../api'

export const tick = { fill: 'var(--muted)', fontSize: 11 }
export const tip = { contentStyle: { background: 'var(--card-solid)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }, labelStyle: { color: 'var(--text)' }, itemStyle: { color: 'var(--text)' } }

export function AnimatedNumber({ value, format }: { value: number; format: (v: number) => string }) {
  const reduce = useReducedMotion()
  const [v, setV] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    if (reduce) { setV(value); prev.current = value; return }
    const c = animate(prev.current, value, { duration: .7, ease: 'easeOut', onUpdate: setV, onComplete: () => (prev.current = value) })
    return () => { prev.current = value; c.stop() }
  }, [value, reduce])
  return <>{format(v)}</>
}

export const KpiCard = ({ label, value, format, hint }: { label: string; value: number; format: (v: number) => string; hint?: string }) => (
  <div className="card stat" title={hint}><span>{label}</span><b><AnimatedNumber value={value} format={format} /></b></div>
)

export function Chips({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ minWidth: 150 }}>
      <label>{label}</label>
      <div className="checks" style={{ maxHeight: 'none' }}>
        {options.map((o) => { const on = value.includes(o); return (
          <label key={o} className={'check' + (on ? ' on' : '')}><input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} />{o}</label>) })}
      </div>
    </div>
  )
}

export function ChartCard({ title, explain, data, children, h = 300 }: { title: string; explain: string; data?: Record<string, any>[]; children: ReactNode; h?: number }) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {data && <button className="btn sm" aria-label={'Download data for ' + title} onClick={() => saveBlob(new Blob([rowsToCsv(data)], { type: 'text/csv' }), title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.csv')}><Download size={13} />CSV</button>}
      </div>
      <p className="muted small" style={{ margin: '.2rem 0 .6rem' }}>{explain}</p>
      <div style={{ width: '100%', height: h }}>{children}</div>
    </div>
  )
}
