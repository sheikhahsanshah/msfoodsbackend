import express from 'express';
import { protect, admin } from '../middlewares/auth.js';
import {
    createPaymentMethod,
    getPaymentMethods,
    updatePaymentMethod,
    deletePaymentMethod
} from '../controllers/paymentMethodController.js';

const router = express.Router();

router.route('/')
    .get(getPaymentMethods)
    .post(protect, admin, createPaymentMethod);

router.route('/:id')
    .put(protect, admin, updatePaymentMethod)
    .delete(protect, admin, deletePaymentMethod);

export default router;
