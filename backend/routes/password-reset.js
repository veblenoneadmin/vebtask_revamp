// Password reset routes
import express from 'express';
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

const router = express.Router();

// Request password reset
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal whether user exists or not for security
      return res.json({ 
        success: true, 
        message: 'If an account with that email exists, you will receive a password reset email.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token in verification table
    await prisma.verification.create({
      data: {
        identifier: email.toLowerCase(),
        value: resetToken,
        expiresAt: resetTokenExpiry
      }
    });

    // Send reset email
    try {
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const resetUrl = `${process.env.BETTER_AUTH_URL || 'https://vebtask.com'}/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Reset your VebTask password',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - VebTask</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                            <img src="https://vebtask.com/veblen-logo.png" alt="VebTask" style="height: 40px; width: auto;" />
                            <h1 style="margin: 20px 0 0; color: #1e293b; font-size: 24px; font-weight: 600;">Password Reset Request</h1>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">Hi ${user.name || 'there'},</p>
                            
                            <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">We received a request to reset your VebTask password. If you didn't make this request, you can safely ignore this email.</p>
                            
                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 40px 0;">
                                <a href="${resetUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
                            </div>
                            
                            <p style="margin: 20px 0; color: #64748b; font-size: 14px; line-height: 1.6;">If the button above doesn't work, copy and paste this link into your browser:</p>
                            <p style="margin: 0 0 20px; color: #6366f1; font-size: 14px; word-break: break-all;">${resetUrl}</p>
                            
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;" />
                            
                            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px;">
                                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;"><strong>Security Notice:</strong> This reset link will expire in 15 minutes for your security. If you didn't request this reset, please ignore this email or contact support.</p>
                            </div>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 10px; color: #64748b; font-size: 12px;">Best regards,<br>The VebTask Team</p>
                            <p style="margin: 0; color: #94a3b8; font-size: 12px;">Veblen Group | Secure Task Management</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('❌ Failed to send reset email:', emailError);
      // Don't fail the request if email fails - still return success
    }

    res.json({ 
      success: true, 
      message: 'If an account with that email exists, you will receive a password reset email.' 
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please try again.' 
    });
  }
});

// Verify reset token
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token is required' 
      });
    }

    // Check if token exists and is not expired
    const verification = await prisma.verification.findFirst({
      where: {
        value: token,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!verification) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Token is valid' 
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please try again.' 
    });
  }
});

// Confirm password reset
router.post('/reset-password/confirm', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Find and verify token
    const verification = await prisma.verification.findFirst({
      where: {
        value: token,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!verification) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    // Find user by email from verification
    const user = await prisma.user.findUnique({
      where: { email: verification.identifier }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password in Account table
    await prisma.account.updateMany({
      where: {
        userId: user.id,
        providerId: 'email-password'
      },
      data: {
        password: hashedPassword
      }
    });

    // Delete used verification token
    await prisma.verification.delete({
      where: { id: verification.id }
    });

    console.log(`✅ Password reset successful for user ${user.email}`);

    res.json({ 
      success: true, 
      message: 'Password has been successfully reset' 
    });

  } catch (error) {
    console.error('Password reset confirmation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please try again.' 
    });
  }
});

export default router;