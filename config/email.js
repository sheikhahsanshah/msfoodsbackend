import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

let resend;

try {
    if (!process.env.RESEND_API_KEY) {
        console.warn('⚠️  RESEND_API_KEY not found in environment variables');
        console.warn('📧 Email functionality will be disabled');
        resend = null;
    } else {
        resend = new Resend(process.env.RESEND_API_KEY);
        console.log('✅ Resend initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize Resend:', error.message);
    resend = null;
}

// Verify connection
const verifyConnection = async () => {
    if (!resend) {
        console.warn('⚠️  Resend not initialized - skipping connection test');
        return;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'contact@msfoods.pk',
            to: ['alyhusnaiin@gmail.com'],
            subject: 'Test Email - MS Foods',
            html: '<p>This is a test email to verify Resend connection for MS Foods.</p>',
        });

        if (error) {
            console.error('❌ Resend connection error:', error);
        } else {
            console.log('✅ Resend connected successfully');
        }
    } catch (error) {
        console.error('❌ Resend connection error:', error);
    }
};

// Only run verification in development
if (process.env.NODE_ENV === 'development' && resend) {
    verifyConnection();
}

export default resend;