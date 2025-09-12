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
        min: [0, 't cannot be negative']
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
        max: 100, // Maximum 100% discount to prevent negative prices
        default: null,
        validate: {
            validator: function (value) {
                // Ensure sale percentage doesn't exceed 100%
                return value === null || (value >= 0 && value <= 100);
            },
            message: 'Sale percentage must be between 0 and 100'
        }
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

// Virtual field for calculated price options with global sale applied
productSchema.virtual('calculatedPriceOptions').get(function () {
    try {
        // If no global sale, return original price options
        if (!this.sale || this.sale <= 0 || !this.priceOptions) {
            return this.priceOptions;
        }

        // Validate sale percentage to prevent financial errors
        if (this.sale > 100) {
            console.error(`⚠️ CRITICAL: Invalid sale percentage ${this.sale}% for product ${this._id}. Using original prices.`);
            return this.priceOptions;
        }

        // Calculate sale prices safely
        return this.priceOptions.map(option => {
            try {
                // Validate original price
                if (!option.price || option.price < 0) {
                    console.error(`⚠️ CRITICAL: Invalid price ${option.price} for product ${this._id}. Skipping sale calculation.`);
                    return option;
                }

                // If individual sale price exists, use it (takes precedence over global sale)
                if (option.salePrice !== null && option.salePrice !== undefined) {
                    // Still add the fields for consistency, but use individual sale price
                    return {
                        ...option.toObject(),
                        calculatedSalePrice: option.salePrice, // Use individual sale price
                        originalPrice: option.price, // Keep original price for reference
                        globalSalePercentage: null // No global sale applied
                    };
                }

                // Calculate global sale price with safety checks
                const discountMultiplier = (100 - this.sale) / 100;
                const calculatedSalePrice = Math.round(option.price * discountMultiplier * 100) / 100; // Round to 2 decimal places

                // Validate calculated sale price
                if (calculatedSalePrice < 0) {
                    console.error(`⚠️ CRITICAL: Calculated negative sale price ${calculatedSalePrice} for product ${this._id}. Using original price.`);
                    return option;
                }

                if (calculatedSalePrice > option.price) {
                    console.error(`⚠️ CRITICAL: Calculated sale price ${calculatedSalePrice} > original price ${option.price} for product ${this._id}. Using original price.`);
                    return option;
                }

                // Only set calculatedSalePrice if there's actually a meaningful discount
                // Check if the discount is at least 1% of the original price to avoid showing sale for negligible discounts
                const actualDiscount = option.price - calculatedSalePrice;
                const discountPercentage = (actualDiscount / option.price) * 100;
                
                if (discountPercentage < 1) {
                    // Discount is too small, don't show as sale
                    return option;
                }

                // Return option with calculated sale price
                return {
                    ...option.toObject(),
                    calculatedSalePrice: calculatedSalePrice,
                    originalPrice: option.price, // Keep original price for reference
                    globalSalePercentage: this.sale
                };

            } catch (error) {
                console.error(`⚠️ CRITICAL: Error calculating sale price for product ${this._id}:`, error);
                return option; // Return original option on error
            }
        });

    } catch (error) {
        console.error(`⚠️ CRITICAL: Error in calculatedPriceOptions virtual for product ${this._id}:`, error);
        return this.priceOptions; // Return original price options on error
    }
});

// Virtual field to check if product has any active sales
productSchema.virtual('hasActiveSales').get(function () {
    try {
        // Check global sale - only if it's meaningful (at least 1%)
        if (this.sale && this.sale > 0 && this.sale <= 100) {
            // For global sales, we need to check if they result in meaningful discounts
            if (this.priceOptions && this.priceOptions.length > 0) {
                // Check if any price option would have a meaningful discount
                const hasMeaningfulGlobalSale = this.priceOptions.some(option => {
                    if (!option.price || option.price <= 0) return false;
                    
                    // Skip if individual sale price exists
                    if (option.salePrice !== null && option.salePrice !== undefined) return false;
                    
                    const discountMultiplier = (100 - this.sale) / 100;
                    const calculatedSalePrice = Math.round(option.price * discountMultiplier * 100) / 100;
                    const actualDiscount = option.price - calculatedSalePrice;
                    const discountPercentage = (actualDiscount / option.price) * 100;
                    
                    return discountPercentage >= 1; // At least 1% discount
                });
                
                if (hasMeaningfulGlobalSale) return true;
            }
        }

        // Check individual price option sales
        if (this.priceOptions && this.priceOptions.length > 0) {
            return this.priceOptions.some(option =>
                option.salePrice !== null &&
                option.salePrice !== undefined &&
                option.salePrice > 0 &&
                option.salePrice < option.price // Ensure it's actually a discount
            );
        }

        return false;
    } catch (error) {
        console.error(`⚠️ CRITICAL: Error checking active sales for product ${this._id}:`, error);
        return false; // Default to no sales on error
    }
});

// Virtual field for the lowest price (considering sales)
productSchema.virtual('lowestPrice').get(function () {
    try {
        if (!this.priceOptions || this.priceOptions.length === 0) {
            return null;
        }

        let lowestPrice = null;

        this.priceOptions.forEach(option => {
            try {
                let currentPrice = option.price;

                // Check individual sale price first
                if (option.salePrice !== null && option.salePrice !== undefined && option.salePrice > 0) {
                    currentPrice = Math.min(currentPrice, option.salePrice);
                }

                // Check global sale price
                if (this.sale && this.sale > 0 && this.sale <= 100) {
                    const globalSalePrice = Math.round(option.price * (100 - this.sale) / 100 * 100) / 100;
                    if (globalSalePrice > 0 && globalSalePrice < currentPrice) {
                        currentPrice = globalSalePrice;
                    }
                }

                if (lowestPrice === null || currentPrice < lowestPrice) {
                    lowestPrice = currentPrice;
                }

            } catch (error) {
                console.error(`⚠️ CRITICAL: Error calculating price for option in product ${this._id}:`, error);
                // Continue with other options
            }
        });

        return lowestPrice;

    } catch (error) {
        console.error(`⚠️ CRITICAL: Error calculating lowest price for product ${this._id}:`, error);
        return null;
    }
});

// Create a text index on the 'name' and 'description' fields for search functionality
productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);
