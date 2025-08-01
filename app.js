import session from 'express-session';
import resend from './config/email.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { errorHandler } from './middlewares/error.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import heroRoutes from './routes/heroRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';;
import { sendContactEmail } from './controllers/contactController.js';
import whatsappWebhookRoutes from './webhooks/routes/whatsappWebhookRoutes.js';
import marketingRoutes from './webhooks/routes/marketingRoutes.js';
import emailMarketingRoutes from './webhooks/routes/emailMarketingRoutes.js';
import adRoutes from './routes/adRoutes.js';
import payfastRouter from './routes/payfast.js'
import paymentMethodRoutes from './routes/paymentMethodRoutes.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS Configuration
const allowedOrigins = [
    'https://msfoods.vercel.app',
    'https://msfoods.pk',
    'https://www.msfoods.pk',
    'http://localhost:3000'
];

const corsOptions = {
    origin: allowedOrigins || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ],

};





// ✅ Parse JSON and URL-encoded data first
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

app.use(cors(corsOptions));

// Connect to MongoDB
connectDB();
// Middleware

app.use(cookieParser());


app.use(session({
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
    }
}));

// Example route to set a cookie
app.get('/set-cookie', (req, res) => {
    res.cookie('exampleCookie', 'cookieValue', {
        httpOnly: true,
        secure: false, // Set to false for development
        sameSite: 'Lax', // Set to Lax for development
    });
    res.send('Cookie set');
});

app.get('/', (req, res) => {
    res.send('CORS is configured correctly.');
});

// Serve static files (images, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/adminUser', adminUserRoutes);
app.use('/api/hero', heroRoutes);
app.use('/api/webhook', whatsappWebhookRoutes);
app.use('/api/webhook/marketing', marketingRoutes);
app.use('/api/webhook/email-marketing', emailMarketingRoutes);
app.use('/api/ad/', adRoutes);
app.post('/api/webhook/whatsapp', (req, res) => {
    console.log('Webhook received:', req.body);
    res.status(200).send('OK');
});
app.use('/api/payfast', payfastRouter)
app.use('/api/payment-methods', paymentMethodRoutes);
app.post('/api/send-email', sendContactEmail);

// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date(),
        uptime: process.uptime(),
    });
});

app.get('/api/test-email', async (req, res) => {
    if (!resend) {
        return res.status(500).send('❌ Email service not available - RESEND_API_KEY not set');
    }

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
            to: ['alyhusnaiin@gmail.com'],
            subject: 'Test Email',
            html: '<p>This is a working test email from Resend</p>',
        });

        if (error) {
            console.error('❌ Email error:', error);
            res.status(500).send('❌ Email sending failed');
        } else {
            console.log('✅ Test email sent successfully:', data);
            res.send('✅ Test email sent successfully');
        }
    } catch (error) {
        console.error('❌ Email error:', error);
        res.status(500).send('❌ Email sending failed');
    }
});

// Error Handling Middleware
app.use(errorHandler);

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/`);
});