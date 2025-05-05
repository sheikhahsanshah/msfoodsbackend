import express from 'express';
import { verifyWebhook, handleIncomingMessage } from '../controllers/whatsappWebhookController.js';

const router = express.Router();

// Verification endpoint (GET)
router.get('/whatsapp', verifyWebhook);

// Incoming messages endpoint (POST)
router.post('/whatsapp', handleIncomingMessage);

export default router;
