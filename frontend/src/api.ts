import axios from 'axios'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000'
export const api = axios.create({ baseURL: API_BASE + '/api' })
const KEY = 'dataverse.token'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY))

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn)

api.interceptors.request.use((c) => {
  const t = getToken()
  if (t) c.headers.Authorization = 'Bearer ' + t
  return c
})
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401 && !String(e.config?.url).includes('/auth/login')) onUnauthorized()
    return Promise.reject(e)
  },
)

export function errMsg(e: any): string {
  if (!e?.response) return 'Cannot reach the DataVerse server. Is the backend running on ' + API_BASE + '?'
  const d = e.response.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '')
  return 'Something went wrong (HTTP ' + e.response.status + ').'
}

export async function downloadFile(path: string, params: Record<string, string>, fallback: string) {
  const r = await api.get(path, { params, responseType: 'blob' })
  const cd: string = r.headers['content-disposition'] || ''
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallback
  saveBlob(r.data, name)
}
export function saveBlob(data: Blob, name: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
export function rowsToCsv(rows: Record<string, any>[]) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: any) => (v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v))
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
export const fmt = (v: any) =>
  v == null ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : Number(v.toPrecision(5)).toLocaleString()) : String(v)
