import { useEffect } from 'react'
import PropTypes from 'prop-types'

/**
 * A minimal accessible modal dialog. Renders a dimmed backdrop with a
 * centered dialog, and closes on backdrop click or the Escape key.
 */
const Modal = ({ children, onClose, className = '' }) => {
  // close the modal when the user presses Escape
  useEffect(() => {
    const handleKeyDown = event => {
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

Modal.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func,
  className: PropTypes.string
}

export default Modal
