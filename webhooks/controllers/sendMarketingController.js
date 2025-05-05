import User from '../../models/User.js';
import { sendMarketingMessage } from '../services/whatsappMessageService.js';

const BATCH_SIZE = 10; // Adjust the batch size based on rate limits or your own preference

export const sendMarketingToWhatsAppUsers = async (req, res) => {
        const { message } = req.body;
        console.log("message aa gia",message);
    try {
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message content is required' });
        }

        // Get users who replied
        const users = await User.find({ hasRepliedOnWhatsApp: true });

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'No users to send marketing message' });
        }

        let allResults = [];

        // Process the users in batches
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(async (user) => {
                    if (user.phone) {
                        try {
                            const phoneNumber = user.phone.replace('+', '');
                            await sendMarketingMessage(phoneNumber, message);
                            return { userId: user._id, status: 'success' };
                        } catch (error) {
                            return { userId: user._id, status: 'failed' };
                        }
                    }
                })
            );
            allResults = [...allResults, ...batchResults];
        }

        res.status(200).json({
            success: true,
            totalUsers: users.length,
            results: allResults.filter((result) => result !== undefined), // Filter out undefined results
        });
    } catch (error) {
        console.error('❌ Error sending marketing:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

