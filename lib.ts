/**
 * Small, dependency-free helpers shared by the server. Kept separate from the
 * route handlers so they can be unit tested without booting Express or
 * requiring API credentials.
 */

import type { Address, MailType } from './types.ts'

/**
 * Narrow a Stripe/Lob metadata value to a known mailing type.
 * @param value metadata value to check
 * @returns true when the value is a valid mail type
 */
export const isMailType = (value: string | undefined): value is MailType =>
  value === 'noUpgrade' || value === 'registered' || value === 'certified'

/**
 * Read the `status_code` (Lob) property off an unknown thrown value.
 * @param err caught value
 * @returns the status code when present
 */
export const statusCodeOf = (err: unknown): number | undefined => {
  if (typeof err === 'object' && err !== null && 'status_code' in err) {
    const code = (err as { status_code?: unknown }).status_code
    return typeof code === 'number' ? code : undefined
  }
  return undefined
}

/**
 * Build a human-readable Stripe charge description for an order.
 * @param order order details to describe
 * @returns the charge description
 */
export const buildDescription = ({
  numPages,
  toAddress,
  returnEnvelope,
  mailType
}: {
  numPages: number
  toAddress: Address
  returnEnvelope: boolean
  mailType: MailType
}): string => {
  let description = `Mailing a ${numPages}-page PDF to ${toAddress.line1}`
  if (returnEnvelope) {
    description += ' with a return envelope'
  }
  if (mailType === 'registered') {
    description += ' via registered mail'
  } else if (mailType === 'certified') {
    description += ' via certified mail'
  }
  return description
}

/**
 * Resolve the public URL for a processed upload.
 * @param uid upload identifier assigned by multer
 * @returns URL path
 */
export const uidToUrl = (uid: string): string => `/uploads/${uid}.pdf`

/**
 * Format a date (or date string) like "Monday, January 1", optionally
 * prefixed with the time like "3:45 PM Monday, January 1".
 * @param date value to format
 * @param options set `includeTime` to prefix the time
 * @returns the formatted date
 */
export const formatDate = (
  date: Date | string,
  { includeTime = false }: { includeTime?: boolean } = {}
): string => {
  const parsed = new Date(date)
  const formatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(parsed)
  if (!includeTime) {
    return formatted
  }
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    parsed
  )
  return `${timePart} ${formatted}`
}
