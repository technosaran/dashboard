# Transfer Modal and Cash Account Protection Fixes

## Changes Implemented

### 1. Transfer Modal - Both Accounts Selectable ✅
**Location**: `src/app/dashboard/accounts/page.tsx` (Transfer Modal)

**Before**: 
- From account was pre-selected or fixed
- Only "To" account was selectable

**After**:
- Both "From" and "To" accounts are now dropdown selects
- No default account pre-selected
- User can choose any account for both source and destination
- Destination dropdown automatically filters out the selected source account

**Changes**:
```typescript
// Header transfer button - no longer pre-selects account
setTransferFromId(null);  // Changed from accounts[0].id

// Modal condition - no longer requires transferFromId
{showTransferModal && (  // Changed from {showTransferModal && transferFromId && (

// From Account field - now a dropdown
<select value={transferFromId || ""} ...>
  <option value="">Select source account</option>
  {accounts.map(...)}
</select>
```

### 2. Cash Account Full Protection ✅
**Location**: `src/app/dashboard/accounts/page.tsx` (Edit Form)

The Cash account is now fully protected with the following restrictions:

#### Cannot Delete ✅
- Delete button hidden for Cash account
- `{account.name !== "Cash" && (<delete button>)}`

#### Cannot Edit Core Fields ✅
When editing Cash account, these fields are disabled:

1. **Account Name** - Disabled
   - Shows message: "Cash account name cannot be changed"

2. **Account Type** - Disabled  
   - Shows message: "Cash account type cannot be changed"
   - Type remains "cash"

3. **Currency** - Disabled
   - Shows message: "Cash account currency cannot be changed"
   - Currency remains "INR"

4. **Bank Selection** - Disabled
   - Shows: "Physical cash - no bank association"
   - Label shows: "Bank Selection (Not applicable for Cash)"

#### Can Only Adjust Balance ✅
- The only way to change Cash account balance is through "Adjust Balance" button
- This is intentional - represents adding/removing physical cash

### 3. Cash Account Auto-Creation ✅
**Location**: `src/app/dashboard/accounts/page.tsx` (loadAccounts function)

```typescript
const hasCashAccount = accountsList.some(acc => acc.name === "Cash");
if (!hasCashAccount) {
  await supabase.from("accounts").insert({
    user_id: user.id,
    name: "Cash",
    type: "cash",
    balance: 0,
    currency: "INR",
    bank_name: null,
    bank_logo: null,
  });
}
```

## Transfer Modal Flow

### New User Experience:

1. Click "Transfer" button in header
2. Modal opens with both dropdowns empty
3. Select "From Account" - shows all accounts with balances
4. Select "To Account" - shows all accounts except the selected "From" account
5. Enter amount and optional note
6. Click "Transfer"

### Validation:
- Cannot select same account for both from and to
- Amount must be greater than 0
- Must have sufficient balance in source account

## Cash Account Edit Form Behavior

### When Editing Cash Account:

```
Account Name: [Cash] (disabled)
└─ "Cash account name cannot be changed"

Type: [Cash] (disabled)
└─ "Cash account type cannot be changed"

Currency: [INR (₹)] (disabled)
└─ "Cash account currency cannot be changed"

Bank Selection (Not applicable for Cash)
└─ "Physical cash - no bank association"
```

### When Editing Other Accounts:
- All fields are editable
- Balance field still hidden (use Adjust Balance)
- Bank selection works normally

## Testing

### Test Transfer Modal
1. Click Transfer button in header
2. Verify both dropdowns are empty initially
3. Select a "From" account
4. Verify "To" dropdown excludes the selected "From" account
5. Complete a transfer
6. Verify balances update in real-time

### Test Cash Account Protection
1. Try to edit Cash account
2. Verify name field is disabled
3. Verify type field is disabled
4. Verify currency field is disabled
5. Verify bank selection shows "Physical cash" message
6. Verify delete button is not visible
7. Verify "Adjust Balance" button still works

### Test Cash Account Creation
1. Create a new user account
2. Navigate to accounts page
3. Verify Cash account is automatically created
4. Verify it has:
   - Name: "Cash"
   - Type: "cash"
   - Balance: 0
   - Currency: "INR"
   - No bank association

## Summary

✅ Transfer modal allows selecting both from and to accounts
✅ Cash account is fully protected from editing
✅ Cash account can only have balance adjusted
✅ Cash account cannot be deleted
✅ Cash account auto-created for all users
✅ All validations working correctly
