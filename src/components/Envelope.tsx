import type { Address as AddressFields } from '../../types.ts'
import type { AddressState } from '../types.ts'
import Address from './Address.tsx'

/** Props for the envelope and success overlay. */
interface EnvelopeProps {
  fileUploadHasBegun: boolean
  fromFields: AddressState
  toFields: AddressState
  updateAddress: (isFrom: boolean, field: Partial<AddressFields>) => void
  sentSuccessfully: boolean
}

/**
 * The envelope containing both address forms and the success overlay shown
 * after an order is sent.
 */
const Envelope = ({
  fileUploadHasBegun,
  fromFields,
  toFields,
  updateAddress,
  sentSuccessfully
}: EnvelopeProps) => {
  const reloadPage = () => {
    location.reload()
  }

  const animationClass = sentSuccessfully ? 'bounceOutRight' : 'slideInUp'
  const sendSuccessClass = sentSuccessfully ? 'animated fadeIn' : 'hidden'

  return (
    <div id="envelope-container">
      <div id="envelope" className={`animated ${animationClass}`}>
        <img className="stamp" src="/img/stamp.png" alt="" />
        <Address
          from={true}
          fields={fromFields}
          fileUploadHasBegun={fileUploadHasBegun}
          updateAddress={updateAddress}
        />
        <Address
          from={false}
          fields={toFields}
          fileUploadHasBegun={fileUploadHasBegun}
          updateAddress={updateAddress}
        />
      </div>
      <div id="send-success" className={sendSuccessClass}>
        <div>
          <h2>Thanks for your order!</h2>
          <p>Your document has begun its journey to {toFields.line1}.</p>
          <p>You will receive an email with tracking information shortly.</p>
          <button className="send-another" onClick={reloadPage}>
            Send Another <i className="fa fa-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Envelope
