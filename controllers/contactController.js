import transporter from '../config/email.js';

export const sendContactEmail = async (req, res) => {
    const { name, email, subject, message, phone } = req.body;

    const mailOptions = {
        // from: email,
        to: process.env.EMAIL_USER,
        subject: `Contact Form: ${subject}`,
        text: `Name: ${name}\nPhone: ${phone}\n Message: ${message}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error sending email' });
    }
};