import { useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import PropTypes from 'prop-types'

import { formatMoney } from '../utils.js'
import Modal from './Modal.jsx'

// Stripe publishable keys are safe to expose in client-side code
const STRIPE_TEST_KEY = 'pk_test_o41iwtQNmvQuGl4Vses2r1fa'
const STRIPE_LIVE_KEY = 'pk_live_e1vrgw70Y8BC4ZCd5Lte0SFm'

const stripeTestPromise = loadStripe(STRIPE_TEST_KEY)
const stripeLivePromise = loadStripe(STRIPE_LIVE_KEY)

/**
 * The card payment form rendered inside a Stripe `Elements` provider. It
 * confirms the authorized PaymentIntent and then finalizes the order on the
 * server, which mails the document and captures the charge.
 */
const PaymentForm = ({ demo, toLine1, onFinalizingChange, onSuccess }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async event => {
    event.preventDefault()
    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setError('')

    // confirm the payment; the PaymentIntent is authorized but not captured
    // until the server finalizes the order
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required'
    })

    if (confirmError) {
      setError(confirmError.message)
      setIsProcessing(false)
      return
    }

    // show the progress modal while the server mails the document
    onFinalizingChange(true)

    try {
      const res = await fetch('/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo, paymentIntentId: paymentIntent.id })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Unexpected error finalizing your order.')
      }
      onSuccess()
    }
    catch (err) {
      onFinalizingChange(false)
      setIsProcessing(false)
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="payment modal">
      <p>Enter your card details to send your document to {toLine1}.</p>
      <PaymentElement />
      {error && (
        <p className="error">
          <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> {error}
        </p>
      )}
      <button type="submit" disabled={!stripe || isProcessing} tabIndex="8">
        {isProcessing ? 'Processing…' : 'Pay and Send'} <i className="fa fa-paper-plane" aria-hidden="true"></i>
      </button>
    </form>
  )
}

/**
 * The order summary, mailing options, and checkout flow. Collects the user's
 * email, then their card details via Stripe, and finalizes the order.
 */
