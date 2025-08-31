// controllers/orderController.js
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { handleResponse, handleError } from '../utils/responseHandler.js';
import crypto from 'crypto';
import { sendEmail } from '../utils/sendEmail.js';
import { sendWhatsAppOrderUpdate } from '../utils/sendWhatsAppMessage.js';
import { generateOrderConfirmationEmail } from '../utils/emailTemplates.js';

export const orderController = {
    // Create new order with transaction
    createOrder: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1) Extract & parse body fields
            let { paymentMethod, couponCode } = req.body;
            let items = req.body.items;
            let shippingAddress = req.body.shippingAddress;

            // If sent as FormData, these arrive as strings → parse them
            if (typeof items === 'string') {
                items = JSON.parse(items);
            }
            if (typeof shippingAddress === 'string') {
                shippingAddress = JSON.parse(shippingAddress);
            }

            // 2) Validate shippingAddress
            const required = [
                'fullName', 'address', 'city', 'country', 'email', 'phone'
            ];
            const missing = required.filter(f => !shippingAddress[f]);
            if (missing.length) {
                await session.abortTransaction();
                return handleError(
                    res,
                    400,
                    `Missing shipping fields: ${missing.join(', ')}`
                );
            }

            // 3) Handle payment proof for BankTransfer
            let screenshotUrl = '';
            if (paymentMethod === 'BankTransfer') {
                // if you used .single('paymentScreenshot'):
                const proofFile = req.file
                    // or if you used .fields([...,'paymentScreenshot']):
                    || (req.files?.paymentScreenshot && req.files.paymentScreenshot[0]);

                if (!proofFile) {
                    await session.abortTransaction();
                    return handleError(
                        res,
                        400,
                        'Payment proof screenshot is required for bank transfer'
                    );
                }
                // CloudinaryStorage gives you .path or .url
                screenshotUrl = proofFile.path || proofFile.url;
            }

            // 4) Process items & compute subtotal
            const [orderItems, subtotal] = await processOrderItems(items, session);

            // 5) Compute shipping
            const settings = await Settings.findOne().session(session) || {};
            const fee = settings.shippingFee ?? 0;
            const threshold = settings.freeShippingThreshold ?? 2000;
            const shippingCost = subtotal > threshold ? 0 : fee;

            // 6) Compute COD fee
            const codFee = paymentMethod === 'COD' ? (settings.codFee ?? 100) : 0;

            // 7) Coupon validation (optional)
            let coupon = null;
            if (couponCode) {
                if (!req.user) {
                    await session.abortTransaction();
                    return handleError(res, 401, 'Authentication required for coupon use');
                }
                try {
                    coupon = await validateCoupon(
                        couponCode,
                        req.user._id,
                        subtotal,
                        orderItems,
                        session
                    );
                } catch (err) {
                    await session.abortTransaction();
                    return handleError(res, 400, err.message);
                }
            }

            // 8) Calculate totals
            const discount = calculateEligibleDiscount(coupon, orderItems);
            const totalAmount = calculateTotal(
                subtotal, shippingCost, discount, codFee
            );

            // 9) Create & save
            const order = new Order({
                user: req.user?._id,
                items: orderItems,
                subtotal,
                shippingCost,
                discount,
                codFee,
                totalAmount,
                shippingAddress,
                paymentMethod,
                paymentScreenshot: screenshotUrl,
                paymentStatus: paymentMethod === 'BankTransfer' ? 'Pending' : 'Confirmed',
                couponUsed: coupon?._id,
                status: 'Processing'
            });

            // If you still support PayFast:
            if (paymentMethod === 'PayFast') {
                order.status = 'Pending';
                order.paymentResult = generatePayfastPayload(order);
            }

            await order.save({ session });

            // 10) Update coupon usage
            if (coupon) {
                await updateCouponUsage(coupon, req.user._id, session);
            }

            await session.commitTransaction();

            // 11) Notify
            await sendStatusNotifications(order, 'Processing');

            return handleResponse(res, 201, 'Order created successfully', order);

        } catch (err) {
            await session.abortTransaction();
            return handleError(res, 500, err.message);
        } finally {
            session.endSession();
        }
    },

    // Get order by ID
    getOrderById: async (req, res) => {
        try {
            const order = await Order.findById(req.params.id)
                .populate({
                    path: 'user',
                    select: 'name email phone'
                })
                .populate({
                    path: 'items.product',
                    select: 'name images priceOptions'
                })
                .populate({
                    path: 'couponUsed',
                    select: 'code discountType discountValue eligibleProducts',
                    populate: {
                        path: 'eligibleProducts',
                        model: 'Product',
                        select: '_id name'
                    }
                });

            if (!order) return handleError(res, 404, 'Order not found');
            if (!authorizeOrderAccess(order, req.user)) return handleError(res, 403, 'Unauthorized');

            handleResponse(res, 200, 'Order retrieved', order);
        } catch (error) {
            handleError(res, 500, error.message);
        }
    },

    // Get user orders
    getUserOrders: async (req, res) => {
        try {
            const orders = await Order.find({ user: req.user._id })
                .sort('-createdAt')
                .populate('items.product', 'name images')
                .populate({
                    path: 'couponUsed',
                    select: 'code discountType discountValue eligibleProducts',
                    populate: {
                        path: 'eligibleProducts',
                        model: 'Product',
                        select: '_id name'
                    }
                });


            handleResponse(res, 200, 'Orders retrieved', orders);
        } catch (error) {
            handleError(res, 500, error.message);
        }
    },

    // Get all orders (Admin)
    getAllOrders: async (req, res) => {
        try {
            const { page = 1, limit = 20, status } = req.query;
            const filter = status ? { status } : {};

            const [orders, count] = await Promise.all([
                Order.find(filter)
                    .limit(limit * 1)
                    .skip((page - 1) * limit)
                    .sort('-createdAt')
                    .populate('user', 'name email')
                    .populate({
                        path: 'couponUsed',
                        populate: {
                            path: 'eligibleProducts',
                            model: 'Product'
                        }
                    }),
                Order.countDocuments(filter)
            ]);

            handleResponse(res, 200, 'Orders retrieved', {
                orders,
                totalPages: Math.ceil(count / limit),
                currentPage: page
            });
        } catch (error) {
            handleError(res, 500, error.message);
        }
    },

    // Update order status (Admin)
    // Update order status (Admin)
    updateOrderStatus: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { status, trackingId } = req.body;

            // Validate status exists and is a string
            if (typeof status !== 'string') {
                await session.abortTransaction();
                return handleError(res, 400, 'Status is required and must be a string');
            }

            const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled', 'returned'];
            const normalizedStatus = status.toLowerCase();

            if (!validStatuses.includes(normalizedStatus)) {
                await session.abortTransaction();
                return handleError(res, 400, 'Invalid status value');
            }

            // Validate tracking ID for shipped orders
            if (normalizedStatus === 'shipped') {
                if (typeof trackingId !== 'string' || !trackingId.trim()) {
                    await session.abortTransaction();
                    return handleError(res, 400, 'Tracking ID is required for shipped orders');
                }
            }

            // Format status correctly
            const formattedStatus = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);

            const order = await Order.findByIdAndUpdate(
                req.params.id,
                {
                    status: formattedStatus,
                    trackingId: trackingId || undefined
                },
                { new: true, session }
            ).populate('user');

            if (!order) {
                await session.abortTransaction();
                return handleError(res, 404, 'Order not found');
            }

            // Handle stock restoration
            if (['cancelled', 'returned'].includes(normalizedStatus)) {
                await restoreStock(order.items, session);
            }

            await session.commitTransaction();

            // Send status notifications
            await sendStatusNotifications(order, formattedStatus);

            handleResponse(res, 200, 'Order status updated', order);
        } catch (error) {
            await session.abortTransaction();
            handleError(res, 500, error.message);
        } finally {
            session.endSession();
        }
    },



    handlePayfastNotification: async (req, res) => {
        try {
            const data = { ...req.body };
            const receivedSignature = data.signature;
            delete data.signature;

            // Reconstruct & verify
            let sigString = Object.keys(data)
                .sort()
                .map(k => `${k}=${encodeURIComponent(data[k])}`)
                .join('&');
            if (process.env.PAYFAST_PASSPHRASE) {
                sigString += `&passphrase=${encodeURIComponent(process.env.PAYFAST_PASSPHRASE)}`;
            }
            const expectedSig = crypto.createHash('md5').update(sigString).digest('hex');
            if (expectedSig !== receivedSignature) {
                return res.status(400).send('Invalid signature');
            }

            // Lookup order
            const order = await Order.findById(data.m_payment_id);
            if (!order) return res.status(404).send('Order not found');

            // Update paymentResult & status
            order.paymentResult = {
                id: data.pf_payment_id,
                status: data.payment_status,
                update_time: new Date().toISOString(),
                rawData: data
            };
            order.status = data.payment_status === 'COMPLETE' ? 'Processing' : 'Cancelled';
            await order.save();

            res.status(200).end();
        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        }
    },


    // Get sales statistics (Admin)
    getSalesStats: async (req, res) => {
        try {
            const { period, startDate, endDate } = req.query;
            const dateRange = getDateRange(period, startDate, endDate);

            const stats = await Order.aggregate([
                { $match: { createdAt: dateRange, status: { $nin: ['Cancelled', 'Returned'] } } },
                {
                    $group: {
                        _id: null,
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: "$totalAmount" },
                        totalSales: { $sum: "$subtotal" },
                        totalShipping: { $sum: "$shippingCost" },
                        totalDiscount: { $sum: "$discount" },
                        totalCodFee: { $sum: "$codFee" },
                        couponsUsed: { $sum: { $cond: [{ $ne: ["$couponUsed", null] }, 1, 0] } }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalOrders: 1,
                        totalRevenue: 1,
                        totalSales: 1,
                        totalShipping: 1,
                        totalDiscount: 1,
                        totalCodFee: 1,
                        couponsUsed: 1,
                        // Profit is revenue minus the cost of goods. Since we don't track COGS,
                        // we can't calculate it yet. Setting to 0 as a placeholder.
                        totalProfit: { $literal: 0 }
                    }
                }
            ]);

            // Calculate sale discounts from order items
            const saleDiscountsResult = await Order.aggregate([
                { $match: { createdAt: dateRange, status: { $nin: ['Cancelled', 'Returned'] } } },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: null,
                        totalSaleDiscounts: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ["$items.priceOption.originalPrice", null] },
                                            { $gt: ["$items.priceOption.originalPrice", "$items.priceOption.price"] }
                                        ]
                                    },
                                    {
                                        $multiply: [
                                            { $subtract: ["$items.priceOption.originalPrice", "$items.priceOption.price"] },
                                            "$items.quantity"
                                        ]
                                    },
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            const totalSaleDiscounts = saleDiscountsResult.length > 0 ? saleDiscountsResult[0].totalSaleDiscounts : 0;
            const totalDiscounts = (stats[0]?.totalDiscount || 0) + totalSaleDiscounts;

            const result = stats[0] || {
                totalOrders: 0,
                totalRevenue: 0,
                totalSales: 0,
                totalShipping: 0,
                totalDiscount: 0,
                totalCodFee: 0,
                couponsUsed: 0,
                totalProfit: 0
            };

            // Update the result with total discounts including sale discounts
            result.totalDiscount = totalDiscounts;
            result.totalSaleDiscounts = totalSaleDiscounts;
            result.totalCouponDiscounts = stats[0]?.totalDiscount || 0;

            handleResponse(res, 200, 'Sales stats retrieved', result);
        } catch (error) {
            handleError(res, 500, error.message);
        }
    }
};

