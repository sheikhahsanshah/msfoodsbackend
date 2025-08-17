import transporter from '../config/email.js';


export const sendEmail = async (options) => {
    console.log('Sending to:', options.email);
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: options.email,
            subject: options.subject,
            html: options.html
        });
        console.log('✅ Email sent:', info.messageId);
        return info;
    } catch (err) {
        console.error('❌ Failed to send email:', err.message);
        throw new Error('Failed to send email');
    }
};