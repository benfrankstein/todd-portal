import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import '../styles/ResetPasswordPage.css';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid reset link. Please request a new password reset.');
        setValidating(false);
        return;
      }

      try {
        const response = await authAPI.validateResetToken(token);
        setTokenValid(true);
        setUserEmail(response.email);
      } catch (err) {
        setError(err.response?.data?.error || 'Invalid or expired reset link. Please request a new password reset.');
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      await authAPI.resetPassword(token, formData.password, formData.confirmPassword);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  if (validating) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Validating reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="reset-password-header">
            <h1 className="company-title">Coastal Private Lending</h1>
            <p className="page-title">Invalid Reset Link</p>
          </div>

          <div className="error-container">
            <div className="error-icon">⚠</div>
            <p className="error-text">{error}</p>
            <button
              onClick={handleGoToLogin}
              className="btn-primary"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="reset-password-header">
            <h1 className="company-title">Coastal Private Lending</h1>
            <p className="page-title">Password Reset Successful</p>
          </div>

          <div className="success-container">
            <div className="success-icon">✓</div>
            <p className="success-text">
              Your password has been reset successfully!
            </p>
            <p className="success-subtext">
              Redirecting to login page...
            </p>
            <button
              onClick={handleGoToLogin}
              className="btn-primary"
            >
              Go to Login Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <div className="reset-password-header">
          <h1 className="company-title">Coastal Private Lending</h1>
          <p className="page-title">Reset Your Password</p>
          {userEmail && (
            <p className="user-email">Resetting password for: {userEmail}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="reset-password-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter new password (min 8 characters)"
              required
              minLength={8}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter new password"
              required
              minLength={8}
              disabled={loading}
            />
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>

          <div className="back-to-login">
            <button
              type="button"
              onClick={handleGoToLogin}
              className="back-link"
              disabled={loading}
            >
              ← Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
