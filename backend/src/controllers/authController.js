const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../models');
const twilioService = require('../services/twilioService');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');

/**
 * Generate password (random 12 character string)
 */
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Login
 * POST /api/auth/login
 * Body: { email: string, password: string }
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user (use lowercase for case-insensitive email lookup)
    const user = await db.User.findOne({ where: { email: email.trim().toLowerCase() } });

    if (!user) {
      // Generic error message for security (don't reveal if email exists)
      return res.status(401).json({ error: 'Invalid email or password. Please check your credentials and try again.' });
    }

    // Validate password
    const isValid = await user.validatePassword(password);

    if (!isValid) {
      // Same generic error message
      return res.status(401).json({ error: 'Invalid email or password. Please check your credentials and try again.' });
    }

    // Check if active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account is currently inactive. Please contact support for assistance.' });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        businessName: user.businessName,
        phoneNumber: user.phoneNumber
      },
      firstTime: user.firstTime
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login. Please try again.' });
  }
};

/**
 * Reset password for first-time login and set phone number
 * POST /api/auth/reset-first-time-password
 * Body: { password: string, confirmPassword: string, phoneNumber: string }
 * Requires authentication
 */
exports.resetFirstTimePassword = async (req, res) => {
  try {
    const { password, confirmPassword, phoneNumber } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({ error: 'Password and confirmation required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Get user from auth middleware
    const user = await db.User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this is actually a first-time login
    if (!user.firstTime) {
      return res.status(400).json({ error: 'This endpoint is only for first-time password reset' });
    }

    // Phone number is only required for non-admin users
    if (user.role !== 'admin') {
      if (!phoneNumber || !phoneNumber.trim()) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
    }

    // Update password, phone number (if provided), and set firstTime to false
    const updateData = {
      password: password, // Will be hashed by model hook
      firstTime: false
    };

    // Only update phone number if provided (for non-admin users it's required, for admin it's optional)
    if (phoneNumber && phoneNumber.trim()) {
      updateData.phoneNumber = phoneNumber;
    }

    await user.update(updateData);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset first-time password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

/**
 * Get current user info
 * GET /api/auth/me
 */
exports.getCurrentUser = async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        businessName: req.user.businessName
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

/**
 * Get unique business names from funded table
 * GET /api/auth/business-names
 */
exports.getBusinessNames = async (req, res) => {
  try {
    // Get distinct business names with their contact information
    // We'll get one record per business (the first one alphabetically by project address)
    const businesses = await db.Funded.findAll({
      attributes: ['businessName', 'email', 'firstName', 'lastName'],
      where: {
        businessName: { [db.Sequelize.Op.ne]: null }
      },
      group: ['businessName', 'email', 'firstName', 'lastName'],
      order: [['businessName', 'ASC']],
      raw: true
    });

    // Create a map to get unique businesses with their contact info
    const businessMap = new Map();
    businesses.forEach(b => {
      if (!businessMap.has(b.businessName)) {
        businessMap.set(b.businessName, {
          businessName: b.businessName,
          email: b.email,
          firstName: b.firstName,
          lastName: b.lastName
        });
      }
    });

    const businessData = Array.from(businessMap.values());

    res.json({
      success: true,
      businesses: businessData
    });

  } catch (error) {
    console.error('Get business names error:', error);
    res.status(500).json({ error: 'Failed to get business names' });
  }
};

/**
 * Create client user with generated password
 * POST /api/auth/create-client
 * Body: { email: string, firstName: string, lastName: string, businessName: string }
 */
exports.createClientUser = async (req, res) => {
  try {
    const { email, firstName, lastName, businessName } = req.body;

    if (!email || !firstName || !lastName || !businessName) {
      return res.status(400).json({
        error: 'Email, first name, last name, and business name required'
      });
    }

    // Check if user already exists
    const existing = await db.User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate random password
    const generatedPassword = generatePassword();

    // Create user
    const user = await db.User.create({
      email,
      password: generatedPassword, // Will be hashed by model hook
      firstName,
      lastName,
      businessName,
      role: 'borrower',
      isActive: true
    });

    // Send welcome email with temporary password
    const emailResult = await sendWelcomeEmail(email, firstName, generatedPassword);

    if (!emailResult.success) {
      console.error('Failed to send welcome email:', emailResult.error);
      // Continue anyway - user is created, just log the email error
    } else {
      console.log(`Welcome email sent to ${email}`);
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessName: user.businessName,
        password: generatedPassword // Return plaintext password ONLY on creation
      },
      message: 'User created successfully. A welcome email with login instructions has been sent.'
    });

  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client user' });
  }
};

/**
 * Get all users (admin only)
 * GET /api/auth/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await db.User.findAll({
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'businessName', 'isActive', 'createdAt', 'lastLogin', 'lastSyncTimestamp'],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      users
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

/**
 * Delete user (admin only)
 * DELETE /api/auth/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        error: 'You cannot delete your own account'
      });
    }

    // Find user
    const user = await db.User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Delete user
    await user.destroy();

    res.json({
      success: true,
      message: `User ${user.email} has been deleted successfully`
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

/**
 * Get investor names from promissory table
 * GET /api/auth/investor-names
 */
exports.getInvestorNames = async (req, res) => {
  try {
    const investors = await db.Promissory.findAll({
      attributes: ['investorName', 'investorEmail'],
      where: {
        investorName: { [db.Sequelize.Op.ne]: null }
      },
      group: ['investorName', 'investorEmail'],
      order: [['investorName', 'ASC']]
    });

    // Use a Map to get unique investors by name, keeping the first email found
    const investorMap = new Map();
    investors.forEach(inv => {
      if (!investorMap.has(inv.investorName)) {
        investorMap.set(inv.investorName, {
          investorName: inv.investorName,
          investorEmail: inv.investorEmail
        });
      }
    });

    const investorData = Array.from(investorMap.values());

    res.json({
      success: true,
      investors: investorData
    });

  } catch (error) {
    console.error('Get investor names error:', error);
    res.status(500).json({ error: 'Failed to get investor names' });
  }
};

/**
 * Create investor user with generated password
 * POST /api/auth/create-investor
 * Body: { email: string, firstName: string, lastName: string, investorName: string }
 */
exports.createInvestorUser = async (req, res) => {
  try {
    const { email, firstName, lastName, investorName } = req.body;

    if (!email || !firstName || !lastName || !investorName) {
      return res.status(400).json({
        error: 'Email, first name, last name, and investor name required'
      });
    }

    // Check if user already exists
    const existing = await db.User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate random password
    const generatedPassword = generatePassword();

    // Create user with role 'promissory' and businessName set to investorName
    const user = await db.User.create({
      email,
      password: generatedPassword, // Will be hashed by model hook
      firstName,
      lastName,
      businessName: investorName, // Store investor name in businessName field
      role: 'promissory',
      isActive: true
    });

    // Send welcome email with temporary password
    const emailResult = await sendWelcomeEmail(email, firstName, generatedPassword);

    if (!emailResult.success) {
      console.error('Failed to send welcome email:', emailResult.error);
      // Continue anyway - user is created, just log the email error
    } else {
      console.log(`Welcome email sent to ${email}`);
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        investorName: user.businessName,
        password: generatedPassword // Return plaintext password ONLY on creation
      },
      message: 'Investor user created successfully. A welcome email with login instructions has been sent.'
    });

  } catch (error) {
    console.error('Create investor error:', error);
    res.status(500).json({ error: 'Failed to create investor user' });
  }
};

