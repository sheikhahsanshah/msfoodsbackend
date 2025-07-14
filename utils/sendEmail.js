import resend from '../config/email.js';

export const sendEmail = async (options) => {
    if (!resend) {
        console.warn('⚠️  Email not sent: Resend not initialized');
        console.warn('📧 To enable emails, set RESEND_API_KEY in environment variables');
        return null;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'MS Foods <contact@msfoods.pk>',
            to: [options.email],
            subject: options.subject,
            html: options.html,
            text: options.text,
            headers: {
                'List-Unsubscribe': '<https://msfoods.pk/unsubscribe>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                'X-Priority': '3',
                'X-MSMail-Priority': 'Normal',
                'Importance': 'normal',
                'X-Mailer': 'MS Foods Email System'
            }
        });

        if (error) {
            console.error('❌ Email sending error:', error);
            throw new Error(`Email could not be sent: ${error.message}`);
        }

        console.log('✅ Email sent successfully:', data);
        return data;
    } catch (error) {
        console.error('❌ Email sending error:', error);
        throw new Error('Email could not be sent');
    }
};