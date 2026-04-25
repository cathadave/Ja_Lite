'use client'

import { AlertTriangle, Check, X } from 'lucide-react'

interface ConfirmModalProps {
  /** Short title for the action being confirmed */
  title: string
  /** Full description of what will happen */
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Called when the user presses Confirm */
  onConfirm: () => void
  /** Called when the user presses Cancel or the close button */
  onCancel: () => void
}

/**
 * ConfirmModal — used before any high-impact action (Rule 10).
 *
 * Usage:
 *   const [showConfirm, setShowConfirm] = useState(false)
 *   {showConfirm && (
 *     <ConfirmModal
 *       title="Reschedule task"
 *       message="This will notify 3 contacts. Continue?"
 *       onConfirm={handleConfirm}
 *       onCancel={() => setShowConfirm(false)}
 *     />
 *   )}
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
      onClick={onCancel}
    >
      {/* Panel — stop click propagation so tapping inside doesn't close */}
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <h2 className="font-bold text-gray-900 text-base leading-tight">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="p-1 text-gray-400 hover:text-gray-600 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Check size={15} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
