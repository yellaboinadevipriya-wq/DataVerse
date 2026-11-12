import { motion } from 'framer-motion'
import { AlertTriangle, Info } from 'lucide-react'
import { ReactNode } from 'react'

export const Spinner = () => <span className="spin" role="status" aria-label="Loading" />
export const Skeletons = ({ n = 3 }: { n?: number }) => (
  <div className="grid g3">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" />)}</div>
)
export const Notice = ({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'bad'; children: ReactNode }) => (
  <div className={'notice ' + (kind === 'info' ? '' : kind)} role={kind === 'bad' ? 'alert' : undefined}>
    {kind === 'info' ? <Info size={18} /> : <AlertTriangle size={18} />}<div>{children}</div>
  </div>
)
export const Empty = ({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) => (
  <div className="empty">{icon}<h3 style={{ color: 'var(--text)' }}>{title}</h3><div>{children}</div></div>
)
/** Staggered slide-up reveal for lists/grids. */
export const Reveal = ({ children, i = 0, className = '' }: { children: ReactNode; i?: number; className?: string }) => (
  <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: .5, delay: Math.min(i, 8) * .07, ease: [.22, 1, .36, 1] }}>{children}</motion.div>
)
/** Tabs with a gliding highlight. */
export function Tabs<T extends string>({ tabs, value, onChange, id }: { tabs: { key: T; label: string; icon?: ReactNode }[]; value: T; onChange: (k: T) => void; id: string }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={'tab' + (value === t.key ? ' active' : '')} onClick={() => onChange(t.key)}>
          {value === t.key && <motion.span layoutId={'tabbg-' + id} className="tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  )
}
