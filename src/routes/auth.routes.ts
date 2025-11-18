import { Router } from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  refreshSession,
  logout,
  verifyEmail,
  resendVerificationEmail,
} from "../controllers/auth.controller";

const router = Router();

router.post('/register', register);
router.post("/login", login);
router.post("/refresh", refreshSession);
router.post("/logout", logout);
router.post("/forgotPassword", forgotPassword);
router.put("/resetPassword/:token", resetPassword);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

export default router;
