import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Only redirect if we're not already on the login page
      // This prevents page refresh when user enters wrong credentials
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/' && currentPath !== '/reset-password') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  resetFirstTimePassword: async (password, confirmPassword, phoneNumber) => {
    const response = await api.post('/auth/reset-first-time-password', { password, confirmPassword, phoneNumber });
    return response.data;
  },

  getBusinessNames: async () => {
    const response = await api.get('/auth/business-names');
    return response.data;
  },

  createClientUser: async (userData) => {
    const response = await api.post('/auth/create-client', userData);
    return response.data;
  },

  getInvestorNames: async () => {
    const response = await api.get('/auth/investor-names');
    return response.data;
  },

  createInvestorUser: async (userData) => {
    const response = await api.post('/auth/create-investor', userData);
    return response.data;
  },

  getCapInvestorNames: async () => {
    const response = await api.get('/auth/capinvestor-names');
    return response.data;
  },

  createCapInvestorUser: async (userData) => {
    const response = await api.post('/auth/create-capinvestor', userData);
    return response.data;
  },

  getAllUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/auth/users/${userId}`);
    return response.data;
  },

  updateUserBusinessNames: async (userId, additionalBusinessNames) => {
    const response = await api.patch(`/auth/users/${userId}/business-names`, { additionalBusinessNames });
    return response.data;
  },

  sendVerificationCode: async (phoneNumber) => {
    const response = await api.post('/auth/send-verification-code', { phoneNumber });
    return response.data;
  },

  verifyPhone: async (phoneNumber, code) => {
    const response = await api.post('/auth/verify-phone', { phoneNumber, code });
    return response.data;
  },

  requestPasswordReset: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  validateResetToken: async (token) => {
    const response = await api.get(`/auth/reset-password/${token}`);
    return response.data;
  },

  resetPassword: async (token, password, confirmPassword) => {
    const response = await api.post('/auth/reset-password', { token, password, confirmPassword });
    return response.data;
  }
};

// Funded APIs
export const fundedAPI = {
  getMyRecords: async () => {
    const response = await api.get('/funded/my-records');
    return response.data;
  },

  getAllRecords: async () => {
    const response = await api.get('/funded/all');
    return response.data;
  }
};

// Promissory APIs
export const promissoryAPI = {
  getMyRecords: async () => {
    const response = await api.get('/promissory/my-records');
    return response.data;
  },

  getAllRecords: async () => {
    const response = await api.get('/promissory/all');
    return response.data;
  }
};

// Cap Investor APIs
export const capInvestorAPI = {
  getMyRecords: async () => {
    const response = await api.get('/capinvestor/my-records');
    return response.data;
  },

  getAllRecords: async () => {
    const response = await api.get('/capinvestor/all');
    return response.data;
  }
};

// Invoice APIs
export const invoiceAPI = {
  getMyInvoices: async () => {
    const response = await api.get('/invoices/my-invoices');
    return response.data;
  },

  getAllInvoices: async () => {
    const response = await api.get('/invoices/all');
    return response.data;
  },

  generateInvoices: async () => {
    const response = await api.post('/invoices/generate');
    return response.data;
  }
};

// Import/Sync APIs
export const importAPI = {
  syncAllSheets: async () => {
    const response = await api.post('/import/sync-all');
    return response.data;
  },

  testConnection: async () => {
    const response = await api.get('/import/test');
    return response.data;
  }
};

// App Settings APIs
export const settingsAPI = {
  getSetting: async (key) => {
    const response = await api.get(`/settings/${key}`);
    return response.data;
  },

  updateSetting: async (key, value) => {
    const response = await api.put(`/settings/${key}`, { value });
    return response.data;
  },

  getAllSettings: async () => {
    const response = await api.get('/settings');
    return response.data;
  }
};

export default api;
