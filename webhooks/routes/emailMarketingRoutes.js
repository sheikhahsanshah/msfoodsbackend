import express from 'express';
import {
    sendMarketingEmail,
    getEmailMarketingStats,
    getUsersForEmailMarketing
} from '../controllers/emailMarketingController.js';
import { protect, admin } from '../../middlewares/auth.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

// Send marketing email
router.post('/send', sendMarketingEmail);

// Get email marketing statistics
router.get('/stats', getEmailMarketingStats);

// Get users for email marketing (with pagination and filters)
router.get('/users', getUsersForEmailMarketing);

export default router; 