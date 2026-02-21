import { useState } from 'react'
import { FileBarChart, Download, Database, Calendar } from 'lucide-react'
import ExportButton from '../components/ExportButton'
import client from '../api/client'
import toast from 'react-hot-toast'

export default function Reports() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const handleBackup = async () => {
    try {
      const res = await client.get('/export/backup/', { responseType: 'blob' })
      const contentDisposition = res.headers['content-disposition']
      let filename = `jahez_backup_${new Date().toISOString().slice(0, 10)}.json`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/)
        if (match) filename = match[1]
      }
      const blob = new Blob([res.data], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      toast.success('Backup downloaded successfully')
    } catch {
      toast.error('Failed to create backup')
    }
  }

  const reports = [
    {
      title: 'Students Report',
      description: 'Name, Phone, Email, Total Projects, Total Fees, Total Paid, Balance',
      endpoint: '/export/students/',
      label: 'Export Students',
    },
    {
      title: 'Teachers Report',
      description: 'Name, Expertise, Phone, Email, Total Projects, Total Earnings, Paid/Unpaid',
      endpoint: '/export/teachers/',
      label: 'Export Teachers',
    },
    {
      title: 'Projects Report',
      description: 'Code, Name, Student, Teacher, Fee, Monthly, Paid, Balance, Status, Teacher Fee',
      endpoint: '/export/projects/',
      label: 'Export Projects',
    },
    {
      title: 'Payments Report',
      description: 'Project Code, Student, Month, Scheduled, Paid, Due Date, Status, Method, Receipt',
      endpoint: '/export/payments/',
      label: 'Export Payments',
      hasDateFilter: true,
    },
    {
      title: 'Overdue Report',
      description: 'Student Name, Phone, Project Code, Amount Due, Due Date, Days Overdue',
      endpoint: '/export/overdue/',
      label: 'Export Overdue',
    },
    {
      title: 'Teacher Payments Report',
      description: 'Teacher Name, Project Code, Student, Teacher Fee, Paid Status, Paid Date',
      endpoint: '/export/teacher-payments/',
      label: 'Export Teacher Payments',
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-dark-100">Reports & Export</h1>

      {/* Date filter for payment reports */}
      <div className="card">
        <div className="flex items-center gap-2 text-dark-400 text-sm mb-3">
          <Calendar size={16} />
          Date Filter (applies to Payments export)
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-dark-500 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="text-sm"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate('') }}
              className="text-xs text-dark-400 hover:text-dark-200 mt-4"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(r => (
          <div key={r.endpoint} className="card flex flex-col justify-between">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileBarChart size={18} className="text-brand-400" />
                <h3 className="font-semibold text-dark-100">{r.title}</h3>
              </div>
              <p className="text-xs text-dark-500 leading-relaxed">{r.description}</p>
            </div>
            <ExportButton
              endpoint={r.endpoint}
              label={r.label}
              params={r.hasDateFilter ? {
                ...(fromDate && { from: fromDate }),
                ...(toDate && { to: toDate }),
              } : {}}
            />
          </div>
        ))}
      </div>

      {/* Full backup */}
      <div className="card border-brand-600/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database size={18} className="text-brand-400" />
              <h3 className="font-semibold text-dark-100">Full Data Backup</h3>
            </div>
            <p className="text-xs text-dark-500">Export ALL data (students, teachers, projects, payments) as a single JSON file</p>
          </div>
          <button onClick={handleBackup} className="btn-primary">
            <Download size={16} /> Download Backup
          </button>
        </div>
      </div>
    </div>
  )
}
