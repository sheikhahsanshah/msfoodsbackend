import express from 'express';
import { protect, admin } from '../middlewares/auth.js';
import {
    createAd,
    getAds,
    getAllAds,
    deleteAd,
    updateAd
} from '../controllers/adController.js';
import { uploadFields } from '../config/cloudinary.js';

const router = express.Router();

// Public routes (for displaying ads)
router.get('/:location', getAds);

// Admin protected routes

router.route('/')
    .post(protect, admin, uploadFields, createAd)
    .get( getAllAds);

router.route('/:id')
    .put(
        protect, admin,
        uploadFields,
        updateAd
    )
    .delete(protect, admin, deleteAd);

export default router;