import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SiteFooter } from './site-footer.tsx';

vi.mock('../lib/analytics.ts', () => ({ track: vi.fn() }));

describe('footer', () => {
  test('links the pricing and the Polar customer portal, and no source code', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: 'Fiyat' })).toHaveAttribute('href', '/#fiyat');
    const portal = screen.getByRole('link', { name: 'Aboneliğini yönet' });
    expect(portal).toHaveAttribute('href', 'https://polar.sh/angaria/portal');
    expect(portal).toHaveAttribute('target', '_blank');
    expect(portal).toHaveAttribute('rel', 'noreferrer');
    expect(screen.queryByRole('link', { name: /GitHub|yıldız|Lisans/ })).not.toBeInTheDocument();
  });
});
