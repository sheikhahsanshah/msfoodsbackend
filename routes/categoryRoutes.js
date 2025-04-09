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
