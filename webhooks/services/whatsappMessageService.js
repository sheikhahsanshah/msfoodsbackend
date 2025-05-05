import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0/YOUR_PHONE_NUMBER_ID/messages'; // Change v19.0 if needed
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; // Your permanent token

// Send message to one number
// Send template message to one number
export const sendMarketingMessage = async (phoneNumber, message) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'template',
                template: {
                    name: 'your_template_name', // Template name
                    language: { code: 'en_US' }, // Language code
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                {
                                    type: 'text',
                                    text: message, // dynamic content in your template
                                },
                            ],
                        },
                    ],
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send message to', phoneNumber, error.response?.data || error.message);
        throw error;
    }
};