// Helper Functions
const processOrderItems = async (items, session) => {
    let subtotal = 0;
    const orderItems = [];
    const stockUpdates = [];

    for (const item of items) {
        const product = await Product.findById(item.productId).session(session);
        if (!product) throw new Error(`Product ${item.productId} not found`);

        const priceOption = product.priceOptions.id(item.priceOptionId);
        if (!priceOption) throw new Error('Invalid price option');

        // Calculate required stock (1 quantity = 1 packet)
        const requiredStock = item.quantity;

        if (product.stock < requiredStock) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
        }

        // Update product stock
        product.stock -= requiredStock;
        stockUpdates.push(product.save({ session }));

        // Calculate the final price considering all sale types
        let finalPrice = priceOption.price;
        let salePrice = null;
        let originalPrice = priceOption.price;
        let globalSalePercentage = null;

        // Priority 1: Individual sale price (if exists)
        if (priceOption.salePrice && priceOption.salePrice < priceOption.price) {
            finalPrice = priceOption.salePrice;
            salePrice = priceOption.salePrice;
        }
        // Priority 2: Global sale percentage (if no individual sale price)
        else if (product.sale && product.sale > 0 && product.sale <= 100) {
            const calculatedSalePrice = Math.round(priceOption.price * (1 - product.sale / 100));
            // Only apply if it's a meaningful discount (at least 1%)
            if (calculatedSalePrice < priceOption.price && (priceOption.price - calculatedSalePrice) / priceOption.price >= 0.01) {
                finalPrice = calculatedSalePrice;
                globalSalePercentage = product.sale;
            }
        }

        // Build order item
        orderItems.push({
            product: product._id,
            name: product.name,
            priceOption: {
                type: priceOption.type,
                weight: priceOption.weight,
                price: finalPrice, // This is the final price customer pays
                salePrice: salePrice,
                originalPrice: originalPrice,
                globalSalePercentage: globalSalePercentage
            },
            quantity: item.quantity,
            image: product.images[0]?.url
        });

        subtotal += finalPrice * item.quantity;
    }

    await Promise.all(stockUpdates);
    return [orderItems, subtotal];
};

