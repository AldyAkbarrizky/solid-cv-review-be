import { Request, Response, CookieOptions } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer, { TransportOptions } from "nodemailer";
import User from "../models/user.model";
import RefreshToken from "../models/refreshToken.model";
import { Op } from "sequelize";
import { ApiResponse } from "../utils/apiResponse";

const ACCESS_TOKEN_TTL = parseInt(process.env.JWT_EXPIRES_IN ?? "86400", 10);
const REFRESH_TOKEN_TTL = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN ?? "604800", 10);
const REFRESH_COOKIE_NAME = "refresh_token";

const buildRefreshCookieOptions = (overrides?: Partial<CookieOptions>): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  path: "/",
  ...overrides,
});

const generateAccessToken = (user: User) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createRefreshTokenRecord = async (userId: number, token: string) => {
  await RefreshToken.create({
    userId,
    token,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
  });
};

const issueRefreshToken = async (userId: number) => {
  const rawToken = crypto.randomBytes(64).toString("hex");
  await createRefreshTokenRecord(userId, hashToken(rawToken));
  return rawToken;
};

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(
    REFRESH_COOKIE_NAME,
    token,
    buildRefreshCookieOptions({ maxAge: REFRESH_TOKEN_TTL * 1000 })
  );
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions());
};

const removeStoredRefreshToken = async (token?: string | null) => {
  if (!token) return;
  await RefreshToken.destroy({
    where: {
      token: hashToken(token),
    },
  });
};

const sendVerificationEmail = async (user: User, token: string) => {
  const verifyURL = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const mailOptions = {
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USERNAME,
    to: user.email,
    subject: "Verifikasi Email Anda",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Selamat bergabung di Solid CV Review!</h2>
        <p>Untuk mulai menggunakan semua fitur, silakan verifikasi email Anda.</p>
        <p><a href="${verifyURL}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Verifikasi Email</a></p>
        <p>Jika tombol tidak berfungsi, salin dan tempel tautan berikut di browser Anda:</p>
        <p>${verifyURL}</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// Register
export const register = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, email, password, password_confirm } = req.body;

  if (password !== password_confirm) {
    return ApiResponse.error(res, "Passwords do not match", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await sendVerificationEmail(newUser, verificationToken);

    return ApiResponse.success(
      res,
      {
        message: "Registration successful. Please verify your email.",
      },
      201
    );
  } catch (error) {
    return ApiResponse.error(res, "Error creating user", 500, error);
  }
};

// Login
export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  const matchingUsers = await User.findAll({
    where: { email },
    order: [["updatedAt", "DESC"]],
  });

  if (matchingUsers.length === 0) {
    return ApiResponse.error(res, "Invalid credentials", 401);
  }

  if (matchingUsers.length > 1) {
    console.warn(
      `[Auth] Duplicate accounts detected for email ${email}. Using the most recently updated record (ID: ${matchingUsers[0].id}).`
    );
  }

  const user = matchingUsers[0];
  console.info(`[DEBUG ONLY] Email of existing user ${user.email}`);
  console.info(`[DEBUG ONLY] Password of existing user ${user.password}`);
  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return ApiResponse.error(res, "Invalid credentials", 401);
  }

  const token = generateAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  setRefreshCookie(res, refreshToken);

  return ApiResponse.success(res, {
    token,
    expiresIn: ACCESS_TOKEN_TTL,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
};

export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { token } = req.body;

  if (!token) {
    return ApiResponse.error(res, "Verification token is required", 400);
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    where: {
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    return ApiResponse.error(
      res,
      "Token tidak valid atau sudah kadaluarsa",
      400
    );
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({
    fields: ["emailVerified", "emailVerificationToken", "emailVerificationExpires"],
  });

  return ApiResponse.success(res, { message: "Email berhasil diverifikasi" });
};

export const resendVerificationEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email } = req.body;

  if (!email) {
    return ApiResponse.error(res, "Email is required", 400);
  }

  const user = await User.findOne({ where: { email } });

  if (!user) {
    return ApiResponse.error(res, "User not found", 404);
  }

  if (user.emailVerified) {
    return ApiResponse.error(res, "Email already verified", 400);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save({
    fields: ["emailVerificationToken", "emailVerificationExpires"],
  });

  await sendVerificationEmail(user, rawToken);

  return ApiResponse.success(res, {
    message: "Email verifikasi baru telah dikirim.",
  });
};

export const refreshSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!incomingToken) {
      clearRefreshCookie(res);
      return ApiResponse.error(res, "Refresh token is missing", 401);
    }

    const hashedToken = hashToken(incomingToken);
    const existingToken = await RefreshToken.findOne({
      where: {
        token: hashedToken,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!existingToken) {
      clearRefreshCookie(res);
      return ApiResponse.error(res, "Refresh token is invalid or expired", 401);
    }

    const user = await User.findByPk(existingToken.userId);

    if (!user) {
      await existingToken.destroy();
      clearRefreshCookie(res);
      return ApiResponse.error(res, "User not found", 401);
    }

    await existingToken.destroy();
    const nextRefreshToken = await issueRefreshToken(user.id);
    setRefreshCookie(res, nextRefreshToken);

    const token = generateAccessToken(user);

    return ApiResponse.success(res, {
      token,
      expiresIn: ACCESS_TOKEN_TTL,
    });
  } catch (error) {
    console.error("[Auth] Failed to refresh session", error);
    return ApiResponse.error(res, "Failed to refresh session", 500, error);
  }
};

