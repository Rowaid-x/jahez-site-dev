import { useState, useEffect } from 'react'
import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'
import StatusBadge from './StatusBadge'

function formatQAR(val) {
  if (val == null) return '0 QAR'
  return Number(val).toLocaleString('en-QA') + ' QAR'
}

export default function PaymentRecorder({ project, onPaymentRecorded }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [receipt, setReceipt] = useState('')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!amount || Number(amount) <= 0) {
      setPreview(null)
      return
    }
    const timer = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const res = await client.post('/payments/preview/', {
          project_id: project.id,
          amount: Number(amount),
        })
        setPreview(res.data)
      } catch {
        setPreview(null)
      } finally {
        setPreviewLoading(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [amount, project.id])

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setLoading(true)
    try {
      await client.post('/payments/record/', {
        project_id: project.id,
        amount: Number(amount),
        payment_method: method,
        receipt_number: receipt,
        notes,
      })
      toast.success('Payment recorded successfully')
      setAmount('')
      setMethod('')
      setReceipt('')
      setNotes('')
      setPreview(null)
      onPaymentRecorded?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Project summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="text-xs text-dark-400">Total Fee</span>
          <span className="text-lg font-bold text-dark-100">{formatQAR(project.total_fee)}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-dark-400">Paid</span>
          <span className="text-lg font-bold text-emerald-400">{formatQAR(project.total_paid)}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-dark-400">Remaining</span>
          <span className="text-lg font-bold text-yellow-400">{formatQAR(project.remaining_balance)}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs text-dark-400">Status</span>
          <StatusBadge status={project.payment_status} />
        </div>
      </div>

      {/* Payment input */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-dark-400 mb-1">Amount Received (QAR) *</label>
          <div className="relative">
            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Enter amount..."
              className="w-full pl-9"
              min="0.01"
              step="0.01"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-dark-400 mb-1">Payment Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="w-full">
            <option value="">Select method...</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-dark-400 mb-1">Receipt Number</label>
          <input
            type="text"
            value={receipt}
            onChange={e => setReceipt(e.target.value)}
            placeholder="Optional..."
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-dark-400 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional..."
            className="w-full"
          />
        </div>
      </div>

      {/* Preview */}
      {previewLoading && (
        <div className="flex items-center gap-2 text-dark-400 text-sm">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-brand-500"></div>
          Calculating distribution...
        </div>
      )}

      {preview && !previewLoading && (
        <div className="card border-brand-600/30">
          <h4 className="text-sm font-semibold text-brand-400 mb-3 flex items-center gap-2">
            <AlertCircle size={16} />
            Payment Distribution Preview
          </h4>
          <div className="space-y-2">
            {preview.preview.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-900/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-dark-400">#{i + 1}</span>
                  <span className="text-sm font-medium">{item.month_label}</span>
                  <span className="text-xs text-dark-500">
                    (Scheduled: {formatQAR(item.scheduled_amount)})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-emerald-400">
                    +{formatQAR(item.will_apply)}
                  </span>
                  <StatusBadge status={item.resulting_status} />
                </div>
              </div>
            ))}
          </div>
          {preview.excess > 0 && (
            <p className="text-sm text-yellow-400 mt-3">
              Excess amount: {formatQAR(preview.excess)} (will remain as credit)
            </p>
          )}
          <p className="text-sm text-dark-400 mt-2">
            Total to apply: <span className="text-dark-200 font-medium">{formatQAR(preview.total_to_apply)}</span>
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !amount || Number(amount) <= 0}
        className="btn-success w-full justify-center"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
        ) : (
          <>
            <CheckCircle size={18} />
            Apply Payment
          </>
        )}
      </button>
    </div>
  )
}
