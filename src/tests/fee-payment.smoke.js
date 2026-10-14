/**
 * Live smoke against local API + DB (optional).
 * Run with backend up: node src/tests/fee-payment.smoke.js
 *
 * Uses a unique email each run. Does not leave demo UI data on the frontend.
 */

const BASE = process.env.SMOKE_API_URL || 'http://localhost:5000/api';

async function req(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const stamp = Date.now();
  const email = `smoke-fee-${stamp}@example.com`;
  const password = 'SmokePass123!';

  console.log('1) Register school…');
  const reg = await req('/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      name: 'Smoke Admin',
      schoolName: `Smoke School ${stamp}`,
      ownerName: 'Smoke Owner',
    },
  });
  assert(reg.json.success, `register failed: ${reg.json.message}`);
  const token = reg.json.data.token;
  assert(token, 'missing token');

  console.log('2) Ensure chart of accounts…');
  await req('/accounts/chart/seed', { method: 'POST', token });

  console.log('3) Create student…');
  const st = await req('/students', {
    method: 'POST',
    token,
    body: {
      name: 'Smoke Student',
      cls: 'Grade 1',
      section: 'A',
      session: '2025-2026',
      admissionNo: `ADM-SMOKE-${stamp}`,
      studentId: `STD-SMOKE-${stamp}`,
      status: 'Active',
    },
  });
  assert(st.json.success, `student create failed: ${st.json.message}`);
  const studentId = st.json.data.student.id;

  console.log('4) Create fee particular + structure…');
  const part = await req('/fees/particulars', {
    method: 'POST',
    token,
    body: { particular: 'Tuition Fee', amount: 5000, frequency: 'Monthly', status: 'Active' },
  });
  assert(part.json.success, `particular failed: ${part.json.message}`);
  const structure = await req('/fees/structure', {
    method: 'POST',
    token,
    body: {
      session: '2025-2026',
      cls: 'Grade 1',
      section: 'A',
      particularId: part.json.data.particular.id,
      amount: 5000,
      frequency: 'Monthly',
    },
  });
  assert(structure.json.success, `structure failed: ${structure.json.message}`);

  console.log('5) Create invoice…');
  const inv = await req('/fees/invoices', {
    method: 'POST',
    token,
    body: {
      studentId,
      session: '2025-2026',
      period: 'Oct 2026',
      useStructure: true,
    },
  });
  assert(inv.json.success, `invoice failed: ${inv.json.message}`);
  const invoiceId = inv.json.data.invoice.id;
  assert(inv.json.data.invoice.balance > 0, 'invoice balance should be > 0');

  console.log('6) Partial payment…');
  const key1 = `smoke-${stamp}-p1`;
  const pay1 = await req(`/fees/invoices/${invoiceId}/pay`, {
    method: 'POST',
    token,
    body: { amount: 2000, method: 'Cash', idempotencyKey: key1 },
  });
  assert(pay1.json.success, `partial pay failed: ${pay1.json.message}`);
  assert(pay1.json.data.payment.receiptNo, 'missing receiptNo');
  assert(pay1.json.data.payment.status === 'PARTIAL PAYMENT', 'expected PARTIAL PAYMENT');
  assert(pay1.json.data.invoice.status === 'Partially Paid', 'invoice should be Partially Paid');
  const receiptNo = pay1.json.data.payment.receiptNo;
  const paymentId = pay1.json.data.payment.id;

  console.log('7) Idempotent retry…');
  const pay1b = await req(`/fees/invoices/${invoiceId}/pay`, {
    method: 'POST',
    token,
    body: { amount: 2000, method: 'Cash', idempotencyKey: key1 },
  });
  assert(pay1b.json.success, `idempotent retry failed: ${pay1b.json.message}`);
  assert(pay1b.json.data.idempotent === true, 'expected idempotent true');
  assert(pay1b.json.data.payment.id === paymentId, 'idempotent should return same payment');

  console.log('8) Overpayment rejected…');
  const over = await req(`/fees/invoices/${invoiceId}/pay`, {
    method: 'POST',
    token,
    body: { amount: 999999, method: 'Cash', idempotencyKey: `smoke-${stamp}-over` },
  });
  assert(!over.json.success, 'overpayment should fail');

  console.log('9) Full remaining payment via receivables…');
  const remaining = pay1.json.data.invoice.balance;
  const pay2 = await req(`/accounts/receivables/${invoiceId}/pay`, {
    method: 'POST',
    token,
    body: { amount: remaining, method: 'Cash', idempotencyKey: `smoke-${stamp}-p2` },
  });
  assert(pay2.json.success, `full pay failed: ${pay2.json.message}`);
  assert(pay2.json.data.payment.status === 'PAID', 'expected PAID');
  assert(pay2.json.data.invoice.balance === 0, 'balance should be 0');

  console.log('10) Reprint duplicate…');
  const reprint = await req(`/fees/payments/${paymentId}/reprint`, { method: 'POST', token, body: {} });
  assert(reprint.json.success, `reprint failed: ${reprint.json.message}`);
  assert(reprint.json.data.receipt.duplicate === true, 'duplicate flag missing');
  assert(reprint.json.data.receipt.receiptNo === receiptNo, 'receiptNo must not change on reprint');

  console.log('11) List payments search…');
  const list = await req(`/fees/payments?q=${encodeURIComponent(receiptNo)}`, { token });
  assert(list.json.success, `list failed: ${list.json.message}`);
  assert((list.json.data.payments || []).some((p) => p.id === paymentId), 'payment not found in list');

  console.log('✅ Fee payment smoke passed.');
}

main().catch((err) => {
  console.error('❌ Smoke failed:', err.message);
  process.exit(1);
});
