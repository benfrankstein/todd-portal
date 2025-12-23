# AWS RDS PostgreSQL Setup Guide

## Cost-Optimized Production RDS Configuration

### Recommended Instance Settings
- **Instance Class**: `db.t4g.micro` (ARM-based, cheapest)
- **Storage**: 20 GB GP3 (General Purpose SSD)
- **Multi-AZ**: No (save ~50% cost)
- **Backup Retention**: 7 days
- **Estimated Cost**: $13-15/month

---

## Step 1: Create RDS Instance

1. **Go to AWS Console** → RDS → Create Database

2. **Engine Options**:
   - Engine type: PostgreSQL
   - Version: 15.x (latest stable)

3. **Templates**:
   - Choose: **Production** (for better defaults)

4. **Settings**:
   ```
   DB instance identifier: coastal-lending-db
   Master username: postgres
   Master password: [SAVE THIS SECURELY!]
   ```

5. **Instance Configuration**:
   - DB instance class: Burstable classes → `db.t4g.micro`

6. **Storage**:
   - Storage type: GP3
   - Allocated storage: 20 GB
   - Storage autoscaling: Enable (max 100 GB)

7. **Connectivity**:
   - VPC: Default VPC
   - **Public access: Yes** (required for development & Netlify)
   - VPC security group: Create new → `coastal-lending-db-sg`

8. **Database Authentication**:
   - Password authentication

9. **Additional Configuration**:
   - Initial database name: `coastal_lending`
   - Backup retention: 7 days
   - Enable encryption: Yes
   - Disable Enhanced Monitoring (saves cost)

10. **Click "Create database"** (takes 5-10 minutes)

---

## Step 2: Configure Security Group

1. Go to **EC2 → Security Groups**
2. Find: `coastal-lending-db-sg`
3. **Edit Inbound Rules**:

   ```
   Rule 1 (Development):
   Type: PostgreSQL
   Port: 5432
   Source: Your IP/32
   Description: Local development

   Rule 2 (Production Backend):
   Type: PostgreSQL
   Port: 5432
   Source: [EC2 Security Group ID]
   Description: Backend server access

   Rule 3 (Temporary - for testing):
   Type: PostgreSQL
   Port: 5432
   Source: 0.0.0.0/0
   Description: TEMPORARY - Remove after initial setup
   ```

---

## Step 3: Get Connection Details

1. Go to RDS → Databases → `coastal-lending-db`
2. **Copy the Endpoint**: `coastal-lending-db.xxxxx.us-east-1.rds.amazonaws.com`
3. Port: `5432`

---

## Step 4: Configure Local Environment

1. **Copy the example env file**:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edit `.env` with your RDS details**:
   ```env
   NODE_ENV=development
   PORT=3001

   # AWS RDS Connection
   DB_HOST=coastal-lending-db.xxxxx.us-east-1.rds.amazonaws.com
   DB_PORT=5432
   DB_NAME=coastal_lending
   DB_USER=postgres
   DB_PASSWORD=your_actual_master_password
   DB_SSL=true

   # Generate a secure JWT secret (min 32 characters)
   JWT_SECRET=your_super_secret_jwt_key_minimum_32_chars_long
   JWT_EXPIRE=7d

   FRONTEND_URL=http://localhost:3000
   ```

---

## Step 5: Run Migrations

1. **Test the database connection**:
   ```bash
   npm run dev
   ```
   You should see: `✓ Database connected successfully`

2. **Run migrations to create tables**:
   ```bash
   npm run db:migrate
   ```

   This will create:
   - `clients` table
   - `users` table (with foreign key to clients)
   - `projects` table (with foreign key to clients)

3. **Verify tables were created**:
   Connect with any PostgreSQL client using your RDS credentials.

---

## Step 6: Production Deployment (EC2)

### On EC2 Instance:

1. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone/Deploy your backend code**

3. **Create production `.env`**:
   ```bash
   nano .env
   ```
   ```env
   NODE_ENV=production
   PORT=3001

   DB_HOST=coastal-lending-db.xxxxx.us-east-1.rds.amazonaws.com
   DB_PORT=5432
   DB_NAME=coastal_lending
   DB_USER=postgres
   DB_PASSWORD=your_master_password
   DB_SSL=true

   JWT_SECRET=different_production_secret_here
   JWT_EXPIRE=7d

   FRONTEND_URL=https://your-app.netlify.app
   ```

4. **Install dependencies & run migrations**:
   ```bash
   npm install
   npm run db:migrate
   ```

5. **Start the server**:
   ```bash
   npm start
   # Or use PM2 for production:
   npm install -g pm2
   pm2 start src/index.js --name coastal-api
   pm2 startup
   pm2 save
   ```

---

## Step 7: Netlify Frontend Configuration

1. **In Netlify, set environment variable**:
   ```
   REACT_APP_API_URL=http://your-ec2-ip:3001
   ```

2. **Update frontend API calls** to use:
   ```javascript
   const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
   ```

---

## Database Schema

### Tables Created:

1. **clients**
   - Business information (LLC name, tax ID, contact info, address)
   - Used for organizing client data

2. **users**
   - Authentication (email, password hash)
   - User profile (first name, last name)
   - Role-based access (admin, staff, client)
   - Links to client via `clientId`

3. **projects**
   - Project details (name, property address)
   - Loan information (amount, rate, term, status)
   - Property details (type, value, LTV ratio)
   - Links to client via `clientId`

### Relationships:
- One Client → Many Users
- One Client → Many Projects

---

## Security Best Practices

### Immediate (Required):
- ✓ Enable SSL for database connections
- ✓ Use strong passwords (min 16 chars, mixed case, numbers, symbols)
- ✓ Never commit `.env` files to git
- ✓ Restrict security group to specific IPs/EC2 only

### Production Hardening:
- Create separate database user for application (not postgres superuser)
- Use AWS Secrets Manager for credentials
- Enable CloudWatch monitoring
- Set up automated backups
- Remove public access, use VPC peering or AWS PrivateLink
- Enable RDS Performance Insights

### Create Application User (Recommended):
```sql
-- Connect as postgres master user
CREATE USER coastal_app WITH PASSWORD 'strong_app_password';
GRANT CONNECT ON DATABASE coastal_lending TO coastal_app;
GRANT USAGE ON SCHEMA public TO coastal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO coastal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO coastal_app;

-- Update .env to use coastal_app instead of postgres
```

---

## Migration Commands

```bash
# Run all pending migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# Undo all migrations
npm run db:migrate:undo:all
```

---

## Testing the Setup

1. **Test local connection**:
   ```bash
   npm run dev
   ```

2. **Test health endpoint**:
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return:
   ```json
   {
     "status": "ok",
     "message": "Coastal Private Lending API is running",
     "database": "connected"
   }
   ```

---

## Troubleshooting

### Connection Refused
- Check security group allows your IP
- Verify RDS is publicly accessible
- Check VPC subnet routing

### SSL Required Error
- Set `DB_SSL=true` in .env
- RDS requires SSL by default

### Migration Errors
- Verify database exists: `coastal_lending`
- Check credentials in .env
- Ensure you're in the backend directory

---

## Cost Monitoring

- **RDS Dashboard**: Monitor storage and connection usage
- **CloudWatch**: Set billing alarms
- **Monthly Review**: Check if autoscaling triggered

For 1-2k rows, you should stay well within the t4g.micro limits.
