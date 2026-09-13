import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { costs, calculateCost } from './costs.ts'

describe('calculateCost', () => {
  it('charges the base price for a short, plain letter', () => {
    assert.equal(
      calculateCost({ numPages: 1, mailType: 'noUpgrade', returnEnvelope: false }),
      costs.base
    )
  })

  it('does not charge for pages up to the free page limit', () => {
    assert.equal(
      calculateCost({ numPages: costs.maxFreePages, mailType: 'noUpgrade', returnEnvelope: false }),
      costs.base
    )
  })

  it('charges the flat overage plus a per-page fee beyond the free limit', () => {
    const expected = costs.base + costs.overMaxFreePages + 1 * costs.overMaxFreePagesPerPage
    assert.equal(
      calculateCost({ numPages: 6, mailType: 'noUpgrade', returnEnvelope: false }),
      expected
    )
  })

  it('scales the per-page fee with the number of pages over the limit', () => {
    const pages = 10
    const expected =
      costs.base +
      costs.overMaxFreePages +
      (pages - costs.maxFreePages) * costs.overMaxFreePagesPerPage
    assert.equal(
      calculateCost({ numPages: pages, mailType: 'noUpgrade', returnEnvelope: false }),
      expected
    )
  })

  it('adds the registered mail surcharge', () => {
    assert.equal(
      calculateCost({ numPages: 1, mailType: 'registered', returnEnvelope: false }),
      costs.base + costs.registeredMail
    )
  })

  it('adds the certified mail surcharge', () => {
    assert.equal(
      calculateCost({ numPages: 1, mailType: 'certified', returnEnvelope: false }),
      costs.base + costs.certifiedMail
    )
  })

  it('does not add a surcharge for noUpgrade', () => {
    assert.equal(
      calculateCost({ numPages: 1, mailType: 'noUpgrade', returnEnvelope: false }),
      costs.base
    )
  })

  it('adds the return envelope fee', () => {
    assert.equal(
      calculateCost({ numPages: 1, mailType: 'noUpgrade', returnEnvelope: true }),
      costs.base + costs.returnEnvelope
    )
  })

  it('combines page overage, mail type, and return envelope fees', () => {
    const expected =
      costs.base +
      costs.overMaxFreePages +
      1 * costs.overMaxFreePagesPerPage +
      costs.certifiedMail +
      costs.returnEnvelope
    assert.equal(
      calculateCost({ numPages: 6, mailType: 'certified', returnEnvelope: true }),
      expected
    )
  })
})
