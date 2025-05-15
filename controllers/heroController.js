// controllers/heroController.js
import HeroImage from '../models/HeroImage.js';
import { deleteFromCloudinary } from '../config/cloudinary.js'; // or wherever your helper is

// Upload hero image
export const uploadHeroImages = async (req, res) => {
    try {
        const mobile = req.files?.mobileImage?.[0];
        const desktop = req.files?.desktopImage?.[0];

        if (!mobile || !desktop) {
            return res.status(400).json({ success: false, message: 'Both images are required' });
        }

        const newHero = await HeroImage.create({
            mobileImage: {
                url: mobile.path,
                public_id: mobile.filename
            },
            desktopImage: {
                url: desktop.path,
                public_id: desktop.filename
            }
        });

        res.status(201).json({ success: true, data: newHero });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get active hero image
export const getHeroImage = async (req, res) => {
    try {
        const hero = await HeroImage.findOne({ isActive: true }).sort({ createdAt: -1 });

        if (!hero) {
            return res.status(404).json({ success: false, message: 'No hero image found' });
        }

        res.status(200).json({ success: true, data: hero });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Optionally deactivate/delete older ones
export const deleteHeroImage = async (req, res) => {
    try {
        const hero = await HeroImage.findById(req.params.id);

        if (!hero) return res.status(404).json({ success: false, message: 'Hero image not found' });

        // Delete from Cloudinary
        await deleteFromCloudinary(hero.desktopImage.public_id);
        await deleteFromCloudinary(hero.mobileImage.public_id);

        await hero.deleteOne();

        res.status(200).json({ success: true, message: 'Hero image deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update hero image
