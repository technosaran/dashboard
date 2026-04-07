# Accounts Page Updates

## Changes Implemented

### 1. Edit Button Made Smaller
- Edit button is now a small icon-only button (no text)
- Positioned next to the add/subtract button
- Subtle gray styling to be less prominent

### 2. Balance Field Hidden When Editing
- When editing an account, the balance field is no longer shown
- Balance can only be changed through the new "Adjust Balance" feature
- Initial balance field only appears when creating new accounts

### 3. Add/Subtract Money Feature
- New prominent plus (+) icon button on each account card
- Opens a modal to add or subtract money
- Two action buttons: "Add Money" (green) and "Subtract Money" (red)
- Requires a note/description for each adjustment
- Validates sufficient balance for subtractions

### 4. Permanent Cash Account
- A "Cash" account is automatically created for each user
- Represents physical money held by the user
- Type: "cash" with special yellow/gold styling
- Cannot be deleted (delete button hidden for Cash account)
- Account name cannot be changed when editing
- Starts with 0 balance

### 5. Fixed Portfolio Overview Card Size
- Portfolio overview section now has a fixed maximum height of 280px
- Account list scrolls if there are many accounts
- Prevents the card from growing too large
- Maintains consistent layout regardless of account count

## New Actions

### `adjustBalance(id, amount, note)`
- Server action to add or subtract money from an account
- Positive amount = add money
- Negative amount = subtract money
- Validates sufficient balance
- Requires a note for tracking

## Account Card Layout

Each account card now has:
1. **Plus button** (left) - Add/subtract money - prominent with account color
2. **Edit button** (middle) - Edit account details - small, gray, subtle
3. **Delete button** (right) - Delete account - only shown for non-Cash accounts

## Cash Account Styling

The Cash account has unique styling:
- Color: Yellow/Gold (#fdcb6e)
- Badge: "CASH" in yellow
- Gradient: Yellow to light yellow
- Icon background: Yellow tint
- Cannot be deleted
- Name cannot be changed

## User Experience Improvements

1. **Clearer Money Management**: Separate buttons for editing details vs adjusting balance
2. **Better Visual Hierarchy**: Edit button is subtle, money adjustment is prominent
3. **Physical Cash Tracking**: Dedicated Cash account for tracking physical money
4. **Scalable Design**: Portfolio overview scrolls instead of growing infinitely
5. **Safety**: Cash account is protected from deletion

## Testing

To test the new features:
1. Open the accounts page - Cash account should be created automatically
2. Click the + button on any account to add/subtract money
3. Try to edit the Cash account - name field should be disabled
4. Try to delete the Cash account - delete button should not appear
5. Create multiple accounts and verify portfolio overview scrolls
6. Edit an existing account - balance field should not appear
