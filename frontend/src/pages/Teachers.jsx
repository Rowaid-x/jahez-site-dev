import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, GraduationCap, Phone, Mail, Briefcase, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'

function formatQAR(val) {
  if (val == null) return '0 QAR'
  return Number(val).toLocaleString('en-QA') + ' QAR'
}

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTeacher, setDetailTeacher] = useState(null)
  const [detailProjects, setDetailProjects] = useState([])
  const [payoutLoadingId, setPayoutLoadingId] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', expertise: '', notes: '' })

  const fetchTeachers = () => {
    setLoading(true)
    client.get('/teachers/')
      .then(res => setTeachers(res.data.results || res.data))
      .catch(() => toast.error('Failed to load teachers'))
      .finally(() => setLoading(false))
  }

  const markTeacherPaid = async (projectId) => {
    if (!confirm('Mark teacher as paid for this project?')) return
    setPayoutLoadingId(projectId)
    try {
      const today = new Date().toISOString().split('T')[0]
      await client.post(`/projects/${projectId}/mark_teacher_paid/`, { paid_date: today })
      toast.success('Teacher marked as paid')
      if (detailTeacher) {
        const res = await client.get(`/teachers/${detailTeacher.id}/`)
        setDetailProjects(res.data.projects || [])
      }
      fetchTeachers()
    } catch {
      toast.error('Failed to update teacher payout')
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
      if (detailTeacher) {
        const res = await client.get(`/teachers/${detailTeacher.id}/`)
        setDetailProjects(res.data.projects || [])
      }
      fetchTeachers()
    } catch {
      toast.error('Failed to update teacher payout')
    } finally {
      setPayoutLoadingId(null)
    }
  }

  useEffect(() => { fetchTeachers() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', phone: '', email: '', expertise: '', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (t, e) => {
    e?.stopPropagation()
    setEditing(t)
    setForm({ name: t.name, phone: t.phone, email: t.email, expertise: t.expertise, notes: t.notes })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    try {
      if (editing) {
        await client.put(`/teachers/${editing.id}/`, form)
        toast.success('Teacher updated')
      } else {
        await client.post('/teachers/', form)
        toast.success('Teacher created')
      }
      setModalOpen(false)
      fetchTeachers()
    } catch (err) {
      toast.error(err.response?.data?.name?.[0] || 'Failed to save teacher')
    }
  }

  const handleDelete = async (t, e) => {
    e?.stopPropagation()
    if (!confirm(`Delete teacher "${t.name}"?`)) return
    try {
      await client.delete(`/teachers/${t.id}/`)
      toast.success('Teacher deleted')
      fetchTeachers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot delete this teacher')
    }
  }

  const openDetail = async (t) => {
    setDetailTeacher(t)
    setDetailOpen(true)
    try {
      const res = await client.get(`/teachers/${t.id}/`)
      setDetailProjects(res.data.projects || [])
    } catch {
      setDetailProjects([])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark-100">Teachers</h1>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Add Teacher
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
        </div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">No teachers found</p>
          <p className="text-dark-600 text-sm mt-1">Add your first teacher to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map(t => (
            <div
              key={t.id}
              onClick={() => openDetail(t)}
              className="card hover:border-dark-600 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-dark-100" dir="auto">{t.name}</h3>
                  {t.expertise && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Briefcase size={13} className="text-brand-400" />
                      <span className="text-sm text-brand-400">{t.expertise}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => openEdit(t, e)}
                    className="p-1.5 text-dark-400 hover:text-brand-400 hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(t, e)}
                    className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                {t.phone && (
                  <div className="flex items-center gap-2 text-dark-300">
                    <Phone size={13} className="text-dark-500" />
                    {t.phone}
                  </div>
                )}
                {t.email && (
                  <div className="flex items-center gap-2 text-dark-300">
                    <Mail size={13} className="text-dark-500" />
                    {t.email}
                  </div>
                )}
              </div>

              <div className="border-t border-dark-700 pt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-dark-500">Projects</p>
                  <p className="text-sm font-bold text-dark-200">{t.total_projects}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-500">Earnings</p>
                  <p className="text-sm font-bold text-dark-200">{formatQAR(t.total_earnings)}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-500">Unpaid</p>
                  <p className="text-sm font-bold text-yellow-400">{formatQAR(t.amount_unpaid)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Teacher' : 'Add Teacher'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name..." className="w-full" dir="auto" autoFocus />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Phone</label>
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+974 XXXX XXXX" className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Expertise</label>
            <input type="text" value={form.expertise} onChange={e => setForm({ ...form, expertise: e.target.value })} placeholder="e.g. AI & Machine Learning" className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." className="w-full h-20 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={detailTeacher?.name || 'Teacher'} size="lg">
        {detailTeacher && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-dark-500">Expertise:</span> <span className="text-dark-200 ml-2">{detailTeacher.expertise || '-'}</span></div>
              <div><span className="text-dark-500">Phone:</span> <span className="text-dark-200 ml-2">{detailTeacher.phone || '-'}</span></div>
              <div><span className="text-dark-500">Email:</span> <span className="text-dark-200 ml-2">{detailTeacher.email || '-'}</span></div>
              <div><span className="text-dark-500">Total Earnings:</span> <span className="text-emerald-400 ml-2">{formatQAR(detailTeacher.total_earnings)}</span></div>
            </div>
            <h4 className="text-sm font-semibold text-dark-300 pt-2">Assigned Projects</h4>
            {detailProjects.length > 0 ? (
              <div className="space-y-2">
                {detailProjects.map(p => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="flex items-center justify-between py-2 px-3 bg-dark-900/50 rounded-lg hover:bg-dark-800 transition-colors"
                    onClick={() => setDetailOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-dark-400">{p.code}</span>
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-dark-400">{formatQAR(p.teacher_fee)}</span>
                      {p.teacher_paid ? (
                        <span className="text-xs text-emerald-400">Paid</span>
                      ) : (
                        <span className="text-xs text-yellow-400">Unpaid</span>
                      )}
                      {p.teacher_paid ? (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markTeacherUnpaid(p.id) }}
                          disabled={payoutLoadingId === p.id}
                          className="inline-flex items-center gap-1 text-xs text-dark-300 hover:text-dark-100 bg-dark-700 hover:bg-dark-600 px-2 py-1 rounded"
                        >
                          <XCircle size={14} /> {payoutLoadingId === p.id ? '...' : 'Unpaid'}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markTeacherPaid(p.id) }}
                          disabled={payoutLoadingId === p.id}
                          className="inline-flex items-center gap-1 text-xs text-dark-100 hover:text-white bg-emerald-700/70 hover:bg-emerald-600 px-2 py-1 rounded"
                        >
                          <CheckCircle size={14} /> {payoutLoadingId === p.id ? '...' : 'Paid'}
                        </button>
                      )}
                      <StatusBadge status={p.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-dark-500 text-sm">No projects assigned</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
