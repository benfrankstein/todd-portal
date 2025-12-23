# Google Sheets Import Setup Guide

## Overview

This script will import data from your Google Sheet into the RDS database, automatically creating clients and projects based on the data.

## Column Mapping

The script reads from these columns (starting at row 7):

| Column Name | Column Letter | Index | Database Field |
|------------|---------------|-------|----------------|
| Business name | C | 2 | Client businessName + Project link |
| Construction Cost | F | 5 | Project propertyValue |
| Construction left in escrow | G | 6 | Stored in notes |
| Loan Amount | H | 7 | Project loanAmount |
| Interest Rate | K | 10 | Project interestRate |
| Interest Payment | M | 12 | Stored in notes |
| Maturity Date | O | 14 | Project maturityDate |

---

## Step 1: Set Up Google Cloud Project

### 1.1 Create a Google Cloud Project

1. Go to: https://console.cloud.google.com/
2. Click **"Select a project"** → **"New Project"**
3. **Project name**: `Coastal-Lending-Import`
4. Click **"Create"**
5. Wait for the project to be created (30 seconds)

### 1.2 Enable Google Sheets API

1. In the Google Cloud Console, make sure your new project is selected
2. Go to: **APIs & Services** → **Library**
   - Or use this link: https://console.cloud.google.com/apis/library
3. Search for: **"Google Sheets API"**
4. Click on **"Google Sheets API"**
5. Click **"Enable"**

---

## Step 2: Create Service Account Credentials

### 2.1 Create Service Account

1. Go to: **APIs & Services** → **Credentials**
   - Or: https://console.cloud.google.com/apis/credentials
2. Click **"Create Credentials"** → **"Service Account"**
3. Fill in:
   ```
   Service account name: coastal-lending-sheets-reader
   Service account ID: (auto-generated)
   Description: Service account for importing Google Sheets data
   ```
4. Click **"Create and Continue"**
5. **Grant this service account access to project**:
   - Role: Select **"Basic"** → **"Viewer"** (or skip this step)
6. Click **"Continue"** → **"Done"**

### 2.2 Create and Download Key

1. In the **Credentials** page, find your service account in the list
2. Click on the service account email (e.g., `coastal-lending-sheets-reader@...`)
3. Go to the **"Keys"** tab
4. Click **"Add Key"** → **"Create new key"**
5. Select **"JSON"** format
6. Click **"Create"**
7. A JSON file will download automatically - **SAVE THIS FILE!**

### 2.3 Install the Credentials

1. **Rename the downloaded file** to: `google-credentials.json`
2. **Move it to your backend directory**:
   ```
   /Users/benfrankstein/Projects/todd-portal/backend/google-credentials.json
   ```
3. **IMPORTANT**: This file contains secrets - never commit it to git!

---

## Step 3: Share Your Google Sheet with the Service Account

This is **CRITICAL** - the service account needs permission to read your sheet!

### 3.1 Get the Service Account Email

1. Open your `google-credentials.json` file
2. Find the line with `"client_email"` - it looks like:
   ```json
   "client_email": "coastal-lending-sheets-reader@your-project.iam.gserviceaccount.com"
   ```
3. **Copy this email address**

### 3.2 Share the Google Sheet

