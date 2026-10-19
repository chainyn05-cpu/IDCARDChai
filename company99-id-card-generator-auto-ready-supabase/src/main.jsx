import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { IdCard, Users, Download, Printer, Search, LogIn, LogOut, Upload, CheckCircle2, AlertCircle, Building2, ShieldCheck, ImagePlus, RefreshCw } from 'lucide-react'
import './styles.css'

// Automatically use Supabase when valid environment variables are provided; otherwise run in local demo mode.
// Normalize the project URL in case Vercel's environment variable was pasted with
// an API path such as /auth/v1 or /rest/v1. Supabase expects the project root URL.
const RAW_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const SUPABASE_URL = RAW_SUPABASE_URL
  .replace(/\/+$/, '')
  .replace(/\/(auth|rest|storage|functions)\/v1$/i, '')
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
const DEMO_MODE = !(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE'))
const supabase = !DEMO_MODE && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

const BRANDS = [
  { id: 'PUZZLE', name: 'PUZZLE', logo: '/logos/puzzle.png', color: '#1d4ed8', desc: 'PUZZLE' },
  { id: 'BAT', name: 'BAT', logo: '/logos/bat.png', color: '#e11d35', desc: 'BAT' },
  { id: 'POS TRAIN', name: 'POS TRAIN', logo: '/logos/pos-train.png', color: '#15965b', desc: 'POS TRAIN' },
]
const blank = { brand: 'PUZZLE', full_name: '', position: '', phone: '', photo: '' }
const DEMO_ADMIN_PASSWORD = 'Bong99'
const localKey = 'employee-id-card-generator-records-v1'

function readLocal() { try { return JSON.parse(localStorage.getItem(localKey) || '[]') } catch { return [] } }
function saveLocal(records) { localStorage.setItem(localKey, JSON.stringify(records)) }
function App() {
  const [tab, setTab] = useState('submit')
  const [form, setForm] = useState(blank)
  const [records, setRecords] = useState([])
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localAdminUnlocked, setLocalAdminUnlocked] = useState(false)
  const [cloudMode, setCloudMode] = useState(Boolean(supabase))
  const [activeRecord, setActiveRecord] = useState(null)
  const [photoZoom, setPhotoZoom] = useState(1)
  const [photoX, setPhotoX] = useState(50)
  const [photoY, setPhotoY] = useState(50)
  const [selectedIds, setSelectedIds] = useState([])

  const brand = BRANDS.find(b => b.id === form.brand) || BRANDS[0]
  const activeBrand = BRANDS.find(b => b.id === (activeRecord?.brand || form.brand)) || BRANDS[0]

  useEffect(() => {
    if (!supabase) { setRecords(readLocal()); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (supabase && session?.user?.app_metadata?.role === 'admin' && tab === 'admin') loadRecords()
  }, [session, tab])

  async function loadRecords() {
    if (!supabase) { setRecords(readLocal()); return }
    const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false })
    if (error) { setNotice('មិនអាចទាញយកទិន្នន័យបាន៖ ' + error.message); return }
    const withPhotos = await Promise.all((data || []).map(async row => {
      let photo = ''
      if (row.photo_path) {
        const { data: signed } = await supabase.storage.from('employee-photos').createSignedUrl(row.photo_path, 3600)
        photo = signed?.signedUrl || ''
      }
      return { ...row, photo, photo_zoom: row.photo_zoom ?? 1, photo_x: row.photo_x ?? 50, photo_y: row.photo_y ?? 50 }
    }))
    setRecords(withPhotos)
  }

  function update(k, v) { setForm(prev => ({ ...prev, [k]: v })) }
  function onPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setNotice('សូមជ្រើសរើសឯកសាររូបភាព។'); return }
    if (file.size > 5 * 1024 * 1024) { setNotice('រូបថតត្រូវមានទំហំតិចជាង 5MB។'); return }
    setPhotoFile(file)
    setPhotoZoom(1); setPhotoX(50); setPhotoY(50)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      setPhotoPreview(dataUrl)
      update('photo', dataUrl)
    }
    reader.onerror = () => setNotice('មិនអាចអានរូបថតបានទេ។ សូមសាកល្បងរូបភាពផ្សេង។')
    reader.readAsDataURL(file)
  }

  async function submitForm(e) {
    e.preventDefault()
    setNotice('')
    if (!form.full_name.trim() || !form.position.trim() || !photoFile && !form.photo) {
      setNotice('សូមបំពេញឈ្មោះ តួនាទី និងបញ្ចូលរូបថត។'); return
    }
    setBusy(true)
    try {
      if (supabase) {
        let photo_path = null
        if (photoFile) {
          const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
          photo_path = `${form.brand.toLowerCase().replace(/\s+/g, '-')}/${crypto.randomUUID()}.${ext}`
          const { error: uploadError } = await supabase.storage.from('employee-photos').upload(photo_path, photoFile, { upsert: false, contentType: photoFile.type })
          if (uploadError) throw uploadError
        }
        const { error } = await supabase.from('employees').insert([{
          brand: form.brand, full_name: form.full_name.trim(), position: form.position.trim(),
          phone: form.phone.trim(), photo_path, photo_zoom: photoZoom, photo_x: photoX, photo_y: photoY, status: 'Approved'
        }])
        if (error) throw error
        setNotice('បានរក្សាទុកព័ត៌មានជោគជ័យ! កាតរបស់អ្នកត្រូវបានបង្កើតដោយស្វ័យប្រវត្តិ មិនចាំបាច់រង់ចាំអនុម័តទេ។')
      } else {
        const entry = { ...form, photo_zoom: photoZoom, photo_x: photoX, photo_y: photoY, id: crypto.randomUUID(), status: 'Approved', created_at: new Date().toISOString(), photo: photoPreview || form.photo }
        const next = [entry, ...readLocal()]
        saveLocal(next); setRecords(next)
        setActiveRecord(entry)
        setNotice('បានរក្សាទុក Demo នៅលើ Browser នេះ។ ដើម្បីឱ្យអ្នកទទួលបានពីឧបករណ៍ផ្សេង សូមភ្ជាប់ Supabase តាម README។')
      }
      setActiveRecord(null)
      setForm(blank); setPhotoFile(null); setPhotoPreview(''); setPhotoZoom(1); setPhotoX(50); setPhotoY(50)
    } catch (err) {
      setNotice('មានបញ្ហា៖ ' + (err?.message || 'មិនអាចរក្សាទុកបាន'))
    } finally { setBusy(false) }
  }

  async function signIn(e) {
    e.preventDefault(); setNotice('')
    if (!supabase) {
      if (password === DEMO_ADMIN_PASSWORD) { setLocalAdminUnlocked(true); setNotice('បាន Login ជោគជ័យក្នុង Demo Mode។') }
      else setNotice('Password មិនត្រឹមត្រូវទេ។ សូមព្យាយាមម្ដងទៀត។')
      return
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setNotice('Login មិនជោគជ័យ៖ ' + error.message)
    else if (data.user?.app_metadata?.role !== 'admin') { await supabase.auth.signOut(); setNotice('គណនីនេះមិនទាន់មានសិទ្ធិ Admin ទេ។ សូមកំណត់ role=admin ក្នុង Supabase SQL Editor។') }
    else { setTab('admin'); setNotice('បាន Login ជោគជ័យ។') }
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setSession(null); setLocalAdminUnlocked(false); setPassword(''); setTab('submit') }


  async function downloadCard(record, format = 'png') {
    if (!record?.full_name?.trim() || !record?.position?.trim() || !(record?.photo || photoPreview)) {
      setNotice('សូមបំពេញឈ្មោះ តួនាទី និងបញ្ចូលរូបថត មុនពេល Download ID Card។')
      return
    }
    const node = document.getElementById(`idcard-${record.id || 'preview'}`)
    if (!node) { setNotice('មិនអាចរកឃើញកាតបានទេ។'); return }
    try {
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: '#101116' })
      const name = `${(record.full_name || 'employee').replace(/[^a-z0-9-_]/gi, '-')}-ID`
      if (format === 'pdf') {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [54, 86] })
        pdf.addImage(dataUrl, 'PNG', 0, 0, 54, 86)
        pdf.save(`${name}.pdf`)
      } else {
        const a = document.createElement('a'); a.href = dataUrl; a.download = `${name}.png`; a.click()
      }
    } catch (err) { setNotice('Download មានបញ្ហា៖ ' + err.message) }
  }

  async function exportAllPdf() {
    const cardsToPrint = filtered.filter(r => !selectedIds.length || selectedIds.includes(r.id))
    if (!cardsToPrint.length) { setNotice('មិនមានកាតសម្រាប់បោះពុម្ពទេ។'); return }
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const cardW = 54, cardH = 86, marginX = 8, marginY = 8, gapX = 9, gapY = 7
    const perPage = 9
    for (let i = 0; i < cardsToPrint.length; i++) {
      if (i > 0 && i % perPage === 0) pdf.addPage()
      const r = cardsToPrint[i]
      const node = document.getElementById(`idcard-${r.id}`)
      if (!node) continue
      const data = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: '#08090c' })
      const slot = i % perPage
      const x = marginX + (slot % 3) * (cardW + gapX)
      const y = marginY + Math.floor(slot / 3) * (cardH + gapY)
      pdf.addImage(data, 'PNG', x, y, cardW, cardH)
    }
    pdf.save('company99-employee-id-cards-a4.pdf')
    setNotice(`បានរៀបចំកាត ${cardsToPrint.length} សន្លឹកសម្រាប់បោះពុម្ព A4។`)
  }

  function toggleSelected(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }
  function toggleAllCards() {
    const ids = filtered.map(r => r.id)
    setSelectedIds(prev => ids.length && ids.every(id => prev.includes(id)) ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  const filtered = useMemo(() => records.filter(r => [r.full_name, r.brand, r.position, r.phone].join(' ').toLowerCase().includes(search.toLowerCase())), [records, search])
  const previewRecord = activeRecord || { ...form, id: 'preview', photo: photoPreview || form.photo, status: 'Preview' }
  const isAdmin = !supabase || Boolean(session)

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><IdCard size={23}/></div><div><strong>ID CARD STUDIO</strong><span>EMPLOYEE REGISTRATION PORTAL</span></div></div>
      <div className="top-actions"><span className={`connection ${supabase ? 'connected' : ''}`}><i/> {supabase ? 'CLOUD READY' : 'DEMO MODE'}</span>{(session || localAdminUnlocked) && <button className="ghost small" onClick={signOut}><LogOut size={15}/> Logout</button>}</div>
    </header>

    <main className="main">
      <nav className="tabs">
        <button className={tab === 'submit' ? 'tab active' : 'tab'} onClick={() => {setTab('submit'); setActiveRecord(null)}}><ImagePlus size={17}/> Registration Form</button>
        <button className={tab === 'admin' ? 'tab active' : 'tab'} onClick={() => setTab('admin')}><Users size={17}/> Admin Dashboard</button>
      </nav>

      {tab === 'submit' ? <div className="workspace">
        <section className="panel form-panel">
          <div className="panel-heading"><div><span className="eyebrow">STEP 01 / INFORMATION</span><h2>បញ្ចូលព័ត៌មានបុគ្គលិក</h2><p>Fields with * are required.</p></div><div className="step-number">01</div></div>
          <form onSubmit={submitForm}>
            <label className="field-label">ជ្រើសរើសក្រុមហ៊ុន / BRAND *</label>
            <div className="brand-choices">{BRANDS.map(b => <button type="button" key={b.id} className={`brand-choice ${form.brand === b.id ? 'selected' : ''}`} onClick={() => update('brand', b.id)}><span className="brand-logo"><img src={b.logo} alt={b.name}/></span><span>{b.name}</span>{form.brand === b.id && <CheckCircle2 className="choice-check" size={16}/>}</button>)}</div>
            <div className="form-grid">
              <div className="field full"><label>ឈ្មោះពេញ / Full name *</label><input value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="ឧ. Sok Dara" required/></div>
              <div className="field"><label>តួនាទី / Position *</label><input value={form.position} onChange={e => update('position', e.target.value)} placeholder="ឧ. Bartender" required/></div>
              <div className="field"><label>លេខទូរស័ព្ទ / Phone</label><input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="0XX XXX XXX"/></div>
            </div>
            <label className="field-label photo-label">រូបថតបុគ្គលិក / PHOTO *</label>
            <label className="upload-box">
              {photoPreview ? <img src={photoPreview} alt="Employee preview"/> : <div className="upload-placeholder"><Upload size={24}/><b>Click to upload photo</b><span>JPG, PNG • Up to 5MB</span></div>}
              <input type="file" accept="image/*" onChange={onPhoto} hidden/>
              {photoPreview && <span className="replace-photo">Change photo</span>}
            </label>
            {photoPreview && <div className="crop-controls">
              <div className="crop-title"><b>កែទីតាំងរូបថត / PHOTO CROP</b><button type="button" className="ghost small" onClick={() => {setPhotoZoom(1); setPhotoX(50); setPhotoY(50)}}>Reset</button></div>
              <label>ពង្រីក / Zoom <span>{photoZoom.toFixed(1)}×</span><input type="range" min="1" max="2.5" step="0.1" value={photoZoom} onChange={e => setPhotoZoom(Number(e.target.value))}/></label>
              <label>ទីតាំងឆ្វេង–ស្តាំ / Horizontal <span>{photoX}%</span><input type="range" min="0" max="100" value={photoX} onChange={e => setPhotoX(Number(e.target.value))}/></label>
              <label>ទីតាំងលើ–ក្រោម / Vertical <span>{photoY}%</span><input type="range" min="0" max="100" value={photoY} onChange={e => setPhotoY(Number(e.target.value))}/></label>
            </div>}
            <div className="form-foot"><span><ShieldCheck size={16}/> សូមពិនិត្យព័ត៌មានមុន Submit</span><button className="primary" disabled={busy}>{busy ? 'កំពុងរក្សាទុក…' : 'Submit Information'} <span>↗</span></button></div>
          </form>
          {notice && <div className="notice"><AlertCircle size={17}/><span>{notice}</span></div>}
        </section>

        <aside className="preview-column">
          <div className="preview-heading"><div><span className="eyebrow">STEP 02 / LIVE PREVIEW</span><h2>ID Card Preview</h2></div><span className="live-pill"><i/> LIVE</span></div>
          <p className="muted">ទម្រង់កាតបញ្ឈរ • 54 × 86 mm</p>
          <IDCard record={{...previewRecord, photo_zoom: photoZoom, photo_x: photoX, photo_y: photoY}} brand={activeBrand}/>
          <div className="preview-actions"><button className="secondary" onClick={() => downloadCard(previewRecord, 'png')}><Download size={16}/> Download My ID (PNG)</button><button className="secondary" onClick={() => downloadCard(previewRecord, 'pdf')}><Download size={16}/> PDF Print</button></div>
          <div className="tip"><div className="tip-icon">✦</div><div><b>Print tip</b><p>Download PDF សម្រាប់ទំហំ 54 × 86 mm។ កាតត្រូវបានបង្កើតដោយស្វ័យប្រវត្តិ ហើយអាចបោះពុម្ពបានភ្លាមៗ។</p></div></div>
        </aside>
      </div> : <section className="panel dashboard">
        <div className="panel-heading dash-heading"><div><span className="eyebrow">STAFF DATABASE</span><h2>Admin Dashboard</h2><p>គ្រប់គ្រង និងបោះពុម្ពកាតបុគ្គលិកដែលបានបង្កើតដោយស្វ័យប្រវត្តិ</p></div><div className="dash-actions">{supabase && session && <button className="secondary" onClick={loadRecords}><RefreshCw size={16}/> Refresh</button>}<button className="secondary" onClick={toggleAllCards}>ជ្រើសរើសកាតទាំងអស់</button><button className="primary" onClick={exportAllPdf}><Printer size={16}/> Print {selectedIds.length ? `Selected (${selectedIds.length})` : "All Cards"} A4</button></div></div>
        {(!supabase && !localAdminUnlocked) ? <form className="login-box" onSubmit={signIn}><div className="login-icon"><ShieldCheck size={26}/></div><h3>Admin Login</h3><p>បញ្ចូល Password ដើម្បីចូលគ្រប់គ្រងទិន្នន័យ Demo។</p><div className="field"><label>Admin Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter password" autoComplete="current-password"/></div><button className="primary"><LogIn size={16}/> Login</button></form> : (supabase && (!session || session.user?.app_metadata?.role !== 'admin')) ? <form className="login-box" onSubmit={signIn}><div className="login-icon"><ShieldCheck size={26}/></div><h3>Admin sign in</h3><p>សម្រាប់ Cloud ពិត សូមប្រើ Admin Email ក្នុង Supabase Auth និង Password ដែលបានកំណត់ (អាចប្រើ Bong99)។</p><div className="field"><label>Admin Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@company.com"/></div><div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Bong99" autoComplete="current-password"/></div><button className="primary"><LogIn size={16}/> Sign in</button></form> : <>
          <div className="stats"><div><span>Total employees</span><b>{records.length}</b></div><div><span>Auto-created cards</span><b>{records.length}</b></div><div><span>Selected for print</span><b>{selectedIds.length}</b></div><div><span>Brands</span><b>03</b></div></div>
          {!supabase && <div className="demo-warning"><AlertCircle size={17}/> Demo mode: ទិន្នន័យមានតែនៅក្នុង Browser នេះប៉ុណ្ណោះ។ ភ្ជាប់ Supabase ដើម្បីប្រើ Cloud ពិតប្រាកដ។</div>}
          <div className="table-tools"><div className="searchbox"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ស្វែងរកឈ្មោះ, លេខ, ក្រុមហ៊ុន…"/></div><span>{filtered.length} records</span></div>
          <div className="employee-list">{filtered.length ? filtered.map(row => <div className="employee-row" key={row.id}><label className="select-card" title="ជ្រើសរើសសម្រាប់បោះពុម្ព"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)}/></label><div className="employee-avatar">{row.photo ? <img src={row.photo} alt=""/> : <span>{row.full_name?.slice(0,1) || '?'}</span>}</div><div className="employee-info"><b>{row.full_name}</b><span>{row.position}{row.phone ? ` • ${row.phone}` : ''}</span></div><span className="brand-chip">{row.brand}</span><span className="status approved">Ready</span><div className="row-actions"><button title="Preview" onClick={() => {setActiveRecord(row); setForm({...blank, ...row}); setPhotoPreview(row.photo || ''); setPhotoZoom(row.photo_zoom ?? 1); setPhotoX(row.photo_x ?? 50); setPhotoY(row.photo_y ?? 50); setTab('submit')}}><IdCard size={16}/></button><button title="Download PNG" onClick={() => downloadCard(row, 'png')}><Download size={16}/></button></div><div className="hidden-card"><IDCard record={row} brand={BRANDS.find(b => b.id === row.brand) || BRANDS[0]} elementId={`idcard-${row.id}`}/></div></div>) : <div className="empty"><Users size={28}/><b>មិនទាន់មានព័ត៌មានបុគ្គលិក</b><span>បុគ្គលិកដែល Submit នឹងបង្ហាញនៅទីនេះ។</span></div>}</div>
        </>}
        {notice && <div className="notice"><AlertCircle size={17}/><span>{notice}</span></div>}
      </section>}
      <footer className="site-footer">
        <div className="footer-credit"><span className="footer-kicker">DEVELOPED BY</span><strong>Chai</strong></div>
        <span className="footer-brands">PUZZLE <i/> BAT <i/> POS TRAIN</span>
        <div className="footer-legal"><strong>© 2026 Company 99 · Internal Use Only</strong><span>Unauthorized copying, distribution, resale, modification, or use outside Company 99 is prohibited without prior written authorization.</span></div>
      </footer>
    </main>
  </div>
}

