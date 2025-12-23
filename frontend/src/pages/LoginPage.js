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

      // Not first time - send verification code and show phone verification
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
    // After successful password reset, send verification code
    setShowPasswordReset(false);

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
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                disabled={loading}
                ref={passwordInputRef}
              />
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

      {showPasswordReset && (
        <FirstTimePasswordReset
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
