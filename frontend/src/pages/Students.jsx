import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, ChevronDown, ChevronUp, FolderKanban, BookOpen } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'

function formatQAR(val) {
  if (val == null) return '0 QAR'
  return Number(val).toLocaleString('en-QA') + ' QAR'
}

function formatCurrency(val, currency = 'QAR') {
  if (val == null) return `0 ${currency}`
  return Number(val).toLocaleString('en-QA') + ` ${currency}`
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedProjects, setExpandedProjects] = useState([])
  const [expandedClasses, setExpandedClasses] = useState([])
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })

  const fetchStudents = () => {
    setLoading(true)
    client.get('/students/', { params: { search } })
      .then(res => setStudents(res.data.results || res.data))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStudents() }, [search])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', phone: '', email: '', notes: '' })
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ name: s.name, phone: s.phone, email: s.email, notes: s.notes })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    try {
      if (editing) {
        await client.put(`/students/${editing.id}/`, form)
        toast.success('Student updated')
      } else {
        await client.post('/students/', form)
        toast.success('Student created')
      }
      setModalOpen(false)
      fetchStudents()
    } catch (err) {
      toast.error(err.response?.data?.name?.[0] || 'Failed to save student')
    }
  }

  const handleDelete = async (s) => {
    if (!confirm(`Delete student "${s.name}"? This cannot be undone.`)) return
    try {
      await client.delete(`/students/${s.id}/`)
      toast.success('Student deleted')
      fetchStudents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot delete this student')
    }
  }

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    try {
      const res = await client.get(`/students/${id}/`)
      const detail = res.data
      setExpandedProjects(detail.projects || [])
      setExpandedClasses(detail.private_classes || [])
    } catch {
      setExpandedProjects([])
      setExpandedClasses([])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark-100">Students</h1>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Add Student
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban size={48} className="mx-auto text-dark-600 mb-4" />
          <p className="text-dark-400">No students found</p>
          <p className="text-dark-600 text-sm mt-1">Add your first student to get started</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-900/50">
                  <th className="text-left px-4 py-3 text-dark-400 font-medium"></th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Email</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Projects</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Proj Balance</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Classes</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Class Balance</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <>
                    <tr
                      key={s.id}
                      className="border-b border-dark-700/50 hover:bg-dark-800/50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(s.id)}
                    >
                      <td className="px-4 py-3">
                        {expandedId === s.id ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                      </td>
                      <td className="px-4 py-3 font-medium" dir="auto">{s.name}</td>
                      <td className="px-4 py-3 text-dark-300">{s.phone || '-'}</td>
                      <td className="px-4 py-3 text-dark-300">{s.email || '-'}</td>
                      <td className="px-4 py-3 text-right">{s.total_projects}</td>
                      <td className="px-4 py-3 text-right">
                        {s.balance > 0 ? <span className="text-yellow-400">{formatQAR(s.balance)}</span> : <span className="text-emerald-400">{formatQAR(s.balance)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{s.total_classes || 0}</td>
                      <td className="px-4 py-3 text-right">
                        {(s.classes_balance || 0) > 0 ? <span className="text-yellow-400">{formatQAR(s.classes_balance)}</span> : <span className="text-emerald-400">{formatQAR(s.classes_balance)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(s) }}
                            className="p-1.5 text-dark-400 hover:text-brand-400 hover:bg-dark-700 rounded-lg transition-colors"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(s) }}
                            className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === s.id && (
                      <tr key={`${s.id}-exp`} className="bg-dark-900/30">
                        <td colSpan={9} className="px-8 py-4">
                          <div className="space-y-4">
                            {expandedProjects.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs text-dark-400 font-medium mb-2 flex items-center gap-1.5"><FolderKanban size={13} /> Projects</p>
                                {expandedProjects.map(p => (
                                  <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-dark-800 rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-mono text-dark-400">{p.code}</span>
                                      <span className="text-sm font-medium">{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-dark-400">Paid: <span className="text-emerald-400">{formatQAR(p.total_paid)}</span></span>
                                      <span className="text-xs text-dark-400">Balance: <span className="text-yellow-400">{formatQAR(p.remaining_balance)}</span></span>
                                      <StatusBadge status={p.payment_status} />
                                      <StatusBadge status={p.status} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {expandedClasses.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs text-dark-400 font-medium mb-2 flex items-center gap-1.5"><BookOpen size={13} /> Private Classes</p>
                                {expandedClasses.map(c => (
                                  <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-dark-800 rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-dark-400">{formatDate(c.date)}</span>
                                      <span className="text-sm font-medium" dir="auto">{c.teacher_name}</span>
                                      <span className="text-xs text-dark-500">{c.subject || ''}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-dark-300">{formatCurrency(c.student_total, c.student_currency)}</span>
                                      <span className={`text-xs ${c.student_payment_status === 'paid' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                        {c.student_payment_status === 'paid' ? 'Paid' : 'Pending'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {expandedProjects.length === 0 && expandedClasses.length === 0 && (
                              <p className="text-dark-500 text-sm">No projects or classes yet</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Student' : 'Add Student'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Full name..."
              className="w-full"
              dir="auto"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+974 XXXX XXXX"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes..."
              className="w-full h-20 resize-none"
            />
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
