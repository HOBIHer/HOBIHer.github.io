import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