const validateCoupon = async (code, userId, subtotal, orderItems, session) => {
    console.log("validateCoupon", code, userId, subtotal, orderItems);
    const coupon = await Coupon.findOne({ code: code.toUpperCase() })
        .session(session)
        .populate('eligibleUsers eligibleProducts');

    if (!coupon) {
        throw new Error('Coupon code not found');
    }

    // Check user usage first since we need it for multiple validations
    const userUsage = coupon.usedBy.find(u => u.userId.equals(userId));
    const timesUsed = userUsage?.timesUsed || 0;

    // Calculate eligible subtotal for min/max validation
    let eligibleSubtotal = subtotal;
    if (coupon.eligibleProducts && coupon.eligibleProducts.length > 0) {
        // Filter items that are eligible for this coupon
        const eligibleItems = orderItems.filter(item =>
            coupon.eligibleProducts.some(p => p._id.equals(item.product))
        );

        // Calculate subtotal for eligible products only
        eligibleSubtotal = eligibleItems.reduce((total, item) => {
            const itemPrice = item.priceOption?.price || 0;
            return total + (itemPrice * item.quantity);
        }, 0);
    }

    // Validation checks with specific error messages
    const validations = [
        {
            check: coupon.isActive,
            message: 'Coupon is not active'
        },
        {
            check: coupon.startAt <= Date.now(),
            message: 'Coupon has not started yet'
        },
        {
            check: coupon.expiresAt > Date.now(),
            message: 'Coupon has expired'
        },
        {
            check: coupon.usedCoupons < coupon.totalCoupons,
            message: 'Coupon usage limit reached'
        },
        {
            check: eligibleSubtotal >= coupon.minPurchase,
            message: `Eligible products subtotal must be at least Rs${coupon.minPurchase}`
        },
        {
            check: !coupon.maxPurchase || eligibleSubtotal <= coupon.maxPurchase,
            message: coupon.maxPurchase ?
                `Eligible products subtotal must be less than Rs${coupon.maxPurchase}` :
                'Coupon not valid for this order amount'
        },
        {
            check: !coupon.eligibleUsers?.length ||
                coupon.eligibleUsers.some(u => u._id.equals(userId)),
            message: 'Coupon not valid for this user'
        },
        {
            check: !coupon.eligibleProducts?.length ||
                orderItems.some(item =>
                    coupon.eligibleProducts.some(p => p._id.equals(item.product))
                ),
            message: 'Coupon not valid for these products'
        },
        {
            check: timesUsed < coupon.maxUsesPerUser,
            message: `Maximum uses per user reached (${coupon.maxUsesPerUser})`
        }
    ];

    // Debug logging - now with all variables defined
    console.log('Coupon validation debug:', {
        couponCode: coupon.code,
        isActive: coupon.isActive,
        validDates: coupon.startAt <= Date.now() && coupon.expiresAt > Date.now(),
        totalUses: `${coupon.usedCoupons}/${coupon.totalCoupons}`,
        userUses: `${timesUsed}/${coupon.maxUsesPerUser}`,
        minPurchase: `${eligibleSubtotal >= coupon.minPurchase} (${eligibleSubtotal} >= ${coupon.minPurchase})`,
        maxPurchase: coupon.maxPurchase ?
            `${eligibleSubtotal <= coupon.maxPurchase} (${eligibleSubtotal} <= ${coupon.maxPurchase})` : 'No max',
        eligibleUser: !coupon.eligibleUsers?.length ||
            coupon.eligibleUsers.some(u => u._id.equals(userId)),
        eligibleProducts: !coupon.eligibleProducts?.length ||
            orderItems.some(item =>
                coupon.eligibleProducts.some(p => p._id.equals(item.product))
            ),
        eligibleSubtotal,
        totalSubtotal: subtotal
    });

    // Find the first failed validation
    const failedValidation = validations.find(v => !v.check);
    if (failedValidation) {
        throw new Error(failedValidation.message);
    }

    return coupon;
};
const updateCouponUsage = async (coupon, userId, session) => {
    coupon.usedCoupons += 1;

    const userUsage = coupon.usedBy.find(u => u.userId.equals(userId));
    if (userUsage) {
        userUsage.timesUsed += 1;
    } else {
        coupon.usedBy.push({ userId, timesUsed: 1 });
    }

    await coupon.save({ session });
};

