import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildTrackingEmail } from './emails.ts'
import type { Address } from './types.ts'

const baseAddress: Address = {
  name: 'Jane Doe',
  line1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701'
}

describe('buildTrackingEmail', () => {
  it('mentions USPS tracking in the subject when a USPS number is present', () => {
    const { subject } = buildTrackingEmail({
      toAddress: baseAddress,
      trackingNumber: '9400111899223197428490',
      trackUrl: 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=940',
      uspsTracking: true
    })
    assert.match(subject, /USPS tracking number included/)
  })

  it('uses a plain subject when there is no USPS number', () => {
    const { subject } = buildTrackingEmail({
      toAddress: baseAddress,
      trackingNumber: 'ltr_123',
      trackUrl: 'https://mailpdf.online/track/ltr_123',
      uspsTracking: false
    })
    assert.equal(subject, '📫 Your document has been mailed')
  })

  it('renders the recipient address in the text body', () => {
    const { text } = buildTrackingEmail({
      toAddress: baseAddress,
      trackingNumber: 'ltr_123',
      trackUrl: 'https://mailpdf.online/track/ltr_123',
      uspsTracking: false
    })
    assert.match(text, /We mailed your document to:/)
    assert.match(text, /Jane Doe/)
    assert.match(text, /123 Main St/)
    assert.match(text, /Austin, TX 78701/)
  })

  it('omits blank optional address lines', () => {
    const { text } = buildTrackingEmail({
      toAddress: { ...baseAddress, line2: '   ' },
      trackingNumber: 'ltr_123',
      trackUrl: 'https://mailpdf.online/track/ltr_123',
      uspsTracking: false
    })
    const blankLines = text.split('\n').filter(line => line.trim() === '')
    // only the trailing delimiter line should be blank; line2 must not add one
    assert.equal(blankLines.length, 1)
  })

  it('includes the tracking number when using USPS tracking', () => {
    const { text, html } = buildTrackingEmail({
      toAddress: baseAddress,
      trackingNumber: '9400111899223197428490',
      trackUrl: 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=940',
      uspsTracking: true
    })
    assert.match(text, /9400111899223197428490/)
    assert.match(html, /9400111899223197428490/)
  })

  it('does not mention USPS tracking for standard letters', () => {
    const { text, html } = buildTrackingEmail({
      toAddress: baseAddress,
      trackingNumber: 'ltr_123',
      trackUrl: 'https://mailpdf.online/track/ltr_123',
      uspsTracking: false
    })
    assert.doesNotMatch(text, /USPS tracking/)
    assert.doesNotMatch(html, /USPS tracking/)
  })

  it('escapes user-provided values in the HTML body', () => {
    const { html } = buildTrackingEmail({
      toAddress: { ...baseAddress, name: `O'Brien & <Co>` },
      trackingNumber: 'ltr_123',
      trackUrl: 'https://mailpdf.online/track/ltr_123',
      uspsTracking: false
    })
    assert.match(html, /O&#39;Brien &amp; &lt;Co&gt;/)
    assert.doesNotMatch(html, /<Co>/)
  })

  it('escapes the tracking URL inside the link href', () => {
    const { html } = buildTrackingEmail({
      toAddress: baseAddress,
      trackingNumber: 'ltr_123',
      trackUrl: 'https://mailpdf.online/track/ltr_123?a=1&b=2',
      uspsTracking: false
    })
    assert.match(html, /href="https:\/\/mailpdf\.online\/track\/ltr_123\?a=1&amp;b=2"/)
  })

  it('wraps the body in the shared HTML layout', () => {
    const { html } = buildTrackingEmail({
      toAddress: baseAddress,
      trackingNumber: 'ltr_123',
      trackUrl: 'https://mailpdf.online/track/ltr_123',
      uspsTracking: false
    })
    assert.match(html, /<!DOCTYPE html>/)
    assert.match(html, /Your document is on its way/)
  })
})