function IDCard({ record, brand, elementId }) {
  const name = record?.full_name || 'EMPLOYEE NAME'
  const position = record?.position || 'JOB TITLE'
  const themeClass = brand.id === 'POS TRAIN' ? 'theme-pos' : brand.id === 'BAT' ? 'theme-bat' : 'theme-puzzle'
  return <div className="card-stage"><div className={`id-card ${themeClass}`} id={elementId || `idcard-${record?.id || 'preview'}`}>
    <div className="card-topline"><span>STAFF IDENTITY</span><span>COMPANY 99</span></div>
    <div className="card-logo"><img src={brand.logo} alt={brand.name}/></div>
    <div className="portrait">{record?.photo ? <img src={record.photo} alt={name} style={{objectPosition: `${record.photo_x ?? 50}% ${record.photo_y ?? 50}%`, transform: `scale(${record.photo_zoom ?? 1})`}}/> : <div className="portrait-placeholder"><Users size={37}/><span>PHOTO</span></div>}</div>
    <div className="card-divider"><span/><span/><span/></div>
    <div className="card-name">{name.toUpperCase()}</div>
    <div className="card-position">{position.toUpperCase()}</div>
    <div className="card-bottom"><div className="card-bottom-red"/><div className="card-bottom-info"><span>COMPANY</span><b>{brand.name}</b></div><div className="qr-fake"><div/><div/><div/><div/><div/><div/><div/><div/><div/></div></div>
    <div className="card-footer"><span>{brand.name} • STAFF CARD</span><span>2026</span></div>
  </div></div>
}

createRoot(document.getElementById('root')).render(<App />)
