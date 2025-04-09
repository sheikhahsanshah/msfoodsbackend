import jwt from 'jsonwebtoken';
import crypto from 'crypto';
 
export const generateAccessToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

export const generateRefreshToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

export const generateEmailVerificationToken = () =>
    crypto.randomBytes(32).toString('hex');

export const generateVerificationCode = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

export const generatePasswordResetToken = () =>
    crypto.randomBytes(32).toString('hex');

export const generatePasswordResetOTP = () =>
    Math.floor(100000 + Math.random() * 900000).toString();