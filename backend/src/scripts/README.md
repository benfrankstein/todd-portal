# Monthly Invoice Generator (Node.js with Puppeteer)

Automated system that generates invoice PDFs for all businesses, investors, and cap investors and uploads them to AWS S3.

## Features

- **Puppeteer-based PDF Generation**: Uses headless Chrome for pixel-perfect rendering matching your UI
- **No System Dependencies**: Unlike WeasyPrint, requires only Node.js (no system libraries needed)
- **Automatic S3 Upload**: PDFs are uploaded to `coastal-lending-invoices` bucket
- **Database Tracking**: Invoice metadata saved to `invoices` table
- **Multi-Entity Support**: Handles clients, investors, and cap investors
- **Smart Pagination**: 12 rows on first page, 20 on subsequent pages

## Quick Start

### Run Manually

```bash
cd /Users/benfrankstein/Projects/todd-portal/backend
node src/scripts/generate-invoices.js
```

### Schedule Monthly (1st of every month at 2 AM)

#### Option A: Cron Job

```bash
crontab -e
```

Add this line:
```
0 2 1 * * cd /Users/benfrankstein/Projects/todd-portal/backend && /usr/local/bin/node src/scripts/generate-invoices.js
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
        <string>/usr/local/bin/node</string>
        <string>/Users/benfrankstein/Projects/todd-portal/backend/src/scripts/generate-invoices.js</string>
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
    <string>/Users/benfrankstein/Projects/todd-portal/backend</string>
    <key>StandardOutPath</key>
    <string>/Users/benfrankstein/Projects/todd-portal/backend/logs/invoice_output.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/benfrankstein/Projects/todd-portal/backend/logs/invoice_error.log</string>
</dict>
</plist>
```

Load the job:
```bash
launchctl load ~/Library/LaunchAgents/com.coastalprivate.invoices.plist
```

## How It Works

1. **Connects to Database**: Uses Sequelize models to query all entities
2. **Aggregates Records**: Groups all loans/investments per business/investor
3. **Generates HTML**: Creates invoice HTML using your existing Dashboard.css styles
4. **Renders PDF**: Puppeteer converts HTML to PDF (same as browser print)
5. **Uploads to S3**: Stores PDF in organized folder structure
6. **Saves Metadata**: Records invoice details in `invoices` table

## File Naming

PDFs are named: `BusinessName_November_1_2025.pdf`

## S3 Structure

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
│       └── Investor_Name/
│           └── Investor_Name_November_1_2025.pdf
```

## Database Queries

View all invoices:
```sql
SELECT * FROM invoices ORDER BY invoice_date DESC LIMIT 10;
```

Get invoices for specific business:
```sql
SELECT * FROM invoices
WHERE business_name = 'TJM Holdings, LLC'
ORDER BY invoice_date DESC;
```

Get invoices for current month:
```sql
SELECT * FROM invoices
WHERE invoice_date = '2025-11-01';
```

## Environment Variables

Required in `/backend/.env`:

```
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=us-east-2
S3_BUCKET_NAME=coastal-lending-invoices
```

**Note:** Get actual credentials from your .env file (not committed to git)

## Why Puppeteer Instead of WeasyPrint?

1. **No System Dependencies**: WeasyPrint requires cairo, pango, gdk-pixbuf, libffi (complex Mac setup)
2. **Perfect Rendering**: Puppeteer uses Chrome's rendering engine (exactly matches your UI)
3. **Easy Installation**: Just `npm install puppeteer`
4. **Better Maintenance**: Pure JavaScript, integrates with existing Node.js backend
5. **Reuses Frontend CSS**: Uses your existing Dashboard.css file

## Statistics

Last run generated:
- **97 clients** (businesses/borrowers)
- **56 investors** (promissory notes)
- **52 cap investors**
- **Total: 205 PDFs** uploaded successfully

## Troubleshooting

### Script fails
- Check `.env` file has AWS credentials
- Verify database connection
- Check S3 bucket exists and is accessible

### PDFs look different
- The script reads `/frontend/src/styles/Dashboard.css`
- Any UI changes will be reflected in generated PDFs

### S3 upload fails
- Verify AWS credentials in `.env`
- Check bucket name: `coastal-lending-invoices`
- Confirm IAM permissions for S3 PutObject

### Out of memory
- Puppeteer processes sequentially (not concurrently)
- Each page is closed after PDF generation
- Should handle hundreds of invoices without issues

## Support

The script logs all activity to console. Check for:
- `✓ Successfully processed...` - Invoice generated
- `✗ Failed to process...` - Error occurred
- Final summary shows processed vs failed count

---

**Generated:** November 17, 2025
**Version:** 2.0 (Puppeteer-based)