const calculateTotal = (subtotal, shipping, discount, codFee = 0) => {
    return Math.max(0, subtotal - discount + shipping + codFee);
};

const restoreStock = async (items, session) => {
    const bulkOps = items.map(item => ({
        updateOne: {
            filter: { _id: item.product },
            update: {
                $inc: {
                    stock: item.quantity
                }
            }
        }
    }));

    await Product.bulkWrite(bulkOps, { session });
};

const sendOrderNotifications = async (order, user) => {
    const contactInfo = user ? {
        email: user.email,
        phone: user.phone,
        verificationMethod: user.verificationMethod
    } : order.shippingAddress;

    // Prepare WhatsApp data
    const whatsappData = {
        customer_name: order.shippingAddress.fullName.split(' ')[0],
        order_id: order._id.toString(),
        item_count: `${order.items.length} ${order.items.length === 1 ? 'item' : 'items'}`,
        order_total: `Rs${order.totalAmount.toFixed(2)}`,
        preparation_time: '2-3 days'
    };

    try {
        // Send email notification
        if (contactInfo.email) {
            try {
                await sendEmail({
                    email: contactInfo.email,
                    subject: 'Order Confirmation - MS Foods',
                    html: generateOrderConfirmationEmail(order)
                });
                console.log('✅ Order email sent successfully');
            } catch (error) {
                console.error('❌ Order email error:', error);
            }
        }

        // Send WhatsApp notification for order confirmation
        // NOTE: This only sends if user.verificationMethod === 'phone'
        // If you don't want WhatsApp notifications, comment out or remove this block
        if (contactInfo.phone && user?.verificationMethod === 'phone') {
            await sendWhatsAppOrderUpdate(
                contactInfo.phone,
                'order_confirmation_utility',
                whatsappData
            );
        }
    } catch (error) {
        console.error('Notification error:', error);
    }
};

