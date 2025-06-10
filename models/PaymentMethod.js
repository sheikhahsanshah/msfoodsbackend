import mongoose from 'mongoose';

const paymentMethodSchema = new mongoose.Schema({
    name: {                // e.g. "MS Foods – UBL"
        type: String,
        required: true,
        trim: true
    },
    accountNumber: {
        type: String,
        required: true
    },
    ownerName: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export default mongoose.model('PaymentMethod', paymentMethodSchema);