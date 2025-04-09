import jwt from 'jsonwebtoken';
import { handleError } from '../utils/responseHandler.js';
import User from '../models/User.js';


// middlewares/auth.js
export const protect = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return handleError(res, 401, 'Not authenticated');
    console.log("kencike ec cds");
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        
        next();
    } catch (error) {
        handleError(res, 401, 'Invalid token');
    }
};

export const admin = (req, res, next) => {
    if (req.user?.role === 'admin') {
        console.log("dncnjd cjd jcd ")
        return next()
    };
    handleError(res, 403, 'Not authorized as admin');
};

// middlewares/auth.js
export const optionalAuth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
        } catch (error) {
            // Don't block the request, just don't set req.user
            console.log('Invalid token, proceeding as guest');
        }
    }
    next();
};
