import React from 'react';

/**
 * VisuallyHidden – Renders content that is invisible to sighted users
 * but fully accessible to screen readers and other assistive technologies.
 *
 * Uses the standard clip-rect hiding technique recommended by the W3C
 * rather than `display: none` or `visibility: hidden`, which would also
 * hide the content from assistive tech.
 *
 * @example
 * ```tsx
 * <button>
 *   <TrashIcon aria-hidden="true" />
 *   <VisuallyHidden>Delete item</VisuallyHidden>
 * </button>
 * ```
 */
export function VisuallyHidden({
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
}) {
  return (
    <span
      {...props}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
        ...props.style,
      }}
    >
      {children}
    </span>
  );
}
