import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'

import type { Costs } from '../../types.ts'
import { formatMoney } from '../utils.ts'
import type { ApiError, FileState, UploadStatus } from '../types.ts'
import Progress from './Progress.tsx'

/** Props for the header and upload control. */
interface HeaderProps {
  costs: Costs
  fileUploadHasBegun: () => void
  file: FileState
  updateFile: (newFile: FileState) => void
  actionable: boolean
}

/**
 * The page header containing the pricing copy and the PDF upload control.
 * Handles both the file picker and native drag-and-drop uploads.
 */
const Header = ({ costs, fileUploadHasBegun, file, updateFile, actionable }: HeaderProps) => {
  // valid statuses: not_started, uploading, processing, complete_success,
  // complete_error
  const [status, setStatus] = useState<UploadStatus>('not_started')
  const [error, setError] = useState('') // error message
  const [uploadProgress, setUploadProgress] = useState(0) // percent, 0-100

  const fileInputRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)

  /** Upload a selected PDF and track its progress and result. */
  const uploadFile = useCallback(
    (selectedFile: File | undefined) => {
      if (!selectedFile) {
        return
      }

      fileUploadHasBegun()

      updateFile({
        filename: '',
        uid: '',
        url: '',
        numPages: 0
      })

      const formData = new FormData()
      formData.append('pdf', selectedFile)

      // use XMLHttpRequest rather than fetch so we can report upload progress
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/upload')

      xhr.upload.addEventListener('progress', event => {
        if (!event.lengthComputable) return
        const percent = Math.round((event.loaded / event.total) * 100)
        setUploadProgress(percent)
        setStatus(percent === 100 ? 'processing' : 'uploading')
      })

      xhr.addEventListener('load', () => {
        let body: Partial<FileState> & Partial<ApiError>
        try {
          body = JSON.parse(xhr.responseText) as Partial<FileState> & Partial<ApiError>
        } catch {
          body = {}
        }

        if (xhr.status >= 400 || body.error) {
          let errorMsg: string
          if (xhr.status === 413) {
            errorMsg = 'PDF over 25 MB file size limit. Please try again with a smaller file.'
          } else if (body.error) {
            errorMsg = body.error
          } else {
            errorMsg = xhr.statusText
          }
          setStatus('complete_error')
          setError(errorMsg)
          // show an alert if the status element is not in the browser viewport
          if (statusRef.current && statusRef.current.getBoundingClientRect().top < 0) {
            alert(`Upload error: ${errorMsg}`)
          }
        } else {
          setStatus('complete_success')
          updateFile({
            filename: body.filename ?? '',
            uid: body.uid ?? '',
            url: body.url ?? '',
            numPages: body.numPages ?? 0
          })
        }
      })

      xhr.addEventListener('error', () => {
        setStatus('complete_error')
        setError('There was a network error while uploading your PDF. Please try again.')
      })

      xhr.send(formData)
    },
    [fileUploadHasBegun, updateFile]
  )

  // native drag-and-drop upload handling (replaces the Dropzone dependency)
  useEffect(() => {
    /* A little closure for handling proper
       drag and drop hover behavior */
    let dragCounter = 0

    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault()
      dragCounter++
      document.body.classList.add('dz-drag-hover')
    }
    const handleDragLeave = () => {
      dragCounter--
      if (dragCounter === 0) {
        document.body.classList.remove('dz-drag-hover')
      }
    }
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault()
    }
    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      dragCounter = 0
      document.body.classList.remove('dz-drag-hover')
      uploadFile(event.dataTransfer?.files[0])
    }

    document.body.addEventListener('dragenter', handleDragEnter)
    document.body.addEventListener('dragleave', handleDragLeave)
    document.body.addEventListener('dragover', handleDragOver)
    document.body.addEventListener('drop', handleDrop)

    return () => {
      document.body.removeEventListener('dragenter', handleDragEnter)
      document.body.removeEventListener('dragleave', handleDragLeave)
      document.body.removeEventListener('dragover', handleDragOver)
      document.body.removeEventListener('drop', handleDrop)
    }
  }, [uploadFile])

  const showFileUploadDialog = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    uploadFile(event.target.files?.[0])
  }

  let statusElement: ReactNode
  let progress: ReactNode
  if (status === 'uploading' || status === 'processing') {
    progress = <Progress completed={uploadProgress} color="rgba(255,255,255, 0.5)" />
  }
  switch (status) {
    case 'not_started':
      break
    case 'uploading':
      statusElement = (
        <p className="status uploading" ref={statusRef}>
          <i className="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i> Uploading…
        </p>
      )
      break
    case 'processing':
      statusElement = (
        <p className="status processing" ref={statusRef}>
          <i className="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i> Processing document…
        </p>
      )
      break
    case 'complete_success':
      statusElement = (
        <p className="status complete_success animated fadeInUp" ref={statusRef}>
          <i className="fa fa-check" aria-hidden="true"></i> Uploaded “{file.filename}.” All pages
          have been sized to 8.5"x11".{' '}
          <a href={file.url} target="_blank" rel="noreferrer">
            View processed PDF
          </a>
          .
          <sup>
            <i className="fa fa-external-link" aria-hidden="true"></i>
          </sup>
        </p>
      )
      break
    case 'complete_error':
      statusElement = (
        <p className="status complete_error animated shake" ref={statusRef}>
          <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Error: {error}
        </p>
      )
      break
    default:
      console.error('Unexpected status:', status)
  }

  const invisibleClass = actionable ? '' : 'invisible'

  return (
    <header>
      <p className="tagline">Skip the post office.</p>
      <h1>Mail a PDF for {formatMoney(costs.base)} in under 60 seconds.</h1>
      <p className="pricing-details">
        Tracking included. Up to {costs.maxFreePages} black-and-white pages for{' '}
        {formatMoney(costs.base)}. Additional pages {formatMoney(costs.overMaxFreePagesPerPage)}
        /each + {formatMoney(costs.overMaxFreePages)}. U.S. address service only.
      </p>
      <div id="upload" className={`upload ${invisibleClass}`}>
        <p className="instructions">
          <strong>Drag and drop</strong> or click
        </p>
        <button onClick={showFileUploadDialog} tabIndex={1}>
          Upload PDF <i className="fa fa-upload" aria-hidden="true"></i>
        </button>

        {progress}
        {statusElement}

        {/* hidden element for file upload http://stackoverflow.com/a/8595592 */}
        <input
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          onChange={handleFileInputChange}
        />
      </div>
    </header>
  )
}

export default Header
