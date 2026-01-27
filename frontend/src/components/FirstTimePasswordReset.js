import React, { useState } from 'react';
import { authAPI } from '../services/api';
import '../styles/FirstTimePasswordReset.css';

const FirstTimePasswordReset = ({ user, onSuccess, onCancel }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isAdmin = user?.role === 'admin';

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handlePhoneNumberChange = (e) => {
    setPhoneNumber(e.target.value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Validate phone number is provided (only for non-admin users)
    if (!isAdmin && !phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }

    try {
      setLoading(true);
      await authAPI.resetFirstTimePassword(password, confirmPassword, phoneNumber);
      // Pass the phone number to parent component for verification
      onSuccess(phoneNumber);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
      setLoading(false);
    }
  };

  return (
    <div className="password-reset-overlay">
      <div className="password-reset-modal">
        <div className="password-reset-header">
          <h2>Welcome! Complete Your Profile</h2>
          <p>
            {isAdmin
              ? "You're logging in for the first time. Please create a new password."
              : "You're logging in for the first time. Please create a new password and enter your phone number."
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="password-reset-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter new password (min 8 characters)"
                required
                minLength={8}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="Re-enter new password"
                required
                minLength={8}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
                disabled={loading}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          {!isAdmin && (
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                placeholder="Enter your phone number"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FirstTimePasswordReset;
