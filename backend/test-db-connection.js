require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('Testing connection with:');
console.log('Host:', process.env.DB_HOST);
console.log('Port:', process.env.DB_PORT);
console.log('Database:', process.env.DB_NAME);
console.log('User:', process.env.DB_USER);
console.log('SSL:', process.env.DB_SSL);
console.log('\nConnecting...');

client.connect()
  .then(() => {
    console.log('✓ Connection successful!');
    return client.query('SELECT NOW()');
  })
  .then(result => {
    console.log('✓ Query successful!');
    console.log('Server time:', result.rows[0].now);
    return client.end();
  })
  .then(() => {
    console.log('✓ Connection closed');
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ Connection failed:');
    console.error('Error:', err.message);
    console.error('Code:', err.code);
    process.exit(1);
  });
