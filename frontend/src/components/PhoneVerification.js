import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import '../styles/PhoneVerification.css';

const PhoneVerification = ({ phoneNumber, onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      await authAPI.verifyPhone(phoneNumber, code);
      setSuccessMessage('Phone verified successfully!');

      // Wait a moment then call onSuccess
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setError('');
    setSuccessMessage('');

    try {
      setLoading(true);
      await authAPI.sendVerificationCode(phoneNumber);
      setSuccessMessage('Verification code sent!');
      setResendCooldown(60); // 60 second cooldown
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    // Only allow digits and limit to 6 characters
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  return (
    <div className="phone-verification-overlay">
      <div className="phone-verification-modal">
        <div className="phone-verification-header">
          <h2>Verify Your Phone</h2>
          <p>
            We've sent a 6-digit verification code to <strong>{phoneNumber}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="phone-verification-form">
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          <div className="form-group">
            <label htmlFor="code">Verification Code</label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={handleCodeChange}
              placeholder="Enter 6-digit code"
              required
              maxLength={6}
              disabled={loading}
              className="code-input"
              autoFocus
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || code.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>

          <div className="resend-section">
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resendCooldown > 0}
              className="btn-link"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PhoneVerification;
