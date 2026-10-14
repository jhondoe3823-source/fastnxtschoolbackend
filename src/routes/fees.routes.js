/**
 * Fees routes — particulars, structure, discounts, invoices.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const feeController = require('../controllers/fees/fee.controller');

const router = express.Router();

router.use(requireAuth);

// Particulars
router.get('/particulars', feeController.listParticulars);
router.post('/particulars', feeController.createParticular);
router.patch('/particulars/:id', feeController.updateParticular);
router.delete('/particulars/:id', feeController.deleteParticular);

// Structure
router.get('/structure', feeController.listStructure);
router.post('/structure', feeController.createStructureLine);
router.post('/structure/copy', feeController.copyStructure);
router.delete('/structure/:id', feeController.deleteStructureLine);

// Discount types
router.get('/discounts', feeController.listDiscounts);
router.post('/discounts', feeController.createDiscount);
router.patch('/discounts/:id', feeController.updateDiscount);
router.delete('/discounts/:id', feeController.deleteDiscount);

// Editable voucher layout (Settings → Fee Voucher)
router.get('/voucher-template', feeController.getVoucherTemplate);
router.patch('/voucher-template', feeController.updateVoucherTemplate);

// Fee payments / receipts (immutable payment history)
router.get('/payments/me', feeController.listMyPayments);
router.get('/payments', feeController.listPayments);
router.get('/payments/:id', feeController.getPayment);
router.get('/payments/:id/receipt', feeController.getReceipt);
router.post('/payments/:id/reprint', feeController.reprintReceipt);

// Invoices
router.get('/invoices', feeController.listInvoices);
router.post('/invoices', feeController.createInvoice);
router.patch('/invoices/:id', feeController.updateInvoice);
router.post('/invoices/:id/pay', feeController.recordPayment);
router.get('/invoices/:id/payments', feeController.listInvoicePayments);
router.delete('/invoices/:id', feeController.deleteInvoice);

module.exports = router;
