import express from 'express';
import {
    getFilteredUsers,
    getUserDetails,
    updateUserStatus,
    updateUserRole,
    getUserStatistics,
    deleteUser,
    getUsersBySignupMethod // Add new controller
} from '../controllers/adminUserController.js';
import { protect, admin } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect, admin);

// Existing routes
router.get('/', getFilteredUsers);
router.get('/stats', getUserStatistics);
router.get('/:id', getUserDetails);
// New signup method route
router.get('/signup-method/:method', getUsersBySignupMethod);
// Existing modification routes
router.patch('/:id/status', updateUserStatus);
router.patch('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

export default router;