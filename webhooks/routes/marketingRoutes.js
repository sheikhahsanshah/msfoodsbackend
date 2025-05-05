import express from 'express';
import { sendMarketingToWhatsAppUsers } from '../controllers/sendMarketingController.js';

const router = express.Router();

// POST /webhook/marketing
router.post('/', sendMarketingToWhatsAppUsers);

export default router;
 