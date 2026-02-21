import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, User, GraduationCap, CheckCircle, XCircle, Edit, Trash2 } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import PaymentRecorder from '../components/PaymentRecorder'

function formatQAR(val) {
  if (val == null) return '0 QAR'
  return Number(val).toLocaleString('en-QA') + ' QAR'
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [teacherPayModalOpen, setTeacherPayModalOpen] = useState(false)
  const [teacherPayDate, setTeacherPayDate] = useState(new Date().toISOString().split('T')[0])
  const [editForm, setEditForm] = useState({})

  const fetchProject = useCallback(() => {
    setLoading(true)
    client.get(`/projects/${id}/`)
      .then(res => {
        setProject(res.data)
        setEditForm({
          code: res.data.code,
          name: res.data.name,
          student: res.data.student,
          teacher: res.data.teacher,
          status: res.data.status,
          total_fee: res.data.total_fee,
          installment_months: res.data.installment_months,
          payment_start_date: res.data.payment_start_date,
          teacher_fee: res.data.teacher_fee || '',
          notes: res.data.notes,
        })
      })
      .catch(() => toast.error('Failed to load project'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchProject() }, [fetchProject])

  const handleEdit = async () => {
    try {
      await client.put(`/projects/${id}/`, {
        ...editForm,
        total_fee: Number(editForm.total_fee),
        installment_months: Number(editForm.installment_months),
        teacher_fee: editForm.teacher_fee ? Number(editForm.teacher_fee) : null,
      })
      toast.success('Project updated')
      setEditModalOpen(false)
      fetchProject()
    } catch (err) {
      toast.error(err.response?.data?.code?.[0] || 'Failed to update project')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    try {
      await client.delete(`/projects/${id}/`)
      toast.success('Project deleted')
      window.history.back()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot delete this project')
    }
  }

  const handleTeacherPaid = async () => {
    try {
      await client.post(`/projects/${id}/mark_teacher_paid/`, { paid_date: teacherPayDate })
      toast.success('Teacher marked as paid')
      setTeacherPayModalOpen(false)
      fetchProject()
    } catch {
      toast.error('Failed to update teacher payment')
    }
  }

  const handleTeacherUnpaid = async () => {
    try {
      await client.post(`/projects/${id}/mark_teacher_unpaid/`)
      toast.success('Teacher marked as unpaid')
      fetchProject()
    } catch {
      toast.error('Failed to update teacher payment')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    )
  }

  if (!project) {
    return <p className="text-dark-400 text-center py-12">Project not found.</p>
  }

  const progressPct = project.total_fee > 0
    ? Math.min(100, Math.round((project.total_paid / Number(project.total_fee)) * 100))
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/projects" className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-dark-100">{project.code}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-dark-400 text-sm mt-0.5">{project.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditModalOpen(true)} className="btn-secondary">
            <Edit size={16} /> Edit
          </button>
          <button onClick={handleDelete} className="btn-danger">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-dark-400 text-sm mb-2">
            <User size={14} /> Student
          </div>
          <p className="font-medium text-dark-100" dir="auto">{project.student_name}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-dark-400 text-sm mb-2">
            <GraduationCap size={14} /> Teacher
          </div>
          <p className="font-medium text-dark-100" dir="auto">{project.teacher_name}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-dark-400 text-sm mb-2">
            <DollarSign size={14} /> Monthly Amount
          </div>
          <p className="font-medium text-dark-100">{formatQAR(project.monthly_amount)} &times; {project.installment_months} months</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-dark-400">Payment Progress</span>
          <span className="text-sm font-medium text-brand-400">{progressPct}%</span>
        </div>
        <div className="w-full bg-dark-700 rounded-full h-3">
          <div
            className="bg-brand-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-dark-500">
          <span>Paid: {formatQAR(project.total_paid)}</span>
          <span>Total: {formatQAR(project.total_fee)}</span>
        </div>
      </div>

      {/* Record Payment button */}
      <button onClick={() => setPaymentModalOpen(true)} className="btn-success">
        <DollarSign size={18} /> Record Payment
      </button>

      {/* Payment Schedule */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-700 bg-dark-900/50">
          <h3 className="text-sm font-semibold text-dark-300">Payment Schedule</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700 bg-dark-900/30">
                <th className="text-left px-4 py-2.5 text-dark-400 font-medium">#</th>
                <th className="text-left px-4 py-2.5 text-dark-400 font-medium">Month</th>
                <th className="text-right px-4 py-2.5 text-dark-400 font-medium">Scheduled</th>
                <th className="text-right px-4 py-2.5 text-dark-400 font-medium">Paid</th>
                <th className="text-left px-4 py-2.5 text-dark-400 font-medium">Due Date</th>
                <th className="text-center px-4 py-2.5 text-dark-400 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 text-dark-400 font-medium">Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {(project.payments || []).map((p, i) => (
                <tr key={p.id} className="border-b border-dark-700/30 hover:bg-dark-800/30">
                  <td className="px-4 py-2.5 text-dark-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{p.month_label}</td>
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

      {/* Teacher Payment Section */}
      <div className="card">
        <h3 className="text-sm font-semibold text-dark-300 mb-4">Teacher Payment</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-dark-200 font-medium" dir="auto">{project.teacher_name}</p>
            <p className="text-sm text-dark-400">Fee: {project.teacher_fee ? formatQAR(project.teacher_fee) : 'Not set'}</p>
          </div>
          <div className="flex items-center gap-3">
            {project.teacher_paid ? (
              <>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle size={16} />
                  <span className="text-sm">Paid on {formatDate(project.teacher_paid_date)}</span>
                </div>
                <button onClick={handleTeacherUnpaid} className="btn-secondary text-xs px-3 py-1.5">
                  <XCircle size={14} /> Mark Unpaid
                </button>
              </>
            ) : (
              <button onClick={() => setTeacherPayModalOpen(true)} className="btn-success text-sm">
                <CheckCircle size={16} /> Mark as Paid
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Recording Modal */}
      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Record Payment" size="lg">
        <PaymentRecorder
          project={project}
          onPaymentRecorded={() => { setPaymentModalOpen(false); fetchProject() }}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Project" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">Project Code</label>
              <input type="text" value={editForm.code || ''} onChange={e => setEditForm({ ...editForm, code: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Project Name</label>
              <input type="text" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Status</label>
              <select value={editForm.status || 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Total Fee (QAR)</label>
              <input type="number" value={editForm.total_fee || ''} onChange={e => setEditForm({ ...editForm, total_fee: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Installment Months</label>
              <input type="number" value={editForm.installment_months || ''} onChange={e => setEditForm({ ...editForm, installment_months: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">Teacher Fee (QAR)</label>
              <input type="number" value={editForm.teacher_fee || ''} onChange={e => setEditForm({ ...editForm, teacher_fee: e.target.value })} className="w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Notes</label>
            <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="w-full h-20 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleEdit} className="btn-primary">Update Project</button>
          </div>
        </div>
      </Modal>

      {/* Teacher Pay Modal */}
      <Modal isOpen={teacherPayModalOpen} onClose={() => setTeacherPayModalOpen(false)} title="Mark Teacher as Paid">
        <div className="space-y-4">
          <p className="text-sm text-dark-300">
            Mark <span className="font-medium text-dark-100">{project.teacher_name}</span> as paid for this project.
          </p>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Payment Date</label>
            <input type="date" value={teacherPayDate} onChange={e => setTeacherPayDate(e.target.value)} className="w-full" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setTeacherPayModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleTeacherPaid} className="btn-success">Confirm Payment</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
