// routes/heroRoutes.js
import express from 'express';
import { uploadFields } from '../config/cloudinary.js';
import { uploadHeroImages, getHeroImage, deleteHeroImage } from '../controllers/heroController.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', protect, admin, uploadFields, uploadHeroImages);
router.get('/', getHeroImage);
router.delete('/:id', protect, admin, deleteHeroImage);

export default router;
