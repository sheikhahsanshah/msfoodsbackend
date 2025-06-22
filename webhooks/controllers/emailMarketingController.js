import User from '../../models/User.js';
import { sendEmail } from '../../utils/sendEmail.js';
import { generateMarketingEmail } from '../../utils/emailTemplates.js';

const BATCH_SIZE = 5; // Smaller batch size for emails to avoid rate limits

export const sendMarketingEmail = async (req, res) => {
    try {
        const {
            subject,
            message,
            images = [],
            targetUsers = 'all', // 'all', 'specific', 'verified', 'active'
            specificUserIds = [],
            includeImages = true
        } = req.body;

        console.log('📧 Email Marketing Request:', {
            subject,
            messageLength: message?.length,
            imagesCount: images?.length,
            targetUsers,
            includeImages,
            images: images
        });

        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Subject and message content are required'
            });
        }

        // Build query based on target type
        let userQuery = { isDeleted: false };

        switch (targetUsers) {
            case 'specific':
                if (!specificUserIds || specificUserIds.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Specific user IDs are required when targeting specific users'
                    });
                }
                userQuery._id = { $in: specificUserIds };
                break;
            case 'verified':
                userQuery.isVerified = true;
                break;
            case 'active':
                // Users who have made orders in the last 30 days
                userQuery.lastOrderAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
                break;
            case 'all':
            default:
                // All users (already set)
                break;
        }

        // Get users with email addresses
        const users = await User.find({ ...userQuery, email: { $exists: true, $ne: '' } });

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No users found with email addresses for the specified criteria'
            });
        }

        let allResults = [];
        let successCount = 0;
        let failureCount = 0;

        // Process users in batches
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(
                batch.map(async (user) => {
                    try {
                        // Build HTML content with images if included
                        let htmlContent = message;

                        if (includeImages && images && images.length > 0) {
                            console.log(`🖼️ Processing images for ${user.email}:`, images);

                            // Add images to the HTML content
                            const imageHtml = images.map(img =>
                                `<img src="${img.url}" alt="${img.alt || 'Marketing Image'}" style="max-width: 100%; height: auto; margin: 10px 0; display: block;" />`
                            ).join('');

                            // Insert images at specified positions or append to end
                            if (htmlContent.includes('[IMAGE]')) {
                                // Replace [IMAGE] placeholders with images
                                htmlContent = htmlContent.replace(/\[IMAGE\]/g, imageHtml);
                                console.log(`📍 Images inserted at [IMAGE] placeholders for ${user.email}`);
                            } else {
                                // If no [IMAGE] placeholder, append images at the end
                                htmlContent += imageHtml;
                                console.log(`📎 Images appended to end for ${user.email}`);
                            }
                        } else {
                            console.log(`❌ No images to process for ${user.email} (includeImages: ${includeImages}, imagesCount: ${images?.length})`);
                        }

                        // Add unsubscribe link
                        const unsubscribeLink = `${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(user.email)}&token=${user._id}`;
                        htmlContent += `
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                                <p>You received this email because you're subscribed to our marketing communications.</p>
                                <p><a href="${unsubscribeLink}" style="color: #666;">Unsubscribe</a></p>
                            </div>
                        `;

                        console.log(`📧 Sending email to ${user.email} with HTML length: ${htmlContent.length}`);
                        if (includeImages && images && images.length > 0) {
                            console.log(`🖼️ Final HTML contains images: ${htmlContent.includes('<img')}`);
                        }

                        await sendEmail({
                            email: user.email,
                            subject: subject,
                            html: generateMarketingEmail(subject, htmlContent, images)
                        });

                        successCount++;
                        return {
                            userId: user._id,
                            email: user.email,
                            status: 'success'
                        };
                    } catch (error) {
                        console.error(`Failed to send email to ${user.email}:`, error);
                        failureCount++;
                        return {
                            userId: user._id,
                            email: user.email,
                            status: 'failed',
                            error: error.message
                        };
                    }
                })
            );

            allResults = [...allResults, ...batchResults];

            // Add delay between batches to avoid rate limits
            if (i + BATCH_SIZE < users.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
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