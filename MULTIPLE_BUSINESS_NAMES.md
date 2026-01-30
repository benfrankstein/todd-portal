# Multiple Business Names Feature

## Overview
Users can now be associated with **multiple business names** instead of just one. This allows a single user account to access data from multiple businesses, investors, or entities.

## How It Works

### Database Changes
- The `business_name` column remains a **STRING** (primary business)
- A new `additional_business_names` column has been added as a PostgreSQL **TEXT ARRAY**
- Users have one primary business and zero or more additional businesses
- Example: `businessName: "KMP Investments"`, `additionalBusinessNames: ["CBD Rentals", "Atlas Development LLC"]`

### User Access
When a user logs in, they can see data from **ALL** their associated business names:
- **Borrowers**: See loans from all their businesses
- **Cap Investors**: See investments from all their investor entities
- **Promissory Investors**: See notes from all their investor entities

### Invoice Generation
- Invoices are still generated **per business/investor name**
- Users with multiple business names will receive **multiple separate invoices**
- Example: If user has `["Company A", "Company B"]`, they get one invoice for Company A and one for Company B

---

## Setting Up Multiple Business Names

### For Admin Users

#### Option 1: Via Admin Dashboard (Recommended) ✨
1. Go to Admin Dashboard → Users tab
2. Click the **edit button (✏️)** next to the user
3. Search for and add additional businesses
4. Click "Save Changes"

#### Option 2: Direct Database Update
```sql
-- Set primary business (done during user creation)
UPDATE users
SET business_name = 'KMP Investments'
WHERE email = 'user@example.com';

-- Add additional businesses
UPDATE users
SET additional_business_names = ARRAY['CBD Rentals', 'Atlas Development LLC']
WHERE email = 'user@example.com';

-- Add a business to existing additional array (append)
UPDATE users
SET additional_business_names = array_append(additional_business_names, 'New Business LLC')
WHERE email = 'user@example.com';

-- Remove a business from additional array
UPDATE users
SET additional_business_names = array_remove(additional_business_names, 'Old Business LLC')
WHERE email = 'user@example.com';
```

#### Option 3: Via Node.js Script
```javascript
const db = require('./src/models');

async function updateUserBusinessNames() {
  const user = await db.User.findOne({
    where: { email: 'user@example.com' }
  });

  // Primary business (set during creation)
  user.businessName = 'KMP Investments';

  // Additional businesses
  user.additionalBusinessNames = ['CBD Rentals', 'Atlas Development LLC'];
  await user.save();

  console.log('Updated!');
}
```

---

## Examples

### Example 1: Single Business (Default)
```sql
-- User has one primary business, no additional
businessName: 'KMP Investments'
additionalBusinessNames: []

-- User sees:
- All funded loans for "KMP Investments"
- Receives invoices for "KMP Investments"
```

### Example 2: Multiple Businesses
```sql
-- User has primary business + additional businesses
businessName: 'KMP Investments'
additionalBusinessNames: ['CBD Rentals', 'Garza Holdings LLC']

-- User sees:
- All funded loans for "KMP Investments"
- All funded loans for "CBD Rentals"
- All funded loans for "Garza Holdings LLC"

-- User receives:
- One invoice for "KMP Investments"
- One invoice for "CBD Rentals"
- One invoice for "Garza Holdings LLC"
```

### Example 3: Investor with Multiple Entities
```sql
-- Cap investor with primary entity + additional entities
businessName: 'Clearwater Financial Services LLC'
additionalBusinessNames: ['AMK Holdings', 'CP Capital LLC']

-- User sees:
- All cap investor records for "Clearwater Financial Services LLC"
- All cap investor records for "AMK Holdings"
- All cap investor records for "CP Capital LLC"

-- User receives:
- One investor statement for "Clearwater Financial Services LLC"
- One investor statement for "AMK Holdings"
- One investor statement for "CP Capital LLC"
```

---

## Technical Details

### Query Behavior

**User Model Helper:**
```javascript
// Helper method to get all business names
user.getAllBusinessNames() // Returns: ['KMP Investments', 'CBD Rentals', 'Atlas LLC']
```

**Querying Data:**
```javascript
// Get all business names (primary + additional)
const allBusinessNames = req.user.getAllBusinessNames();

// Match ANY of the user's business names
where: {
  businessName: {
    [Sequelize.Op.in]: allBusinessNames
  }
}
```

### Email Matching for Invoice Generation

Finds users who have access to a specific business (either as primary OR in additional):

```javascript
where: {
  [Sequelize.Op.or]: [
    { businessName: 'KMP Investments' }, // Primary matches
    {
      additionalBusinessNames: {
        [Sequelize.Op.overlap]: ['KMP Investments'] // Additional contains it
      }
    }
  ]
}
```

---

## Migration Details

### What Changed?
- `business_name` column: `VARCHAR` → `TEXT[]` (array)
- Existing single business names were automatically converted to single-element arrays
- No data loss during migration

### Rollback
If needed, you can rollback:
```bash
npm run db:migrate:undo
```
This will convert arrays back to strings (using first element only).

---

## API Response Changes

### Before:
```json
{
  "success": true,
  "businessName": "KMP Investments",
  "records": [...]
}
```

### After:
```json
{
  "success": true,
  "businessNames": ["KMP Investments", "CBD Rentals"],
  "records": [...]
}
```

---

## Use Cases

### Use Case 1: Consolidated View for Business Owner
- Owner of multiple LLCs wants one login to see all their loans
- Set `business_name = ['LLC A', 'LLC B', 'LLC C']`
- User sees all loans in one dashboard

### Use Case 2: Investment Manager
- Manager handles multiple investor entities
- Set `business_name = ['Entity 1 IRA', 'Entity 2 Trust', 'Entity 3 LLC']`
- User sees all investments across entities

### Use Case 3: Accountant Access
- Accountant needs to see multiple clients
- Set `business_name = ['Client A', 'Client B', 'Client C']`
- Accountant can access all client data

---

## Important Notes

⚠️ **Business Name Matching**
- Must be **exact match** (case-sensitive)
- "KMP Investments" ≠ "Kmp investments"
- Trailing/leading spaces matter

⚠️ **Invoice Generation**
- Each business gets its own invoice
- User receives **multiple invoices** if they have multiple businesses

⚠️ **Admin Users**
- Admin users typically have empty `business_name` array
- Admins can see all data regardless of business name

---

## Checking Current Business Names

```sql
-- See all users and their business names
SELECT
  email,
  role,
  business_name,
  array_length(business_name, 1) as business_count
FROM users
WHERE is_active = true
ORDER BY email;

-- Find users with multiple business names
SELECT email, business_name
FROM users
WHERE array_length(business_name, 1) > 1;

-- Find users with no business names
SELECT email, role
FROM users
WHERE business_name IS NULL OR array_length(business_name, 1) = 0;
```
