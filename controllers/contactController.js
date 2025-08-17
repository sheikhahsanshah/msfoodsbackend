import { sendEmail } from '../utils/sendEmail.js';
import { generateContactFormEmail } from '../utils/emailTemplates.js';

export const sendContactEmail = async (req, res) => {
    const { name, email, subject, message, phone } = req.body;

    try {
        const html = generateContactFormEmail({ name, email, subject, message, phone });
        // Send to your support email or wherever you want to receive contact form submissions
        const recipient = 'support@irondize.com';
        await sendEmail({ email: recipient, subject: `Contact Form: ${subject}`, html });
        console.log('✅ Contact email sent successfully to', recipient);
        res.status(200).json({ success: true, message: 'Email sent successfully' });    
    } catch (error) {
        console.error('❌ Contact email error:', error);
        res.status(500).json({ success: false, message: 'Error sending email' });
    }
};