import type { ChangeEvent } from 'react'

import type { Address as AddressFields } from '../../types.ts'
import type { AddressState } from '../types.ts'

/** Props for a single address form. */
interface AddressProps {
  fileUploadHasBegun: boolean
  from: boolean
  fields: AddressState
  updateAddress: (isFrom: boolean, field: Partial<AddressFields>) => void
}

/**
 * A single mailing address form (either the "from" or "to" address) rendered
 * on the envelope.
 */
const Address = ({ fileUploadHasBegun, from, fields, updateAddress }: AddressProps) => {
  const title = from ? 'from' : 'to'

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateAddress(from, { [event.target.name]: event.target.value })
  }

  let error
  let verificationStatus
  if (fields.error) {
    // verification completed with error
    error = (
      <p className="error animated fadeIn">
        <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> {fields.error}
      </p>
    )
    verificationStatus = <i className="verification-status fa fa-times" aria-hidden="true"></i>
  }
  if (fields.dirty) {
    // verification queued/in progress; show spinner
    verificationStatus = (
      <i className="verification-status fa fa-circle-o-notch fa-spin" aria-hidden="true"></i>
    )
  }
  // strict equality comparison because error can also be `undefined`
  else if (fields.error === false) {
    // verified; show check mark
    verificationStatus = <i className="verification-status fa fa-check" aria-hidden="true"></i>
  }

  const className = `address ${title} ${error ? 'error' : ''}`
  const arrow = <i className={`fa fa-arrow-right ${title}`} aria-hidden="true" />

  let nameClassName: string | undefined
  let line1ClassName: string | undefined
  let cityClassName: string | undefined
  let stateClassName: string | undefined
  let zipClassName: string | undefined
  if (fileUploadHasBegun) {
    const missingFields = fields.missing
    nameClassName = missingFields.has('name') ? 'error' : ''
    line1ClassName = missingFields.has('line1') ? 'error' : ''
    cityClassName = missingFields.has('city') ? 'error' : ''
    stateClassName = missingFields.has('state') ? 'error' : ''
    zipClassName = missingFields.has('zip') ? 'error' : ''
  }

  const tabIndex = from ? 2 : 3

  return (
    <form className={className}>
      <h2>
        {title} {arrow} {verificationStatus}
      </h2>
      {error}
      <input
        type="text"
        name="name"
        placeholder="Name"
        required
        className={nameClassName}
        value={fields.name || ''}
        onChange={handleInputChange}
        tabIndex={tabIndex}
        autoComplete="name"
      />
      <input
        type="text"
        name="line1"
        placeholder="Address line 1"
        required
        className={line1ClassName}
        value={fields.line1 || ''}
        onChange={handleInputChange}
        tabIndex={tabIndex}
        autoComplete="address-line1"
      />
      <input
        type="text"
        name="line2"
        placeholder="Address line 2 (optional)"
        value={fields.line2 || ''}
        onChange={handleInputChange}
        tabIndex={tabIndex}
        autoComplete="address-line2"
      />
      <div className="third-line">
        <input
          type="text"
          name="city"
          placeholder="City"
          required
          className={cityClassName}
          value={fields.city || ''}
          onChange={handleInputChange}
          tabIndex={tabIndex}
          autoComplete="address-level2"
        />
        <input
          type="text"
          name="state"
          placeholder="State"
          required
          className={stateClassName}
          value={fields.state || ''}
          onChange={handleInputChange}
          tabIndex={tabIndex}
          autoComplete="address-level1"
        />
        <input
          type="text"
          name="zip"
          placeholder="Zip"
          pattern="\d*"
          required
          className={zipClassName}
          value={fields.zip || ''}
          onChange={handleInputChange}
          tabIndex={tabIndex}
          autoComplete="postal-code"
        />
      </div>
    </form>
  )
}

export default Address
