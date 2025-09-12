import express from 'express';
import {
    orderController, verifyPayment
} from '../controllers/orderController.js';
import { protect, admin, optionalAuth  } from '../middlewares/auth.js';
import {  uploadPaymentProof } from '../config/cloudinary.js';

const router = express.Router();

router.post('/', optionalAuth, uploadPaymentProof,   orderController.createOrder);
router.get('/my-orders', protect, orderController.getUserOrders);
router.get('/:id', protect, orderController.getOrderById);


router.get('/sales',  orderController.getSalesStats);
router.post('/notify', orderController.handlePayfastNotification);
router.get('/', protect, admin, orderController.getAllOrders);
router.put('/:id/status', protect, admin, orderController.updateOrderStatus);
router.put('/:id/verify-payment', protect, admin, verifyPayment);
// router.post('/create-payment-intent', protect, createPaymentIntent);

export default router;      