'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * SkipNavLink – A visually hidden link that becomes visible on focus,
 * allowing keyboard users to skip directly to the main content area.
 *
 * Place this component as the **first focusable element** inside `<body>`
 * so it is the first thing a screen-reader / keyboard user encounters.
 *
 * @example
 * ```tsx
 * // In root layout:
 * <body>
 *   <SkipNavLink />
 *   <Header />
 *   <SkipNavContent>
 *     <Page />
 *   </SkipNavContent>
 * </body>
 * ```
 */
export function SkipNavLink({
  contentId = 'main-content',
  children = 'Skip to main content',
  className,
}: {
  /** The `id` of the target landmark element (must match `SkipNavContent`'s `id`). */
  contentId?: string;
  /** Custom label – defaults to "Skip to main content". */
  children?: React.ReactNode;
  /** Additional class names merged with defaults. */
  className?: string;
}) {
  return (
    <a
      href={`#${contentId}`}
      className={cn(
        // Positioning & layout
        'fixed top-0 left-0 z-[9999]',
        // Hidden by default – translated above viewport
        '-translate-y-full',
        // Visible on focus – slides into view
        'focus:translate-y-0',
        // Visual styling – high contrast
        'bg-indigo-600 text-white',
        'px-6 py-3',
        'text-sm font-bold tracking-wide',
        'rounded-br-lg',
        // Smooth transition
        'transition-transform duration-200 ease-in-out',
        // Focus ring for additional visibility
        'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600',
        // Shadow for depth
        'shadow-lg',
        className,
      )}
    >
      {children}
    </a>
  );
}

/**
 * SkipNavContent – The target landmark for `SkipNavLink`.
 *
 * Wraps your main content in a `<main>` element with the matching `id`
 * so the skip-link can jump focus here.
 *
 * `tabIndex={-1}` allows the element to receive programmatic focus
 * without appearing in the natural tab order.
 *
 * @example
 * ```tsx
 * <SkipNavContent>
 *   <DashboardPage />
 * </SkipNavContent>
 * ```
 */
export function SkipNavContent({
  id = 'main-content',
  children,
  className,
}: {
  /** Must match the `contentId` prop of `SkipNavLink`. */
  id?: string;
  children: React.ReactNode;
  /** Additional class names for the `<main>` element. */
  className?: string;
}) {
  return (
    <main
      id={id}
      tabIndex={-1}
      className={cn('outline-none', className)}
    >
      {children}
    </main>
  );
}
