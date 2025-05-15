// models/HeroImage.js
import mongoose from 'mongoose';

const heroImageSchema = new mongoose.Schema({
    desktopImage: {
        url: String,
        public_id: String
    },
    mobileImage: {
        url: String,
        public_id: String
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export default mongoose.model('HeroImage', heroImageSchema);
