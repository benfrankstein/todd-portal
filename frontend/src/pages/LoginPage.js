import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import FirstTimePasswordReset from '../components/FirstTimePasswordReset';
import PhoneVerification from '../components/PhoneVerification';
import ForgotPassword from '../components/ForgotPassword';
import '../styles/LoginPage.css';

function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const passwordInputRef = useRef(null);
  const auth = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Don't clear error immediately - let user read it
    // Error will clear on next submit attempt
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call API directly instead of using login from AuthContext for first-time check
      const data = await authAPI.login(formData.email, formData.password);
      console.log('Login result:', data);
      console.log('First time?', data.firstTime);

      // Check if first-time login - show password reset modal
      if (data.firstTime) {
        console.log('Showing password reset modal');
        // Store token temporarily but don't set user in context yet
        localStorage.setItem('token', data.token);
        setLoggedInUser(data.user);
        setShowPasswordReset(true);
        setLoading(false);
        return;
      }

      // Not first time - check if admin (skip phone verification for admins)
      if (data.user.role === 'admin') {
        // Admin users skip phone verification - log them in directly
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        await auth.login(formData.email, formData.password);
        // AuthContext will handle navigation
        return;
      }

      // For non-admin users - send verification code and show phone verification
      localStorage.setItem('token', data.token);
      setLoggedInUser(data.user);

      // Send verification code
      try {
        await authAPI.sendVerificationCode(data.user.phoneNumber);
        setShowPhoneVerification(true);
      } catch (verifyErr) {
        setError('Failed to send verification code. Please try again.');
        localStorage.removeItem('token');
      }
    } catch (err) {
      // Set error message from backend (or default)
      setError(err.response?.data?.error || 'An error occurred during login. Please try again.');

      // Clear password field for security (industry best practice)
      // Keep email field so user can fix typos
      setFormData(prevData => ({
        email: prevData.email, // Explicitly preserve email
        password: '' // Clear password
      }));

      // Focus password field after a short delay so user can see error message
      setTimeout(() => {
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      }, 500); // Longer delay so user can read error
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetSuccess = async (phoneNumber) => {
    // After successful password reset
    setShowPasswordReset(false);

    // If admin, skip phone verification and log them in directly
    if (loggedInUser.role === 'admin') {
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      window.location.href = '/';
      return;
    }

    // For non-admin users, send verification code
    // Update logged in user with the new phone number
    const updatedUser = { ...loggedInUser, phoneNumber: phoneNumber };
    setLoggedInUser(updatedUser);

    try {
      // Send verification code to the newly set phone number
      await authAPI.sendVerificationCode(phoneNumber);
      setShowPhoneVerification(true);
    } catch (err) {
      setError('Failed to send verification code. Please try again.');
      localStorage.removeItem('token');
    }
  };

  const handlePhoneVerificationSuccess = () => {
    // After successful phone verification, save user and force reload
    // This allows AuthContext to pick up the user from localStorage and handle routing
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    window.location.href = '/';
  };

  return (
    <>
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="company-title">Coastal Private Lending</h1>
            <p className="company-subtitle">Secure Portal Access</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  ref={passwordInputRef}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="4" y1="4" x2="20" y2="20"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="forgot-password-link">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="link-button"
                  disabled={loading}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>

      {showPasswordReset && loggedInUser && (
        <FirstTimePasswordReset
          user={loggedInUser}
          onSuccess={handlePasswordResetSuccess}
        />
      )}

      {showPhoneVerification && loggedInUser && loggedInUser.phoneNumber && (
        <PhoneVerification
          phoneNumber={loggedInUser.phoneNumber}
          onSuccess={handlePhoneVerificationSuccess}
        />
      )}

      {showForgotPassword && (
        <ForgotPassword
          onClose={() => setShowForgotPassword(false)}
        />
      )}
    </>
  );
}

export default LoginPage;
