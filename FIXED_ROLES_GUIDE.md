# Fixed Role Assignments

This document describes the fixed role assignment system implemented for the Bite Bonansa Cafe application.

## Overview

The system automatically assigns specific roles to designated email addresses during the registration process. This ensures that administrative, cashier, and rider accounts have the correct permissions from the moment they register.

## Fixed Role Mappings

The following email addresses have fixed role assignments:

| Email Address | Role | Description |
|--------------|------|-------------|
| `cjsalvaleon19@gmail.com` | **Admin** | Full administrative access to all features |
| `arclitacj@gmail.com` | **Cashier** | Access to POS and order management |
| `bantecj@bitebonansacafe.com` | **Cashier** | Access to POS and order management |
| `johndave0991@gmail.com` | **Rider** | Access to delivery management and tracking |
| `johndave0991@bitebonansacafe.com` | **Rider** | Access to delivery management and tracking |

**All other accounts** automatically receive the **Customer** role with access to the customer portal.

## Implementation

### Files Involved

1. **`utils/roleMapping.js`**
   - Contains the `FIXED_ROLES` mapping object
   - Exports `getRoleForEmail()` function for role determination
   - Exports helper functions for role management

2. **`pages/api/register.js`**
   - Updated to use `getRoleForEmail()` during user registration
   - Automatically assigns the correct role based on email address

### How It Works

When a new user registers:

1. The registration API receives the user's email address
2. The `getRoleForEmail(email)` function is called
3. The function normalizes the email (lowercase, trimmed)
4. It checks if the email exists in the `FIXED_ROLES` mapping
5. If found, it returns the assigned role (admin, cashier, or rider)
6. If not found, it returns 'customer' as the default role
7. The user record is created with the appropriate role

### Code Example

```javascript
import { getRoleForEmail } from '../../utils/roleMapping';

// Determine role based on email
const userRole = getRoleForEmail(email);
// Returns: 'admin', 'cashier', 'rider', or 'customer'

await supabaseAdmin.from('users').insert([{
  id: data.user.id,
  email,
  role: userRole, // Role is automatically set
  // ... other fields
}]);
```

## Role-Based Access Control

After registration, users are automatically redirected to their appropriate portal based on their role:

- **Admin** → `/dashboard` (admin dashboard with full access)
- **Cashier** → `/cashier` (POS system)
- **Rider** → `/rider/dashboard` (delivery management)
- **Customer** → `/customer/menu` (customer portal)

## Security Considerations

1. **Email Normalization**: Emails are normalized (lowercase, trimmed) for case-insensitive comparison
2. **Fixed Assignments**: Role assignments are hardcoded and cannot be changed through the UI
3. **Default to Customer**: Any email not in the fixed list defaults to customer role
4. **Database Level**: Roles are stored in the database and checked on every authenticated request

## Modifying Fixed Roles

To add or modify fixed role assignments, edit the `FIXED_ROLES` object in `utils/roleMapping.js`:

```javascript
const FIXED_ROLES = {
  'arclitacj@gmail.com': 'cashier',
  'cjsalvaleon19@gmail.com': 'admin',
  'johndave0991@gmail.com': 'rider',
  // Add new fixed roles here:
  // 'newemail@example.com': 'admin',
};
```

After modifying the file:
1. Commit the changes to version control
2. Redeploy the application
3. New registrations will use the updated role mappings

**Note**: Existing users who already registered will keep their current role. If you need to change an existing user's role, update the `role` field directly in the database.

## Testing

To test the fixed role assignments:

1. **Test Admin Account**
   - Register with: `cjsalvaleon19@gmail.com`
   - Expected: Redirected to `/dashboard` with admin access

2. **Test Cashier Account**
   - Register with: `arclitacj@gmail.com`
   - Expected: Redirected to `/cashier` with POS access

3. **Test Rider Account**
   - Register with: `johndave0991@gmail.com`
   - Expected: Redirected to `/rider/dashboard` with delivery access

4. **Test Customer Account**
   - Register with any other email (e.g., `customer@example.com`)
   - Expected: Redirected to `/customer/menu` with customer portal access

## Troubleshooting

### User has wrong role after registration

1. Check the `users` table in the database
2. Verify the `role` column value
3. If incorrect, manually update: `UPDATE users SET role = 'correct_role' WHERE email = 'user@example.com'`
4. Have the user log out and log back in

### Fixed role not being applied

1. Verify the email address exactly matches (case-insensitive)
2. Check `utils/roleMapping.js` for typos in the email
3. Check server logs for any errors during registration
4. Ensure the roleMapping.js file is properly imported in register.js

## Future Enhancements

Possible improvements for role management:

1. Admin UI for managing role assignments
2. Role delegation (admins assigning roles to users)
3. Multiple roles per user
4. Time-limited role assignments
5. Role-based permissions matrix
6. Audit log for role changes

## Support

For issues with role assignments:
1. Check the database `users` table for the correct role value
2. Review server logs for registration errors
3. Verify email addresses match exactly (case-insensitive)
4. Contact system administrator for manual role updates if needed