const sendStatusNotifications = async (order, status) => {
    try {
        const populatedOrder = await order.populate('user');
        const contactInfo = populatedOrder.user ? {
            phone: populatedOrder.user.phone,
            email: populatedOrder.user.email
        } : order.shippingAddress;

        // Common parameters
        const baseParams = {
            order_url: `${process.env.BASE_URL}/user/dashboard/order-history/${order._id}`,
            customer_name: order.shippingAddress.fullName.split(' ')[0],
            order_number: order._id.toString().substr(-6)
        };
        const formatDateForTemplate = (date) => {
            const options = {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            };
            return new Date(date).toLocaleDateString('en-US', options);
        };

        // Status-specific parameters
        const statusParams = {
            Processing: {
                template: 'order_process',
                params: {
                    estimated_date: formatDateForTemplate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
                }
            },
            Shipped: {
                template: 'order_shipped',
                params: {
                    tracking_id: order.trackingId || 'Not available, will update soon',
                    estimated_date: formatDateForTemplate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))
                }
            },
            Delivered: {
                template: 'order_deliver',
                params: {} // Only customer_name is needed from baseParams
            },
            Returned: {
                template: 'order_return',
                params: {} // customer_name and order_number from baseParams
            },
            Cancelled: {
                template: 'order_cancel',
                params: {
                    estimated_date: 4,
                }
            }
        };

        if (statusParams[status]) {
            const templateConfig = statusParams[status];
            const fullParams = { ...baseParams, ...templateConfig.params };

            // Send WhatsApp notification for status update
            // NOTE: This sends to all users with a phone number, regardless of verification method
            // If you don't want WhatsApp notifications, comment out or remove this block
            // if (contactInfo.phone) {
            //     await sendWhatsAppOrderUpdate(
            //         contactInfo.phone,
            //         templateConfig.template,
            //         fullParams
            //     );
            // }

            if (contactInfo.email) {
                try {
                    await sendEmail({
                        email: contactInfo.email,
                        subject: `${status} Update - Order #${order._id}`,
                        html: generateStatusEmail(order, status)
                    });
                    console.log('✅ Status email sent successfully');
                } catch (error) {
                    console.error('❌ Status email error:', error);
                }
            }
        }
    } catch (error) {
        console.error('Status notification error:', error);
    }
};

