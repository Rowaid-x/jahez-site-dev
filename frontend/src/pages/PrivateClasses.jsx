import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'

function formatCurrency(val, currency = 'QAR') {
  if (val == null) return `0 ${currency}`
  return Number(val).toLocaleString('en-QA') + ` ${currency}`
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const DURATION_OPTIONS = [
  { value: '0.5', label: '30 min' },
  { value: '1.0', label: '1 hr' },
  { value: '1.5', label: '1.5 hrs' },
  { value: '2.0', label: '2 hrs' },
  { value: '2.5', label: '2.5 hrs' },
  { value: '3.0', label: '3 hrs' },
]

const CURRENCIES = ['QAR', 'USD', 'GBP', 'JOD', 'EGP']
const CURRENCY_RATES = { QAR: 1, USD: 3.65, GBP: 4.62, JOD: 5.15, EGP: 0.075 }

export default function PrivateClasses() {
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState({
    student: '', teacher: '', date: '', duration: '1.0', subject: '',
    student_hourly_rate: '', student_currency: 'QAR',
    teacher_hourly_rate: '', teacher_currency: 'QAR',
    student_payment_status: 'pending', teacher_payment_status: 'pending',
    notes: '',
  })

  const fetchClasses = () => {
    setLoading(true)
    const params = { search }
    if (statusFilter) params.student_payment_status = statusFilter
    client.get('/private-classes/', { params })
      .then(res => setClasses(res.data.results || res.data))
      .catch(() => toast.error('Failed to load classes'))
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

  useEffect(() => { fetchClasses() }, [search, statusFilter])
  useEffect(() => { fetchDropdowns() }, [])

  const getDefaultDate = () => new Date().toISOString().split('T')[0]

  const openCreate = () => {
    setEditing(null)
    setForm({
      student: '', teacher: '', date: getDefaultDate(), duration: '1.0', subject: '',
      student_hourly_rate: '', student_currency: 'QAR',
      teacher_hourly_rate: '', teacher_currency: 'QAR',
      student_payment_status: 'pending', teacher_payment_status: 'pending',
      notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({
      student: c.student, teacher: c.teacher, date: c.date,
      duration: String(c.duration), subject: c.subject || '',
      student_hourly_rate: c.student_hourly_rate,
      student_currency: c.student_currency || 'QAR',
      teacher_hourly_rate: c.teacher_hourly_rate,
      teacher_currency: c.teacher_currency || 'QAR',
      student_payment_status: c.student_payment_status,
      teacher_payment_status: c.teacher_payment_status,
      notes: c.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.student || !form.teacher || !form.date || !form.student_hourly_rate || !form.teacher_hourly_rate) {
      toast.error('Please fill in all required fields')
      return
    }
    try {
      const payload = {
        ...form,
        student: Number(form.student),
        teacher: Number(form.teacher),
        duration: Number(form.duration),
        student_hourly_rate: Number(form.student_hourly_rate),
        student_currency: form.student_currency,
        teacher_hourly_rate: Number(form.teacher_hourly_rate),
        teacher_currency: form.teacher_currency,
        student_paid_date: form.student_payment_status === 'paid' ? (form.student_paid_date || getDefaultDate()) : null,
        teacher_paid_date: form.teacher_payment_status === 'paid' ? (form.teacher_paid_date || getDefaultDate()) : null,
      }
      if (editing) {
        await client.put(`/private-classes/${editing.id}/`, payload)
        toast.success('Class updated')
      } else {
        await client.post('/private-classes/', payload)
        toast.success('Class created')
      }
      setModalOpen(false)
      fetchClasses()
    } catch (err) {
      const errData = err.response?.data
      const msg = errData?.detail || Object.values(errData || {})?.[0]?.[0] || 'Failed to save class'
      toast.error(msg)
    }
  }

  const handleDelete = async (c) => {
    if (!confirm(`Delete this class session?`)) return
    try {
      await client.delete(`/private-classes/${c.id}/`)
      toast.success('Class deleted')
      fetchClasses()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete class')
    }
  }

  const markStudentPaid = async (c) => {
    try {
      await client.post(`/private-classes/${c.id}/mark_student_paid/`)
      toast.success('Student marked as paid')
      fetchClasses()
    } catch { toast.error('Failed to update') }
  }

  const markStudentUnpaid = async (c) => {
    try {
      await client.post(`/private-classes/${c.id}/mark_student_unpaid/`)
      toast.success('Student marked as unpaid')
      fetchClasses()
    } catch { toast.error('Failed to update') }
  }

  const markTeacherPaid = async (c) => {
    try {
      await client.post(`/private-classes/${c.id}/mark_teacher_paid/`)
      toast.success('Teacher marked as paid')
      fetchClasses()
    } catch { toast.error('Failed to update') }
  }

  const markTeacherUnpaid = async (c) => {
    try {
      await client.post(`/private-classes/${c.id}/mark_teacher_unpaid/`)
      toast.success('Teacher marked as unpaid')
      fetchClasses()
    } catch { toast.error('Failed to update') }
  }

  // Summary stats (all in QAR for correct cross-currency totals)
  const totalStudentRevenue = classes.reduce((s, c) => s + (c.student_total_qar || 0), 0)
  const totalTeacherCost = classes.reduce((s, c) => s + (c.teacher_total_qar || 0), 0)
  const totalProfit = classes.reduce((s, c) => s + (c.profit || 0), 0)
  const unpaidStudentCount = classes.filter(c => c.student_payment_status === 'pending').length
  const unpaidTeacherCount = classes.filter(c => c.teacher_payment_status === 'pending').length

  const computedTotal = form.student_hourly_rate && form.duration
    ? (Number(form.student_hourly_rate) * Number(form.duration))
    : 0
  const computedTeacherTotal = form.teacher_hourly_rate && form.duration
    ? (Number(form.teacher_hourly_rate) * Number(form.duration))
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark-100">Private Classes</h1>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Add Class
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="stat-card">
          <span className="text-xs text-dark-400">Total Sessions</span>
          <span className="text-lg font-bold text-dark-100">{classes.length}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-dark-400">Student Revenue</span>
          <span className="text-lg font-bold text-emerald-400">{formatCurrency(totalStudentRevenue)}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-dark-400">Teacher Cost</span>
          <span className="text-lg font-bold text-yellow-400">{formatCurrency(totalTeacherCost)}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-dark-400">Profit</span>
          <span className="text-lg font-bold text-brand-400">{formatCurrency(totalProfit)}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-dark-400">Unpaid</span>
          <span className="text-lg font-bold text-red-400">{unpaidStudentCount} student / {unpaidTeacherCount} teacher</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by student, teacher, subject..."
            className="w-full pl-9"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          <option value="pending">Student Unpaid</option>
          <option value="paid">Student Paid</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16">
          <Clock size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">No private classes found</p>
          <p className="text-dark-600 text-sm mt-1">Add your first class session to get started</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-900/50">
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Student</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Teacher</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Subject</th>
                  <th className="text-center px-4 py-3 text-dark-400 font-medium">Duration</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Student Total</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Teacher Total</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Profit (QAR)</th>
                  <th className="text-center px-4 py-3 text-dark-400 font-medium">Student Paid</th>
                  <th className="text-center px-4 py-3 text-dark-400 font-medium">Teacher Paid</th>
                  <th className="text-center px-4 py-3 text-dark-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
                    <td className="px-4 py-3 text-dark-300">{formatDate(c.date)}</td>
                    <td className="px-4 py-3 font-medium" dir="auto">{c.student_name}</td>
                    <td className="px-4 py-3 text-dark-300" dir="auto">{c.teacher_name}</td>
                    <td className="px-4 py-3 text-dark-300" dir="auto">{c.subject || '-'}</td>
                    <td className="px-4 py-3 text-center">{Number(c.duration)} hr{Number(c.duration) !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(c.student_total, c.student_currency)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(c.teacher_total, c.teacher_currency)}</td>
                    <td className="px-4 py-3 text-right text-brand-400">{formatCurrency(c.profit, 'QAR')}</td>
                    <td className="px-4 py-3 text-center">
                      {c.student_payment_status === 'paid' ? (
                        <button onClick={() => markStudentUnpaid(c)} className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                          <CheckCircle size={14} /> Paid
                        </button>
                      ) : (
                        <button onClick={() => markStudentPaid(c)} className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300">
                          <XCircle size={14} /> Pending
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.teacher_payment_status === 'paid' ? (
                        <button onClick={() => markTeacherUnpaid(c)} className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                          <CheckCircle size={14} /> Paid
                        </button>
                      ) : (
                        <button onClick={() => markTeacherPaid(c)} className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300">
                          <XCircle size={14} /> Pending
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-dark-400 hover:text-brand-400 hover:bg-dark-700 rounded-lg transition-colors"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Class' : 'Add Private Class'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-sm text-dark-400 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Duration *</label>
              <select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="w-full">
                {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Student Rate / hr *</label>
              <div className="flex gap-2">
                <input type="number" value={form.student_hourly_rate} onChange={e => setForm({ ...form, student_hourly_rate: e.target.value })} placeholder="e.g. 200" className="flex-1" min="1" />
                <select value={form.student_currency} onChange={e => setForm({ ...form, student_currency: e.target.value })} className="w-24">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Teacher Rate / hr *</label>
              <div className="flex gap-2">
                <input type="number" value={form.teacher_hourly_rate} onChange={e => setForm({ ...form, teacher_hourly_rate: e.target.value })} placeholder="e.g. 100" className="flex-1" min="1" />
                <select value={form.teacher_currency} onChange={e => setForm({ ...form, teacher_currency: e.target.value })} className="w-24">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-dark-400 mb-1">Subject</label>
              <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics, Physics..." className="w-full" dir="auto" />
            </div>
          </div>

          {/* Computed totals preview */}
          {(computedTotal > 0 || computedTeacherTotal > 0) && (
            <div className="bg-dark-900/50 rounded-lg p-3 text-sm grid grid-cols-3 gap-4">
              <div>
                <span className="text-dark-500">Student pays:</span>
                <span className="ml-2 text-dark-200 font-medium">{formatCurrency(computedTotal, form.student_currency)}</span>
              </div>
              <div>
                <span className="text-dark-500">Teacher gets:</span>
                <span className="ml-2 text-dark-200 font-medium">{formatCurrency(computedTeacherTotal, form.teacher_currency)}</span>
              </div>
              <div>
                <span className="text-dark-500">Profit (QAR):</span>
                <span className="ml-2 text-brand-400 font-medium">
                  {formatCurrency(
                    (computedTotal * (CURRENCY_RATES[form.student_currency] || 1)) -
                    (computedTeacherTotal * (CURRENCY_RATES[form.teacher_currency] || 1)),
                    'QAR'
                  )}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-dark-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." className="w-full h-20 resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary">
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
