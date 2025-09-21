import User from '../../models/User.js';
import { sendEmail } from '../../utils/sendEmail.js';
import { generateMarketingEmail } from '../../utils/emailTemplates.js';

const BATCH_SIZE = 2; // Reduced batch size to match rate limit (2 requests per second)

export const sendMarketingEmail = async (req, res) => {
    try {
        const {
            subject,
            message,
            images = [],
            targetUsers = 'all',
            specificUserIds = [],
            includeImages = true
        } = req.body;

        // ... (rest of your logic for fetching users) ...

        let allResults = [];
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];

            try {
                // The correct approach: just use the original message content
                // and let the generateMarketingEmail function build the full email.
                await sendEmail({
                    email: user.email,
                    subject: subject,
                    // Pass the original message and images.
                    // The generateMarketingEmail function handles the layout.
                    html: generateMarketingEmail(
                        subject, 
                        message, // Pass the clean message here
                        includeImages ? images : [], 
                        user.name // Pass the recipient's name to personalize the greeting
                    )
                });

                successCount++;
                allResults.push({
                    userId: user._id,
                    email: user.email,
                    status: 'success'
                });

                console.log(`✅ Email sent successfully to ${user.email}`);

            } catch (error) {
                console.error(`❌ Failed to send email to ${user.email}:`, error);
                failureCount++;
                allResults.push({
                    userId: user._id,
                    email: user.email,
                    status: 'failed',
                    error: error.message
                });
            }

            if (i < users.length - 1) {
                console.log(`⏳ Waiting 500ms before next email...`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        res.status(200).json({
            success: true,
            totalUsers: users.length,
            successCount,
            failureCount,
            results: allResults
        });

    } catch (error) {
        console.error('❌ Error sending marketing emails:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while sending marketing emails'
        });
    }
};


export const getEmailMarketingStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({
            isDeleted: false,
            email: { $exists: true, $ne: '' }
        });

        const verifiedUsers = await User.countDocuments({
            isDeleted: false,
            email: { $exists: true, $ne: '' },
            isVerified: true
        });

        const activeUsers = await User.countDocuments({
            isDeleted: false,
            email: { $exists: true, $ne: '' },
            lastOrderAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                verifiedUsers,
                activeUsers
            }
        });

    } catch (error) {
        console.error('❌ Error getting email marketing stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting email marketing stats'
        });
    }
};

export const getUsersForEmailMarketing = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            targetType = 'all',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query
        let query = {
            isDeleted: false,
            email: { $exists: true, $ne: '' }
        };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Apply target type filter
        switch (targetType) {
            case 'verified':
                query.isVerified = true;
                break;
            case 'active':
                query.lastOrderAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
                break;
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const users = await User.find(query)
            .select('name email isVerified createdAt lastOrderAt orderCount totalSpent')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                users,
                pagination: {
                    total,
                    pages: Math.ceil(total / parseInt(limit)),
                    page: parseInt(page),
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting users for email marketing:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting users for email marketing'
        });
    }
}; 