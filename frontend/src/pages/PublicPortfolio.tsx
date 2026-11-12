import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errMsg } from '../api'
import PortfolioView from '../components/PortfolioView'
import { Notice, Skeletons } from '../components/ui'

export default function PublicPortfolio() {
  const { slug } = useParams()
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState('')
  useEffect(() => { setD(null); setErr(''); api.get(`/public/portfolio/${slug}`).then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))) }, [slug])
  if (err) return <div className="empty"><h2>Portfolio not available</h2><Notice kind="warn">{err}</Notice><Link className="btn primary" to="/">Go to DataVerse</Link></div>
  if (!d) return <Skeletons n={2} />
  return <><PortfolioView d={d} /><p className="muted small center" style={{ marginTop: '2rem' }}>Built with <Link to="/">DataVerse</Link>. Projects may use synthetic practice data, as stated in each project.</p></>
}
