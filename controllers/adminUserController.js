// controllers/adminUserController.js
import User from '../models/User.js';
import Order from '../models/Order.js';
import { handleResponse, handleError } from '../utils/responseHandler.js';

// @desc    Get all users with advanced filtering
// @route   GET /api/admin/users
// @access  Admin
export const getFilteredUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            role,
            isVerified,
            isBlocked,
            phone,
            email,
            createdAfter,
            createdBefore,
            sort = '-createdAt',
            signupMethod,
            hasRepliedOnWhatsApp
        } = req.query;

        // Base filter
        const filter = { isDeleted: { $ne: true } };

        // Check if hasRepliedOnWhatsApp is passed and handle it as boolean
        if (hasRepliedOnWhatsApp !== undefined) {
            filter.hasRepliedOnWhatsApp = hasRepliedOnWhatsApp === 'true';  // Convert string 'true' to boolean true
        }
        
        // Text search
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Signup method filter
        if (signupMethod && ['email', 'phone'].includes(signupMethod)) {
            filter[signupMethod] = { $exists: true, $ne: null };
        }

        // Direct filters
        if (role) filter.role = role;
        if (isVerified) filter.isVerified = isVerified === 'true';
        if (isBlocked) filter.isBlocked = isBlocked === 'true';
        if (phone) filter.phone = phone;
        if (email) filter.email = email;

        // Date range filter
        if (createdAfter || createdBefore) {
            filter.createdAt = {};
            if (createdAfter) filter.createdAt.$gte = new Date(createdAfter);
            if (createdBefore) filter.createdAt.$lte = new Date(createdBefore);
        }

        // Handle order-based sorting with aggregation
        if (['orderCount', 'totalSpent', '-orderCount', '-totalSpent'].includes(sort)) {
            const sortOrder = sort.startsWith('-') ? -1 : 1;
            const sortField = sort.replace('-', '');

            try {
                const aggregation = [
                    { $match: filter },
                    {
                        $lookup: {
                            from: 'orders',
                            localField: '_id',
                            foreignField: 'user',
                            as: 'orders'
                        }
                    },
                    {
                        $addFields: {
                            orderCount: { $size: '$orders' },
                            totalSpent: { $sum: '$orders.totalAmount' }
                        }
                    },
                    { $sort: { [sortField]: sortOrder } },
                    { $skip: (page - 1) * limit },
                    { $limit: Number(limit) },
                    {
                        $project: {
                            password: 0,
                            refreshToken: 0,
                            emailVerificationToken: 0,
                            addresses: 0,
                            orders: 0
                        }
                    }
                ];

                const [users, total] = await Promise.all([usersQuery.exec(), User.countDocuments(filter)]);
                console.log('Users:', users);
                console.log('Total:', total);

                return handleResponse(res, 200, 'Users retrieved successfully', {
                    users: users.map(user => ({
                        ...user,
                        signupMethod: user.email && user.phone ? 'both' :
                            user.email ? 'email' : 'phone'
                    })),
                    pagination: {
                        total,
                        pages: Math.ceil(total / limit),
                        page: Number(page),
                        limit: Number(limit)
                    }
                });
            } catch (aggError) {
                return handleError(res, 500, 'Aggregation error', aggError);
            }
        }

        // Regular sorting for non-order fields
        try {
            const usersQuery = User.find(filter)
                .select('-password -refreshToken -emailVerificationToken -addresses')
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .lean();

            const [users, total] = await Promise.all([
                usersQuery.exec(),
                User.countDocuments(filter)
            ]);

            const usersWithStats = await Promise.all(
                users.map(async user => {
                    const [orderCount, totalSpent] = await Promise.all([
                        Order.countDocuments({ user: user._id }),
                        Order.aggregate([
                            { $match: { user: user._id } },
                            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
                        ])
                    ]);

                    return {
                        ...user,
                        orderCount: orderCount || 0,
                        totalSpent: totalSpent[0]?.total || 0,
                        signupMethod: user.email && user.phone ? 'both' :
                            user.email ? 'email' : 'phone'
                    };
                })
            );

            handleResponse(res, 200, 'Users retrieved successfully', {
                users: usersWithStats,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    page: Number(page),
                    limit: Number(limit)
                }
            });

        } catch (queryError) {
            handleError(res, 500, 'Query error', queryError);
        }

    } catch (error) {
        handleError(res, 500, 'Server error', error);
    }
};

