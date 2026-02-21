import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, GraduationCap, FolderKanban, DollarSign,
  AlertTriangle, TrendingUp, Clock, CheckCircle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import client from '../api/client'
import StatusBadge from '../components/StatusBadge'

function formatQAR(val) {
  if (val == null) return '0 QAR'
  return Number(val).toLocaleString('en-QA') + ' QAR'
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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

  const statCards = [
    { label: 'Students', value: data.total_students, icon: Users, color: 'text-blue-400', link: '/students' },
    { label: 'Teachers', value: data.total_teachers, icon: GraduationCap, color: 'text-purple-400', link: '/teachers' },
    { label: 'Active Projects', value: data.active_projects, icon: FolderKanban, color: 'text-cyan-400', link: '/projects' },
    { label: 'Revenue Expected', value: formatQAR(data.total_revenue), icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Total Collected', value: formatQAR(data.total_collected), icon: CheckCircle, color: 'text-green-400' },
    { label: 'Pending', value: formatQAR(data.total_pending), icon: Clock, color: 'text-yellow-400' },
    { label: 'Overdue', value: data.overdue_count, icon: AlertTriangle, color: data.overdue_count > 0 ? 'text-red-400' : 'text-dark-400', link: '/payments' },
    { label: 'Collection Rate', value: `${data.collection_rate}%`, icon: TrendingUp, color: 'text-brand-400' },
  ]

  return (
    <div className="space-y-6">
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

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent payments */}
        <div className="card">
          <h3 className="text-sm font-semibold text-dark-300 mb-4">Recent Payments</h3>
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
  )
}
