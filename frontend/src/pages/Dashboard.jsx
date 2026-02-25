import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, GraduationCap, FolderKanban, DollarSign,
  AlertTriangle, Clock, CheckCircle, BookOpen,
  ArrowDownCircle, ArrowUpCircle, Wallet, Activity,
  Plus, Edit, Trash2, CreditCard, RefreshCw
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import client from '../api/client'

function formatQAR(val) {
  if (val == null) return '0 QAR'
  return Number(val).toLocaleString('en-QA') + ' QAR'
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDate(dateStr)
}

const LOG_ICONS = {
  created: { icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  updated: { icon: Edit, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  deleted: { icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10' },
  payment: { icon: CreditCard, color: 'text-green-400', bg: 'bg-green-500/10' },
  status_change: { icon: RefreshCw, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/dashboard/')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    )
  }

  if (!data) {
    return <p className="text-dark-400 text-center py-12">Failed to load dashboard data.</p>
  }

  const cf = data.cash_flow || {}

  const statCards = [
    { label: 'Students', value: data.total_students, icon: Users, color: 'text-blue-400', link: '/students' },
    { label: 'Teachers', value: data.total_teachers, icon: GraduationCap, color: 'text-purple-400', link: '/teachers' },
    { label: 'Active Projects', value: data.active_projects, icon: FolderKanban, color: 'text-cyan-400', link: '/projects' },
    { label: 'Private Classes', value: data.total_classes || 0, icon: BookOpen, color: 'text-orange-400', link: '/classes' },
    { label: 'Revenue Expected', value: formatQAR(data.total_revenue), icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Total Collected', value: formatQAR(data.total_collected), icon: CheckCircle, color: 'text-green-400' },
    { label: 'Pending', value: formatQAR(data.total_pending), icon: Clock, color: 'text-yellow-400' },
    { label: 'Overdue', value: data.overdue_count, icon: AlertTriangle, color: data.overdue_count > 0 ? 'text-red-400' : 'text-dark-400', link: '/payments' },
  ]

  return (
    <div className="flex gap-6">
      {/* ===== LEFT: Main dashboard content ===== */}
      <div className="flex-1 min-w-0 space-y-6">
        <h1 className="text-2xl font-bold text-dark-100">Dashboard</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, link }) => {
            const Card = (
              <div key={label} className="stat-card hover:border-dark-600 transition-colors cursor-default">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-dark-400">{label}</span>
                  <Icon size={16} className={color} />
                </div>
                <span className={`text-lg font-bold ${color}`}>{value}</span>
              </div>
            )
            return link ? <Link key={label} to={link}>{Card}</Link> : <div key={label}>{Card}</div>
          })}
        </div>

        {/* Monthly Cash Flow */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={18} className="text-brand-400" />
            <h3 className="text-sm font-semibold text-dark-300">{cf.month_label || 'This Month'} — Cash Flow</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-dark-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownCircle size={16} className="text-emerald-400" />
                <span className="text-xs text-dark-400">Money In</span>
              </div>
              <p className="text-lg font-bold text-emerald-400">{formatQAR(cf.money_in)}</p>
              <div className="mt-2 space-y-1 text-xs text-dark-500">
                <p>Projects: {formatQAR(cf.money_in_projects)}</p>
                <p>Classes: {formatQAR(cf.money_in_classes)}</p>
              </div>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpCircle size={16} className="text-red-400" />
                <span className="text-xs text-dark-400">Money Out</span>
              </div>
              <p className="text-lg font-bold text-red-400">{formatQAR(cf.money_out)}</p>
              <div className="mt-2 space-y-1 text-xs text-dark-500">
                <p>Teacher (Projects): {formatQAR(cf.money_out_projects)}</p>
                <p>Teacher (Classes): {formatQAR(cf.money_out_classes)}</p>
              </div>
            </div>
            <div className="bg-dark-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={16} className={cf.net_savings >= 0 ? 'text-brand-400' : 'text-red-400'} />
                <span className="text-xs text-dark-400">Net Savings</span>
              </div>
              <p className={`text-lg font-bold ${cf.net_savings >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {formatQAR(cf.net_savings)}
              </p>
              <p className="mt-2 text-xs text-dark-500">
                {cf.net_savings >= 0 ? 'Available to transfer' : 'Deficit this month'}
              </p>
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly collections */}
          <div className="card">
            <h3 className="text-sm font-semibold text-dark-300 mb-4">Monthly Collections</h3>
            {data.monthly_collections.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.monthly_collections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#f1f5f9' }}
                    itemStyle={{ color: '#3b82f6' }}
                    formatter={(val) => formatQAR(val)}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-dark-500 text-sm text-center py-12">No collection data yet</p>
            )}
          </div>

          {/* Collection rate */}
          <div className="card flex flex-col justify-between">
            <h3 className="text-sm font-semibold text-dark-300 mb-4">Collection Progress</h3>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#334155" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="#3b82f6" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${data.collection_rate * 2.64} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-brand-400">{data.collection_rate}%</span>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-dark-400">
                  {formatQAR(data.total_collected)} of {formatQAR(data.total_revenue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Private Classes Section */}
        {(data.total_classes > 0) && (
          <>
            <h2 className="text-lg font-semibold text-dark-200 mt-2">Private Classes</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="stat-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-dark-400">Sessions</span>
                  <BookOpen size={16} className="text-orange-400" />
                </div>
                <span className="text-lg font-bold text-orange-400">{data.total_classes}</span>
              </div>
              <div className="stat-card">
                <span className="text-xs text-dark-400">Student Owed</span>
                <span className="text-lg font-bold text-emerald-400">{formatQAR(data.classes_student_revenue)}</span>
              </div>
              <div className="stat-card">
                <span className="text-xs text-dark-400">Collected</span>
                <span className="text-lg font-bold text-green-400">{formatQAR(data.classes_collected)}</span>
              </div>
              <div className="stat-card">
                <span className="text-xs text-dark-400">Outstanding</span>
                <span className={`text-lg font-bold ${data.classes_outstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatQAR(data.classes_outstanding)}</span>
              </div>
              <div className="stat-card">
                <span className="text-xs text-dark-400">Profit</span>
                <span className="text-lg font-bold text-brand-400">{formatQAR(data.classes_profit)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly class collections chart */}
              <div className="card">
                <h3 className="text-sm font-semibold text-dark-300 mb-4">Monthly Class Collections</h3>
                {(data.monthly_class_collections || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.monthly_class_collections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                        labelStyle={{ color: '#f1f5f9' }}
                        itemStyle={{ color: '#f97316' }}
                        formatter={(val) => formatQAR(val)}
                      />
                      <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-dark-500 text-sm text-center py-12">No class payment data yet</p>
                )}
              </div>

              {/* Recent class payments */}
              <div className="card">
                <h3 className="text-sm font-semibold text-dark-300 mb-4">Recent Class Payments</h3>
                {(data.recent_class_payments || []).length > 0 ? (
                  <div className="space-y-3">
                    {data.recent_class_payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-900/50">
                        <div>
                          <p className="text-sm font-medium" dir="auto">{p.student_name}</p>
                          <p className="text-xs text-dark-500">{p.classes_count} class{p.classes_count !== 1 ? 'es' : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-emerald-400">
                            {p.currency !== 'QAR' ? `${Number(p.amount).toLocaleString('en-QA')} ${p.currency}` : formatQAR(p.amount)}
                          </p>
                          {p.currency !== 'QAR' && <p className="text-xs text-dark-500">{formatQAR(p.amount_qar)}</p>}
                          <p className="text-xs text-dark-500">{formatDate(p.paid_date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-dark-500 text-sm text-center py-8">No class payments recorded yet</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Bottom row - Projects */}
        <h2 className="text-lg font-semibold text-dark-200 mt-2">Projects</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent payments */}
          <div className="card">
            <h3 className="text-sm font-semibold text-dark-300 mb-4">Recent Project Payments</h3>
            {data.recent_payments.length > 0 ? (
              <div className="space-y-3">
                {data.recent_payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-900/50">
                    <div>
                      <p className="text-sm font-medium">{p.student_name}</p>
                      <p className="text-xs text-dark-500">{p.project_code} &middot; {p.month_label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-emerald-400">{formatQAR(p.actual_amount)}</p>
                      <p className="text-xs text-dark-500">{formatDate(p.paid_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-500 text-sm text-center py-8">No payments recorded yet</p>
            )}
          </div>

          {/* Upcoming dues */}
          <div className="card">
            <h3 className="text-sm font-semibold text-dark-300 mb-4">Upcoming Dues</h3>
            {data.upcoming_dues.length > 0 ? (
              <div className="space-y-3">
                {data.upcoming_dues.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-900/50">
                    <div>
                      <p className="text-sm font-medium">{p.student_name}</p>
                      <p className="text-xs text-dark-500">{p.project_code} &middot; {p.month_label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-yellow-400">{formatQAR(p.scheduled_amount)}</p>
                      <p className="text-xs text-dark-500">Due {formatDate(p.due_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-500 text-sm text-center py-8">No upcoming dues</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== RIGHT: Activity Log ===== */}
      <div className="hidden xl:block w-80 shrink-0">
        <div className="sticky top-8">
          <div className="card p-0 max-h-[calc(100vh-6rem)] flex flex-col">
            <div className="px-4 py-3 border-b border-dark-700 flex items-center gap-2">
              <Activity size={16} className="text-brand-400" />
              <h3 className="text-sm font-semibold text-dark-300">Activity Log</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(data.activity_log || []).length > 0 ? (
                <div className="divide-y divide-dark-700/50">
                  {data.activity_log.map(log => {
                    const style = LOG_ICONS[log.action] || LOG_ICONS.updated
                    const Icon = style.icon
                    return (
                      <div key={log.id} className="px-4 py-3 hover:bg-dark-800/50 transition-colors">
                        <div className="flex gap-3">
                          <div className={`mt-0.5 p-1.5 rounded-lg ${style.bg} shrink-0`}>
                            <Icon size={12} className={style.color} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-dark-200 leading-relaxed" dir="auto">{log.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-dark-500">{timeAgo(log.created_at)}</span>
                              {log.username && (
                                <span className="text-[10px] text-dark-600">by {log.username}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Activity size={32} className="text-dark-700 mb-2" />
                  <p className="text-dark-500 text-xs">No activity yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
