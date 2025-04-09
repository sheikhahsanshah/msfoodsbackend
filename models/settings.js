import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        shippingFee: {
            type: Number,
            required: true,
            default: 0,
        },
    },
    { timestamps: true }
);

// Use the fallback to prevent redefinition during hot reloads
const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

export default Settings;
