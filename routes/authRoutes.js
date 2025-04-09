import express from 'express';
import {
    signup,
    login,
    logout,
    verifyEmail,
    verifyPhone,
    forgotPassword,
    resetPassword,
    resendVerification,
    refreshToken,
    getMe
} from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/verify-email/:token', verifyEmail);
router.post('/verify-phone', verifyPhone);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-verification', resendVerification);
router.post('/refresh-token', refreshToken);
router.get('/me', protect, getMe);

export default router;