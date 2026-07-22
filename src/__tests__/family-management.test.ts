import { describe, it, expect, vi, beforeEach } from 'vitest';

// -------------------------------------------------------------------
// Mock next/cache – must be declared before action imports
// -------------------------------------------------------------------
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// -------------------------------------------------------------------
// Mock Supabase client factory
// -------------------------------------------------------------------
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockDelete = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
});
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
});
const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  delete: mockDelete,
  update: mockUpdate,
});
const mockRpc = vi.fn().mockResolvedValue({
  data: { success: true },
  error: null,
});

let mockUser: { id: string } | null = { id: 'test-user-id' };

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockImplementation(async () => ({
      data: { user: mockUser },
    })),
  },
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockImplementation(async () => mockSupabase),
}));

// -------------------------------------------------------------------
// Import actions AFTER mocks are set up
// -------------------------------------------------------------------
import {
  addFamilyMember,
  deleteFamilyMember,
  createAllowance,
  processFamilyTransfer,
} from '@/app/dashboard/family/actions';

// -------------------------------------------------------------------
// Reset mocks before each test
// -------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: 'test-user-id' };
  mockInsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({
    insert: mockInsert,
    delete: mockDelete,
    update: mockUpdate,
  });
});

// ===================================================================
// addFamilyMember
// ===================================================================
describe('addFamilyMember', () => {
  it('should return error when name is empty', async () => {
    const result = await addFamilyMember({ name: '', relationship: 'Son' });
    expect(result).toEqual({ error: 'Name is required' });
  });

  it('should return error when relationship is empty', async () => {
    const result = await addFamilyMember({ name: 'Alice', relationship: '' });
    expect(result).toEqual({ error: 'Relationship is required' });
  });

  it('should return error when not authenticated', async () => {
    mockUser = null;
    const result = await addFamilyMember({ name: 'Alice', relationship: 'Daughter' });
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should succeed with valid data', async () => {
    const result = await addFamilyMember({ name: 'Alice', relationship: 'Daughter' });
    expect(result).toMatchObject({ success: true });
    expect(mockFrom).toHaveBeenCalledWith('family_members');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'test-user-id',
      name: 'Alice',
      relationship: 'Daughter',
      balance: 0,
    });
  });
});

// ===================================================================
// deleteFamilyMember
// ===================================================================
describe('deleteFamilyMember', () => {
  it('should return error when id is empty', async () => {
    const result = await deleteFamilyMember('');
    expect(result).toEqual({ error: 'Member ID is required' });
  });
});

// ===================================================================
// createAllowance
// ===================================================================
describe('createAllowance', () => {
  it('should return error when member id is blank whitespace', async () => {
    const result = await createAllowance({
      family_member_id: '   ',
      amount: 500,
      frequency: 'monthly',
    });
    expect(result).toEqual({ error: 'Member is required' });
  });

  it('should return error when amount is 0', async () => {
    const result = await createAllowance({
      family_member_id: 'member-1',
      amount: 0,
      frequency: 'monthly',
    });
    expect(result).toEqual({ error: 'Amount must be a positive number' });
  });

  it('should return error when amount is negative', async () => {
    const result = await createAllowance({
      family_member_id: 'member-1',
      amount: -100,
      frequency: 'monthly',
    });
    expect(result).toEqual({ error: 'Amount must be a positive number' });
  });

  it('should return error when frequency is empty', async () => {
    const result = await createAllowance({
      family_member_id: 'member-1',
      amount: 500,
      frequency: '',
    });
    expect(result).toEqual({ error: 'Frequency is required' });
  });

  it('should return error when frequency is blank whitespace', async () => {
    const result = await createAllowance({
      family_member_id: 'member-1',
      amount: 500,
      frequency: '   ',
    });
    expect(result).toEqual({ error: 'Frequency is required' });
  });
});

// ===================================================================
// processFamilyTransfer
// ===================================================================
describe('processFamilyTransfer', () => {
  it('should return error when family_member_id is blank whitespace', async () => {
    const result = await processFamilyTransfer({
      family_member_id: '   ',
      account_id: 'account-1',
      amount: 100,
      type: 'gift',
    });
    expect(result).toEqual({ error: 'Recipient is required' });
  });

  it('should return error when amount is 0', async () => {
    const result = await processFamilyTransfer({
      family_member_id: 'member-1',
      account_id: 'account-1',
      amount: 0,
      type: 'gift',
    });
    expect(result).toEqual({ error: 'Amount must be a positive number' });
  });

  it('should return error when amount is negative', async () => {
    const result = await processFamilyTransfer({
      family_member_id: 'member-1',
      account_id: 'account-1',
      amount: -50,
      type: 'gift',
    });
    expect(result).toEqual({ error: 'Amount must be a positive number' });
  });

  it('should return error when account_id is empty', async () => {
    const result = await processFamilyTransfer({
      family_member_id: 'member-1',
      account_id: '',
      amount: 100,
      type: 'gift',
    });
    expect(result).toEqual({ error: 'Account is required' });
  });

  it('should trim transfer fields before calling RPC', async () => {
    const result = await processFamilyTransfer({
      family_member_id: ' member-1 ',
      account_id: ' account-1 ',
      amount: 100,
      type: ' gift ',
      note: '  hello  ',
    });

    expect(result).toMatchObject({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('process_family_transfer_v2', {
      p_user_id: 'test-user-id',
      p_family_member_id: 'member-1',
      p_account_id: 'account-1',
      p_amount: 100,
      p_type: 'gift',
      p_note: 'hello',
    });
  });
});
