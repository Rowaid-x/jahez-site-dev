import { Download } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'

export default function ExportButton({ endpoint, label, params = {} }) {
  const handleExport = async () => {
    try {
      const queryStr = new URLSearchParams(params).toString()
      const url = queryStr ? `${endpoint}?${queryStr}` : endpoint
      const res = await client.get(url, { responseType: 'blob' })

      const contentDisposition = res.headers['content-disposition']
      let filename = `jahez_export_${new Date().toISOString().slice(0, 10)}.csv`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/)
        if (match) filename = match[1]
      }

      const blob = new Blob([res.data], { type: res.headers['content-type'] })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)

      toast.success('Export downloaded successfully')
    } catch (err) {
      toast.error('Failed to export data')
      console.error(err)
    }
  }

  return (
    <button onClick={handleExport} className="btn-secondary text-sm">
      <Download size={16} />
      {label}
    </button>
  )
}