const authorizeOrderAccess = (order, user) => {
    return order.user?.equals(user._id) || user.role === 'admin';
};

export const generatePayfastPayload = (order) => {
    const params = {
        merchant_id: process.env.PAYFAST_MERCHANT_ID,
        merchant_key: process.env.PAYFAST_MERCHANT_KEY,
        return_url: process.env.PAYFAST_RETURN_URL,
        cancel_url: process.env.PAYFAST_CANCEL_URL,
        notify_url: process.env.PAYFAST_NOTIFY_URL,
        m_payment_id: order._id.toString(),
        amount: order.totalAmount.toFixed(2),
        item_name: `Sandbox Order #${order._id}`
    };

    // If you have a passphrase, include it in the signature string:
    let signatureString = Object.keys(params)
        .sort()
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');

    if (process.env.PAYFAST_PASSPHRASE) {
        signatureString += `&passphrase=${encodeURIComponent(process.env.PAYFAST_PASSPHRASE)}`;
    }

    const signature = crypto.createHash('md5').update(signatureString).digest('hex');
    params.signature = signature;

    return {
        redirectUrl: `${process.env.PAYFAST_URL}?${new URLSearchParams(params)}`,
        status: 'pending'
    };
};


const verifyPayfastSignature = (data, receivedSignature) => {
    let signatureString = Object.keys(data)
        .sort()
        .map(key => `${key}=${encodeURIComponent(data[key])}`)
        .join('&');

    if (process.env.PAYFAST_PASSPHRASE) {
        signatureString += `&passphrase=${encodeURIComponent(process.env.PAYFAST_PASSPHRASE)}`;
    }

    const expectedSignature = crypto
        .createHash('md5')
        .update(signatureString)
        .digest('hex');

    return expectedSignature === receivedSignature;
};

const updateOrderFromPayment = (order, data) => {
    order.paymentResult = {
        id: data.pf_payment_id,
        status: data.payment_status,
        update_time: new Date().toISOString(),
        rawData: data
    };

    if (data.payment_status === 'COMPLETE') {
        order.status = 'Processing';
    } else if (data.payment_status === 'FAILED') {
        order.status = 'Cancelled';
    }
};

