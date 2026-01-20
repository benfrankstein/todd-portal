import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fundedAPI, promissoryAPI, capInvestorAPI, invoiceAPI } from '../services/api';
import '../styles/Dashboard.css';
import logo from '../assets/coastal-logo.png';

function ClientDashboard() {
  const { user, logout } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects', 'invoice', or 'statements'
  const [sortBy, setSortBy] = useState((user.role === 'promissory' || user.role === 'capinvestor') ? 'activity' : 'maturityDate'); // 'maturityDate', 'loanAmount', 'address', 'activity'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'closed'
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);

  useEffect(() => {
    loadRecords();
    loadInvoices(); // Preload invoices on mount for faster Past Statements tab
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);

      // Determine which API to call based on user role
      let response;
      if (user.role === 'promissory') {
        response = await promissoryAPI.getMyRecords();
        setBusinessName(response.investorName || '');
      } else if (user.role === 'capinvestor') {
        response = await capInvestorAPI.getMyRecords();
        setBusinessName(response.investorName || '');
      } else {
        // borrower role or any other role defaults to funded data
        response = await fundedAPI.getMyRecords();
        setBusinessName(response.businessName || '');
      }

      setRecords(response.records || []);
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return '-';

    // Try to parse as YYYY-MM-DD format first (for invoice dates)
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    // Otherwise parse as regular date (handles ISO strings, timestamps, etc.)
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid Date';

    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPercent = (value) => {
    if (!value) return '-';
    return `${value}%`;
  };

  const handleCardClick = (record) => {
    setSelectedProject(record);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProject(null);
  };

  const getInvoiceDate = () => {
    // Get current date in Eastern timezone (to match invoice generation)
    const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const dateET = new Date(nowET);

    // Create date as 1st of current month in Eastern Time
    const firstOfMonth = new Date(dateET.getFullYear(), dateET.getMonth(), 1);
    return firstOfMonth.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Export as PDF function - commented out but kept for future use
  // const handlePrint = () => {
  //   window.print();
  // };

  const loadInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const response = await invoiceAPI.getMyInvoices();
      setInvoices(response.invoices || []);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleDownloadInvoice = (downloadUrl, fileName) => {
    // Open the pre-signed URL in a new tab to download
    window.open(downloadUrl, '_blank');
  };

  // Calculate portfolio metrics
  const getPortfolioMetrics = () => {
    let totalValue = 0;
    let activeLoans = records.length;
    let totalPayment = 0;

    if (user.role === 'capinvestor') {
      // For cap investors, only count funded loans for metrics
      const fundedLoans = records.filter(r => {
        const status = r.loanStatus ? r.loanStatus.toLowerCase() : '';
        return status === 'funded';
      });
      totalValue = fundedLoans.reduce((sum, r) => sum + (parseFloat(r.loanAmount) || 0), 0);
      activeLoans = fundedLoans.length;
      totalPayment = fundedLoans.reduce((sum, r) => sum + (parseFloat(r.payment) || 0), 0);
    } else if (user.role === 'promissory') {
      // For promissory users, only count active loans (exclude closed)
      const activePromissoryLoans = records.filter(r => !r.status || r.status.toLowerCase() !== 'closed');
      totalValue = activePromissoryLoans.reduce((sum, r) => sum + (parseFloat(r.loanAmount) || 0), 0);
      activeLoans = activePromissoryLoans.length;
      totalPayment = activePromissoryLoans.reduce((sum, r) => sum + (parseFloat(r.capitalPay) || 0), 0);
    } else {
      // For borrowers, use all records
      totalValue = records.reduce((sum, r) => sum + (parseFloat(r.loanAmount) || 0), 0);
      totalPayment = records.reduce((sum, r) => sum + (parseFloat(r.interestPayment) || 0), 0);
    }

    const avgLoan = activeLoans > 0 ? totalValue / activeLoans : 0;

    return {
      totalValue,
      activeLoans,
      avgLoan,
      totalPayment
    };
  };

  // Determine project status
  const getProjectStatus = (record) => {
    // For cap investors, return the actual loan status
    if (user.role === 'capinvestor' && record.loanStatus) {
      return record.loanStatus.toLowerCase();
    }
    // Check if status field exists and use it (for promissory and borrower)
    if (record.status) {
      const status = record.status.toLowerCase();
      if (status === 'closed') return 'closed';
    }
    // Check loanStatus field for other investor types
    if (record.loanStatus) {
      const status = record.loanStatus.toLowerCase();
      if (status === 'closed') return 'closed';
    }
    // Default to active
    return 'active';
  };

  // Filter and sort records
  const getFilteredAndSortedRecords = () => {
    let filtered = [...records];

    // Apply filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(record => {
        const status = getProjectStatus(record);
        return status === filterStatus;
      });
    }

    // Apply sort
    filtered.sort((a, b) => {
      if (sortBy === 'activity') {
        // Sort by activity
        const statusA = getProjectStatus(a);
        const statusB = getProjectStatus(b);

        if (user.role === 'capinvestor') {
          // For cap investors: funded > under contract > closed
          const statusOrder = { 'funded': 1, 'under contract': 2, 'closed': 3 };
          const orderA = statusOrder[statusA] || 999;
          const orderB = statusOrder[statusB] || 999;
          return orderA - orderB;
        } else {
          // For other roles: active first, then closed
          if (statusA === 'active' && statusB === 'closed') return -1;
          if (statusA === 'closed' && statusB === 'active') return 1;
          return 0; // same status, keep original order
        }
      } else if (sortBy === 'loanAmount') {
        return (parseFloat(b.loanAmount) || 0) - (parseFloat(a.loanAmount) || 0);
      } else if (sortBy === 'address') {
        return (a.projectAddress || '').localeCompare(b.projectAddress || '');
      } else { // maturityDate
        const dateA = a.maturityDate ? new Date(a.maturityDate) : new Date('2099-12-31');
        const dateB = b.maturityDate ? new Date(b.maturityDate) : new Date('2099-12-31');
        return dateA - dateB;
      }
    });

    return filtered;
  };

  if (loading) {
    return <div className="dashboard-container">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <img src={logo} alt="Coastal Private Lending" className="dashboard-logo" />
          <div className="header-info">
            <p>Welcome, {user.firstName}!</p>
            <p className="business-name-header">{businessName}</p>
          </div>
        </div>
        <div className="header-center">
          {/* Tab Navigation in Header */}
          <div className="tab-navigation no-print">
            <button
              className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              Projects
            </button>
            <button
              className={`tab-button ${activeTab === 'invoice' ? 'active' : ''}`}
              onClick={() => setActiveTab('invoice')}
            >
              Invoice Statement
            </button>
            <button
              className={`tab-button ${activeTab === 'statements' ? 'active' : ''}`}
              onClick={() => setActiveTab('statements')}
            >
              Past Statements
            </button>
          </div>
        </div>
        <div className="header-right">
          <button onClick={() => setShowAccountModal(true)} className="account-button">
            Account
          </button>
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">

        {/* Projects Tab */}
        <section className="dashboard-section" style={{ display: activeTab === 'projects' ? 'block' : 'none' }}>
            {/* Portfolio Metrics */}
            <div className="portfolio-metrics">
              <div className="metric-card">
                <div className="metric-content">
                  <div className="metric-label">Active Loans</div>
                  <div className="metric-value">{getPortfolioMetrics().activeLoans}</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-content">
                  <div className="metric-label">
                    {user.role === 'capinvestor' ? 'Active Loaned Amount' :
                     user.role === 'promissory' ? 'Active Loaned Amount' : 'Borrowed Amount'}
                  </div>
                  <div className="metric-value">{formatCurrency(getPortfolioMetrics().totalValue)}</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-content">
                  <div className="metric-label">Avg Loan Size</div>
                  <div className="metric-value">{formatCurrency(getPortfolioMetrics().avgLoan)}</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-content">
                  <div className="metric-label">{(user.role === 'promissory' || user.role === 'capinvestor') ? 'Monthly Collected Payment' : 'Monthly Interest Payment'}</div>
                  <div className="metric-value">{formatCurrency(getPortfolioMetrics().totalPayment)}</div>
                </div>
              </div>
            </div>

            <div className="section-header">
              <h2>{(user.role === 'promissory' || user.role === 'capinvestor') ? 'Your Investments' : 'Your Funded Projects'}</h2>
              <span className="record-count">{getFilteredAndSortedRecords().length} of {records.length} {(user.role === 'promissory' || user.role === 'capinvestor') ? 'investment(s)' : 'project(s)'}</span>
            </div>

            {/* Filters and Sorting */}
            <div className="filters-bar">
              <div className="filter-group">
                <label>Sort by:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
                  {(user.role === 'promissory' || user.role === 'capinvestor') ? (
                    <>
                      <option value="activity">Activity</option>
                      <option value="loanAmount">Loan Amount</option>
                      <option value="address">Address</option>
                    </>
                  ) : (
                    <>
                      <option value="maturityDate">Maturity Date</option>
                      <option value="loanAmount">Loan Amount</option>
                      <option value="address">Address</option>
                    </>
                  )}
                </select>
              </div>
              <div className="filter-group">
                <label>Filter:</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
                  {user.role === 'capinvestor' ? (
                    <>
                      <option value="all">All Projects</option>
                      <option value="funded">Funded</option>
                      <option value="under contract">Under Contract</option>
                      <option value="closed">Closed</option>
                    </>
                  ) : (
                    <>
                      <option value="all">All Projects</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {getFilteredAndSortedRecords().length === 0 ? (
              <div className="empty-state">
                <p>No projects match your current filters.</p>
              </div>
            ) : (
              <div className="projects-grid">
                {getFilteredAndSortedRecords().map((record, index) => {
                  const status = getProjectStatus(record);
                  const isInvestor = (user.role === 'promissory' || user.role === 'capinvestor');

                  return (
                    <div
                      key={record.id || index}
                      className="project-card"
                      onClick={() => handleCardClick(record)}
                    >
                      <div className="project-card-header">
                        <h3 className="project-address">
                          {user.role === 'promissory'
                            ? (record.type || record.assetId || 'Investment')
                            : user.role === 'capinvestor'
                            ? (record.propertyAddress || 'No Address')
                            : (record.projectAddress || 'No Address')
                          }
                        </h3>
                        <span className={`status-tag ${status.replace(' ', '-')}`}>
                          {user.role === 'capinvestor' ? (
                            <>
                              {status === 'funded' && 'Funded'}
                              {status === 'under contract' && 'Under Contract'}
                              {status === 'closed' && 'Closed'}
                            </>
                          ) : (
                            <>
                              {status === 'active' && 'Active'}
                              {status === 'closed' && 'Closed'}
                            </>
                          )}
                        </span>
                      </div>
                      <div className="project-card-body">
                        <div className="project-stat">
                          <span className="stat-label">Loan Amount</span>
                          <span className="stat-value">{formatCurrency(record.loanAmount)}</span>
                        </div>
                        <div className="project-stat">
                          <span className="stat-label">Interest Rate</span>
                          <span className="stat-value">{formatPercent(record.interestRate)}</span>
                        </div>
                        <div className="project-stat">
                          {user.role === 'capinvestor' && record.loanStatus && record.loanStatus.toLowerCase() === 'closed' && record.payoffDate ? (
                            <>
                              <span className="stat-label">Payoff Date</span>
                              <span className="stat-value">{formatDate(record.payoffDate)}</span>
                            </>
                          ) : user.role === 'promissory' && record.status && record.status.toLowerCase() === 'closed' && record.payoffDate ? (
                            <>
                              <span className="stat-label">Payoff Date</span>
                              <span className="stat-value">{formatDate(record.payoffDate)}</span>
                            </>
                          ) : user.role === 'capinvestor' && record.fundDate ? (
                            <>
                              <span className="stat-label">Fund Date</span>
                              <span className="stat-value">{formatDate(record.fundDate)}</span>
                            </>
                          ) : (
                            <>
                              <span className="stat-label">Maturity Date</span>
                              <span className="stat-value">{formatDate(record.maturityDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="project-card-footer">
                        <span className="view-details">View Details →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </section>

        {/* Invoice Statement Tab */}
        <section className="dashboard-section" style={{ display: activeTab === 'invoice' ? 'block' : 'none' }}>
          {loadingInvoices ? (
            <div className="loading-container">
              <p>Loading invoice...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="empty-state invoice-coming-soon">
              <div className="coming-soon-icon">📄</div>
              <h3>New Invoice Statement Coming Soon</h3>
              <p>Your invoice statement will be available on the 1st of next month.</p>
            </div>
          ) : (
            <div className="pdf-viewer-container">
              {!pdfLoaded && (
                <div className="pdf-loading-overlay">
                  <p>Loading invoice...</p>
                </div>
              )}
              <iframe
                src={`${invoices[0].downloadUrl}#toolbar=0&navpanes=0&view=FitH`}
                title="Invoice Statement"
                className="pdf-iframe"
                onLoad={() => setPdfLoaded(true)}
                style={{ display: pdfLoaded ? 'block' : 'none' }}
              />
            </div>
          )}
        </section>

        {/* Past Statements Tab */}
        <section className="dashboard-section" style={{ display: activeTab === 'statements' ? 'block' : 'none' }}>
            <h2 className="section-title">Past Invoice Statements</h2>

            {loadingInvoices ? (
              <div className="loading-container">
                <p>Loading invoices...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="empty-state">
                <p>No past invoices found.</p>
              </div>
            ) : (
              <div className="invoices-list">
                <table className="invoices-table">
                  <thead>
                    <tr>
                      <th>Invoice Date</th>
                      <th>File Name</th>
                      <th>Total Amount</th>
                      <th>Loan Count</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{formatDate(invoice.invoiceDate)}</td>
                        <td>{invoice.fileName}</td>
                        <td>{formatCurrency(invoice.totalAmount)}</td>
                        <td>{invoice.recordCount} loans</td>
                        <td>
                          <button
                            onClick={() => handleDownloadInvoice(invoice.downloadUrl, invoice.fileName)}
                            className="download-button"
                          >
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </div>

      {/* Project Details Modal */}
      {showModal && selectedProject && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content project-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {user.role === 'promissory'
                  ? (selectedProject.type || selectedProject.assetId || 'Investment Details')
                  : user.role === 'capinvestor'
                  ? (selectedProject.propertyAddress || 'Investment Details')
                  : (selectedProject.projectAddress || 'Project Details')
                }
              </h2>
              <button onClick={closeModal} className="modal-close">&times;</button>
            </div>

            <div className="project-details">
              {user.role === 'capinvestor' ? (
                // Cap Investor specific fields
                <>
                  {selectedProject.propertyAddress && (
                    <div className="detail-row">
                      <span className="detail-label">Property Address</span>
                      <span className="detail-value">{selectedProject.propertyAddress}</span>
                    </div>
                  )}

                  <div className="detail-row">
                    <span className="detail-label">Loan Amount</span>
                    <span className="detail-value">{formatCurrency(selectedProject.loanAmount)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Interest Rate</span>
                    <span className="detail-value">{formatPercent(selectedProject.interestRate)}</span>
                  </div>

                  {selectedProject.payment && (
                    <div className="detail-row">
                      <span className="detail-label">Payment</span>
                      <span className="detail-value">{formatCurrency(selectedProject.payment)}</span>
                    </div>
                  )}

                  {selectedProject.fundDate && (
                    <div className="detail-row">
                      <span className="detail-label">Fund Date</span>
                      <span className="detail-value">{formatDate(selectedProject.fundDate)}</span>
                    </div>
                  )}

                  {selectedProject.loanStatus && selectedProject.loanStatus.toLowerCase() === 'closed' && selectedProject.payoffDate ? (
                    <div className="detail-row">
                      <span className="detail-label">Payoff Date</span>
                      <span className="detail-value">{formatDate(selectedProject.payoffDate)}</span>
                    </div>
                  ) : null}

                  {selectedProject.loanStatus && (
                    <div className="detail-row">
                      <span className="detail-label">Status</span>
                      <span className="detail-value">{selectedProject.loanStatus}</span>
                    </div>
                  )}
                </>
              ) : user.role === 'promissory' ? (
                // Promissory specific fields
                <>
                  {selectedProject.type && (
                    <div className="detail-row">
                      <span className="detail-label">Type</span>
                      <span className="detail-value">{selectedProject.type}</span>
                    </div>
                  )}

                  {selectedProject.assetId && (
                    <div className="detail-row">
                      <span className="detail-label">Asset ID</span>
                      <span className="detail-value">{selectedProject.assetId}</span>
                    </div>
                  )}

                  <div className="detail-row">
                    <span className="detail-label">Loan Amount</span>
                    <span className="detail-value">{formatCurrency(selectedProject.loanAmount)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Interest Rate</span>
                    <span className="detail-value">{formatPercent(selectedProject.interestRate)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Capital Pay</span>
                    <span className="detail-value">{formatCurrency(selectedProject.capitalPay)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Fund Date</span>
                    <span className="detail-value">{formatDate(selectedProject.fundDate)}</span>
                  </div>

                  {selectedProject.status && selectedProject.status.toLowerCase() === 'closed' && selectedProject.payoffDate ? (
                    <div className="detail-row">
                      <span className="detail-label">Payoff Date</span>
                      <span className="detail-value">{formatDate(selectedProject.payoffDate)}</span>
                    </div>
                  ) : (
                    <div className="detail-row">
                      <span className="detail-label">Maturity Date</span>
                      <span className="detail-value">{formatDate(selectedProject.maturityDate)}</span>
                    </div>
                  )}

                  {selectedProject.status && (
                    <div className="detail-row">
                      <span className="detail-label">Status</span>
                      <span className="detail-value">{selectedProject.status}</span>
                    </div>
                  )}
                </>
              ) : (
                // Borrower specific fields
                <>
                  <div className="detail-row">
                    <span className="detail-label">Property Address</span>
                    <span className="detail-value">{selectedProject.projectAddress || 'N/A'}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Loan Amount</span>
                    <span className="detail-value">{formatCurrency(selectedProject.loanAmount)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Interest Rate</span>
                    <span className="detail-value">{formatPercent(selectedProject.interestRate)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Interest Payment</span>
                    <span className="detail-value">{formatCurrency(selectedProject.interestPayment)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Maturity Date</span>
                    <span className="detail-value">{formatDate(selectedProject.maturityDate)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Construction Cost</span>
                    <span className="detail-value">{formatCurrency(selectedProject.constructionCost)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Construction Left in Escrow</span>
                    <span className="detail-value">{formatCurrency(selectedProject.constructionLeftInEscrow)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={closeModal} className="button-primary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Account Information Modal */}
      {showAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div className="modal-content account-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Account Information</h2>
              <button onClick={() => setShowAccountModal(false)} className="modal-close">&times;</button>
            </div>

            <div className="account-details">
              <div className="account-section">
                <h3 className="section-subtitle">Personal Information</h3>
                <div className="detail-row">
                  <span className="detail-label">First Name</span>
                  <span className="detail-value">{user.firstName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Name</span>
                  <span className="detail-value">{user.lastName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{user.email}</span>
                </div>
              </div>

              <div className="account-section">
                <h3 className="section-subtitle">Business Information</h3>
                <div className="detail-row">
                  <span className="detail-label">Business Name</span>
                  <span className="detail-value">{businessName || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Role</span>
                  <span className="detail-value capitalize">{user.role}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAccountModal(false)} className="button-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDashboard;
