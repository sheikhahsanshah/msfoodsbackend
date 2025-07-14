import mongoose from "mongoose"
const AdSchema = new mongoose.Schema({
    title: String,
    text: String,
    startDate: {
        type: Date,
        default: Date.now,
    },
    endDate: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
    },
    mobileImage: String,
    desktopImage: String,
    location: {
        type: String,
        required: true,
        enum: ["header", "sidebar", "footer"],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
})

export default mongoose.model("Ad", AdSchema)
