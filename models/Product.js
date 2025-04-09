import mongoose from 'mongoose';

const priceOptionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['packet', 'weight-based'], // Defines if it's a fixed packet price or per specific weight
        required: true
    },
    weight: {
        type: Number, // Weight in grams (e.g., 100, 500)
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    salePrice: {
        type: Number,
        min: 0,
        default: null
    }
});

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter product name'],
        trim: true,
        maxlength: [120, 'Product name cannot exceed 120 characters']
    },
    description: {
        type: String,
        required: [true, 'Please enter product description']
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    stock: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Stock cannot be negative']
    },
    images: [{
        public_id: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        }
    }],
    ratings: {
        type: Number,
        default: 0
    },
    numOfReviews: {
        type: Number,
        default: 0
    },
    slug: String,
    priceOptions: [priceOptionSchema], // Array of packet or weight-based pricing
    sale: {
        type: Number,
        min: 0,
        default: null
    } // Global sale on product
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual populate reviews
productSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'product'
});

// Create a text index on the 'name' and 'description' fields for search functionality
productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);
