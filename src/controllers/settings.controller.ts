import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/user.model";
import UserPreference from "../models/userPreference.model";
import { ApiResponse } from "../utils/apiResponse";

type NotificationKey =
  | "emailUpdates"
  | "analysisComplete"
  | "weeklyTips"
  | "promotions";

const getUserIdFromRequest = (req: Request): number | null => {
  const currentUser = (req as any).user;
  return currentUser?.id ?? null;
};

const ensurePreferences = async (userId: number) => {
  const [preferences] = await UserPreference.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      emailUpdates: true,
      analysisComplete: true,
      weeklyTips: false,
      promotions: true,
    },
  });

  return preferences;
};

export const getUserSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = getUserIdFromRequest(req);

  if (!userId) {
    return ApiResponse.error(res, "Unauthorized", 401);
  }

  const user = await User.findByPk(userId, {
    attributes: [
      "id",
      "name",
      "email",
      "role",
      "emailVerified",
      "createdAt",
      "updatedAt",
    ],
  });

  if (!user) {
    return ApiResponse.error(res, "User not found", 404);
  }

  const preferences = await ensurePreferences(userId);

  const planLabel = user.role === "paid" ? "Akun Pro" : "Akun Gratis";
  const quota = user.role === "paid" ? 20 : 5;

  return ApiResponse.success(res, {
    user,
    notifications: preferences.toJSON(),
    account: {
      plan: planLabel,
      usage: {
        limit: quota,
        used: 0,
      },
      emailVerified: user.emailVerified,
      lastPasswordChange: user.updatedAt,
      lastLoginAt: user.updatedAt,
    },
  });
};

export const updateProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = getUserIdFromRequest(req);

  if (!userId) {
    return ApiResponse.error(res, "Unauthorized", 401);
  }

  const { name, email } = req.body;

  if (!name || !email) {
    return ApiResponse.error(res, "Name and email are required", 400);
  }

  const user = await User.findByPk(userId);

  if (!user) {
    return ApiResponse.error(res, "User not found", 404);
  }

  const existingEmail = await User.findOne({
    where: { email },
  });

  if (existingEmail && existingEmail.id !== userId) {
    return ApiResponse.error(res, "Email is already in use", 409);
  }

  user.name = name;
  user.email = email;
  await user.save({ fields: ["name", "email"] });

  return ApiResponse.success(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    message: "Profile updated successfully",
  });
};

export const changePassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = getUserIdFromRequest(req);

  if (!userId) {
    return ApiResponse.error(res, "Unauthorized", 401);
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return ApiResponse.error(res, "Both passwords are required", 400);
  }

  if (newPassword.length < 8) {
    return ApiResponse.error(
      res,
      "New password must be at least 8 characters",
      400
    );
  }

  const user = await User.findByPk(userId);

  if (!user) {
    return ApiResponse.error(res, "User not found", 404);
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isCurrentPasswordValid) {
    return ApiResponse.error(res, "Current password is incorrect", 400);
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save({ fields: ["password"] });

  return ApiResponse.success(res, {
    message: "Password updated successfully",
  });
};

export const updateNotificationSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = getUserIdFromRequest(req);

  if (!userId) {
    return ApiResponse.error(res, "Unauthorized", 401);
  }

  const allowedKeys: NotificationKey[] = [
    "emailUpdates",
    "analysisComplete",
    "weeklyTips",
    "promotions",
  ];

  const updates: Partial<Record<NotificationKey, boolean>> = {};

  allowedKeys.forEach((key) => {
    if (typeof req.body[key] === "boolean") {
      updates[key] = req.body[key];
    }
  });

  if (Object.keys(updates).length === 0) {
    return ApiResponse.error(res, "No valid notification settings provided", 400);
  }

  const preferences = await ensurePreferences(userId);
  await preferences.update(updates);

  return ApiResponse.success(res, {
    notifications: preferences.toJSON(),
    message: "Notification settings updated",
  });
};
