import { useCallback, useEffect, useState } from 'react'

import { costs as costConfig, calculateCost as calcCost } from '../costs.ts'
import type { Address, CalculateCostParams, Costs, VerifyAddressResponse } from '../types.ts'
import Header from './components/Header.tsx'
import Envelope from './components/Envelope.tsx'
import Send from './components/Send.tsx'
import type { AddressState, FileState, OptionsState } from './types.ts'

const DEFAULT_REQUIRED_FIELDS: ReadonlySet<keyof Address> = new Set<keyof Address>([
  'name',
  'line1',
  'city',
  'state',
  'zip'
])

// demo mode is enabled by including "demo" anywhere in the URL
const IS_DEMO = document.location.search.includes('demo')

/**
 * Build the initial state for an address form.
 * @param requiredFields fields that must be present
 * @returns initial address state
 */
const makeAddress = (requiredFields: ReadonlySet<keyof Address>): AddressState => ({
  // error can be undefined (has not been validated), a string with an
  // error message (truthy), or false (validated without error)
  error: undefined,
  // set of missing fields
  missing: new Set(requiredFields),
  // true when address has not been verified but it queued for verification
  dirty: false
})

/** Props accepted by the root application component. */
interface AppProps {
  costs?: Costs
  calculateCost?: (params: CalculateCostParams) => number
  requiredFields?: ReadonlySet<keyof Address>
  demo?: boolean
}

/**
 * Root application component. Owns the upload, address, and options state and
 * coordinates the envelope, upload header, and checkout sections.
 */
const App = ({
  costs = costConfig,
  calculateCost = calcCost,
  requiredFields = DEFAULT_REQUIRED_FIELDS,
  demo = IS_DEMO
}: AppProps) => {
  const [isOnline, setIsOnline] = useState(true)
  const [file, setFile] = useState<FileState>({
    // populated by upload api response
    filename: '',
    uid: '',
    url: '',
    numPages: 0
  })
  const [fileUploadHasBegun, setFileUploadHasBegun] = useState(false)
  const [fromAddress, setFromAddress] = useState<AddressState>(() => makeAddress(requiredFields))
  const [toAddress, setToAddress] = useState<AddressState>(() => makeAddress(requiredFields))
  const [options, setOptions] = useState<OptionsState>({
    mailType: 'noUpgrade',
    returnEnvelope: false
  })
  const [sentSuccessfully, setSentSuccessfully] = useState(false)

  // wait 1s for DOM/animations before showing the demo popup
  useEffect(() => {
    if (!demo) {
      return
    }
    const timeoutId = setTimeout(() => {
      alert(
        'This application is running in demo mode because "demo" is in the URL.\n\nEverything will work normally, except your credit card won\'t be charged and your document won\'t actually be sent.\n\nIf you meant to use this application for real, remove the word "demo" from the URL.'
      )
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [demo])

  // poll the server to detect when the user goes offline
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch('/favicon.ico', { method: 'HEAD' })
        setIsOnline(res.ok)
      } catch {
        setIsOnline(false)
      }
    }, 1000 * 10)
    return () => clearInterval(intervalId)
  }, [])

  /** Determine which required fields are still missing from an address. */
  const missingFields = useCallback(
    (address: AddressState): Set<keyof Address> => {
      return new Set(
        Array.from(requiredFields).filter(field => {
          const value = address[field]
          return !(value && value.length)
        })
      )
    },
    [requiredFields]
  )

  const beginFileUpload = useCallback(() => {
    setFileUploadHasBegun(true)
    // focus the first address input so the user can start filling it out
    document.querySelector<HTMLInputElement>('.address input')?.focus()
  }, [])

  const updateFile = useCallback((newFile: FileState) => {
    setFile(newFile)
  }, [])

  /** Merge updated fields into the from or to address and recompute validity. */
  const updateAddress = useCallback(
    (isFrom: boolean, field: Partial<Address>) => {
      const setter = isFrom ? setFromAddress : setToAddress
      setter(prev => {
        const updatedAddress = { ...prev, ...field }
        const missing = missingFields(updatedAddress)
        const isNotMissingFields = missing.size === 0
        return { ...updatedAddress, missing, dirty: isNotMissingFields }
      })
    },
    [missingFields]
  )

  /** Ask the server to verify an address with Lob. */
  const verifyAddress = useCallback(async (isFrom: boolean, address: AddressState) => {
    const setter = isFrom ? setFromAddress : setToAddress
    try {
      const res = await fetch('/verify_address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address)
      })
      const body: VerifyAddressResponse = await res.json()
      const newError = body.error || false
      setter(prev => ({ ...prev, error: newError, dirty: false }))
    } catch (err) {
      console.error(err)
      setter(prev => ({
        ...prev,
        error: 'Unable to verify this address. Please try again.',
        dirty: false
      }))
    }
  }, [])

  // queue the from address for verification once it is complete, debounced so
  // we only verify after the user stops typing
  useEffect(() => {
    if (!fromAddress.dirty) {
      return
    }
    const timeoutId = setTimeout(() => verifyAddress(true, fromAddress), 500)
    return () => clearTimeout(timeoutId)
  }, [fromAddress, verifyAddress])

  useEffect(() => {
    if (!toAddress.dirty) {
      return
    }
    const timeoutId = setTimeout(() => verifyAddress(false, toAddress), 500)
    return () => clearTimeout(timeoutId)
  }, [toAddress, verifyAddress])

  const updateOptions = useCallback((option: Partial<OptionsState>) => {
    setOptions(prev => ({ ...prev, ...option }))
  }, [])

  const markSentSuccessfully = useCallback(() => {
    setSentSuccessfully(true)
  }, [])

  let offlineBanner
  if (!isOnline) {
    offlineBanner = (
      <div className="offline banner animated fadeInDownBig">
        <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Your internet connection
        has gone offline. Some functionality will not work until connection is restored.
      </div>
    )
  }

  return (
    <main>
      {offlineBanner}
      <div id="drop-mask">Release to upload!</div>
      <Header
        costs={costs}
        file={file}
        fileUploadHasBegun={beginFileUpload}
        updateFile={updateFile}
        actionable={!sentSuccessfully}
      />
      <Envelope
        fileUploadHasBegun={fileUploadHasBegun}
        updateAddress={updateAddress}
        fromFields={fromAddress}
        toFields={toAddress}
        sentSuccessfully={sentSuccessfully}
      />
      <Send
        costs={costs}
        file={file}
        options={options}
        updateOptions={updateOptions}
        calculateCost={calculateCost}
        fromAddress={fromAddress}
        toAddress={toAddress}
        sentSuccessfully={markSentSuccessfully}
        actionable={!sentSuccessfully}
        demo={demo}
      />
      <footer>
        <ul>
          <li>
            <a href="/pages/refund-policy" target="_blank" rel="noreferrer">
              Refund Policy
            </a>
          </li>
          <li>
            <a href="/pages/terms" target="_blank" rel="noreferrer">
              Terms of Service
            </a>
          </li>
          <li>
            <a href="/pages/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
          </li>
        </ul>
        <p>
          Powered by{' '}
          <a href="https://lob.com/" target="_blank" rel="noreferrer">
            Lob
          </a>{' '}
          and{' '}
          <a href="https://stripe.com/" target="_blank" rel="noreferrer">
            Stripe
          </a>
        </p>
      </footer>
    </main>
  )
}

export default App