1. Open your Google Sheet in your browser
2. Click **"Share"** button (top right)
3. **Paste the service account email** into the "Add people and groups" field
4. Set permission to: **"Viewer"**
5. **Uncheck** "Notify people" (it's a bot, not a person)
6. Click **"Share"** or **"Send"**

✅ Your service account now has read access to the sheet!

---

## Step 4: Get Your Google Sheet ID

1. Open your Google Sheet in a browser
2. Look at the URL - it looks like:
   ```
   https://docs.google.com/spreadsheets/d/1ABC123xyz-EXAMPLE-SheetID/edit
   ```
3. **Copy the Sheet ID** (the long string between `/d/` and `/edit`)
   - Example: `1ABC123xyz-EXAMPLE-SheetID`
4. **Save this** - you'll need it to run the import!

---

## Step 5: Update .gitignore (Security)

Add the credentials file to your `.gitignore` to prevent accidentally committing secrets:

```bash
cd /Users/benfrankstein/Projects/todd-portal/backend
echo "google-credentials.json" >> .gitignore
```

---

## Step 6: Test the Setup

### 6.1 Start Your Backend

```bash
cd /Users/benfrankstein/Projects/todd-portal/backend
npm run dev
```

### 6.2 Test Google Sheets Connection

Open a new terminal and run:

```bash
curl http://localhost:3001/api/import/test
```

**Expected response:**
```json
{
  "success": true,
  "message": "Google Sheets API connection successful"
}
```

**If you get an error:**
- Check that `google-credentials.json` is in the backend directory
- Verify the file is valid JSON
- Make sure Google Sheets API is enabled

---

## Step 7: Run the Import

### Option A: Using curl (Command Line)

```bash
curl -X POST http://localhost:3001/api/import/google-sheet \
  -H "Content-Type: application/json" \
  -d '{
    "spreadsheetId": "YOUR_SHEET_ID_HERE",
    "sheetName": "Sheet1"
  }'
```

Replace `YOUR_SHEET_ID_HERE` with your actual Sheet ID from Step 4.

### Option B: Using Postman or Insomnia

1. Method: **POST**
2. URL: `http://localhost:3001/api/import/google-sheet`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "spreadsheetId": "YOUR_SHEET_ID_HERE",
     "sheetName": "Sheet1"
   }
   ```

### Expected Response:

```json
{
  "success": true,
  "message": "Import completed",
  "results": {
    "success": 15,
    "failed": 0,
    "errors": [],
    "clientsCreated": 10,
    "projectsCreated": 15
  }
}
```

---

## How the Import Works

### Data Flow:

1. **Reads Google Sheet** starting from row 7
2. For each row:
   - **Checks if client exists** (by business name)
   - If not → **Creates new client**
   - **Creates project** linked to that client
   - Stores financial data in project fields

### Example:

**Google Sheet Row 7:**
```
Business name: Sunset Development LLC
Loan Amount: $500,000
Interest Rate: 8.5%
Maturity Date: 12/31/2025
```

**Database Result:**

**clients table:**
```
id: uuid-abc-123
businessName: "Sunset Development LLC"
primaryContactName: "Sunset Development LLC"
primaryContactEmail: "sunsetdevelopmentllc@placeholder.com"
```

**projects table:**
```
id: uuid-xyz-789
clientId: uuid-abc-123 (linked!)
projectName: "Sunset Development LLC - Project"
loanAmount: 500000.00
interestRate: 8.50
maturityDate: 2025-12-31
status: "Active"
```

### Important Notes:

- ✅ **Duplicate prevention**: If a client already exists, it won't create a duplicate
- ✅ **Multiple projects**: Same client can have multiple projects
- ✅ **Data parsing**: Automatically handles currency symbols ($, commas)
- ✅ **Error handling**: Continues importing even if one row fails

---

## Troubleshooting

### Error: "Credentials file not found"
- Make sure `google-credentials.json` is in `/backend/` directory
- File name must be exact: `google-credentials.json`

### Error: "The caller does not have permission"
- You forgot to share the sheet with the service account email
- Go back to Step 3.2

### Error: "Unable to parse range"
- Check that your sheet name is correct (default is "Sheet1")
- If your sheet has a different name, pass it in the request

### Error: "No data found"
- Make sure your sheet has data starting at row 7
- Check that columns C, F, G, H, K, M, O have data

### Import succeeds but no data appears
- Check the response - look at `clientsCreated` and `projectsCreated`
- Verify your database connection is working
- Run: `curl http://localhost:3001/api/health`

---

## Re-running the Import

You can run the import multiple times:

- **Same business names**: Won't create duplicate clients
- **New projects**: Will add new projects to existing clients
- **Updates**: Does NOT update existing data (only adds new records)

If you need to clear the database and start fresh:

```bash
cd backend
npm run db:migrate:undo:all
npm run db:migrate
# Then run import again
```

---

## Production Deployment

When deploying to EC2:

1. **Upload `google-credentials.json` to EC2** (securely via SCP)
   ```bash
   scp google-credentials.json ec2-user@your-ec2-ip:/home/ec2-user/backend/
   ```

2. **Or use environment variable** (more secure):
   - Store credentials in AWS Secrets Manager
   - Load in code instead of using file

3. **Make sure the file is NOT in git**:
   ```bash
   git status  # Should not show google-credentials.json
   ```

---

## Next Steps

After import completes:

1. **Verify data in database**:
   - Connect to RDS with a PostgreSQL client
   - Query: `SELECT * FROM clients;`
   - Query: `SELECT * FROM projects;`

2. **Create user accounts** linked to clients

3. **Build the client portal** to display project data

---

## Summary Checklist

- [ ] Create Google Cloud project
- [ ] Enable Google Sheets API
- [ ] Create service account
- [ ] Download credentials JSON file
- [ ] Rename and move file to `backend/google-credentials.json`
- [ ] Copy service account email from JSON file
- [ ] Share Google Sheet with service account email
- [ ] Get Sheet ID from URL
- [ ] Test connection: `GET /api/import/test`
- [ ] Run import: `POST /api/import/google-sheet`
- [ ] Verify data in database

---

Need help? Check the logs in your terminal where the backend is running!
