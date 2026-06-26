import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PnLValue from '@/components/pnl-value';

describe('PnLValue Component', () => {
  it('renders positive value correctly with plus sign and success class', () => {
    const { container } = render(<PnLValue value={1234.56} />);
    const mainSpan = container.querySelector('span');
    expect(mainSpan?.textContent).toBe('+₹1,234.56');
    expect(mainSpan?.className).toContain('text-success');
  });

  it('renders negative value correctly with minus sign and danger class', () => {
    const { container } = render(<PnLValue value={-987.65} />);
    const mainSpan = container.querySelector('span');
    expect(mainSpan?.textContent).toBe('-₹987.65');
    expect(mainSpan?.className).toContain('text-danger');
  });

  it('renders zero correctly without sign', () => {
    const { container } = render(<PnLValue value={0} />);
    const mainSpan = container.querySelector('span');
    expect(mainSpan?.textContent).toBe('₹0.00');
    expect(mainSpan?.className).toContain('text-[--text-secondary]');
  });

  it('renders percentage when provided', () => {
    const { container } = render(<PnLValue value={100} percentage={5.5} />);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
    expect(spans[1].textContent).toBe('(+5.50%)');
    expect(spans[1].className).toContain('text-success');
  });

  it('respects custom prefix and currency', () => {
    const { container } = render(<PnLValue value={500} prefix="US$" />);
    const mainSpan = container.querySelector('span');
    expect(mainSpan?.textContent).toBe('+US$500.00');
  });

  it('respects USD currency fallback', () => {
    const { container } = render(<PnLValue value={500} currency="USD" />);
    const mainSpan = container.querySelector('span');
    expect(mainSpan?.textContent).toBe('+$500.00');
  });

  it('can hide the positive sign', () => {
    const { container } = render(<PnLValue value={100} showSign={false} />);
    const mainSpan = container.querySelector('span');
    expect(mainSpan?.textContent).toBe('₹100.00'); // No '+' sign
  });

  it('handles amount prop as fallback for value', () => {
    const { container } = render(<PnLValue amount={250} />);
    const mainSpan = container.querySelector('span');
    expect(mainSpan?.textContent).toBe('+₹250.00');
  });
});
