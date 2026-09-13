import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildDescription, formatDate, isMailType, statusCodeOf, uidToUrl } from './lib.ts'
import type { Address } from './types.ts'

const toAddress: Address = {
  name: 'Jane Doe',
  line1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701'
}

describe('buildDescription', () => {
  it('describes a plain mailing', () => {
    assert.equal(
      buildDescription({ numPages: 3, toAddress, returnEnvelope: false, mailType: 'noUpgrade' }),
      'Mailing a 3-page PDF to 123 Main St'
    )
  })

  it('notes a return envelope', () => {
    assert.equal(
      buildDescription({ numPages: 3, toAddress, returnEnvelope: true, mailType: 'noUpgrade' }),
      'Mailing a 3-page PDF to 123 Main St with a return envelope'
    )
  })

  it('notes registered mail', () => {
    assert.equal(
      buildDescription({ numPages: 3, toAddress, returnEnvelope: false, mailType: 'registered' }),
      'Mailing a 3-page PDF to 123 Main St via registered mail'
    )
  })

  it('notes certified mail', () => {
    assert.equal(
      buildDescription({ numPages: 3, toAddress, returnEnvelope: false, mailType: 'certified' }),
      'Mailing a 3-page PDF to 123 Main St via certified mail'
    )
  })

  it('combines the return envelope and mail type', () => {
    assert.equal(
      buildDescription({ numPages: 3, toAddress, returnEnvelope: true, mailType: 'certified' }),
      'Mailing a 3-page PDF to 123 Main St with a return envelope via certified mail'
    )
  })
})

describe('formatDate', () => {
  // Use local date components so the expected output is timezone-independent.
  const date = new Date(2026, 0, 5, 15, 45)

  it('formats a date without the time by default', () => {
    assert.equal(formatDate(date), 'Monday, January 5')
  })

  it('prefixes the time when requested', () => {
    assert.equal(formatDate(date, { includeTime: true }), '3:45 PM Monday, January 5')
  })

  it('accepts an ISO-like local date string', () => {
    assert.equal(
      formatDate('2026-01-05T12:00:00', { includeTime: true }),
      '12:00 PM Monday, January 5'
    )
  })
})

describe('statusCodeOf', () => {
  it('reads a numeric status_code property', () => {
    assert.equal(statusCodeOf({ status_code: 422 }), 422)
  })

  it('ignores non-numeric status_code values', () => {
    assert.equal(statusCodeOf({ status_code: '422' }), undefined)
  })

  it('returns undefined for values without the property', () => {
    assert.equal(statusCodeOf(new Error('nope')), undefined)
    assert.equal(statusCodeOf(null), undefined)
    assert.equal(statusCodeOf(undefined), undefined)
  })
})

describe('isMailType', () => {
  it('accepts each valid mail type', () => {
    assert.equal(isMailType('noUpgrade'), true)
    assert.equal(isMailType('registered'), true)
    assert.equal(isMailType('certified'), true)
  })

  it('rejects unknown values', () => {
    assert.equal(isMailType('express'), false)
    assert.equal(isMailType(undefined), false)
    assert.equal(isMailType(''), false)
  })
})

describe('uidToUrl', () => {
  it('builds the public upload URL', () => {
    assert.equal(uidToUrl('abc123'), '/uploads/abc123.pdf')
  })
})
