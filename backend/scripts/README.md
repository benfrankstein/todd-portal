# Coastal Private Lending - Automated Invoice Generator

This system automatically generates monthly invoice PDFs for all businesses and investors, uploads them to AWS S3, and stores the URLs in the database.

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd /Users/benfrankstein/Projects/todd-portal/backend/scripts
pip3 install -r requirements.txt
```

**Note**: WeasyPrint requires system dependencies:
- **Mac**: `brew install python3 cairo pango gdk-pixbuf libffi`
- **Linux**: `sudo apt-get install python3-dev python3-pip python3-cffi libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev`

### 2. Run Database Migration

```bash
cd /Users/benfrankstein/Projects/todd-portal/backend
npm run db:migrate
```

This creates the `invoices` table to store PDF metadata.

### 3. Configure Environment Variables

The `.env` file has been created with your AWS credentials. Verify the settings:

```bash
cat /Users/benfrankstein/Projects/todd-portal/backend/scripts/.env
```

Make sure these values are correct:
- `DATABASE_URL`: Your PostgreSQL connection string
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_REGION`: us-east-1
- `S3_BUCKET_NAME`: coastal-lending-invoices

### 4. Test the Script

Run manually to test:

```bash
cd /Users/benfrankstein/Projects/todd-portal/backend/scripts
python3 generate_invoices.py
```

This will:
1. Connect to your database
2. Query all businesses, investors, and cap investors
3. Generate invoice PDFs for each
4. Upload PDFs to S3
5. Save URLs to the `invoices` table
6. Create a log file: `invoice_generation.log`

### 5. Schedule Monthly Execution

#### Option A: Cron Job (Mac/Linux)

Edit crontab:
```bash
crontab -e
```

Add this line to run at 2 AM on the 1st of every month:
```
0 2 1 * * cd /Users/benfrankstein/Projects/todd-portal/backend/scripts && /usr/bin/python3 generate_invoices.py
```

#### Option B: launchd (Mac - Recommended)

Create file: `~/Library/LaunchAgents/com.coastalprivate.invoices.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.coastalprivate.invoices</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/benfrankstein/Projects/todd-portal/backend/scripts/generate_invoices.py</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Day</key>
        <integer>1</integer>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>WorkingDirectory</key>
    <string>/Users/benfrankstein/Projects/todd-portal/backend/scripts</string>
    <key>StandardOutPath</key>
    <string>/Users/benfrankstein/Projects/todd-portal/backend/scripts/invoice_output.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/benfrankstein/Projects/todd-portal/backend/scripts/invoice_error.log</string>
</dict>
</plist>
```

Load the job:
```bash
launchctl load ~/Library/LaunchAgents/com.coastalprivate.invoices.plist
```

## Generated Files

### S3 Structure
```
s3://coastal-lending-invoices/
├── invoices/
│   ├── clients/
│   │   └── Business_Name/
│   │       └── Business_Name_November_1_2025.pdf
│   ├── investors/
│   │   └── Investor_Name/
│   │       └── Investor_Name_November_1_2025.pdf
│   └── capinvestors/
│       └── TJM_Funding/
│           └── TJM_Funding_November_1_2025.pdf
```

### Database Records

Query invoices:
```sql
SELECT * FROM invoices ORDER BY invoice_date DESC;
```

Get all invoices for a specific business:
```sql
SELECT * FROM invoices
WHERE business_name = 'Business Name'
ORDER BY invoice_date DESC;
```

Get latest invoices:
```sql
SELECT * FROM invoices
WHERE invoice_date = '2025-11-01';
```

## Accessing PDFs

### From S3 Console
1. Go to AWS S3 Console
2. Open bucket: `coastal-lending-invoices`
3. Navigate to: `invoices/clients/Business_Name/`
4. Click on PDF to download

### Programmatically
```javascript
// In your Node.js backend
const invoices = await db.Invoice.findAll({
  where: {
    business_name: 'Business Name',
    role: 'client'
  },
  order: [['invoice_date', 'DESC']]
});

// Get S3 URL
const latestInvoice = invoices[0];
console.log(latestInvoice.s3Url);
```

## Troubleshooting

### Script fails to connect to database
- Check `DATABASE_URL` in `.env`
- Verify PostgreSQL is running: `pg_isready`
- Test connection: `psql $DATABASE_URL`

### S3 upload fails
- Verify AWS credentials in `.env`
- Check bucket name: `coastal-lending-invoices`
- Verify IAM permissions for S3 write access

### WeasyPrint errors
- Install system dependencies (see step 1)
- Mac users: `brew install cairo pango gdk-pixbuf libffi`

### No invoices generated
- Check log file: `invoice_generation.log`
- Verify records exist in database tables
- Run script manually to see errors

### PDFs look different from UI
- Logo may be missing (set `LOGO_URL` in `.env`)
- Font rendering may differ slightly

## Manual Execution

Generate invoices for specific month:
```bash
# Edit the script to change the date, or run normally (uses current month)
python3 generate_invoices.py
```

View logs:
```bash
tail -f invoice_generation.log
```

## Security Notes

**IMPORTANT:**
1. Never commit `.env` file to git (already in `.gitignore`)
2. Rotate AWS keys regularly
3. Use IAM roles instead of keys if running on AWS
4. PDFs are encrypted at rest in S3 (AES256)
5. S3 bucket has public access blocked

## Support

For issues or questions, check:
1. `invoice_generation.log` for detailed error messages
2. Database `invoices` table for saved records
3. S3 bucket for uploaded files

---

Generated: November 16, 2025