/**
 * Get cap investor names from capinvestor table
 * GET /api/auth/capinvestor-names
 */
exports.getCapInvestorNames = async (req, res) => {
  try {
    const capInvestors = await db.CapInvestor.findAll({
      attributes: ['investorName'],
      where: {
        investorName: { [db.Sequelize.Op.ne]: null }
      },
      group: ['investorName'],
      order: [['investorName', 'ASC']]
    });

    // Use a Map to get unique cap investors by name
    const capInvestorMap = new Map();
    capInvestors.forEach(inv => {
      if (!capInvestorMap.has(inv.investorName)) {
        capInvestorMap.set(inv.investorName, {
          investorName: inv.investorName
        });
      }
    });

    const capInvestorData = Array.from(capInvestorMap.values());

    res.json({
      success: true,
      capInvestors: capInvestorData
    });

  } catch (error) {
    console.error('Get cap investor names error:', error);
    res.status(500).json({ error: 'Failed to get cap investor names' });
  }
};

/**
 * Create cap investor user with generated password
 * POST /api/auth/create-capinvestor
 * Body: { email: string, firstName: string, lastName: string, investorName: string }
 */
exports.createCapInvestorUser = async (req, res) => {
  try {
    const { email, firstName, lastName, investorName } = req.body;

    if (!email || !firstName || !lastName || !investorName) {
      return res.status(400).json({
        error: 'Email, first name, last name, and investor name required'
      });
    }

    // Check if user already exists
    const existing = await db.User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate random password
    const generatedPassword = generatePassword();

    // Create user with role 'capinvestor' and businessName set to investorName
    const user = await db.User.create({
      email,
      password: generatedPassword, // Will be hashed by model hook
      firstName,
      lastName,
      businessName: investorName, // Store investor name in businessName field
      role: 'capinvestor',
      isActive: true
    });

    // Send welcome email with temporary password
    const emailResult = await sendWelcomeEmail(email, firstName, generatedPassword);

    if (!emailResult.success) {
      console.error('Failed to send welcome email:', emailResult.error);
      // Continue anyway - user is created, just log the email error
    } else {
      console.log(`Welcome email sent to ${email}`);
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        investorName: user.businessName,
        password: generatedPassword // Return plaintext password ONLY on creation
      },
      message: 'Cap investor user created successfully. A welcome email with login instructions has been sent.'
    });

  } catch (error) {
    console.error('Create cap investor error:', error);
    res.status(500).json({ error: 'Failed to create cap investor user' });
  }
};

