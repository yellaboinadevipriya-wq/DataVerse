import { useCallback, useEffect, useState } from 'react'
import { api, errMsg } from '../api'

export type Row = {
  order_id: string; order_date: string; region: string; product_category: string; product: string
  sales: number; profit: number; quantity: number; customer_segment: string
}
export type Filters = { regions: string[]; categories: string[]; segments: string[]; year: string; q: string }
export const NO_FILTERS: Filters = { regions: [], categories: [], segments: [], year: 'all', q: '' }

const cache: Record<string, any> = {}
/** Loads a built-in synthetic sample dataset from the backend (cached for the session). */
export function useSample<T = Row>(key: string) {
  const [state, set] = useState<{ rows: T[] | null; error: string }>({ rows: cache[key] ?? null, error: '' })
  const load = useCallback(() => {
    set({ rows: null, error: '' })
    api.get(`/samples/${key}`).then((r) => { cache[key] = r.data.rows; set({ rows: r.data.rows, error: '' }) }).catch((e) => set({ rows: null, error: errMsg(e) }))
  }, [key])
  useEffect(() => { if (!cache[key]) load() }, [key])
  return { ...state, retry: load }
}

export const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
export const unique = (rows: Row[], k: keyof Row) => Array.from(new Set(rows.map((r) => String(r[k])))).sort()

export function applyFilters(rows: Row[], f: Filters, skip?: 'regions' | 'categories' | 'segments'): Row[] {
  const q = f.q.trim().toLowerCase()
  return rows.filter((r) =>
    (skip === 'regions' || !f.regions.length || f.regions.includes(r.region)) &&
    (skip === 'categories' || !f.categories.length || f.categories.includes(r.product_category)) &&
    (skip === 'segments' || !f.segments.length || f.segments.includes(r.customer_segment)) &&
    (f.year === 'all' || r.order_date.startsWith(f.year)) &&
    (!q || r.product.toLowerCase().includes(q) || r.order_id.toLowerCase().includes(q)))
}

export type Metric = 'sales' | 'profit' | 'quantity'
export function kpis(rows: Row[]) {
  const sales = rows.reduce((a, r) => a + r.sales, 0), profit = rows.reduce((a, r) => a + r.profit, 0)
  const orders = new Set(rows.map((r) => r.order_id)).size
  return { sales, profit, orders, units: rows.reduce((a, r) => a + r.quantity, 0), margin: sales ? profit / sales : 0, aov: orders ? sales / orders : 0 }
}
export function groupSum(rows: Row[], key: keyof Row, metric: Metric = 'sales') {
  const m = new Map<string, number>()
  rows.forEach((r) => m.set(String(r[key]), (m.get(String(r[key])) || 0) + (r[metric] as number)))
  return Array.from(m, ([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
}
export function monthly(rows: Row[], metric: Metric = 'sales') {
  const m = new Map<string, number>()
  rows.forEach((r) => { const k = r.order_date.slice(0, 7); m.set(k, (m.get(k) || 0) + (r[metric] as number)) })
  return Array.from(m, ([label, value]) => ({ label, value: Math.round(value * 100) / 100 })).sort((a, b) => a.label.localeCompare(b.label))
}
export function stacked(rows: Row[], key: keyof Row, by: keyof Row, metric: Metric = 'sales') {
  const keys = Array.from(new Set(rows.map((r) => String(r[by])))).sort()
  const m = new Map<string, Record<string, any>>()
  rows.forEach((r) => {
    const k = String(r[key]); const o = m.get(k) || { label: k }
    o[String(r[by])] = Math.round(((o[String(r[by])] || 0) + (r[metric] as number)) * 100) / 100; m.set(k, o)
  })
  return { keys, data: Array.from(m.values()).sort((a, b) => a.label.localeCompare(b.label)) }
}
export function histogram(values: number[], bins = 12) {
  if (!values.length) return []
  const lo = Math.min(...values), hi = Math.max(...values), w = (hi - lo) / bins || 1
  const out = Array.from({ length: bins }, (_, i) => ({ label: `${Math.round(lo + i * w)}–${Math.round(lo + (i + 1) * w)}`, value: 0 }))
  values.forEach((v) => { out[Math.min(bins - 1, Math.floor((v - lo) / w))].value++ })
  return out
}
export const money = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : v.toLocaleString(undefined, { maximumFractionDigits: 0 }))
export const pct = (v: number) => (v * 100).toFixed(1) + '%'
export const PALETTE = ['#7c6cff', '#2ee6ff', '#ff5fd2', '#4f7bff', '#3ddc97', '#ffb84d', '#ff6b81', '#a78bfa']
