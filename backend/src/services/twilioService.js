const twilio = require('twilio');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Check if credentials are properly configured
const hasValidCredentials = accountSid &&
  authToken &&
  verifyServiceSid &&
  accountSid.startsWith('AC') &&
  authToken !== 'your_twilio_auth_token_here' &&
  verifyServiceSid !== 'your_twilio_verify_service_sid_here';

if (!hasValidCredentials) {
  console.warn('⚠️  Twilio credentials not configured. SMS verification will not work.');
  console.warn('   Please update .env file with valid Twilio credentials.');
}

// Only initialize client if credentials are valid
let client = null;
if (hasValidCredentials) {
  client = twilio(accountSid, authToken);
}

/**
 * Send verification code to phone number
 * @param {string} phoneNumber - Phone number in any format (will be normalized)
 * @returns {Promise<object>} - Verification result
 */
exports.sendVerificationCode = async (phoneNumber) => {
  if (!client) {
    throw new Error('SMS verification is not configured. Please contact support.');
  }

  try {
    // Normalize phone number - remove spaces, dashes, etc.
    const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');

    // If number doesn't start with +, assume US and add +1
    const formattedPhone = normalizedPhone.startsWith('+')
      ? normalizedPhone
      : `+1${normalizedPhone}`;

    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: formattedPhone,
        channel: 'sms'
      });

    return {
      success: true,
      status: verification.status,
      to: formattedPhone
    };
  } catch (error) {
    console.error('Twilio send verification error:', error);

    // Handle specific Twilio errors
    if (error.code === 60200) {
      throw new Error('Invalid phone number format');
    } else if (error.code === 60203) {
      throw new Error('Maximum send attempts reached. Please try again later.');
    } else if (error.code === 60212) {
      throw new Error('Too many attempts. Please wait before requesting a new code.');
    }

    throw new Error('Failed to send verification code');
  }
};

/**
 * Verify the code entered by user
 * @param {string} phoneNumber - Phone number that received the code
 * @param {string} code - Verification code entered by user
 * @returns {Promise<object>} - Verification result
 */
exports.verifyCode = async (phoneNumber, code) => {
  if (!client) {
    throw new Error('SMS verification is not configured. Please contact support.');
  }

  try {
    // Normalize phone number same way as send
    const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
    const formattedPhone = normalizedPhone.startsWith('+')
      ? normalizedPhone
      : `+1${normalizedPhone}`;

    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: formattedPhone,
        code: code
      });

    return {
      success: verificationCheck.status === 'approved',
      status: verificationCheck.status
    };
  } catch (error) {
    console.error('Twilio verify code error:', error);

    // Handle specific Twilio errors
    if (error.code === 60200) {
      throw new Error('Invalid phone number format');
    } else if (error.code === 60202) {
      throw new Error('Maximum verification attempts reached');
    } else if (error.code === 60223) {
      throw new Error('Invalid verification code');
    }

    throw new Error('Failed to verify code');
  }
};
