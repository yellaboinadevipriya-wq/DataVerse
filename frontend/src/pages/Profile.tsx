import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Notice } from '../components/ui'
import { errMsg, useApp } from '../ctx'

export default function Profile() {
  const { user, setUser, signOut, toast, theme, toggleTheme } = useApp()
  const [name, setName] = useState(user!.name)
  const [lang, setLang] = useState(user!.language)
  const save = async () => {
    try { setUser((await api.patch('/auth/me', { name, language: lang })).data); toast('Profile saved.', 'success') } catch (e) { toast(errMsg(e), 'error') }
  }
  return (
   
<div style={{ maxWidth: 560 }}>
  <h1 style={{ fontSize: 'clamp(2rem,4.5vw,3rem)' }}>
    Profile & <span className="grad">settings</span>
  </h1>
  <div className="card">
    <div className="field">
      <label>Email</label>
      <input value={user!.email} disabled />
    </div>

    <div className="field">
      <label htmlFor="nm">Name</label>
      <input
        id="nm"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />
    </div>

    <div className="row">
      <button className="btn primary" onClick={save}>
        Save changes
      </button>
      <button className="btn" onClick={toggleTheme}>
        Theme: {theme}
      </button>
      <Link className="btn" to="/saved">
        Saved work
      </Link>
      <button className="btn danger" onClick={signOut}>
        Sign out
      </button>
    </div>
  </div>
</div>
)
}
