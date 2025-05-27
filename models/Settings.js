// models/Settings.js
import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        shippingFee: {
            type: Number,
            required: true,
            default: 0,
        },
        freeShippingThreshold: {
            type: Number,
            required: true,
            default: 3000,    // new!
        },
    },
    { timestamps: true }
);

const Settings =
    mongoose.models.Settings ||
    mongoose.model("Settings", settingsSchema);

export default Settings;
