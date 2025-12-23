# Twilio Verify SMS Integration Setup

This document explains the SMS verification feature that has been integrated into the Coastal Private Lending portal.

## Overview

SMS verification has been implemented to enhance security. Users must verify their phone number via SMS code on **every login**.

## Features Implemented

### Backend Changes

1. **Twilio Service** (`src/services/twilioService.js`)
   - Handles sending SMS verification codes
   - Handles verifying user-entered codes
   - Supports international phone formats
   - Gracefully handles missing/invalid Twilio credentials

2. **API Endpoints**
   - `POST /api/auth/send-verification-code` - Send SMS code to user's phone
   - `POST /api/auth/verify-phone` - Verify the code entered by user

3. **Database Updates**
   - Added `phone_number` column to users table
   - Added `phone_verified` column to users table
   - Admin user phone set to: 9736150406

4. **Controller Updates**
   - `authController.sendVerificationCode()` - Send verification code
   - `authController.verifyPhone()` - Verify phone code
   - Login response now includes `phoneNumber` field

### Frontend Changes

1. **PhoneVerification Component** (`src/components/PhoneVerification.js`)
   - Modal that prompts user to enter 6-digit code
   - Automatic code sending on mount
   - Resend code functionality with 60-second cooldown
   - Input validation (6 digits only)
   - Error handling and user feedback

2. **Login Flow Updates**
   - After successful login → Send verification code
   - After first-time password reset → Send verification code
   - Show PhoneVerification modal
   - After successful verification → Redirect to dashboard

3. **API Integration**
   - Added `sendVerificationCode()` method to authAPI
   - Added `verifyPhone()` method to authAPI

## Twilio Setup Instructions

### 1. Create Twilio Account

If you don't have one already:
1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free trial account
3. Complete phone verification for your account

### 2. Create a Verify Service

1. Log in to Twilio Console: https://console.twilio.com
2. Navigate to **Verify** → **Services**
3. Click **Create new Service**
4. Give it a name (e.g., "Coastal Lending Portal")
5. Click **Create**
6. Copy the **Service SID** (starts with "VA")

### 3. Get Your Credentials

1. Go to Twilio Console Dashboard: https://console.twilio.com
2. Find your **Account SID** (starts with "AC")
3. Find your **Auth Token** (click "Show" to reveal)

### 4. Update Environment Variables

Edit `/Users/benfrankstein/Projects/todd-portal/backend/.env`:

```bash
# Twilio Verify Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Your Account SID
TWILIO_AUTH_TOKEN=your_auth_token_here                 # Your Auth Token
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxx    # Your Verify Service SID
```

Replace the placeholder values with your actual Twilio credentials.

### 5. Restart Backend Server

After updating the .env file, restart the backend server for changes to take effect:

```bash
cd /Users/benfrankstein/Projects/todd-portal/backend
npm start
```

You should see the message:
```
✓ Database connected successfully
```

If Twilio is not configured, you'll see a warning:
```
⚠️  Twilio credentials not configured. SMS verification will not work.
```

## Testing the Feature

### Test Users

- **Admin User**
  - Email: admin@coastalprivatelending.com
  - Password: root
  - Phone: 9736150406

### Testing Steps

1. **Start the Application**
   ```bash
   # Terminal 1 - Backend
   cd /Users/benfrankstein/Projects/todd-portal/backend
   npm start

   # Terminal 2 - Frontend
   cd /Users/benfrankstein/Projects/todd-portal/frontend
   npm start
   ```

2. **Test Login Flow**
   - Navigate to http://localhost:3000/login
   - Enter email and password
   - Click "Login"
   - You should receive an SMS with a 6-digit code
   - Enter the code in the verification modal
   - Click "Verify"
   - You should be redirected to the dashboard

3. **Test First-Time User Flow**
   - Create a new user with generated password
   - Login with email and generated password
   - Complete password reset form (includes phone number entry)
   - You should receive an SMS with verification code
   - Enter code and verify
   - Redirected to dashboard

