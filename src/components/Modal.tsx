import { useEffect } from 'react'
import type { ReactNode } from 'react'

/** Props for the modal dialog. */
interface ModalProps {
  children?: ReactNode
  onClose?: () => void
  className?: string
}

/**
 * A minimal accessible modal dialog. Renders a dimmed backdrop with a
 * centered dialog, and closes on backdrop click or the Escape key.
 */
const Modal = ({ children, onClose, className = '' }: ModalProps) => {
  // close the modal when the user presses Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={event => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default Modal