const getDateRange = (period, startDate, endDate) => {
    const now = new Date();
    let start;

    switch (period.toLowerCase()) {
        case 'week':
            start = new Date(now.setDate(now.getDate() - 7));
            break;
        case 'month':
            start = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case 'year':
            start = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        default:
            start = new Date(0);
    }

    if (startDate && endDate) {
        start = new Date(startDate);
        endDate = new Date(endDate);
    } else {
        endDate = new Date();
    }

    return { $gte: start, $lte: endDate };
};

const generateOrderEmail = (order) => `
    <div style="max-width: 600px; margin: 20px auto; padding: 20px;">
        <h2>Order Confirmation #${order._id}</h2>
        <p>Thank you for your order! Here are your order details:</p>
        
 <h3>Order Status: ${order.status}</h3>
    
    ${order.trackingId ? `
      <h3>Tracking Information</h3>
      <p>Tracking ID: ${order.trackingId}</p>
    ` : ''}
    
        <h3>Shipping Address</h3>
        <p>${Object.values(order.shippingAddress).filter(Boolean).join(', ')}</p>
        
        <h3>Order Items</h3>
        <ul>
            ${order.items.map(item => `
                <li>
                    ${item.name} - 
                    ${item.quantity} packets
                    @ Rs${item.priceOption.price}
                </li>
            `).join('')}
        </ul>
        
        <h3>Total: Rs${order.totalAmount}</h3>
        <p>Payment Method: ${order.paymentMethod}</p>
    </div>
`;