## Phone Number Format

The system accepts phone numbers in any format:
- US format: `9736150406`
- International format: `+19736150406`
- With formatting: `(973) 615-0406`

The system automatically normalizes phone numbers:
- Removes spaces, dashes, parentheses
- Adds `+1` for US numbers without country code

## Important Notes

### Twilio Trial Account Limitations

If using a Twilio trial account:
1. You can only send SMS to **verified phone numbers**
2. To verify a phone number:
   - Go to Twilio Console → Phone Numbers → Verified Caller IDs
   - Click "+" to add a new number
   - Enter the phone number and complete verification
3. SMS messages will include a trial message prefix
4. Limited to a certain number of messages per month

### Upgrading to Production

To remove trial limitations:
1. Upgrade your Twilio account (add billing info)
2. Purchase a Twilio phone number for sending SMS
3. No code changes needed - just upgrade in Twilio console

### Rate Limiting

Twilio has built-in rate limiting:
- Maximum 5 verification attempts per phone number per hour
- Maximum 10 verification checks per verification code

## Error Handling

The system handles various error scenarios:

1. **Invalid Phone Number**: User-friendly error message
2. **Too Many Attempts**: Cooldown period enforced
3. **Invalid Code**: Clear error message with ability to resend
4. **Expired Code**: Codes expire after 10 minutes
5. **Twilio Not Configured**: Graceful error message asking user to contact support

## Security Features

1. **Phone Number Validation**: Matches user's registered phone number
2. **Token Required**: Must be authenticated to request verification
3. **One-Time Codes**: Each code can only be used once
4. **Time Limited**: Codes expire after 10 minutes
5. **Rate Limited**: Prevents abuse via multiple attempts

## File Structure

```
backend/
├── src/
│   ├── controllers/
│   │   └── authController.js          # Added verification endpoints
│   ├── routes/
│   │   └── auth.js                    # Added verification routes
│   ├── services/
│   │   └── twilioService.js           # NEW - Twilio integration
│   ├── models/
│   │   └── user.js                    # Added phone fields
│   ├── migrations/
│   │   ├── ...-add-phone-number-to-users.js
│   │   └── ...-add-phone-verified-to-users.js
│   └── scripts/
│       └── update-admin-phone.js      # Script to update admin phone
├── .env                               # Updated with Twilio vars
└── TWILIO_SETUP.md                    # This file

frontend/
├── src/
│   ├── components/
│   │   └── PhoneVerification.js       # NEW - Verification modal
│   ├── pages/
│   │   └── LoginPage.js               # Updated login flow
│   ├── services/
│   │   └── api.js                     # Added verification methods
│   └── styles/
│       └── PhoneVerification.css      # NEW - Modal styles
```

## Troubleshooting

### SMS Not Received

1. Check Twilio console logs for delivery status
2. Verify phone number is correct format
3. Check if phone number is verified (for trial accounts)
4. Check spam/junk folder (some carriers filter automated SMS)

### "SMS verification is not configured" Error

1. Verify .env file has correct Twilio credentials
2. Verify credentials start with correct prefixes (AC, VA)
3. Restart backend server after updating .env
4. Check server logs for specific error messages

### Verification Code Doesn't Work

1. Check if code has expired (10 minutes)
2. Check if you exceeded maximum attempts (5 per hour)
3. Request a new code using "Resend Code" button
4. Verify you're entering the correct 6-digit code

## Next Steps

1. **Set up Twilio account** and get credentials
2. **Update .env file** with real Twilio credentials
3. **Test with your phone number** (add to verified numbers if using trial)
4. **Update all user phone numbers** in the database
5. **Monitor Twilio usage** in the console
6. **Consider upgrading** Twilio account for production use

## Support

For Twilio-related issues:
- Twilio Documentation: https://www.twilio.com/docs/verify
- Twilio Support: https://support.twilio.com
- Twilio Console: https://console.twilio.com

For application issues, check the server logs for detailed error messages.
