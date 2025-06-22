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
            default: 2000,    // new!
        },
        codFee: {
            type: Number,
            required: true,
            default: 100,     // COD fee default
        },
    },
    { timestamps: true }
);

const Settings =
    mongoose.models.Settings ||
    mongoose.model("Settings", settingsSchema);

export default Settings;
