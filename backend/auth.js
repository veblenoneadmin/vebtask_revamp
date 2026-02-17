import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./lib/prisma.js";

console.log('✅ Using Prisma adapter for Better Auth');
// Helper function to get the base URL for the application
function getBaseURL() {
  return process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || "http://localhost:3009";
}

// Helper function to get the full auth API URL
function getAuthBaseURL() {
  return getBaseURL() + "/api/auth";
}

console.log('🔐 Better Auth Config:', {
  appBaseURL: getBaseURL(),
  authBaseURL: getAuthBaseURL(),
  googleRedirectURI: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 
    "Auto-generated from baseURL" : "N/A",
  hasSecret: !!process.env.BETTER_AUTH_SECRET,
  environment: process.env.NODE_ENV,
  googleOAuthEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql"
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || "https://vebtask.com",
  basePath: "/api/auth",
  secret: (() => {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('BETTER_AUTH_SECRET environment variable is required in production');
      }
      console.warn('⚠️  Using fallback secret for development. Set BETTER_AUTH_SECRET in production!');
      return "test-secret-key-for-debugging";
    }
    return secret;
  })(),
  
  // Authentication providers
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Always get refresh token and show account selector
      accessType: "offline",
      prompt: "select_account consent"
      // Let Better Auth auto-generate redirectURI from baseURL
    }
  } : {},
  
  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 6,
    maxPasswordLength: 128
  },
  
  // Session configuration
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 24 hours
    cookieName: "vebtask.session",
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5 // 5 minutes
    }
  },
  
  // Pages configuration for redirects (removed callback - let Better Auth handle it)
  
  // Trusted origins for CORS
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:3001",
    "http://localhost:3000",
    "https://vebtask.com",
    "https://www.vebtask.com",
    "https://vebtask-production.up.railway.app"
  ],
  
  // Advanced configuration
  advanced: {
    database: {
      generateId: () => crypto.randomUUID()
    },
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: "lax",
      httpOnly: true,
      domain: process.env.NODE_ENV === 'production' ? '.vebtask.com' : undefined
    }
  },
  
  // Password reset configuration
  passwordReset: {
    enabled: true,
    expiresIn: 60 * 15, // 15 minutes
    sendResetPassword: async ({ user, token }) => {
      // This will be handled by our custom routes
      console.log(`Password reset requested for ${user.email}, token: ${token}`);
    }
  },
  
  // Email verification
  emailVerification: {
    enabled: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, token }) => {
      console.log(`📧 Sending verification email to ${user.email}, token: ${token}`);
      
      // Import nodemailer
      const nodemailer = await import('nodemailer');
      
      // Create SMTP transporter
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const verificationUrl = `${getBaseURL()}/email-verified?token=${token}`;

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        replyTo: process.env.SMTP_FROM || process.env.SMTP_USER,
        subject: 'Verify your VebTask account - Action Required',
        headers: {
          'X-Priority': '1',
          'X-Mailer': 'VebTask Authentication System',
          'List-Unsubscribe': `<mailto:unsubscribe@veblengroup.com.au>`,
          'Message-ID': `<${Date.now()}.${Math.random().toString(36)}@veblengroup.com.au>`
        },
        text: `
Welcome to VebTask!

Hi ${user.name || 'there'},

Thank you for signing up for VebTask. To complete your registration and secure your account, please verify your email address.

Verify your email by visiting this link:
${verificationUrl}

This verification link will expire in 24 hours for security purposes.

If you did not create a VebTask account, please ignore this email.

Best regards,
The VebTask Team
Veblen Group
        `.trim(),
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your VebTask Account</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0; padding: 0; background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                            <img src="https://vebtask.com/veblen-logo.png" alt="VebTask" style="height: 40px; width: auto;" />
                            <h1 style="margin: 20px 0 0; color: #1e293b; font-size: 24px; font-weight: 600;">Welcome to VebTask</h1>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">Hi ${user.name || 'there'},</p>
                            
                            <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">Thank you for signing up for VebTask! To complete your registration and secure your account, please verify your email address.</p>
                            
                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 40px 0;">
                                <a href="${verificationUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
                            </div>
                            
                            <p style="margin: 20px 0; color: #64748b; font-size: 14px; line-height: 1.6;">If the button above doesn't work, copy and paste this link into your browser:</p>
                            <p style="margin: 0 0 20px; color: #6366f1; font-size: 14px; word-break: break-all;">${verificationUrl}</p>
                            
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;" />
                            
                            <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; line-height: 1.6;"><strong>Security Notice:</strong> This verification link will expire in 24 hours.</p>
                            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">If you did not create a VebTask account, please ignore this email.</p>
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

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to ${user.email}`);
      } catch (error) {
        console.error('❌ Failed to send verification email:', error);
        throw error;
      }
    }
  },
  
  // User configuration
  user: {
    modelName: "User",
    additionalFields: {
      activeOrgId: {
        type: "string",
        required: false
      }
    }
  },
  
  // Callbacks for custom logic
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔐 Sign in callback:', { 
        userId: user?.id, 
        email: user?.email, 
        provider: account?.providerId,
        providerAccountId: account?.providerAccountId,
        profileId: profile?.id,
        profileEmail: profile?.email 
      });
      return true;
    },
    async session({ session, token }) {
      console.log('🔐 Session callback:', {
        sessionId: session?.id,
        userId: session?.userId,
        tokenId: token?.id,
        hasActiveOrgId: !!token?.activeOrgId
      });
      // Add organization context to session
      if (token.activeOrgId) {
        session.activeOrgId = token.activeOrgId;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      console.log('🔐 JWT callback:', {
        hasToken: !!token,
        hasUser: !!user,
        hasAccount: !!account,
        tokenId: token?.id,
        userId: user?.id
      });
      // Add custom claims to JWT
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    }
  },
  
  // Request/Response logging
  async onRequest(request, response) {
    // Log ALL auth-related requests to debug OAuth flow
    console.log('🔐 Auth Request:', {
      method: request.method,
      url: request.url,
      pathname: request.pathname,
      query: request.query,
      hasAuthHeader: !!request.headers?.authorization,
      hasCookies: !!request.headers?.cookie,
      cookieDetails: request.headers?.cookie?.substring(0, 200),
      contentType: request.headers?.['content-type'],
      userAgent: request.headers?.['user-agent']?.substring(0, 50)
    });
    
    // Log sign-in attempts specifically
    if (request.url?.includes('/sign-in/email')) {
      console.log('📧 Email sign-in attempt:', {
        body: request.body ? Object.keys(request.body) : 'no-body',
        hasEmail: !!(request.body?.email),
        hasPassword: !!(request.body?.password)
      });
    }
  },

  async onResponse(request, response) {
    // Log responses, especially for sign-in attempts and OAuth callbacks
    if (request.url?.includes('/sign-in/') || request.url?.includes('/callback/')) {
      console.log('🔐 Auth Response:', {
        url: request.url,
        method: request.method,
        status: response?.status || 'no-status',
        hasSetCookie: !!response?.headers?.['set-cookie'],
        setCookieCount: response?.headers?.['set-cookie']?.length || 0,
        location: response?.headers?.location,
        contentType: response?.headers?.['content-type'],
        responseHeaders: Object.keys(response?.headers || {})
      });
    }
    return response;
  },
  
  // Error handling
  onError(error, request) {
    console.error('🔐 Better-Auth Error:', {
      message: error.message,
      path: request?.url,
      method: request?.method,
      body: request?.body,
      provider: request?.body?.provider,
      name: error.name,
      code: error.code,
      cause: error.cause,
      stack: error.stack,
      fullError: error
    });
    // Log database errors specifically
    if (error.message?.includes('database') || error.message?.includes('prisma')) {
      console.error('Database error details:', error);
    }
  },
  
  // Rate limiting
  rateLimit: {
    enabled: true,
    window: 60 * 1000, // 1 minute
    max: 100 // requests per window
  }
});

console.log('✅ Better-auth instance created successfully');