export const logout = async (req: Request, res: Response): Promise<Response> => {
  try {
    const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];
    await removeStoredRefreshToken(incomingToken);
  } catch (error) {
    console.error("[Auth] Failed to revoke refresh token", error);
  } finally {
    clearRefreshCookie(res);
  }

  return ApiResponse.success(res, { message: "Logged out successfully" });
};

// Forgot Password
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email } = req.body;
  const user = await User.findOne({
    where: { email },
    order: [["updatedAt", "DESC"]],
  });

  if (!user) {
    return ApiResponse.error(res, "User not found", 404);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await user.save();

  const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  } as TransportOptions);

  const mailOptions = {
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USERNAME,
    to: user.email,
    subject: "Your Password Reset Token",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Password Reset Request</h2>
        <p>You are receiving this email because you (or someone else) have requested the reset of a password for your account.</p>
        <p>Please click the button below to reset your password:</p>
        <a href="${resetURL}" style="background-color: #4CAF50; color: white; padding: 14px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">Reset Password</a>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>This link will expire in 10 minutes.</p>
        <hr>
        <p>If you're having trouble clicking the "Reset Password" button, copy and paste the URL below into your web browser:</p>
        <p>${resetURL}</p>
      </div>
    `,
  };

  try {
    console.info(
      `[Auth] Sending password reset email to ${user.email} via ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`
    );
    const info = await transporter.sendMail(mailOptions);
    console.info(
      `[Auth] Password reset email successfully sent to ${user.email}. MessageId: ${info.messageId}, accepted: ${info.accepted}`
    );
    return ApiResponse.success(res, { message: "Token sent to email!" });
  } catch (error) {
    console.error(
      `[Auth] Failed to send password reset email to ${user.email}`,
      error
    );
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return ApiResponse.error(res, "Error sending email", 500, error);
  }
};

// Reset Password
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    console.info("[Auth] Attempting password reset with token:", hashedToken);

    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      console.warn("[Auth] Password reset failed. Token invalid or expired.");
      return ApiResponse.error(res, "Token is invalid or has expired", 400);
    }

    console.info("[DEBUG ONLY] New Password:", req.body.password);

    const newHashedPassword = await bcrypt.hash(req.body.password, 12);
    user.password = newHashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({
      fields: ["password", "passwordResetToken", "passwordResetExpires"],
    });

    console.info(
      `[Auth] Password reset successful for user ${user.email} (ID: ${user.id})`
    );

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      {
        expiresIn: parseInt(process.env.JWT_EXPIRES_IN!),
      }
    );

    return ApiResponse.success(res, {
      token,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("[Auth] Unexpected error during password reset", error);
    return ApiResponse.error(res, "Failed to reset password", 500, error);
  }
};