// @desc    Get users by signup method
// @route   GET /api/admin/users/signup-method/:method
// @access  Admin
export const getUsersBySignupMethod = async (req, res) => {
    try {
        const { method } = req.params;
        const { page = 1, limit = 20 } = req.query;

        if (!['email', 'phone'].includes(method)) {
            return handleError(res, 400, 'Invalid signup method');
        }

        const filter = {
            [method]: { $exists: true, $ne: null }
        };

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('name email phone createdAt role isVerified')
                .sort('-createdAt')
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .lean(),
            User.countDocuments(filter)
        ]);

        const usersWithDetails = users.map(user => ({
            ...user,
            signupMethod: method,
            hasBothCredentials: !!user.email && !!user.phone
        }));

        handleResponse(res, 200, 'Users retrieved', {
            users: usersWithDetails,
            total,
            pages: Math.ceil(total / limit),
            page: Number(page)
        });

    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Get user details with related data
// @route   GET /api/admin/users/:id
// @access  Admin
export const getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -refreshToken -emailVerificationToken')
            .populate({
                path: 'addresses',
                select: '-_id -__v'
            })
            .populate({
                path: 'orders',
                select: 'totalAmount status createdAt',
                options: {
                    limit: 5,
                    sort: { createdAt: -1 },
                    // Add match condition if needed
                    match: {
                        status: { $ne: 'Cancelled' }
                    }
                }
            });

        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        handleResponse(res, 200, 'User details retrieved', user);
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Update user status (Block/Unblock/Suspend)
// @route   PATCH /api/admin/users/:id/status
// @access  Admin
export const updateUserStatus = async (req, res) => {
    try {
        const { action } = req.body;
        const validActions = ['block', 'unblock', 'suspend'];
        
        if (!validActions.includes(action)) {
            return handleError(res, 400, 'Invalid status action');
        }

        const update = {};
        switch(action) {
            case 'block':
                update.isBlocked = true;
                update.blockedAt = Date.now();
                break;
            case 'unblock':
                update.isBlocked = false;
                update.blockedAt = null;
                break;
            case 'suspend':
                update.suspendedUntil = new Date(Date.now() + 7*24*60*60*1000); // 7 days
                break;
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        handleResponse(res, 200, `User ${action}ed successfully`, user);
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Update user role
// @route   PATCH /api/admin/users/:id/role
// @access  Admin
export const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        
        if (!['user', 'admin'].includes(role)) {
            return handleError(res, 400, 'Invalid role');
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        handleResponse(res, 200, 'User role updated', user);
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Admin
export const getUserStatistics = async (req, res) => {
    try {
        const stats = await User.aggregate([
            {
                $facet: {
                    totalUsers: [{ $count: "count" }],
                    activeUsers: [
                        { $match: { isBlocked: false } },
                        { $count: "count" }
                    ],
                    userGrowth: [
                        {
                            $group: {
                                _id: { 
                                    year: { $year: "$createdAt" },
                                    month: { $month: "$createdAt" }
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { "_id.year": 1, "_id.month": 1 } }
                    ],
                    roleDistribution: [
                        { $group: { _id: "$role", count: { $sum: 1 } } }
                    ]
                }
            }
        ]);

        handleResponse(res, 200, 'Statistics retrieved', stats[0]);
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// @desc    Delete user (Soft delete)
// @route   DELETE /api/admin/users/:id
// @access  Admin
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { 
                isDeleted: true,
                deletedAt: Date.now()
            },
            { new: true }
        );

        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        // Optional: Anonymize personal data
        user.name = 'Deleted User';
        user.email = `deleted-${user._id}@example.com`;
        user.phone = null;
        user.addresses = [];
        await user.save();

        handleResponse(res, 200, 'User deleted successfully');
    } catch (error) {
        handleError(res, 500, error.message);
    }
};