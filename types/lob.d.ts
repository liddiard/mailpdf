/**
 * Minimal ambient declarations for the `lob` package, which ships no types and
 * has no `@types/lob` package on npm. Only the surface used by this app is
 * declared.
 */
declare module 'lob' {
  /** An address in Lob's expected wire format. */
  export interface LobAddress {
    name?: string
    address_line1: string
    address_line2?: string
    address_city: string
    address_state: string
    address_zip: string
    address_country?: string
  }

  /** Request body for `usVerifications.verify`. */
  export interface LobVerificationRequest {
    recipient?: string
    primary_line: string
    secondary_line?: string
    city: string
    state: string
    zip_code: string
  }

  /** Response from `usVerifications.verify`. */
  export interface LobVerification {
    deliverability: string
  }

  /** Options accepted by `letters.create`. */
  export interface LobLetterCreateOptions {
    from: LobAddress
    to: LobAddress
    file: Buffer
    color?: boolean
    double_sided?: boolean
    address_placement?: string
    return_envelope?: boolean
    use_type?: string
    metadata?: Record<string, string>
    perforated_page?: number
    extra_service?: string
  }

  /** A single USPS tracking event on a letter. */
  export interface LobTrackingEvent {
    id?: string
    name?: string
    location?: string
    time?: string
    date_created?: string
    date_modified?: string
    [key: string]: unknown
  }

  /** A letter resource returned by the Lob API. */
  export interface LobLetter {
    id: string
    tracking_number?: string
    date_created?: string
    date_modified?: string
    expected_delivery_date?: string
    tracking_events?: LobTrackingEvent[]
    [key: string]: unknown
  }

  export default class Lob {
    constructor(apiKey?: string | null, options?: Record<string, unknown>)

    usVerifications: {
      verify(options: LobVerificationRequest): Promise<LobVerification>
    }

    letters: {
      create(options: LobLetterCreateOptions): Promise<LobLetter>
      retrieve(id: string): Promise<LobLetter>
    }
  }
}
