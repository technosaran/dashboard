'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

/**
 * Announcer – Renders an ARIA live region that announces dynamic
 * content changes to screen readers.
 *
 * @example
 * ```tsx
 * <Announcer message="3 results found" />
 * <Announcer message="Error: invalid input" assertive />
 * ```
 */
export function Announcer({
  message,
  assertive = false,
}: {
  /** The message to announce to assistive technologies. */
  message: string;
  /** If `true`, uses `aria-live="assertive"` (interrupts current speech). */
  assertive?: boolean;
}) {
  return (
    <VisuallyHidden
      role="status"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {message}
    </VisuallyHidden>
  );
}

/**
 * useAnnounce – A hook that returns an `announce` function and an
 * `AnnouncerRegion` component to render in your tree.
 *
 * The `announce` function imperatively sets the live-region message,
 * which screen readers will read aloud.
 *
 * @example
 * ```tsx
 * function SearchResults() {
 *   const { announce, AnnouncerRegion } = useAnnounce();
 *
 *   useEffect(() => {
 *     announce(`${results.length} results found`);
 *   }, [results.length, announce]);
 *
 *   return (
 *     <>
 *       <AnnouncerRegion />
 *       <ResultsList results={results} />
 *     </>
 *   );
 * }
 * ```
 */
export function useAnnounce() {
  const [message, setMessage] = useState('');
  const [assertive, setAssertive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Announce a message to screen readers via the live region.
   *
   * @param text - The message to announce.
   * @param options - Optional settings. `assertive` interrupts current speech.
   */
  const announce = useCallback(
    (text: string, options?: { assertive?: boolean }) => {
      // Clear any pending announcement
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Clear the message first so re-announcing the same text triggers a change
      setMessage('');
      setAssertive(options?.assertive ?? false);

      // Use a microtask delay so the DOM change is detected by assistive tech
      timeoutRef.current = setTimeout(() => {
        setMessage(text);
      }, 100);
    },
    [],
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Render this component somewhere in your tree to create the live region.
   * It is visually hidden but accessible to screen readers.
   */
  const AnnouncerRegion = useCallback(
    () => <Announcer message={message} assertive={assertive} />,
    [message, assertive],
  );

  return { announce, AnnouncerRegion } as const;
}
