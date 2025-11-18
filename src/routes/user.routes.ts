import { Router } from 'express';
import { getUsers, createUser, getUser, updateUser, deleteUser } from '../controllers/user.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.route('/').get(protect, getUsers).post(createUser);

router.route('/:id').get(protect, getUser).put(protect, updateUser).delete(protect, deleteUser);

export default router;
