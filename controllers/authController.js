import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../utils/sendEmail.js';
import { sendWhatsAppOTP } from '../utils/sendWhatsAppMessage.js';
import {
    generateAccessToken,
    generateRefreshToken,
    generateEmailVerificationToken,
    generateVerificationCode,
    generatePasswordResetToken,
    generatePasswordResetOTP,
} from '../utils/generateToken.js';
import { handleResponse, handleError } from '../utils/responseHandler.js';
import {
    verificationEmail,
    passwordResetEmail,
} from '../utils/emailTemplates.js';



// Helper function to prepare user data for response
const prepareUserData = (user) => {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
    };
};

// Signup Controller
export const signup = async (req, res) => {
    try {
        const { name, email, password, phone, verificationMethod } = req.body;

        if (!name || !password || !verificationMethod) {
            return handleError(res, 400, 'Name, password, and verification method are required');
        }

        // build query & data only for the chosen method
        let existingUser;
        if (verificationMethod === 'email') {
            if (!email) return handleError(res, 400, 'Email is required');
            existingUser = await User.findOne({ email: email.toLowerCase() });
        } else {
            if (!phone) return handleError(res, 400, 'Phone is required');
            existingUser = await User.findOne({ phone });
        }

        if (existingUser) {
            const field = verificationMethod === 'email' ? 'email' : 'phone';
            return handleError(res, 400, `User with this ${field} already exists`);
        }

        // only include the one we need
        const userData = { name, password };
        if (verificationMethod === 'email') userData.email = email.toLowerCase();
        else userData.phone = phone;

        const user = new User(userData);

        if (verificationMethod === 'email') {
            user.emailVerificationToken = generateEmailVerificationToken();
            user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
            const verificationUrl = `${process.env.CLIENT_URL}/auth/verify-email/${user.emailVerificationToken}`;
            await sendEmail({
                email: user.email,
                subject: 'Email Verification',
                html: verificationEmail(user.name, verificationUrl),
            });
        } else {
            const otp = generateVerificationCode();
            user.phoneVerificationCode = otp;
            user.phoneVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 mins expiry
            await sendWhatsAppOTP(phone, otp, 'signupotp', '+923256897669'); // Use signupotp template

        }

            await user.save();
      

        handleResponse(res, 201, 'Verification code sent', {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
        });
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// Verify Email Controller
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({ emailVerificationToken: token });

        if (!user) {
            return handleError(res, 400, 'Invalid verification token');
        }

        if (user.emailVerificationExpires < Date.now()) {
            user.emailVerificationToken = generateEmailVerificationToken();
            user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
            await user.save();

            const verificationUrl = `${process.env.CLIENT_URL}/auth/verify-email/${user.emailVerificationToken}`;
            await sendEmail({
                email: user.email,
                subject: 'New Email Verification Link',
                html: verificationEmail(user.name, verificationUrl),
            });

            return handleError(res, 400, 'Verification token expired. New email sent.');
        }

        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        handleResponse(res, 200, 'Email verified successfully');
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// Verify Phone Controller
export const verifyPhone = async (req, res) => {
    try {
        const { phone, code } = req.body;
        const user = await User.findOne({ phone });

        if (!user) return handleError(res, 400, 'Invalid phone number');
        if (user.phoneVerificationCode !== code) return handleError(res, 400, 'Invalid verification code');
        if (user.phoneVerificationExpires < Date.now()) return handleError(res, 400, 'Verification code expired');

        user.isVerified = true;
        user.phoneVerificationCode = undefined;
        user.phoneVerificationExpires = undefined;
        await user.save();

        handleResponse(res, 200, 'Phone number verified successfully');
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// Login Controller
export const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({
            $or: [{ email: identifier }, { phone: identifier }],
        }).select('+password');

        if (!user) return handleError(res, 401, 'Invalid credentials');
        if (!user.isVerified) return handleError(res, 403, 'Please verify your account first');

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return handleError(res, 401, 'Invalid credentials');

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Store tokens in session
        req.session.user = {
            id: user._id,
            role: user.role,
            accessToken,
            refreshToken,
        };

        handleResponse(res, 200, 'Login successful', {
            user: prepareUserData(user),
            accessToken,
            refreshToken,
        });
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// Forgot Password Controller
export const forgotPassword = async (req, res) => {
    try {
        const { identifier } = req.body;
        const user = await User.findOne({
            $or: [{ email: identifier }, { phone: identifier }],
        });

        if (!user) return handleError(res, 404, 'User not found');

        let resetToken, resetCode;
        if (user.email) {
            resetToken = generatePasswordResetToken();
            user.resetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            const resetUrl = `${process.env.CLIENT_URL}/auth/reset-password/${resetToken}`;
            await sendEmail({
                email: user.email,
                subject: 'Password Reset Request',
                html: passwordResetEmail(user.name, resetUrl),
            });
        } else {
            resetCode = generatePasswordResetOTP();
            user.resetToken = crypto.createHash('sha256').update(resetCode).digest('hex');
            user.resetExpires = Date.now() + 15 * 60 * 1000; // 15 mins expiry
            await sendWhatsAppOTP(user.phone, resetCode, 'forgototp', '+923256897669'); // Use forgototp 
            
            

        }

        user.resetExpires = Date.now() + 600000; // 10 minutes
        await user.save();

        handleResponse(res, 200, 'Password reset instructions sent');
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// Reset Password Controller
export const resetPassword = async (req, res) => {
    try {
        const { token, code, password } = req.body;
        if (!password) return handleError(res, 400, 'Password is required');

        let hashedToken;
        if (token) {
            hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        } else if (code) {
            hashedToken = crypto.createHash('sha256').update(code).digest('hex');
        } else {
            return handleError(res, 400, 'Token or code is required');
        }

        const user = await User.findOne({
            resetToken: hashedToken,
            resetExpires: { $gt: Date.now() },
        });

        if (!user) return handleError(res, 400, 'Invalid or expired token/code');

        user.password = password;
        user.resetToken = undefined;
        user.resetExpires = undefined;
        await user.save();

        handleResponse(res, 200, 'Password reset successful');
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// Resend Verification Controller
export const resendVerification = async (req, res) => {
    try {
        const { identifier } = req.body;
        const user = await User.findOne({
            $or: [{ email: identifier }, { phone: identifier }],
        });

        if (!user) return handleError(res, 404, 'User not found');
        if (user.isVerified) return handleError(res, 400, 'Account already verified');

        if (user.email) {
            user.emailVerificationToken = generateEmailVerificationToken();
            user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
            const verificationUrl = `${process.env.CLIENT_URL}/auth/verify-email/${user.emailVerificationToken}`;
            await sendEmail({
                email: user.email,
                subject: 'Resend Email Verification',
                html: verificationEmail(user.name, verificationUrl),
            });
        } else {
            const otp = generateVerificationCode(); // Generate new OTP
            user.phoneVerificationCode = otp;
            user.phoneVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 mins expiry
            await sendWhatsAppOTP(user.phone, otp, 'resendotp', '+923256897669'); // Use resendotp template
        }

        await user.save();
        handleResponse(res, 200, 'Verification code resent');
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// Refresh Token Controller
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return handleError(res, 401, 'No refresh token provided');
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return handleError(res, 401, 'Invalid refresh token');
        }

        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        // Update session with new tokens
        req.session.user = {
            id: user._id,
            role: user.role,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };

        handleResponse(res, 200, 'Token refreshed', {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        handleError(res, 401, 'Invalid refresh token');
    }
};

// Get Current User Controller
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id).select('-password');
        handleResponse(res, 200, 'Current user retrieved', prepareUserData(user));
    } catch (error) {
        handleError(res, 500, error.message);
    }
};

// Logout Controller
export const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                return handleError(res, 500, 'Failed to destroy session');
            }
            handleResponse(res, 200, 'Successfully logged out');
        });
    } catch (error) {
        handleError(res, 500, error.message);
    }
};