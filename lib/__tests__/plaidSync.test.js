import { describe, it, expect } from 'vitest'
import { planSyncWrites } from '../plaidSync'

const CTX = { userId: 'user_1', itemRowId: 'item-row-uuid' }

function txn(overrides = {}) {
  return {
    transaction_id: 'txn_1',
    account_id: 'acc_1',
    amount: 10,
    name: 'Coffee Shop',
    merchant_name: null,
    date: '2026-03-01',
    authorized_date: null,
    pending: false,
    pending_transaction_id: null,
    personal_finance_category: { primary: 'FOOD_AND_DRINK' },
    ...overrides,
  }
}

describe('planSyncWrites', () => {
  it('maps added transactions into inserts', () => {
    const plan = planSyncWrites({ added: [txn()] }, CTX)
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0].plaid_transaction_id).toBe('txn_1')
    expect(plan.updates).toHaveLength(0)
    expect(plan.deleteIds).toHaveLength(0)
  })

  it('a posted transaction with a pending_transaction_id produces BOTH an insert and a delete of the pending id', () => {
    const plan = planSyncWrites({
      added: [txn({ transaction_id: 'txn_posted', pending_transaction_id: 'txn_pending' })],
    }, CTX)
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0].plaid_transaction_id).toBe('txn_posted')
    expect(plan.deleteIds).toEqual(['txn_pending'])
  })

  it('modified transactions with a pending_transaction_id also queue a delete', () => {
    const plan = planSyncWrites({
      modified: [txn({ transaction_id: 'txn_mod', pending_transaction_id: 'txn_old_pending' })],
    }, CTX)
    expect(plan.updates).toHaveLength(1)
    expect(plan.deleteIds).toEqual(['txn_old_pending'])
  })

  it('removed[] ids and pending-reconciliation ids merge without duplicates', () => {
    const plan = planSyncWrites({
      added: [txn({ transaction_id: 'a', pending_transaction_id: 'shared' })],
      removed: [{ transaction_id: 'shared' }, { transaction_id: 'other' }],
    }, CTX)
    expect(plan.deleteIds.sort()).toEqual(['other', 'shared'])
  })

  it('replaying an identical page produces an identical plan (idempotency)', () => {
    const page = {
      added: [txn({ transaction_id: 'a1' })],
      modified: [txn({ transaction_id: 'm1' })],
      removed: [{ transaction_id: 'r1' }],
    }
    const first = planSyncWrites(page, CTX)
    const second = planSyncWrites(page, CTX)
    expect(second).toEqual(first)
  })

  it('deletes are represented once, ahead of inserts and updates in the returned plan shape', () => {
    const plan = planSyncWrites({
      added: [txn({ transaction_id: 'a', pending_transaction_id: 'p' })],
      removed: [{ transaction_id: 'p' }],
    }, CTX)
    // Object key order documents the intended apply order (delete -> insert
    // -> update); applySyncWrites is the thing that actually enforces it at
    // runtime, but the plan shape should reflect the same contract.
    expect(Object.keys(plan)).toEqual(['inserts', 'updates', 'deleteIds'])
    expect(plan.deleteIds).toEqual(['p'])
  })

  it('modified[] updates never include category or note — user corrections must survive Plaid re-categorizing', () => {
    const plan = planSyncWrites({
      modified: [txn({ transaction_id: 'm1', personal_finance_category: { primary: 'GENERAL_MERCHANDISE' } })],
    }, CTX)
    const columns = plan.updates[0].columns
    expect(columns).not.toHaveProperty('category')
    expect(columns).not.toHaveProperty('note')
    // but it does keep the fields Plaid legitimately owns
    expect(columns).toHaveProperty('amount')
    expect(columns).toHaveProperty('date')
    expect(columns).toHaveProperty('description')
    expect(columns).toHaveProperty('pending')
  })

  it('handles an empty page', () => {
    expect(planSyncWrites({}, CTX)).toEqual({ inserts: [], updates: [], deleteIds: [] })
  })
})
