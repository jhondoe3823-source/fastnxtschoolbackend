/**
 * Unit tests for fee payment status derivation and amount validation rules.
 * Run: node --test src/tests/fee-payment.logic.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { deriveInvoiceStatus } = require('../services/fees/fee-payment.service');

describe('deriveInvoiceStatus', () => {
  it('marks full payment as Paid with zero balance', () => {
    const r = deriveInvoiceStatus({ total: 10000, discount: 0, paid: 10000, due: '2099-01-01' });
    assert.equal(r.status, 'Paid');
    assert.equal(r.balance, 0);
  });

  it('marks partial payment as Partially Paid', () => {
    const r = deriveInvoiceStatus({ total: 10000, discount: 0, paid: 4000, due: '2099-01-01' });
    assert.equal(r.status, 'Partially Paid');
    assert.equal(r.balance, 6000);
  });

  it('accounts for discount when computing net and balance', () => {
    const r = deriveInvoiceStatus({ total: 10000, discount: 1000, paid: 9000, due: '2099-01-01' });
    assert.equal(r.status, 'Paid');
    assert.equal(r.balance, 0);
  });

  it('marks overdue when due date passed and balance remains', () => {
    const r = deriveInvoiceStatus({ total: 5000, discount: 0, paid: 0, due: '2020-01-01' });
    assert.equal(r.status, 'Overdue');
    assert.equal(r.balance, 5000);
  });

  it('marks pending when unpaid and not overdue', () => {
    const r = deriveInvoiceStatus({ total: 5000, discount: 0, paid: 0, due: '2099-12-31' });
    assert.equal(r.status, 'Pending');
    assert.equal(r.balance, 5000);
  });
});

describe('payment amount validation rules', () => {
  function validateAmount(requested, previousBalance) {
    if (requested <= 0) return 'Payment amount must be greater than zero.';
    if (requested > previousBalance) {
      return `Payment amount (Rs ${requested}) exceeds outstanding balance (Rs ${previousBalance}).`;
    }
    return null;
  }

  it('rejects zero and negative amounts', () => {
    assert.ok(validateAmount(0, 1000));
    assert.ok(validateAmount(-5, 1000));
  });

  it('rejects overpayment', () => {
    const msg = validateAmount(1500, 1000);
    assert.match(msg, /exceeds outstanding/);
  });

  it('allows exact and partial amounts', () => {
    assert.equal(validateAmount(1000, 1000), null);
    assert.equal(validateAmount(250, 1000), null);
  });
});

describe('receipt duplicate flag', () => {
  it('serializePayment marks duplicate when requested', () => {
    const { serializePayment } = require('../services/fees/fee-payment.service');
    const base = {
      id: 'p1',
      receiptNo: 'RCP-2026-0001',
      invoiceId: 'i1',
      invoiceNo: 'INV-1',
      studentName: 'Test',
      cls: 'G1',
      section: 'A',
      period: 'Oct 2026',
      amount: 100,
      method: 'Cash',
      reference: '',
      paidAt: new Date('2026-10-14T10:00:00Z'),
      grossAmount: 100,
      discount: 0,
      previousBalance: 100,
      remainingBalance: 0,
      status: 'PAID',
      linesSnapshot: [],
      schoolSnapshot: { name: 'School' },
      reprintCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const original = serializePayment(base, { duplicate: false });
    const dup = serializePayment(base, { duplicate: true });
    assert.equal(original.duplicate, false);
    assert.equal(dup.duplicate, true);
    assert.equal(dup.receiptNo, original.receiptNo);
  });
});
