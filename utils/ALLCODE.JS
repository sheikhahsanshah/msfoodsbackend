import session from 'express-session';
import transporter from './config/email.js';
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
import adminUserRoutes from './routes/adminUserRoutes.js';;
import { sendContactEmail } from './controllers/contactController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// CORS Configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: 'alyhusnaiin@gmail.com',
            subject: 'Test Email',
            text: 'This is a working test email',
        });
        res.send('✅ Test email sent successfully');
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

import express from 'express';
import { upload } from '../config/cloudinary.js';
import {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
} from '../controllers/categoryController.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', protect, admin, upload, createCategory);
router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.put('/:id', protect, admin, upload, updateCategory);
router.delete('/:id', protect, admin, deleteCategory);

export default router;
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        description: String,
        isActive: {
            type: Boolean,
            default: true,
        },
        images: [
            {
                public_id: {
                    type: String,
                    required: true,
                },
                url: {
                    type: String,
                    required: true,
                },
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.model('Category', categorySchema);
import Category from '../models/category.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

// CREATE a new category (Admin only)

// CREATE a new category with images (Admin only)
export const createCategory = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;

        // Process uploaded images
        const images = req.files.map((file) => ({
            public_id: file.filename,
            url: file.path,
        }));

        const category = new Category({ name, description, isActive, images });
        await category.save();

        res.status(201).json({ message: 'Category created successfully', category });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


// READ all categories
export const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// READ a single category by ID
export const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// UPDATE a category (Admin only)
export const updateCategory = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        const category = await Category.findById(req.params.id);

        if (!category) return res.status(404).json({ error: 'Category not found' });

        // If new images are uploaded, delete old images from Cloudinary
        if (req.files.length > 0) {
            for (let img of category.images) {
                await deleteFromCloudinary(img.public_id);
            }

            category.images = req.files.map((file) => ({
                public_id: file.filename,
                url: file.path,
            }));
        }

        category.name = name || category.name;
        category.description = description || category.description;
        category.isActive = isActive !== undefined ? isActive : category.isActive;

        await category.save();
        res.json({ message: 'Category updated successfully', category });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


// DELETE a category (Admin only)
export const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        // Delete images from Cloudinary
        for (let img of category.images) {
            await deleteFromCloudinary(img.public_id);
        }

        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Storage Configuration for Multiple Images
const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        // Ensure that only valid image formats are uploaded (png, jpeg, jpg)
        const allowedFormats = ['image/jpeg', 'image/png', 'image/jpg'];
        const fileFormat = file.mimetype;

        if (!allowedFormats.includes(fileFormat)) {
            throw new Error("Only JPEG, PNG, or JPG images are allowed!");
        }

        return {
            folder: "products",  // Folder in Cloudinary where images will be stored
            format: fileFormat.split("/")[1], // Automatically detects format based on MIME type
            public_id: `${file.originalname.split(".")[0]}_${Date.now()}`, // Ensure unique public ID
        };
    },
});

// Multer Middleware for Multiple Images
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit file size to 5MB per image
    },
}).array("images", 10); // Handle up to 10 images

// Generic delete function
const deleteFromCloudinary = async (publicId) => {
    await cloudinary.uploader.destroy(publicId);
};

export { upload, cloudinary, deleteFromCloudinary };