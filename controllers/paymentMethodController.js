import PaymentMethod from '../models/PaymentMethod.js';
import asyncHandler from 'express-async-handler';

// @desc   Create new bank account
// @route  POST /api/payment-methods
// @access Admin
export const createPaymentMethod = asyncHandler(async (req, res) => {
    const { name, accountNumber, ownerName } = req.body;
    const pm = await PaymentMethod.create({ name, accountNumber, ownerName });
    res.status(201).json(pm);
});

// @desc   Get all (admin) or only active (user) methods
// @route  GET /api/payment-methods
// @access Public
export const getPaymentMethods = asyncHandler(async (req, res) => {
    const filter = req.user?.role === 'admin'
        ? {}
        : { isActive: true };
    const list = await PaymentMethod.find(filter).sort('name');
    res.json(list);
});

// @desc   Update a bank account
// @route  PUT /api/payment-methods/:id
// @access Admin
export const updatePaymentMethod = asyncHandler(async (req, res) => {
    const pm = await PaymentMethod.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pm) res.status(404).throw(new Error('Not found'));
    res.json(pm);
});

// @desc   Delete (soft or hard) a bank account
// @route  DELETE /api/payment-methods/:id
// @access Admin
export const deletePaymentMethod = asyncHandler(async (req, res) => {
    const pm = await PaymentMethod.findById(req.params.id);
    if (!pm) return res.status(404).json({ message: 'Not found' });
    await pm.remove();
    res.json({ message: 'Removed' });
});