const Send = ({ costs, file, options, updateOptions, calculateCost, fromAddress, toAddress, sentSuccessfully, actionable, demo }) => {
  const [email, setEmail] = useState('') // user's email address
  const [isShowingEmailModal, setIsShowingEmailModal] = useState(false)
  const [isShowingProgressModal, setIsShowingProgressModal] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [isFinalizing, setIsFinalizing] = useState(false)

  const stripePromise = useMemo(
    () => (demo ? stripeTestPromise : stripeLivePromise),
    [demo]
  )

  // total cost in cents for the current order
  const getTotal = useMemo(
    () => calculateCost({ ...options, numPages: file.numPages }),
    [calculateCost, options, file.numPages]
  )

  const handleMailTypeChange = event => {
    updateOptions({ [event.target.name]: event.target.value })
  }

  const handleReturnEnvelopeChange = () => {
    updateOptions({ returnEnvelope: !options.returnEnvelope })
  }

  const handleEmailChange = event => {
    setEmail(event.target.value)
  }

  const handleClick = () => {
    setIsShowingEmailModal(true)
  }

  const handleEmailModalClose = () => {
    setIsShowingEmailModal(false)
  }

  const handlePaymentModalClose = () => {
    setClientSecret(null)
  }

  const handleSuccess = () => {
    setClientSecret(null)
    setIsFinalizing(false)
    sentSuccessfully() // we're done!
  }

  const displayCheckout = async event => {
    event.preventDefault()
    setIsShowingEmailModal(false)
    setIsShowingProgressModal(true)
    try {
      const res = await fetch('/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: file.uid,
          numPages: file.numPages,
          mailType: options.mailType,
          returnEnvelope: options.returnEnvelope,
          cost: getTotal,
          fromAddress: fromAddress,
          toAddress: toAddress,
          demo: demo,
          email: email
        })
      })
      const body = await res.json()
      if (!res.ok || body.error) {
        throw new Error(body.error || 'Unexpected error')
      }
      setClientSecret(body.clientSecret)
    }
    catch (err) {
      alert(`We apologize, there was an unexpected problem with your order: ${err.message}`)
    }
    finally {
      setIsShowingProgressModal(false)
    }
  }

  let pageCount
  if (file.numPages > costs.maxFreePages) {
    pageCount = <span className="page-count">{file.numPages}-page document</span>
  }

  let error
  if (!file.uid.length) {
    error = (
      <p className="error">
        <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Please <a href="#upload">upload a PDF above</a> to continue.
      </p>
    )
  }
  else if (Array.from(fromAddress.missing).length ||
           Array.from(toAddress.missing).length ||
           typeof fromAddress.error === 'undefined' ||
           typeof toAddress.error === 'undefined') {
    error = (
      <p className="error">
        <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Please fill out the missing address fields above in red.
      </p>
    )
  }
  else if (toAddress.error || fromAddress.error) {
    error = (
      <p className="error">
        <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Please correct the address problem identified in red above.
      </p>
    )
  }

  let emailModal
  if (isShowingEmailModal) {
    emailModal = (
      <Modal onClose={handleEmailModalClose} className="email modal">
        <form onSubmit={displayCheckout}>
          <p>Please provide an email address for your tracking number and receipt.</p>
          <p>We use your email only to send this information.</p>
          <input type="email" placeholder="Email" autoFocus
                 value={email} onChange={handleEmailChange} tabIndex="7" />
          <button type="submit" tabIndex="8">
            Continue <i className="fa fa-arrow-right" aria-hidden="true"></i>
          </button>
        </form>
      </Modal>
    )
  }

  let paymentModal
  if (clientSecret) {
    paymentModal = (
      <Modal onClose={isFinalizing ? undefined : handlePaymentModalClose} className="payment-modal">
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm
            demo={demo}
            toLine1={toAddress.line1}
            onFinalizingChange={setIsFinalizing}
            onSuccess={handleSuccess}
          />
        </Elements>
      </Modal>
    )
  }

  let progressModal
  if (isShowingProgressModal || isFinalizing) {
    progressModal = (
      <Modal className="progress modal">
        <p><i className="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i> Preparing your document for shipment…</p>
      </Modal>
    )
  }

  const className = actionable ? '' : 'invisible'

  return (
    <section id="pay-and-send" className={className}>
      <div className="total">
        Total
        <div className="price">{formatMoney(getTotal)}</div>
        {pageCount}
      </div>
      <div className="additions">
        <fieldset className="mail-type">
          <label>
            <input type="radio" name="mailType" value="noUpgrade"
                   checked={options.mailType === 'noUpgrade'}
                   onChange={handleMailTypeChange} tabIndex="4" />
            Regular service
          </label>
          <label>
            <input type="radio" name="mailType" value="certified"
                   checked={options.mailType === 'certified'}
                   onChange={handleMailTypeChange} tabIndex="4" />
            Certified Mail <span className="price">+{formatMoney(costs.certifiedMail)}</span>
            <a href="https://www.usps.com/ship/insurance-extra-services.htm" target="_blank" rel="noreferrer" title="What's this?">
              <i className="fa fa-question fa-fw" aria-hidden="true"></i>
            </a>
          </label>
          <label>
            <input type="radio" name="mailType" value="registered"
                   checked={options.mailType === 'registered'}
                   onChange={handleMailTypeChange} tabIndex="4" />
            Registered Mail <span className="price">+{formatMoney(costs.registeredMail)}</span>
            <a href="https://www.usps.com/ship/insurance-extra-services.htm" target="_blank" rel="noreferrer" title="What's this?">
              <i className="fa fa-question fa-fw" aria-hidden="true"></i>
            </a>
          </label>
        </fieldset>
        <label>
          <input type="checkbox" name="returnEnvelope"
                 checked={options.returnEnvelope}
                 onChange={handleReturnEnvelopeChange} tabIndex="5" />
          Include blank return envelope <span className="price">+{formatMoney(costs.returnEnvelope)}</span>
        </label>
      </div>
      {error}
      <button onClick={handleClick} disabled={!!error} tabIndex="6">
        Pay and Send <i className="fa fa-paper-plane" aria-hidden="true"></i>
      </button>

      {emailModal}
      {paymentModal}
      {progressModal}

      <p>Mail is usually delivered by USPS within 4–6 business days.</p>
      <p>You will receive a tracking number by email after checkout.</p>

    </section>
  )
}

PaymentForm.propTypes = {
  demo: PropTypes.bool.isRequired,
  toLine1: PropTypes.string,
  onFinalizingChange: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired
}

Send.propTypes = {
  costs: PropTypes.object.isRequired,
  file: PropTypes.object.isRequired,
  options: PropTypes.object.isRequired,
  updateOptions: PropTypes.func.isRequired,
  calculateCost: PropTypes.func.isRequired,
  fromAddress: PropTypes.object.isRequired,
  toAddress: PropTypes.object.isRequired,
  sentSuccessfully: PropTypes.func.isRequired,
  actionable: PropTypes.bool.isRequired,
  demo: PropTypes.bool.isRequired
}

export default Send
