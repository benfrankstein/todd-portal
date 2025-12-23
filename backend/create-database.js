require('dotenv').config();
const { Client } = require('pg');

// First connect to default postgres database
const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: 'postgres', // Connect to default database first
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('Connecting to default postgres database...');

client.connect()
  .then(() => {
    console.log('✓ Connected successfully!');
    // Check if coastal_lending database exists
    return client.query("SELECT 1 FROM pg_database WHERE datname = 'coastal_lending'");
  })
  .then(result => {
    if (result.rows.length > 0) {
      console.log('✓ Database "coastal_lending" already exists!');
      return Promise.resolve();
    } else {
      console.log('Creating database "coastal_lending"...');
      return client.query('CREATE DATABASE coastal_lending');
    }
  })
  .then(() => {
    console.log('✓ Database setup complete!');
    return client.end();
  })
  .then(() => {
    console.log('✓ Connection closed');
    console.log('\nYou can now run migrations: npm run db:migrate');
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ Error:', err.message);
    console.error('Code:', err.code);

    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection timeout - Check these:');
      console.error('1. Security group allows your IP on port 5432');
      console.error('2. RDS is publicly accessible (Yes)');
      console.error('3. Your current IP address hasn\'t changed');
    }

    process.exit(1);
  });
