// Add custom jest matchers from jest-extended
import 'jest-extended';

// Add custom jest matchers from testing-library
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  useParams() {
    return {};
  },
}));

// Mock Next.js image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Global test utilities
(global as any).testUtils = {
  // Helper to create mock Supabase client
  createMockSupabaseClient: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
    },
  }),

  // Helper to create mock user
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  // Helper to create mock transaction
  createMockTransaction: (overrides = {}) => ({
    id: 'test-transaction-id',
    user_id: 'test-user-id',
    amount: 100,
    description: 'Test transaction',
    date: '2024-01-01',
    category: 'food',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  // Helper to create mock account
  createMockAccount: (overrides = {}) => ({
    id: 'test-account-id',
    user_id: 'test-user-id',
    name: 'Test Account',
    type: 'checking',
    balance: 1000,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),
};

// Set up fetch mock for API calls
global.fetch = jest.fn();

// Suppress console errors in tests (optional, can be removed if you want to see them)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    // Suppress specific expected errors
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Warning: useLayoutEffect') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
