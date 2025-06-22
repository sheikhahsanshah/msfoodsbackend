import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { handleResponse, handleError } from '../utils/responseHandler.js';

// @desc    Create new coupon
// @route   POST /api/coupons
// @access  Admin
export const createCoupon = async (req, res) => {
    try {
        const {
            code, discountType, discountValue, minPurchase, maxPurchase,
            maxUses, singleUse, totalCoupons, startAt, expiresAt, eligibleUsers, eligibleProducts
        } = req.body;

        if (discountType === 'percentage' && discountValue > 100) {
            return handleError(res, 400, 'Percentage discount cannot exceed 100%');
        }

        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return handleError(res, 400, 'Coupon code already exists');
        }

        const coupon = await Coupon.create({
            code: code.toUpperCase(),
            discountType,
            discountValue,
            minPurchase: minPurchase || 0,
            maxPurchase: maxPurchase || null,
            maxUses: maxUses || null,
            singleUse: singleUse || false,
            totalCoupons: totalCoupons || null,
            startAt: startAt ? new Date(startAt) : new Date(),
            expiresAt: new Date(expiresAt),
            isActive: true,
            usedCoupons: 0,
            eligibleUsers: eligibleUsers || [],
            eligibleProducts: eligibleProducts || [],
            usedBy: []
        });

        const allCoupons = await Coupon.find().sort({ createdAt: -1 });
        handleResponse(res, 201, 'Coupon created successfully', allCoupons);

    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Get active coupons
// @route   GET /api/coupons
// @access  Public
export const getActiveCoupons = async (req, res) => {
    try {
        const currentDate = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            expiresAt: { $gt: currentDate },
            $or: [{ maxUses: { $exists: false } }, { maxUses: { $gt: 0 } }]
        }).select('-usedBy -isActive');

        handleResponse(res, 200, 'Active coupons retrieved', coupons);
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Get all coupons (Admin View)
// @route   GET /api/coupons/all
// @access  Admin
export const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        handleResponse(res, 200, 'All coupons retrieved', coupons);
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Validate coupon
// @route   POST /api/coupons/validate
// @access  Private
export const validateCoupon = async (req, res) => {
    try {
        const { code, cartTotal, items } = req.body;
        const userId = req.user._id;
        const currentTime = new Date();

        const coupon = await Coupon.findOne({ code: code.toUpperCase() })
            .populate('eligibleUsers eligibleProducts')
            .lean();

        if (!coupon || !coupon.isActive) {
            return handleError(res, 404, 'Invalid coupon code');
        }

        if (currentTime < coupon.startAt) {
            return handleError(res, 400, 'Coupon is not live yet');
        }

        if (currentTime > coupon.expiresAt) {
            return handleError(res, 400, 'Coupon has expired');
        }

        if (cartTotal < coupon.minPurchase) {
            return handleError(res, 400, `Minimum purchase of Rs${coupon.minPurchase} required`);
        }

        if (coupon.maxPurchase && cartTotal > coupon.maxPurchase) {
            return handleError(res, 400, `Maximum purchase allowed is Rs${coupon.maxPurchase}`);
        }

        if (coupon.usedCoupons >= coupon.totalCoupons) {
            return handleError(res, 400, 'Coupon usage limit reached');
        }

        if (coupon.eligibleUsers && coupon.eligibleUsers.length > 0) {
            const isEligible = coupon.eligibleUsers.some(userIdObj =>
                userIdObj._id.toString() === userId.toString()
            );
            if (!isEligible) {
                return handleError(res, 403, 'This coupon is not available for your account');
            }
        }

        // Check product eligibility and calculate eligible subtotal
        let eligibleItems = [];
        let eligibleSubtotal = 0;

        if (coupon.eligibleProducts && coupon.eligibleProducts.length > 0) {
            // Specific products coupon
            if (!items || items.length === 0) {
                return handleError(res, 400, 'No items in cart to validate against eligible products');
            }

            // Filter items that are eligible for this coupon
            eligibleItems = items.filter(item =>
                coupon.eligibleProducts.some(p => p._id.toString() === item.productId.toString())
            );

            if (eligibleItems.length === 0) {
                return handleError(res, 400, 'Coupon not valid for these products');
            }

            // Calculate subtotal for eligible products only
            eligibleSubtotal = eligibleItems.reduce((total, item) => {
                const itemPrice = item.price || 0;
                return total + (itemPrice * item.quantity);
            }, 0);

        } else {
            // All products coupon
            eligibleItems = items;
            eligibleSubtotal = cartTotal;
        }

        const userUsage = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
        if (userUsage && userUsage.timesUsed >= (coupon.maxUsesPerUser || 1)) {
            return handleError(res, 400, 'Coupon usage limit reached for this user');
        }

        // Calculate discount based on eligible subtotal only
        let discount = coupon.discountType === 'percentage'
            ? eligibleSubtotal * (coupon.discountValue / 100)
            : coupon.discountValue;

        discount = Math.min(discount, eligibleSubtotal);

        console.log('Coupon validation details:', {
            couponCode: coupon.code,
            eligibleItems: eligibleItems.length,
            eligibleSubtotal,
            cartTotal,
            discount,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue
        });

        handleResponse(res, 200, 'Coupon is valid', {
            valid: true,
            discount: Number(discount.toFixed(2)),
            discountType: coupon.discountType,
            code: coupon.code,
            eligibleItems: eligibleItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                name: item.name
            })),
            eligibleSubtotal: Number(eligibleSubtotal.toFixed(2))
        });

    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Update coupon
// @route   PUT /api/coupons/:code
// @access  Admin
export const updateCoupon = async (req, res) => {
    try {
        const { code } = req.params;
        const updates = req.body;

        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return handleError(res, 404, 'Coupon not found');
        }

        if (updates.code && updates.code !== coupon.code) {
            return handleError(res, 400, 'Coupon code cannot be changed');
        }

        if (updates.discountValue && coupon.discountType === 'percentage' && updates.discountValue > 100) {
            return handleError(res, 400, 'Percentage discount cannot exceed 100%');
        }

        const allowedUpdates = [
            'discountValue', 'minPurchase', 'maxPurchase', 'maxUses', 'maxUsesPerUser',
            'singleUse', 'totalCoupons', 'startAt', 'expiresAt', 'isActive', 'eligibleUsers', 'eligibleProducts'
        ];

        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                // Ensure eligibleUsers updates properly
                if (key === "eligibleUsers" && Array.isArray(updates[key])) {
                    coupon.eligibleUsers = updates[key];  // 🔥 Explicitly setting array
                } else {
                    coupon[key] = updates[key];
                }
            }
        });

        console.log("coupons before save : ", coupon)


        await coupon.save();
        const updatedCoupons = await Coupon.find().sort({ createdAt: -1 });


        handleResponse(res, 200, 'Coupon updated successfully', updatedCoupons);

    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Delete coupon (soft delete)
// @route   DELETE /api/coupons/:code
// @access  Admin
export const deleteCoupon = async (req, res) => {
    try {
        const { code } = req.params;

        const coupon = await Coupon.findOneAndDelete({ code: code.toUpperCase() });


        if (!coupon) {
            return handleError(res, 404, 'Coupon not found');
        }

        const remainingCoupons = await Coupon.find().sort({ createdAt: -1 });
        handleResponse(res, 200, 'Coupon deactivated successfully', remainingCoupons);

    } catch (error) {
        handleError(res, 500, error.message);
    }
};
