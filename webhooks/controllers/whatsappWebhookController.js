import User from '../../models/User.js'; // Adjust if your User model path is different

// VERIFY WEBHOOK (for Meta to verify)
export const verifyWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'abcZCbVYBOZC0ZC6qiZCR';

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ Webhook Verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
};

// HANDLE INCOMING MESSAGES
export const handleIncomingMessage = async (req, res) => {
    console.log('📩 Incoming webhook:', JSON.stringify(req.body, null, 2));

    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages?.[0];

        if (messages) {
            const phoneNumber = messages.from; // e.g., "923001234567"

            // Update user in database (if phone exists)
            await User.findOneAndUpdate(
                { phone: `+${phoneNumber}` }, // WhatsApp sends phone without +
                {
                    hasRepliedOnWhatsApp: true,
                    lastWhatsAppReply: new Date()
                },
                { new: true }
            );

            console.log(`✅ User with phone ${phoneNumber} marked as replied on WhatsApp`);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Webhook Handling Error:', error);
        res.sendStatus(500);
    }
};
