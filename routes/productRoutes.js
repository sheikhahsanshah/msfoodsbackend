import express from 'express';
import {
    getAllProducts,
    searchProducts,
    getProductById,
    getRecentProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductsByCategories,
    getProductsByMultipleCategories
} from '../controllers/productController.js';
import { protect, admin } from '../middlewares/auth.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

router.get('/', getAllProducts);
router.get('/recent', getRecentProducts);
router.get('/categories/:categoryId', getProductsByCategories);
router.get('/by-categories', getProductsByMultipleCategories);

router.get('/search', searchProducts);
router.get('/:id', getProductById);

router.post(
    '/',
    protect,
    admin,
    upload, // Handle image uploads
    createProduct
);
router.put(
    '/:id',
    protect,
    admin,
    upload, // Handle image updates
    updateProduct
);
router.delete('/:id', protect, admin, deleteProduct);

export default router;