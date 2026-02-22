import { useState, useEffect } from 'react'
import { Plus, Search, FolderKanban, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'

function formatQAR(val) {
  if (val == null) return '0 QAR'
  return Number(val).toLocaleString('en-QA') + ' QAR'
}

const CURRENCY_RATES = { QAR: 1, USD: 3.65, GBP: 4.62, JOD: 5.15, EGP: 0.075 }

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    code: '', name: '', student: '', teacher: '',
    currency: 'QAR', fee_in_original: '', total_fee: '',
    installment_months: '', payment_start_date: '',
    teacher_fee: '', teacher_currency: 'QAR', teacher_fee_in_original: '',
    notes: '',
  })

  const fetchProjects = () => {
    setLoading(true)
    client.get('/projects/', { params: { search } })
      .then(res => setProjects(res.data.results || res.data))
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setLoading(false))
  }

  const fetchDropdowns = () => {
    Promise.all([
      client.get('/students/'),
      client.get('/teachers/'),
    ]).then(([sRes, tRes]) => {
      setStudents(sRes.data.results || sRes.data)
      setTeachers(tRes.data.results || tRes.data)
    }).catch(console.error)
  }

  useEffect(() => { fetchProjects() }, [search])
  useEffect(() => { fetchDropdowns() }, [])

  const getDefaultStartDate = () => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return next.toISOString().split('T')[0]
  }

  const openCreate = () => {
    setForm({
      code: '', name: '', student: '', teacher: '',
      currency: 'QAR', fee_in_original: '', total_fee: '',
      installment_months: '',
      payment_start_date: getDefaultStartDate(),
      teacher_fee: '', teacher_currency: 'QAR', teacher_fee_in_original: '',
      notes: '',
    })
    setModalOpen(true)
  }

  const handleCurrencyChange = (currency) => {
    const rate = CURRENCY_RATES[currency] || 1
    const origAmt = form.fee_in_original ? Number(form.fee_in_original) : 0
    const qarAmt = currency === 'QAR' ? origAmt : Math.round(origAmt * rate)
    setForm({ ...form, currency, total_fee: qarAmt || '' })
  }

  const handleOriginalFeeChange = (val) => {
    const rate = CURRENCY_RATES[form.currency] || 1
    const qarAmt = form.currency === 'QAR' ? val : Math.round(Number(val) * rate)
    setForm({ ...form, fee_in_original: val, total_fee: qarAmt || '' })
  }

  const handleSave = async () => {
    if (!form.code || !form.name || !form.student || !form.teacher || !form.total_fee || !form.installment_months || !form.payment_start_date) {
      toast.error('Please fill in all required fields')
      return
    }
    try {
      const payload = {
        ...form,
        student: Number(form.student),
        teacher: Number(form.teacher),
        currency: form.currency,
        fee_in_original: form.currency !== 'QAR' && form.fee_in_original ? Number(form.fee_in_original) : null,
        exchange_rate: CURRENCY_RATES[form.currency] || 1,
        total_fee: Number(form.total_fee),
        installment_months: Number(form.installment_months),
        teacher_fee: form.teacher_fee ? Number(form.teacher_fee) : null,
        teacher_currency: form.teacher_currency,
        teacher_fee_in_original: form.teacher_currency !== 'QAR' && form.teacher_fee_in_original ? Number(form.teacher_fee_in_original) : null,
        teacher_exchange_rate: CURRENCY_RATES[form.teacher_currency] || 1,
      }
      await client.post('/projects/', payload)
      toast.success('Project created with installment schedule')
      setModalOpen(false)
      fetchProjects()
    } catch (err) {
      const errData = err.response?.data
      const msg = errData?.code?.[0] || errData?.detail || Object.values(errData || {})?.[0]?.[0] || 'Failed to create project'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark-100">Projects</h1>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> New Project
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by code, name, student, teacher..."
          className="w-full pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">No projects found</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-900/50">
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Code</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Student</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Teacher</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Total Fee</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Paid</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Balance</th>
                  <th className="text-center px-4 py-3 text-dark-400 font-medium">Status</th>
                  <th className="text-center px-4 py-3 text-dark-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-brand-400">{p.code}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-dark-300" dir="auto">{p.student_name}</td>
                    <td className="px-4 py-3 text-dark-300" dir="auto">{p.teacher_name}</td>
                    <td className="px-4 py-3 text-right">
                      {formatQAR(p.total_fee)}
                      {p.original_fee_display && (
                        <span className="block text-xs text-dark-500">{p.original_fee_display}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">{formatQAR(p.total_paid)}</td>
                    <td className="px-4 py-3 text-right text-yellow-400">{formatQAR(p.remaining_balance)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        to={`/projects/${p.id}`}
                        className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 text-sm"
                      >
                        <Eye size={15} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Project" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">Project Code *</label>
              <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1022" className="w-full" autoFocus />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Project Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Project title..." className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Student *</label>
              <select value={form.student} onChange={e => setForm({ ...form, student: e.target.value })} className="w-full">
                <option value="">Select student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Teacher *</label>
              <select value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} className="w-full">
                <option value="">Select teacher...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Currency</label>
              <select value={form.currency} onChange={e => handleCurrencyChange(e.target.value)} className="w-full">
                <option value="QAR">QAR - Qatari Riyal</option>
                <option value="USD">USD - US Dollar</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JOD">JOD - Jordanian Dinar</option>
                <option value="EGP">EGP - Egyptian Pound</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">
                {form.currency === 'QAR' ? 'Total Fee (QAR) *' : `Fee in ${form.currency} *`}
              </label>
              <input type="number" value={form.fee_in_original || form.total_fee} onChange={e => handleOriginalFeeChange(e.target.value)} placeholder="e.g. 10000" className="w-full" min="1" />
              {form.currency !== 'QAR' && form.fee_in_original && (
                <p className="text-xs text-dark-500 mt-1">
                  = {formatQAR(form.total_fee)} (rate: 1 {form.currency} = {CURRENCY_RATES[form.currency]} QAR)
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Installment Months *</label>
              <input type="number" value={form.installment_months} onChange={e => setForm({ ...form, installment_months: e.target.value })} placeholder="e.g. 5" className="w-full" min="1" />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Payment Start Date *</label>
              <input type="date" value={form.payment_start_date} onChange={e => setForm({ ...form, payment_start_date: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Teacher Fee</label>
              <div className="flex gap-2">
                <input type="number" value={form.teacher_currency === 'QAR' ? form.teacher_fee : form.teacher_fee_in_original} onChange={e => {
                  if (form.teacher_currency === 'QAR') {
                    setForm({ ...form, teacher_fee: e.target.value, teacher_fee_in_original: '' })
                  } else {
                    const rate = CURRENCY_RATES[form.teacher_currency] || 1
                    const qarAmt = Math.round(Number(e.target.value) * rate)
                    setForm({ ...form, teacher_fee_in_original: e.target.value, teacher_fee: qarAmt || '' })
                  }
                }} placeholder="Optional" className="flex-1" />
                <select value={form.teacher_currency} onChange={e => {
                  const cur = e.target.value
                  const rate = CURRENCY_RATES[cur] || 1
                  if (cur === 'QAR') {
                    setForm({ ...form, teacher_currency: cur, teacher_fee_in_original: '' })
                  } else {
                    const orig = form.teacher_fee_in_original || form.teacher_fee
                    const qarAmt = orig ? Math.round(Number(orig) * rate) : ''
                    setForm({ ...form, teacher_currency: cur, teacher_fee_in_original: orig, teacher_fee: qarAmt })
                  }
                }} className="w-24">
                  <option value="QAR">QAR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="JOD">JOD</option>
                  <option value="EGP">EGP</option>
                </select>
              </div>
              {form.teacher_currency !== 'QAR' && form.teacher_fee_in_original && (
                <p className="text-xs text-dark-500 mt-1">
                  = {formatQAR(form.teacher_fee)} (rate: 1 {form.teacher_currency} = {CURRENCY_RATES[form.teacher_currency]} QAR)
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." className="w-full h-20 resize-none" />
          </div>

          {form.total_fee && form.installment_months && Number(form.installment_months) > 0 && (
            <div className="bg-dark-900/50 rounded-lg p-3 text-sm">
              <p className="text-dark-400">
                Monthly installment: <span className="text-dark-200 font-medium">
                  {formatQAR(Math.ceil(Number(form.total_fee) / Number(form.installment_months)))}
                </span>
                {' '}&times; {form.installment_months} months
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary">Create Project</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
