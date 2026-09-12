import type { Address, MailType, UploadResponse } from '../types.ts'

/** Uploaded file state, populated by the upload API response. */
export type FileState = UploadResponse

/** Form state for an address: raw fields plus client-side validation state. */
export interface AddressState extends Partial<Address> {
  /** `undefined` = not validated, string = error message, `false` = valid */
  error?: string | false
  /** names of the required fields that are still missing */
  missing: Set<keyof Address>
  /** true when the address is complete and queued for verification */
  dirty: boolean
}

/** Mailing options selected by the user. */
export interface OptionsState {
  mailType: MailType
  returnEnvelope: boolean
}

/** Upload lifecycle status. */
export type UploadStatus =
  'not_started' | 'uploading' | 'processing' | 'complete_success' | 'complete_error'

/** Generic API error response body. */
export interface ApiError {
  error: string
}
