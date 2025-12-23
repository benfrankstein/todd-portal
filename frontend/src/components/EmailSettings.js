import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/EmailSettings.css';

const EmailSettings = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('invoice_client');
  const [templateData, setTemplateData] = useState({
    subject: '',
    greeting: '',
    bodyMessage: '',
    closingMessage: '',
    signature: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const templateLabels = {
    'invoice_client': 'Client Invoice Email',
    'invoice_investor': 'Investor (Promissory) Invoice Email',
    'invoice_capinvestor': 'Cap Investor Invoice Email',
    'user_welcome': 'User Welcome Email'
  };

  const invoiceVariables = [
    { var: '{{businessName}}', desc: 'Client or Investor business name' },
    { var: '{{month}}', desc: 'Invoice month (e.g., "December")' },
    { var: '{{year}}', desc: 'Invoice year (e.g., "2025")' },
    { var: '{{formattedDate}}', desc: 'Full date (e.g., "December 19, 2025")' },
    { var: '{{totalAmount}}', desc: 'Formatted currency amount' },
    { var: '{{amountLabel}}', desc: '"Total Interest Due" or "Total Interest Earned"' }
  ];

  const welcomeVariables = [
    { var: '{{firstName}}', desc: 'User\'s first name' },
    { var: '{{email}}', desc: 'User\'s email address' },
    { var: '{{password}}', desc: 'Temporary password' },
    { var: '{{portalUrl}}', desc: 'Portal URL (cplportal.com)' }
  ];

  const templateVariables = selectedTemplate === 'user_welcome' ? welcomeVariables : invoiceVariables;

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (templates.length > 0) {
      loadTemplate(selectedTemplate);
    }
  }, [selectedTemplate, templates]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/email-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data.templates);
    } catch (error) {
      console.error('Error loading templates:', error);
      setMessage({ type: 'error', text: 'Failed to load email templates' });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = async (templateName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/email-templates/${templateName}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const template = response.data.template;
      setTemplateData({
        subject: template.subject,
        greeting: template.greeting,
        bodyMessage: template.bodyMessage,
        closingMessage: template.closingMessage,
        signature: template.signature
      });
    } catch (error) {
      console.error('Error loading template:', error);
      setMessage({ type: 'error', text: 'Failed to load template' });
    }
  };

  const handleChange = (field, value) => {
    setTemplateData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear message when user starts editing
    if (message.text) {
      setMessage({ type: '', text: '' });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const token = localStorage.getItem('token');
      await axios.put(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/email-templates/${selectedTemplate}`,
        templateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: 'Template saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving template:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  const confirmReset = async () => {
    setShowResetConfirm(false);

    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/email-templates/${selectedTemplate}/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const template = response.data.template;
      setTemplateData({
        subject: template.subject,
        greeting: template.greeting,
        bodyMessage: template.bodyMessage,
        closingMessage: template.closingMessage,
        signature: template.signature
      });
      setMessage({ type: 'success', text: 'Template reset to default successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error resetting template:', error);
      setMessage({ type: 'error', text: 'Failed to reset template' });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/email-templates/${selectedTemplate}/preview`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPreviewData(response.data.preview);
      setShowPreview(true);
    } catch (error) {
      console.error('Error loading preview:', error);
      setMessage({ type: 'error', text: 'Failed to load preview' });
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Please enter an email address' });
      return;
    }

    try {
      setSendingTest(true);
      setMessage({ type: '', text: '' });
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/email-templates/${selectedTemplate}/test`,
        { recipientEmail: testEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: `Test email sent to ${testEmail}!` });
      setShowTestModal(false);
      setTestEmail('');
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Error sending test email:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to send test email' });
    } finally {
      setSendingTest(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: `Copied "${text}" to clipboard!` });
    setTimeout(() => setMessage({ type: '', text: '' }), 2000);
  };

  if (loading) {
    return (
      <div className="email-settings-container">
        <div className="loading-state">Loading email templates...</div>
      </div>
    );
  }

  return (
    <div className="email-settings-container">
      <div className="email-settings-header">
        <div>
          <h2>Email Template Settings</h2>
          <p>Customize email templates for invoices, welcome messages, and notifications</p>
        </div>
      </div>

      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="template-selector">
        <label>Select Template:</label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="template-dropdown"
        >
          {Object.keys(templateLabels).map(key => (
            <option key={key} value={key}>{templateLabels[key]}</option>
          ))}
        </select>
      </div>

      <div className="template-editor">
        <div className="editor-section">
          <label>Subject Line</label>
          <input
            type="text"
            value={templateData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            placeholder="e.g., Monthly Loan Invoice - {{month}} {{year}}"
          />
        </div>

        <div className="editor-section">
          <label>Greeting</label>
          <input
            type="text"
            value={templateData.greeting}
            onChange={(e) => handleChange('greeting', e.target.value)}
            placeholder="e.g., Dear Valued Client"
          />
        </div>

        <div className="editor-section">
          <label>Body Message</label>
          <textarea
            value={templateData.bodyMessage}
            onChange={(e) => handleChange('bodyMessage', e.target.value)}
            placeholder="Main message content..."
            rows={3}
          />
        </div>

        <div className="editor-section">
          <label>Closing Message</label>
          <textarea
            value={templateData.closingMessage}
            onChange={(e) => handleChange('closingMessage', e.target.value)}
            placeholder="e.g., Thank you for your continued partnership..."
            rows={4}
          />
        </div>

        <div className="editor-section">
          <label>Signature</label>
          <input
            type="text"
            value={templateData.signature}
            onChange={(e) => handleChange('signature', e.target.value)}
            placeholder="e.g., Coastal Private Lending Team"
          />
        </div>
      </div>

      <div className="template-variables">
        <h3>Available Template Variables</h3>
        <p className="variables-description">Click any variable to copy it to your clipboard:</p>
        <div className="variables-grid">
          {templateVariables.map((item, index) => (
            <div
              key={index}
              className="variable-chip"
              onClick={() => copyToClipboard(item.var)}
              title="Click to copy"
            >
              <code>{item.var}</code>
              <span className="variable-desc">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="action-buttons">
        <button onClick={handleSave} className="button-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button onClick={handlePreview} className="button-secondary">
          Preview Email
        </button>
        <button onClick={() => setShowTestModal(true)} className="button-secondary">
          Send Test Email
        </button>
        <button onClick={handleReset} className="button-danger" disabled={saving}>
          Reset to Default
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-content preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Email Preview (with Sample Data)</h2>
              <button onClick={() => setShowPreview(false)} className="modal-close">&times;</button>
            </div>
            <div className="preview-content">
              <div className="preview-section">
                <strong>Subject:</strong>
                <p>{previewData.subject}</p>
              </div>
              <div className="preview-section">
                <strong>Greeting:</strong>
                <p>{previewData.greeting},</p>
              </div>
              <div className="preview-section">
                <strong>Body:</strong>
                <p style={{ whiteSpace: 'pre-line' }}>{previewData.bodyMessage}</p>
              </div>
              <div className="preview-section">
                <strong>Closing:</strong>
                <p style={{ whiteSpace: 'pre-line' }}>{previewData.closingMessage}</p>
              </div>
              <div className="preview-section">
                <strong>Signature:</strong>
                <p>{previewData.signature}</p>
              </div>
            </div>
            <button onClick={() => setShowPreview(false)} className="button-primary">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="modal-overlay" onClick={() => setShowTestModal(false)}>
          <div className="modal-content test-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Send Test Email</h2>
              <button onClick={() => setShowTestModal(false)} className="modal-close">&times;</button>
            </div>
            <div className="modal-body">
              <p>Enter an email address to receive a test invoice email with sample data:</p>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="test-email-input"
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleSendTest} className="button-primary" disabled={sendingTest}>
                {sendingTest ? 'Sending...' : 'Send Test Email'}
              </button>
              <button onClick={() => setShowTestModal(false)} className="button-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={cancelReset}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Template</h2>
              <button onClick={cancelReset} className="modal-close">&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '32px 24px' }}>
              <div className="warning-icon">⚠️</div>
              <p>Are you sure you want to reset this template to default? This cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button onClick={cancelReset} className="button-secondary">Cancel</button>
              <button onClick={confirmReset} className="button-danger">Reset to Default</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailSettings;
