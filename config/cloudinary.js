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
const upload = multer(
    
    {
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit file size to 5MB per image
    },
}).array("images", 10); // Handle up to 10 images


const uploadFields = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
    { name: 'mobileImage', maxCount: 1 },
    { name: 'desktopImage', maxCount: 1 },
]);

// Generic delete function
const deleteFromCloudinary = async (publicId) => {
    await cloudinary.uploader.destroy(publicId);
};


const paymentStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "order_proofs",
        format: async (req, file) => file.mimetype.split("/")[1],
        public_id: (req, file) =>
            `order_${req.user?._id || "guest"}_${Date.now()}`,
    },
});

export const uploadPaymentProof = multer({
    storage: paymentStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
}).single("paymentScreenshot");

export { upload, uploadFields, cloudinary, deleteFromCloudinary };