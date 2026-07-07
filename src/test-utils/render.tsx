/**
 * Custom render utilities for React Testing Library
 * 
 * Provides wrappers with common providers and utilities
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';

/**
 * Custom render options
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial router state for Next.js router mock
   */
  router?: {
    pathname?: string;
    query?: Record<string, string>;
    asPath?: string;
  };
}

/**
 * Custom render function that wraps components with common providers
 * 
 * @param ui - React component to render
 * @param options - Custom render options
 * @returns Render result with additional utilities
 * 
 * @example
 * const { getByText, rerender } = customRender(<MyComponent />);
 * expect(getByText('Hello')).toBeInTheDocument();
 */
export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult {
  // Create a wrapper with providers if needed
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <>{children}</>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Re-export everything from React Testing Library
 */
export * from '@testing-library/react';

/**
 * Override the default render with our custom render
 */
export { customRender as render };
