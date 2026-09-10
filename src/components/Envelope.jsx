import PropTypes from 'prop-types'

import Address from './Address.jsx'

/**
 * The envelope containing both address forms and the success overlay shown
 * after an order is sent.
 */
const Envelope = ({ fileUploadHasBegun, fromFields, toFields, updateAddress, sentSuccessfully }) => {
  const reloadPage = () => {
    location.reload()
  }

  const animationClass = sentSuccessfully ? 'bounceOutRight' : 'slideInUp'
  const sendSuccessClass = sentSuccessfully ? 'animated fadeIn' : 'hidden'

  return (
    <div id="envelope-container">
      <div id="envelope" className={`animated ${animationClass}`}>
        <img className="stamp" src="/img/stamp.png" alt="" />
        <Address from={true} fields={fromFields}
                fileUploadHasBegun={fileUploadHasBegun}
                updateAddress={updateAddress} />
        <Address from={false} fields={toFields}
                fileUploadHasBegun={fileUploadHasBegun}
                updateAddress={updateAddress} />
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

Envelope.propTypes = {
  fileUploadHasBegun: PropTypes.bool.isRequired,
  fromFields: PropTypes.object.isRequired,
  toFields: PropTypes.object.isRequired,
  updateAddress: PropTypes.func.isRequired,
  sentSuccessfully: PropTypes.bool.isRequired
}

export default Envelope