const generateStatusEmail = (order, status) => {
    const statusInfo = {
        Processing: {
            title: "Order Processing",
            message: "We've received your order and are preparing it for shipment.",
            color: "#3498db"
        },
        Shipped: {
            title: "Order Shipped!",
            message: "Your order is on its way to you!",
            color: "#2ecc71"
        },
        Delivered: {
            title: "Order Delivered",
            message: "Your order has been successfully delivered.",
            color: "#27ae60"
        },
        Cancelled: {
            title: "Order Cancelled",
            message: "Your order has been cancelled as requested.",
            color: "#e74c3c"
        },
        Returned: {
            title: "Return Processed",
            message: "We've received your returned items.",
            color: "#f39c12"
        }
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Update</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: ${statusInfo[status].color};
            padding: 30px 20px;
            text-align: center;
            color: white;
            border-radius: 8px 8px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .container {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .content {
            padding: 30px;
            background-color: #ffffff;
        }
        .order-info {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 25px;
        }
        .order-info p {
            margin: 8px 0;
        }
        .tracking-info {
            background-color: #f0f7ff;
            padding: 20px;
            border-radius: 6px;
            margin: 25px 0;
            border-left: 4px solid ${statusInfo[status].color};
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: ${statusInfo[status].color};
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            margin-top: 15px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #777;
            font-size: 12px;
            border-top: 1px solid #eee;
        }
        .item-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .item-table th {
            text-align: left;
            padding: 10px;
            background-color: #f5f5f5;
            border-bottom: 2px solid #ddd;
        }
        .item-table td {
            padding: 15px 10px;
            border-bottom: 1px solid #eee;
        }
        .item-image {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${statusInfo[status].title}</h1>
        </div>
        
        <div class="content">
            <p>Dear ${order.shippingAddress.fullName},</p>
            <p>${statusInfo[status].message}</p>
            
            <div class="order-info">
                <p><strong>Order Number:</strong> #${order._id}</p>
                <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                <p><strong>Status:</strong> <span style="color: ${statusInfo[status].color}; font-weight: 600">${status}</span></p>
            </div>
            
            ${status === 'Shipped' && order.trackingId ? `
            <div class="tracking-info">
                <h3 style="margin-top: 0">Tracking Information</h3>
                <p><strong>Tracking Number:</strong> ${order.trackingId}</p>
                ${process.env.TRACKING_BASE_URL ? `
                <a href="${process.env.TRACKING_BASE_URL}/${order.trackingId}" class="button">Track Your Package</a>
                ` : ''}
            </div>
            ` : ''}
            
            <h3 style="margin-bottom: 15px">Order Summary</h3>
            <table class="item-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items.map(item => `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px; padding-right:10px;">
                                ${item.image ? `<img src="${item.image}" class="item-image" alt="${item.name}">` : ''}
                                <div style="padding-left:10px;">
                                    <div style="font-weight: 600">${item.name}</div>
                                    <div style="font-size: 12px; color: #777">
                                        ${item.priceOption.type === 'weight-based' ?
            `${item.priceOption.weight}g` : 'Packet'}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>${item.quantity}</td>
                        <td>Rs${(item.priceOption.salePrice || item.priceOption.price).toFixed(2)}</td>
                        <td>Rs${(item.quantity * (item.priceOption.salePrice || item.priceOption.price)).toFixed(2)}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="text-align: right; margin-top: 20px">
                <p><strong>Subtotal:</strong> Rs${order.subtotal.toFixed(2)}</p>
                <p><strong>Shipping:</strong> Rs${order.shippingCost.toFixed(2)}</p>
                ${order.discount > 0 ? `<p><strong>Discount:</strong> -Rs${order.discount.toFixed(2)}</p>` : ''}
                <p style="font-size: 18px; font-weight: 600; margin-top: 10px">
                    <strong>Total:</strong> Rs${order.totalAmount.toFixed(2)}
                </p>
            </div>
            
            <div style="margin-top: 30px">
                <h3>Shipping Address</h3>
                <p>${order.shippingAddress.fullName}</p>
                <p>${order.shippingAddress.address}</p>
                <p>${order.shippingAddress.city}${order.shippingAddress.postalCode ? `, ${order.shippingAddress.postalCode}` : ''}</p>
                <p>${order.shippingAddress.country}</p>
            </div>
        </div>
        
        <div class="footer">
            <p>If you have any questions, please contact our support team at support@yourstore.com</p>
            <p>© ${new Date().getFullYear()} Your Store Name. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
};

const calculateEligibleDiscount = (coupon, orderItems) => {
    if (!coupon) return 0;

    let eligibleItems = [];
    let eligibleSubtotal = 0;

    if (coupon.eligibleProducts && coupon.eligibleProducts.length > 0) {
        // Filter items that are eligible for this coupon
        eligibleItems = orderItems.filter(item =>
            coupon.eligibleProducts.some(p => p._id.equals(item.product))
        );

        // Calculate subtotal for eligible products only
        eligibleSubtotal = eligibleItems.reduce((total, item) => {
            const itemPrice = item.priceOption?.price || 0;
            return total + (itemPrice * item.quantity);
        }, 0);
    } else {
        // If no eligible products specified, apply to entire order
        eligibleItems = orderItems;
        eligibleSubtotal = orderItems.reduce((total, item) => {
            const itemPrice = item.priceOption?.price || 0;
            return total + (itemPrice * item.quantity);
        }, 0);
    }

    // Apply discount to eligible subtotal only
    let discount = 0;
    if (coupon.discountType === 'percentage') {
        discount = Math.min((eligibleSubtotal * coupon.discountValue) / 100, eligibleSubtotal);
    } else {
        discount = Math.min(coupon.discountValue, eligibleSubtotal);
    }

    console.log('Order discount calculation:', {
        couponCode: coupon.code,
        eligibleItems: eligibleItems.length,
        eligibleSubtotal,
        discount,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
    });

    return discount;
};

/**
 * @desc   Admin: confirm or decline a bank transfer
 * @route  PUT /api/orders/:id/verify-payment
 * @access Admin
 */
export async function verifyPayment(req, res, next) {
    try {
        const { paymentStatus } = req.body;   // expected: 'Confirmed' or 'Declined'
        if (!['Confirmed', 'Declined'].includes(paymentStatus)) {
            return res.status(400).json({ message: 'Invalid paymentStatus. Must be "Confirmed" or "Declined".' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.paymentStatus = paymentStatus;

        // if confirmed and it's a bank transfer, advance order.status
        if (paymentStatus === 'Confirmed' && order.paymentMethod === 'BankTransfer') {
            order.status = 'Processing';
        }
        // if declined, cancel
        if (paymentStatus === 'Declined') {
            order.status = 'Cancelled';
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);

    } catch (err) {
        // pass any unexpected errors to your errorHandler
        next(err);
    }
}