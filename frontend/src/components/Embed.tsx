import { ExternalLink, Trash2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { api, errMsg } from '../api'
import { useApp } from '../ctx'
import { Empty, Notice, Skeletons, Spinner } from './ui'
import { Link2 } from 'lucide-react'

const HELP = {
  tableau: { host: 'public.tableau.com', placeholder: 'https://public.tableau.com/views/YourWorkbook/YourSheet',
    note: 'Open your dashboard on Tableau Public, click Share and copy the link (it contains /views/…). Tableau Public dashboards are public, so only use non-confidential data.' },
  powerbi: { host: 'app.powerbi.com', placeholder: 'https://app.powerbi.com/view?r=…',
    note: 'Use File → Embed report → Publish to web (public link: anyone with the URL can see it, so never use private data), or an organisation embed link (reportEmbed). Organisation links need viewers to sign in with permission, and token-based embedding for private data is not built into DataVerse yet.' },
}

export default function EmbedPanel({ kind }: { kind: 'tableau' | 'powerbi' }) {
  const { toast } = useApp()
  const [list, setList] = useState<any[] | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [f, setF] = useState({ title: '', url: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const h = HELP[kind]
  const load = () => api.get('/embeds').then((r) => { const l = r.data.filter((e: any) => e.kind === kind); setList(l); setSel((s) => s ?? l[0]?.id ?? null) }).catch((e) => toast(errMsg(e), 'error'))
  useEffect(() => { load() }, [kind])
  const add = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const r = await api.post('/embeds', { kind, ...f }); setF({ title: '', url: '' }); setSel(r.data.id); await load(); toast('Saved. If the frame stays empty, the report may need sign-in or block embedding.', 'info') }
    catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  const del = async (id: number) => { await api.delete(`/embeds/${id}`); setSel(null); load() }
  const cur = list?.find((e) => e.id === sel)
  return (
    <div className="grid g2" style={{ gridTemplateColumns: 'minmax(260px,360px) 1fr', alignItems: 'start' }}>
      <div>
        <form className="card" onSubmit={add}>
          <h3>Add your own {kind === 'tableau' ? 'Tableau' : 'Power BI'} dashboard</h3>
          <p className="muted small">{h.note}</p>
          <div className="field"><label htmlFor={kind + 't'}>Title</label><input id={kind + 't'} required maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="field"><label htmlFor={kind + 'u'}>Link (https, {h.host})</label><input id={kind + 'u'} required type="url" placeholder={h.placeholder} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
          {err && <Notice kind="bad">{err}</Notice>}
          <button className="btn primary" disabled={busy}>{busy ? <Spinner /> : <Link2 size={16} />}Validate & save</button>
        </form>
        {list?.length ? <div className="card" style={{ marginTop: '1rem' }}><h3>Saved</h3>{list.map((e) => (
          <div key={e.id} className="lesson-row" style={{ cursor: 'pointer', borderColor: e.id === sel ? 'var(--accent2)' : undefined }} onClick={() => setSel(e.id)}>
            <span style={{ flex: 1 }}>{e.title}</span><button className="btn sm danger" aria-label={'Delete ' + e.title} onClick={(ev) => { ev.stopPropagation(); del(e.id) }}><Trash2 size={14} /></button></div>))}</div> : null}
      </div>
      <div>
        {list === null ? <Skeletons n={1} /> : cur ? (
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>{cur.title}</h3><a className="btn sm" href={cur.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Open in new tab</a></div>
            <Notice kind="warn">This frame shows the real {kind === 'tableau' ? 'Tableau' : 'Power BI'} page at the link you saved. DataVerse cannot tell whether it loaded: if it stays blank, the report needs sign-in, is not published, or blocks embedding. Use “Open in new tab” to check.</Notice>
            <iframe key={cur.id} title={cur.title} src={cur.embed_url} style={{ width: '100%', height: 560, border: '1px solid var(--border)', borderRadius: 14, background: '#fff' }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms" referrerPolicy="no-referrer-when-downgrade" loading="lazy" allowFullScreen />
          </div>
        ) : <div className="card"><Empty icon={<Link2 size={36} />} title="No dashboards added yet">Paste a published dashboard link to embed it here. DataVerse never fabricates embeds or sample dashboard URLs.</Empty></div>}
      </div>
    </div>
  )
}
