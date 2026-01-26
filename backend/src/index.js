require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./models');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection test
db.sequelize.authenticate()
  .then(() => console.log('✓ Database connected successfully'))
  .catch(err => console.error('✗ Database connection failed:', err.message));

// Routes
const importRoutes = require('./routes/import');
const authRoutes = require('./routes/auth');
const fundedRoutes = require('./routes/funded');
const promissoryRoutes = require('./routes/promissory');
const capInvestorRoutes = require('./routes/capinvestor');
const invoiceRoutes = require('./routes/invoices');
const emailTemplateRoutes = require('./routes/emailTemplates');
const appSettingsRoutes = require('./routes/appSettings');

app.get('/api/health', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    res.json({
      status: 'ok',
      message: 'Coastal Private Lending API is running',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'API is running but database connection failed',
      database: 'disconnected'
    });
  }
});

// API routes
app.use('/api/import', importRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/funded', fundedRoutes);
app.use('/api/promissory', promissoryRoutes);
app.use('/api/capinvestor', capInvestorRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/settings', appSettingsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
