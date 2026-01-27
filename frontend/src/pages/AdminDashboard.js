import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, importAPI, invoiceAPI } from '../services/api';
import EmailSettings from '../components/EmailSettings';
import '../styles/Dashboard.css';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [capInvestors, setCapInvestors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('client'); // 'client', 'investor', or 'capinvestor'
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [selectedCapInvestor, setSelectedCapInvestor] = useState(null);
  const [newUser, setNewUser] = useState({
    email: '',
    firstName: '',
    lastName: ''
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'borrowers', 'promissory', 'capinvestors', 'settings'

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResults, setSyncResults] = useState(null);

  // Invoice generation state
  const [generatingInvoices, setGeneratingInvoices] = useState(false);

  // Delete user state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    loadData();
  }, []);

  // Reset search term when changing tabs
  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [businessData, investorData, capInvestorData, usersData] = await Promise.all([
        authAPI.getBusinessNames(),
        authAPI.getInvestorNames(),
        authAPI.getCapInvestorNames(),
        authAPI.getAllUsers()
      ]);
      setBusinesses(businessData.businesses || []);
      setInvestors(investorData.investors || []);
      setCapInvestors(capInvestorData.capInvestors || []);
      const allUsers = usersData.users || [];
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateUserModal = (business) => {
    setModalType('client');
    setSelectedBusiness(business);
    setSelectedInvestor(null);
    setShowModal(true);
    // Auto-populate contact fields from business data
    setNewUser({
      email: business.email || '',
      firstName: business.firstName || '',
      lastName: business.lastName || ''
    });
    setGeneratedPassword('');
    setError('');
  };

  const openCreateInvestorModal = (investor) => {
    setModalType('investor');
    setSelectedInvestor(investor);
    setSelectedBusiness(null);
    setSelectedCapInvestor(null);
    setShowModal(true);
    // Auto-populate email from investor data
    setNewUser({
      email: investor.investorEmail || '',
      firstName: '',
      lastName: ''
    });
    setGeneratedPassword('');
    setError('');
  };

  const openCreateCapInvestorModal = (capInvestor) => {
    setModalType('capinvestor');
    setSelectedCapInvestor(capInvestor);
    setSelectedBusiness(null);
    setSelectedInvestor(null);
    setShowModal(true);
    setNewUser({
      email: '',
      firstName: '',
      lastName: ''
    });
    setGeneratedPassword('');
    setError('');
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('client');
    setSelectedBusiness(null);
    setSelectedInvestor(null);
    setSelectedCapInvestor(null);
    setNewUser({ email: '', firstName: '', lastName: '' });
    setGeneratedPassword('');
    setError('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      let response;
      if (modalType === 'client') {
        response = await authAPI.createClientUser({
          ...newUser,
          businessName: selectedBusiness.businessName
        });
      } else if (modalType === 'investor') {
        response = await authAPI.createInvestorUser({
          ...newUser,
          investorName: selectedInvestor.investorName
        });
      } else if (modalType === 'capinvestor') {
        response = await authAPI.createCapInvestorUser({
          ...newUser,
          investorName: selectedCapInvestor.investorName
        });
      }

      setGeneratedPassword(response.user.password);
      await loadData(); // Reload users list
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    alert('Password copied to clipboard!');
  };

  const handleSyncData = async () => {
    try {
      setSyncing(true);
      setSyncResults(null);
      setError('');

      // Call the sync-all API endpoint
      const data = await importAPI.syncAllSheets();

      setSyncResults(data.results);
      setShowSyncModal(true);
      showNotification('success', 'Data synced successfully from Google Sheets!');

      // Reload data after sync
      await loadData();
    } catch (error) {
      console.error('Sync error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to sync data. Please try again.';
      setError(errorMsg);
      showNotification('error', `Sync failed: ${errorMsg}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateInvoices = async () => {
    try {
      setGeneratingInvoices(true);
      setError('');

      // Call the generate invoices API endpoint
      const data = await invoiceAPI.generateInvoices();

      showNotification('success', 'Invoice generation started! This process may take several minutes. Invoices will be sent via email when complete.');
    } catch (error) {
      console.error('Invoice generation error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to start invoice generation. Please try again.';
      setError(errorMsg);
      showNotification('error', `Invoice generation failed: ${errorMsg}`);
    } finally {
      setGeneratingInvoices(false);
    }
  };

  const closeSyncModal = () => {
    setShowSyncModal(false);
    setSyncResults(null);
  };

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: '', message: '' });
    }, 5000);
  };

  const handleDeleteUserClick = (userId, userName) => {
    setUserToDelete({ id: userId, name: userName });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    try {
      await authAPI.deleteUser(userToDelete.id);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      // Reload users after deletion
      await loadData();
      showNotification('success', `User "${userToDelete.name}" has been deleted successfully`);
    } catch (error) {
      console.error('Error deleting user:', error);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      showNotification('error', error.response?.data?.error || 'Failed to delete user');
    }
  };

  const cancelDeleteUser = () => {
    setShowDeleteConfirm(false);
    setUserToDelete(null);
  };

  // Get current tab data and filter based on search term
  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'borrowers':
        return businesses.filter(business =>
          business.businessName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      case 'promissory':
        return investors.filter(investor =>
          investor.investorName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      case 'capinvestors':
        return capInvestors.filter(capInvestor =>
          capInvestor.investorName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      default:
        return [];
    }
  };

  const currentTabData = getCurrentTabData();

  // Get current admin user's last sync timestamp
  const currentAdminUser = users.find(u => u.email === user.email && u.role === 'admin');
  const lastSyncTimestamp = currentAdminUser?.lastSyncTimestamp;

  if (loading) {
    return <div className="dashboard-container">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      {/* Notification Banner */}
      {notification.show && (
        <div className={`notification-banner ${notification.type}`}>
          {notification.type === 'success' ? '✓' : '✗'} {notification.message}
        </div>
      )}

      {/* Syncing Banner */}
      {syncing && (
        <div className="syncing-banner">
          <div className="syncing-spinner"></div>
          <span>Syncing data from Google Sheets...</span>
        </div>
      )}

      {/* Invoice Generation Banner */}
      {generatingInvoices && (
        <div className="syncing-banner">
          <div className="syncing-spinner"></div>
          <span>Generating invoices...</span>
        </div>
      )}

      <header className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Welcome, {user.firstName}!</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastSyncTimestamp && (
            <span style={{ fontSize: '0.9rem', color: '#64748b', marginRight: '5px' }}>
              Last sync: {new Date(lastSyncTimestamp).toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric'
              })} at {new Date(lastSyncTimestamp).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </span>
          )}
          <button
            onClick={handleSyncData}
            className="sync-button"
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Refresh Data'}
          </button>
          <button
            onClick={handleGenerateInvoices}
            className="sync-button"
            disabled={generatingInvoices}
          >
            {generatingInvoices ? 'Generating...' : 'Generate Invoices'}
          </button>
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Tab Navigation */}
        <div className="admin-tabs-container">
          <div className="admin-tabs">
            <button
              className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Users
              <span className="tab-count">{users.length}</span>
            </button>
            <button
              className={`admin-tab ${activeTab === 'borrowers' ? 'active' : ''}`}
              onClick={() => setActiveTab('borrowers')}
            >
              Borrowers
              <span className="tab-count">{businesses.length}</span>
            </button>
            <button
              className={`admin-tab ${activeTab === 'promissory' ? 'active' : ''}`}
              onClick={() => setActiveTab('promissory')}
            >
              Promissory
              <span className="tab-count">{investors.length}</span>
            </button>
            <button
              className={`admin-tab ${activeTab === 'capinvestors' ? 'active' : ''}`}
              onClick={() => setActiveTab('capinvestors')}
            >
              Cap Investors
              <span className="tab-count">{capInvestors.length}</span>
            </button>
            <button
              className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>

          {/* Tab Content */}
          <div className="admin-tab-content">
            {/* Data Tabs (Borrowers, Promissory, Cap Investors) */}
            {['borrowers', 'promissory', 'capinvestors'].includes(activeTab) && (
              <>
                {/* Search Bar */}
                <div className="admin-tab-search">
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder={
                      activeTab === 'borrowers' ? 'Search borrowers...' :
                      activeTab === 'promissory' ? 'Search promissory...' :
                      'Search cap investors...'
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Scrollable Business List */}
                <div className="admin-business-list">
                  {currentTabData.length > 0 ? (
                    currentTabData.map((item, index) => {
                      const name = item.businessName || item.investorName;
                      const role = activeTab === 'borrowers' ? 'borrower' : activeTab === 'promissory' ? 'promissory' : 'capinvestor';
                      const itemUsers = users.filter(u => u.businessName === name && u.role === role);

                      return (
                        <div key={index} className="admin-business-item">
                          <div className="admin-business-info">
                            <div className="admin-business-name">{name}</div>
                            <div className="admin-business-users">{itemUsers.length} user(s)</div>
                          </div>
                          <button
                            onClick={() => {
                              if (activeTab === 'borrowers') {
                                openCreateUserModal(item);
                              } else if (activeTab === 'promissory') {
                                openCreateInvestorModal(item);
                              } else {
                                openCreateCapInvestorModal(item);
                              }
                            }}
                            className="admin-create-user-button"
                          >
                            + Create User
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="admin-business-empty">
                      {searchTerm ? 'No results found' : `No ${activeTab} available`}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="admin-users-card">
                <div className="admin-users-header">
                  <h2>All Users</h2>
                  <span className="admin-users-count">{users.length} total</span>
                </div>
                <div className="table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Business</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>{u.firstName} {u.lastName}</td>
                          <td>{u.email}</td>
                          <td>{u.businessName || '-'}</td>
                          <td>
                            <span className={`role-badge role-${u.role}`}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${u.isActive ? 'active' : 'inactive'}`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                          <td>
                            <button
                              onClick={() => handleDeleteUserClick(u.id, `${u.firstName} ${u.lastName}`)}
                              className="delete-user-button"
                              title="Delete user"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <EmailSettings />
            )}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalType === 'client'
                  ? `Create User for ${selectedBusiness?.businessName}`
                  : modalType === 'investor'
                  ? `Create User for ${selectedInvestor?.investorName}`
                  : `Create User for ${selectedCapInvestor?.investorName}`
                }
              </h2>
              <button onClick={closeModal} className="modal-close">&times;</button>
            </div>

            {!generatedPassword ? (
              <form onSubmit={handleCreateUser} className="modal-form">
                {error && <div className="error-message">{error}</div>}

                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                    required
                    disabled={creating}
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                    required
                    disabled={creating}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    required
                    disabled={creating}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={closeModal} className="button-secondary" disabled={creating}>
                    Cancel
                  </button>
                  <button type="submit" className="button-primary" disabled={creating}>
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="success-content">
                <div className="success-icon">✓</div>
                <h3>User Created Successfully!</h3>
                <p>Please save these credentials. The password cannot be retrieved later.</p>

                <div className="credentials-box">
                  <div className="credential-item">
                    <label>Email:</label>
                    <span>{newUser.email}</span>
                  </div>
                  <div className="credential-item">
                    <label>Password:</label>
                    <div className="password-display">
                      <code>{generatedPassword}</code>
                      <button onClick={copyPassword} className="copy-button">
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={closeModal} className="button-primary">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Results Modal */}
      {showSyncModal && syncResults && (
        <div className="modal-overlay" onClick={closeSyncModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Google Sheets Sync Complete</h2>
              <button onClick={closeSyncModal} className="modal-close">&times;</button>
            </div>

            <div className="sync-results">
              {/* Funded Results */}
              <div className="sync-section">
                <h3>📊 Funded (Borrowers)</h3>
                <div className="sync-stats">
                  <div className="sync-stat">
                    <span className="sync-stat-label">Created:</span>
                    <span className="sync-stat-value success">{syncResults.funded.created}</span>
                  </div>
                  <div className="sync-stat">
                    <span className="sync-stat-label">Updated:</span>
                    <span className="sync-stat-value info">{syncResults.funded.updated}</span>
                  </div>
                  <div className="sync-stat">
                    <span className="sync-stat-label">Deleted:</span>
                    <span className="sync-stat-value error">{syncResults.funded.deleted}</span>
                  </div>
                  <div className="sync-stat">
                    <span className="sync-stat-label">Failed:</span>
                    <span className="sync-stat-value warning">{syncResults.funded.failed}</span>
                  </div>
                </div>
              </div>

              {/* Promissory Results */}
              <div className="sync-section">
                <h3>💰 Promissory (Investors)</h3>
                <div className="sync-stats">
                  <div className="sync-stat">
                    <span className="sync-stat-label">Created:</span>
                    <span className="sync-stat-value success">{syncResults.promissory.created}</span>
                  </div>
                  <div className="sync-stat">
                    <span className="sync-stat-label">Deleted:</span>
                    <span className="sync-stat-value error">{syncResults.promissory.deleted}</span>
                  </div>
                  <div className="sync-stat">
                    <span className="sync-stat-label">Failed:</span>
                    <span className="sync-stat-value warning">{syncResults.promissory.failed}</span>
                  </div>
                </div>
              </div>

              {/* Cap Investor Results */}
              <div className="sync-section">
                <h3>🏦 Cap Investors</h3>
                <div className="sync-stats">
                  <div className="sync-stat">
                    <span className="sync-stat-label">Created:</span>
                    <span className="sync-stat-value success">{syncResults.capInvestor.created}</span>
                  </div>
                  <div className="sync-stat">
                    <span className="sync-stat-label">Updated:</span>
                    <span className="sync-stat-value info">{syncResults.capInvestor.updated}</span>
                  </div>
                  <div className="sync-stat">
                    <span className="sync-stat-label">Deleted:</span>
                    <span className="sync-stat-value error">{syncResults.capInvestor.deleted}</span>
                  </div>
                  <div className="sync-stat">
                    <span className="sync-stat-label">Failed:</span>
                    <span className="sync-stat-value warning">{syncResults.capInvestor.failed}</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="sync-summary">
                <p>✅ All data has been synced from Google Sheets successfully!</p>
                <p>The dashboard will now show the latest data from your spreadsheets.</p>
              </div>
            </div>

            <button onClick={closeSyncModal} className="button-primary">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteConfirm && userToDelete && (
        <div className="modal-overlay" onClick={cancelDeleteUser}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete User</h2>
              <button onClick={cancelDeleteUser} className="modal-close">&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '32px 24px' }}>
              <div className="warning-icon">⚠️</div>
              <p style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px', textAlign: 'center', fontWeight: '600' }}>
                Are you sure you want to delete user "{userToDelete.name}"?
              </p>
              <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', margin: 0 }}>
                This action cannot be undone. The user will be permanently removed from the system.
              </p>
            </div>
            <div className="modal-actions" style={{ padding: '0 24px 24px 24px' }}>
              <button onClick={cancelDeleteUser} className="button-secondary">
                Cancel
              </button>
              <button onClick={confirmDeleteUser} className="button-danger">
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