/**
 * Send SMS verification code to user's phone
 * POST /api/auth/send-verification-code
 * Body: { phoneNumber: string }
 * Requires authentication
 */
exports.sendVerificationCode = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || !phoneNumber.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Get user from auth middleware
    const user = await db.User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify phone number matches user's phone number
    if (user.phoneNumber !== phoneNumber.trim()) {
      return res.status(400).json({ error: 'Phone number does not match your account' });
    }

    // Send verification code via Twilio
    const result = await twilioService.sendVerificationCode(phoneNumber);

    res.json({
      success: true,
      message: 'Verification code sent successfully',
      status: result.status
    });

  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      error: error.message || 'Failed to send verification code'
    });
  }
};

/**
 * Verify SMS code entered by user
 * POST /api/auth/verify-phone
 * Body: { phoneNumber: string, code: string }
 * Requires authentication
 */
exports.verifyPhone = async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }

    // Get user from auth middleware
    const user = await db.User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify phone number matches user's phone number
    if (user.phoneNumber !== phoneNumber.trim()) {
      return res.status(400).json({ error: 'Phone number does not match your account' });
    }

    // Verify code via Twilio
    const result = await twilioService.verifyCode(phoneNumber, code);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid verification code',
        status: result.status
      });
    }

    // Update user's phone verification status
    await user.update({ phoneVerified: true });

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      verified: true
    });

  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(400).json({
      error: error.message || 'Invalid verification code'
    });
  }
};

/**
 * Request password reset - sends reset email
 * POST /api/auth/forgot-password
 * Body: { email: string }
 * Public route - no authentication required
 */
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await db.User.findOne({ where: { email: email.trim().toLowerCase() } });

    // Check if user doesn't exist
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.status(404).json({
        success: false,
        error: 'Account not found with that email address. Please check your email and try again.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log(`Password reset requested for inactive user: ${email}`);
      return res.status(403).json({
        success: false,
        error: 'This account is currently inactive. Please contact support for assistance.'
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before storing (for security)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token expiration to 1 hour from now
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save hashed token and expiration to database
    await user.update({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expires
    });

    // Send password reset email with the unhashed token
    const emailResult = await sendPasswordResetEmail(user.email, user.firstName, resetToken);

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return res.status(500).json({
        error: 'Failed to send password reset email. Please try again later.'
      });
    }

    console.log(`Password reset email sent to ${user.email}`);

    res.json({
      success: true,
      accountFound: true,
      email: user.email,
      message: `Account found! A password reset link has been sent to ${user.email}. Please check your inbox.`
    });

  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({
      error: 'Failed to process password reset request. Please try again later.'
    });
  }
};

/**
 * Validate reset token
 * GET /api/auth/reset-password/:token
 * Public route - no authentication required
 */
exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token that hasn't expired
    const user = await db.User.findOne({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          [db.Sequelize.Op.gt]: new Date() // Token hasn't expired
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset token. Please request a new password reset.'
      });
    }

    // Token is valid
    res.json({
      success: true,
      message: 'Token is valid',
      email: user.email
    });

  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(500).json({
      error: 'Failed to validate reset token'
    });
  }
};

/**
 * Reset password using token
 * POST /api/auth/reset-password
 * Body: { token: string, password: string, confirmPassword: string }
 * Public route - no authentication required
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    // Validate inputs
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        error: 'Token, password, and confirmation are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token that hasn't expired
    const user = await db.User.findOne({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          [db.Sequelize.Op.gt]: new Date() // Token hasn't expired
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset token. Please request a new password reset.'
      });
    }

    // Update password and clear reset token fields
    await user.update({
      password: password, // Will be hashed by model hook
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    console.log(`Password successfully reset for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Failed to reset password. Please try again.'
    });
  }
};
