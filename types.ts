/**
 * Domain and API contract types shared by the client and server.
 */

/** An `Error` carrying an optional HTTP status code. */
export interface HttpError extends Error {
  status?: number
}

/** The mailing service level selected for an order. */
export type MailType = 'noUpgrade' | 'registered' | 'certified'

/** A U.S. mailing address. */
export interface Address {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
}

/** Pricing configuration. All costs are in cents. */
export interface Costs {
  base: number
  maxFreePages: number
  overMaxFreePages: number
  overMaxFreePagesPerPage: number
  maxPages: number
  certifiedMail: number
  registeredMail: number
  returnEnvelope: number
}

/** Inputs to `calculateCost`. */
export interface CalculateCostParams {
  numPages: number
  mailType: MailType
  returnEnvelope: boolean
}

/** Response body from `POST /upload`. */
export interface UploadResponse {
  filename: string
  uid: string
  url: string
  numPages: number
}

/** Request body for `POST /verify_address`. */
export interface VerifyAddressRequest {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
}

/** Response body from `POST /verify_address`. */
export interface VerifyAddressResponse {
  error: string | false
  deliverability: string
}

/** Request body for `POST /checkout`. */
export interface CheckoutRequest {
  demo: boolean
  uid: string
  numPages: number
  mailType: MailType
  returnEnvelope: boolean
  cost: number
  fromAddress: Address
  toAddress: Address
  email: string
}

/** Response body from `POST /checkout`. */
export interface CheckoutResponse {
  clientSecret: string | null
  paymentIntentId: string
}

/** Request body for `POST /finalize`. */
export interface FinalizeRequest {
  demo: boolean
  paymentIntentId: string
}

/** Generic error response body returned by the API. */
export interface ErrorResponse {
  error: string
}
