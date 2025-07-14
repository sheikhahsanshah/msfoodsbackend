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




export default resend;