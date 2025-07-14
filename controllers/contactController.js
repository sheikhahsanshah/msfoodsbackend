import resend from '../config/email.js';
import { generateContactFormEmail } from '../utils/emailTemplates.js';

export const sendContactEmail = async (req, res) => {
    const { name, email, subject, message, phone } = req.body;

    if (!resend) {
        console.warn('⚠️  Contact email not sent: Resend not initialized');
        return res.status(200).json({
            success: true,
            message: 'Contact form received (email service unavailable)'
        });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: [process.env.EMAIL_USER || 'alyhusnaiin@gmail.com'],
            subject: `Contact Form: ${subject}`,
            html: generateContactFormEmail({ name, email, subject, message, phone }),
        });

        if (error) {
            console.error('❌ Contact email error:', error);
            res.status(500).json({ success: false, message: 'Error sending email' });
        } else {
            console.log('✅ Contact email sent successfully:', data);
            res.status(200).json({ success: true, message: 'Email sent successfully' });
        }
    } catch (error) {
        console.error('❌ Contact email error:', error);
        res.status(500).json({ success: false, message: 'Error sending email' });
    }
};