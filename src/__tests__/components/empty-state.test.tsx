import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/empty-state';

describe('EmptyState Component', () => {
  it('renders the title correctly', () => {
    render(<EmptyState title="No Data Found" />);
    expect(screen.getByText('No Data Found')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<EmptyState title="Title" description="Here is a description" />);
    expect(screen.getByText('Here is a description')).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(<EmptyState title="Title" icon={<span data-testid="test-icon">🔍</span>} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders the action node when provided', () => {
    render(<EmptyState title="Title" action={<button>Click Me</button>} />);
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });

  it('applies the correct glow color class based on props', () => {
    const { container } = render(<EmptyState title="Title" glowColor="emerald" />);
    
    // The glow div has absolute positioning and the bg color class
    const glowDivs = container.querySelectorAll('div.absolute');
    let hasEmeraldGlow = false;
    
    glowDivs.forEach(div => {
      if (div.className.includes('bg-emerald-500/10')) {
        hasEmeraldGlow = true;
      }
    });
    
    expect(hasEmeraldGlow).toBe(true);
  });
});
