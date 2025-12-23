import React, { useState } from 'react';
import { authAPI } from '../services/api';
import '../styles/ForgotPassword.css';

const ForgotPassword = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSuccessMessage('');

    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setLoading(true);
      const response = await authAPI.requestPasswordReset(email);

      if (response.success && response.accountFound) {
        setSuccess(true);
        setUserEmail(response.email);
        setSuccessMessage(response.message);
        console.log('Password reset email sent:', response.message);
      }
    } catch (err) {
      // Handle specific error responses
      if (err.response?.status === 404) {
        setError(err.response.data.error || 'Account not found with that email address.');
      } else if (err.response?.status === 403) {
        setError(err.response.data.error || 'This account is currently inactive.');
      } else {
        setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-overlay" onClick={onClose}>
      <div className="forgot-password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="forgot-password-header">
          <h2>Forgot Password?</h2>
          {!success && (
            <p>Enter your email address and we'll send you a link to reset your password.</p>
          )}
        </div>

        {success ? (
          <div className="success-message-container">
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h3 className="success-title">Account Found!</h3>
              <p className="success-email">
                {userEmail}
              </p>
              <p>
                A password reset link has been sent to your email address.
                Please check your inbox and follow the instructions to reset your password.
              </p>
              <p className="success-note">
                The reset link will expire in 1 hour for security reasons.
              </p>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="forgot-password-form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
