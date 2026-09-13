import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** Props for the modal dialog. */
interface ModalProps {
  children?: ReactNode
  onClose?: () => void
  className?: string
}

/**
 * A minimal accessible modal dialog built on the native `<dialog>` element.
 * Opening it renders the dialog in the browser's top layer (dimmed via
 * `::backdrop`) and locks background scrolling, while the dialog's own
 * contents scroll when they exceed the viewport height. It closes on backdrop
 * click or the Escape key when an `onClose` handler is provided.
 */
const Modal = ({ children, onClose, className = '' }: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // open the dialog in the top layer once it mounts
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (!dialog.open) {
      dialog.showModal()
    }
    return () => {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [])

  // dismiss on Escape (cancel) or a click on the backdrop
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    const handleCancel = (event: Event) => {
      event.preventDefault()
      onClose?.()
    }

    const handleClick = (event: MouseEvent) => {
      // only the dialog element itself (its padding or the backdrop) can be the
      // click target; clicks on the content bubble up from descendants
      if (event.target !== dialog) {
        return
      }
      // keyboard-activated clicks (e.g. pressing Enter on a form control) report
      // (0, 0) coordinates and would otherwise look like an outside click
      if (event.detail === 0) {
        return
      }
      const rect = dialog.getBoundingClientRect()
      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      if (!isInside) {
        onClose?.()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    dialog.addEventListener('click', handleClick)
    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      dialog.removeEventListener('click', handleClick)
    }
  }, [onClose])

  return (
    <dialog ref={dialogRef} className={`modal-dialog ${className}`}>
      {children}
    </dialog>
  )
}

export default Modal
