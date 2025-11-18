import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import {
  changePassword,
  getUserSettings,
  updateNotificationSettings,
  updateProfile,
} from "../controllers/settings.controller";

const router = Router();

router.use(protect);

router.get("/me", getUserSettings);
router.put("/profile", updateProfile);
router.put("/password", changePassword);
router.put("/notifications", updateNotificationSettings);

export default router;
