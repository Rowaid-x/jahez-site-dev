import { useState, useEffect } from 'react'
import { CreditCard, Filter, CheckSquare, DollarSign, GraduationCap, CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'

function formatQAR(val) {
  if (val == null) return '0 QAR'
  return Number(val).toLocaleString('en-QA') + ' QAR'
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Payments() {
  const [tab, setTab] = useState('student')
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [studentFilter, setStudentFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const [summaryPending, setSummaryPending] = useState(0)
  const [summaryCollected, setSummaryCollected] = useState(0)
  const [summaryOverdue, setSummaryOverdue] = useState(0)

  // Record payment modal
  const [recordOpen, setRecordOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [recordForm, setRecordForm] = useState({ project_id: '', amount: '', payment_method: '', receipt_number: '', notes: '' })
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [recordLoading, setRecordLoading] = useState(false)

  // Teacher payouts
  const [allProjects, setAllProjects] = useState([])
  const [teacherProjectsLoading, setTeacherProjectsLoading] = useState(true)
  const [payoutLoadingId, setPayoutLoadingId] = useState(null)

  const fetchPayments = () => {
    setLoading(true)
    const params = {}
    if (statusFilter) params.status = statusFilter
    if (studentFilter) params.project__student = studentFilter
    if (teacherFilter) params.project__teacher = teacherFilter

    client.get('/payments/', { params })
      .then(res => {
        const data = res.data.results || res.data
        setPayments(data)
        calculateSummary(data)
      })
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false))
  }

  const fetchDropdowns = () => {
    Promise.all([
      client.get('/students/'),
      client.get('/teachers/'),
      client.get('/projects/'),
    ]).then(([sRes, tRes, pRes]) => {
      setStudents(sRes.data.results || sRes.data)
      setTeachers(tRes.data.results || tRes.data)
      setProjects(pRes.data.results || pRes.data)
    }).catch(console.error)
  }

  const fetchTeacherProjects = () => {
    setTeacherProjectsLoading(true)
    client.get('/projects/')
      .then(res => setAllProjects(res.data.results || res.data))
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setTeacherProjectsLoading(false))
  }

  const calculateSummary = (data) => {
    let pending = 0, collected = 0, overdue = 0
    data.forEach(p => {
      if (p.status === 'paid') {
        collected += Number(p.actual_amount || 0)
      } else if (p.status === 'overdue') {
        overdue += Number(p.scheduled_amount) - Number(p.actual_amount || 0)
      } else {
        pending += Number(p.scheduled_amount) - Number(p.actual_amount || 0)
      }
    })
    setSummaryPending(pending)
    setSummaryCollected(collected)
    setSummaryOverdue(overdue)
  }

  useEffect(() => { fetchPayments() }, [statusFilter, studentFilter, teacherFilter])
  useEffect(() => { fetchDropdowns() }, [])
  useEffect(() => { if (tab === 'teacher') fetchTeacherProjects() }, [tab])

  // --- Student Payments: bulk select ---
  const toggleSelect = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleSelectAll = () => {
    const pending = payments.filter(p => p.status !== 'paid')
    if (selected.size === pending.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pending.map(p => p.id)))
    }
  }

  const handleBulkPaid = async () => {
    if (selected.size === 0) return
    if (!confirm(`Mark ${selected.size} installment(s) as paid?`)) return
    setBulkLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await Promise.all(
        Array.from(selected).map(id => {
          const payment = payments.find(p => p.id === id)
          return client.patch(`/payments/${id}/`, {
            status: 'paid',
            actual_amount: payment?.scheduled_amount,
            paid_date: today,
          })
        })
      )
      toast.success(`${selected.size} payments marked as paid`)
      setSelected(new Set())
      fetchPayments()
    } catch {
      toast.error('Failed to update some payments')
    } finally {
      setBulkLoading(false)
    }
  }

  // --- Record Payment ---
  const openRecordPayment = () => {
    setRecordForm({ project_id: '', amount: '', payment_method: '', receipt_number: '', notes: '' })
    setPreview(null)
    setRecordOpen(true)
  }

  const handlePreview = async () => {
    if (!recordForm.project_id || !recordForm.amount) {
      toast.error('Select a project and enter an amount')
      return
    }
    setPreviewLoading(true)
    try {
      const res = await client.post('/payments/preview/', {
        project_id: Number(recordForm.project_id),
        amount: Number(recordForm.amount),
      })
      setPreview(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!recordForm.project_id || !recordForm.amount) {
      toast.error('Select a project and enter an amount')
      return
    }
    setRecordLoading(true)
    try {
      await client.post('/payments/record/', {
        project_id: Number(recordForm.project_id),
        amount: Number(recordForm.amount),
        payment_method: recordForm.payment_method,
        receipt_number: recordForm.receipt_number,
        notes: recordForm.notes,
      })
      toast.success('Payment recorded successfully!')
      setRecordOpen(false)
      fetchPayments()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment')
    } finally {
      setRecordLoading(false)
    }
  }

  // --- Teacher Payouts ---
  const markTeacherPaid = async (projectId) => {
    if (!confirm('Mark teacher as paid for this project?')) return
    setPayoutLoadingId(projectId)
    try {
      const today = new Date().toISOString().split('T')[0]
      await client.post(`/projects/${projectId}/mark_teacher_paid/`, { paid_date: today })
      toast.success('Teacher marked as paid')
      fetchTeacherProjects()
    } catch {
      toast.error('Failed to update')
    } finally {
      setPayoutLoadingId(null)
    }
  }

  const markTeacherUnpaid = async (projectId) => {
    if (!confirm('Mark teacher as unpaid for this project?')) return
    setPayoutLoadingId(projectId)
    try {
      await client.post(`/projects/${projectId}/mark_teacher_unpaid/`)
      toast.success('Teacher marked as unpaid')
      fetchTeacherProjects()
    } catch {
      toast.error('Failed to update')
    } finally {
      setPayoutLoadingId(null)
    }
  }

  const selectedProject = projects.find(p => String(p.id) === String(recordForm.project_id))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark-100">Payments</h1>
        <button onClick={openRecordPayment} className="btn-success">
          <DollarSign size={18} /> Record Student Payment
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('student')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'student' ? 'bg-brand-600 text-white' : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          <span className="flex items-center gap-2"><CreditCard size={16} /> Student Payments</span>
        </button>
        <button
          onClick={() => setTab('teacher')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'teacher' ? 'bg-brand-600 text-white' : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          <span className="flex items-center gap-2"><GraduationCap size={16} /> Teacher Payouts</span>
        </button>
      </div>

      {/* ==================== STUDENT PAYMENTS TAB ==================== */}
      {tab === 'student' && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <span className="text-xs text-dark-400">Total Collected</span>
              <span className="text-lg font-bold text-emerald-400">{formatQAR(summaryCollected)}</span>
            </div>
            <div className="stat-card">
              <span className="text-xs text-dark-400">Total Pending</span>
              <span className="text-lg font-bold text-yellow-400">{formatQAR(summaryPending)}</span>
            </div>
            <div className="stat-card">
              <span className="text-xs text-dark-400">Overdue Amount</span>
              <span className="text-lg font-bold text-red-400">{formatQAR(summaryOverdue)}</span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter size={16} className="text-dark-500" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </select>
            <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)} className="text-sm">
              <option value="">All Students</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} className="text-sm">
              <option value="">All Teachers</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {selected.size > 0 && (
              <button onClick={handleBulkPaid} disabled={bulkLoading} className="btn-success text-sm ml-auto">
                <CheckSquare size={16} />
                {bulkLoading ? 'Updating...' : `Mark ${selected.size} as Paid`}
              </button>
            )}
          </div>

          {/* Installments Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16">
              <CreditCard size={48} className="mx-auto text-dark-600 mb-4" />
              <p className="text-dark-400">No payments found</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700 bg-dark-900/50">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selected.size > 0 && selected.size === payments.filter(p => p.status !== 'paid').length}
                          onChange={toggleSelectAll}
                          className="rounded border-dark-600"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-dark-400 font-medium">Student</th>
                      <th className="text-left px-4 py-3 text-dark-400 font-medium">Project</th>
                      <th className="text-left px-4 py-3 text-dark-400 font-medium">Month</th>
                      <th className="text-right px-4 py-3 text-dark-400 font-medium">Scheduled</th>
                      <th className="text-right px-4 py-3 text-dark-400 font-medium">Paid</th>
                      <th className="text-left px-4 py-3 text-dark-400 font-medium">Due Date</th>
                      <th className="text-center px-4 py-3 text-dark-400 font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-dark-400 font-medium">Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className={`border-b border-dark-700/30 hover:bg-dark-800/30 transition-colors ${selected.has(p.id) ? 'bg-brand-600/10' : ''}`}>
                        <td className="px-4 py-2.5">
                          {p.status !== 'paid' && (
                            <input
                              type="checkbox"
                              checked={selected.has(p.id)}
                              onChange={() => toggleSelect(p.id)}
                              className="rounded border-dark-600"
                            />
                          )}
                        </td>
                        <td className="px-4 py-2.5" dir="auto">{p.student_name}</td>
                        <td className="px-4 py-2.5 font-mono text-brand-400">{p.project_code}</td>
                        <td className="px-4 py-2.5">{p.month_label}</td>
                        <td className="px-4 py-2.5 text-right">{formatQAR(p.scheduled_amount)}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-400">
                          {p.actual_amount ? formatQAR(p.actual_amount) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-dark-300">{formatDate(p.due_date)}</td>
                        <td className="px-4 py-2.5 text-center"><StatusBadge status={p.status} /></td>
                        <td className="px-4 py-2.5 text-dark-300">{formatDate(p.paid_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== TEACHER PAYOUTS TAB ==================== */}
      {tab === 'teacher' && (
        <>
          <p className="text-sm text-dark-400">
            Track teacher fee payouts per project. Click <strong className="text-dark-200">Mark Paid</strong> or <strong className="text-dark-200">Mark Unpaid</strong> to update.
          </p>

          {teacherProjectsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
            </div>
          ) : allProjects.length === 0 ? (
            <div className="text-center py-16">
              <GraduationCap size={48} className="mx-auto text-dark-600 mb-4" />
              <p className="text-dark-400">No projects found</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700 bg-dark-900/50">
                      <th className="text-left px-4 py-3 text-dark-400 font-medium">Project</th>
                      <th className="text-left px-4 py-3 text-dark-400 font-medium">Student</th>
                      <th className="text-left px-4 py-3 text-dark-400 font-medium">Teacher</th>
                      <th className="text-right px-4 py-3 text-dark-400 font-medium">Teacher Fee</th>
                      <th className="text-center px-4 py-3 text-dark-400 font-medium">Paid Status</th>
                      <th className="text-center px-4 py-3 text-dark-400 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allProjects.map(p => (
                      <tr key={p.id} className="border-b border-dark-700/30 hover:bg-dark-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-brand-400">{p.code}</span>
                          <span className="ml-2 text-dark-200">{p.name}</span>
                        </td>
                        <td className="px-4 py-3 text-dark-300" dir="auto">{p.student_name}</td>
                        <td className="px-4 py-3 text-dark-300" dir="auto">{p.teacher_name}</td>
                        <td className="px-4 py-3 text-right">{p.teacher_fee ? formatQAR(p.teacher_fee) : <span className="text-dark-600">Not set</span>}</td>
                        <td className="px-4 py-3 text-center">
                          {p.teacher_paid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                              <CheckCircle size={14} /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-medium">
                              <XCircle size={14} /> Unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.teacher_paid ? (
                            <button
                              onClick={() => markTeacherUnpaid(p.id)}
                              disabled={payoutLoadingId === p.id}
                              className="inline-flex items-center gap-1 text-xs text-dark-300 hover:text-dark-100 bg-dark-700 hover:bg-dark-600 px-3 py-1.5 rounded transition-colors"
                            >
                              <XCircle size={14} /> {payoutLoadingId === p.id ? '...' : 'Mark Unpaid'}
                            </button>
                          ) : (
                            <button
                              onClick={() => markTeacherPaid(p.id)}
                              disabled={payoutLoadingId === p.id}
                              className="inline-flex items-center gap-1 text-xs text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded transition-colors"
                            >
                              <CheckCircle size={14} /> {payoutLoadingId === p.id ? '...' : 'Mark Paid'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== RECORD PAYMENT MODAL ==================== */}
      <Modal isOpen={recordOpen} onClose={() => setRecordOpen(false)} title="Record Student Payment" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Select Project *</label>
            <select
              value={recordForm.project_id}
              onChange={e => { setRecordForm({ ...recordForm, project_id: e.target.value }); setPreview(null) }}
              className="w-full"
            >
              <option value="">Choose a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.student_name})
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="bg-dark-900/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-dark-400">Student:</span>
                <span className="text-dark-200" dir="auto">{selectedProject.student_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Total Fee:</span>
                <span className="text-dark-200">{formatQAR(selectedProject.total_fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Paid so far:</span>
                <span className="text-emerald-400">{formatQAR(selectedProject.total_paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Remaining:</span>
                <span className="text-yellow-400">{formatQAR(selectedProject.remaining_balance)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-dark-400 mb-1">Payment Amount (QAR) *</label>
            <input
              type="number"
              value={recordForm.amount}
              onChange={e => { setRecordForm({ ...recordForm, amount: e.target.value }); setPreview(null) }}
              placeholder="e.g. 2000"
              className="w-full"
              min="1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">Payment Method</label>
              <select value={recordForm.payment_method} onChange={e => setRecordForm({ ...recordForm, payment_method: e.target.value })} className="w-full">
                <option value="">Select...</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Receipt Number</label>
              <input
                type="text"
                value={recordForm.receipt_number}
                onChange={e => setRecordForm({ ...recordForm, receipt_number: e.target.value })}
                placeholder="Optional"
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-dark-400 mb-1">Notes</label>
            <textarea
              value={recordForm.notes}
              onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
              placeholder="Optional notes..."
              className="w-full h-16 resize-none"
            />
          </div>

          {/* Preview button */}
          <button
            onClick={handlePreview}
            disabled={previewLoading || !recordForm.project_id || !recordForm.amount}
            className="btn-secondary w-full"
          >
            {previewLoading ? 'Loading preview...' : 'Preview Distribution'}
          </button>

          {/* Preview result */}
          {preview && preview.distribution && (
            <div className="bg-dark-900/50 rounded-lg p-3 space-y-2">
              <p className="text-xs text-dark-400 font-medium">Payment will be distributed as:</p>
              {preview.distribution.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-dark-300">{d.month_label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-dark-500">{formatQAR(d.current_paid)}</span>
                    <ArrowRight size={12} className="text-dark-600" />
                    <span className="text-emerald-400 font-medium">{formatQAR(d.new_total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setRecordOpen(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleRecordPayment}
              disabled={recordLoading || !recordForm.project_id || !recordForm.amount}
              className="btn-success"
            >
              <DollarSign size={16} />
              {recordLoading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
