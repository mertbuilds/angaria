import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Route as McpRoute } from '../routes/mcp.tsx';
import { stubObservers } from '../test/observers.ts';
import { SiteHeader } from './site-header.tsx';

vi.mock('../lib/analytics.ts', () => ({ track: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The site's frame (header over the page) with the landing stubbed and the real /mcp page. */
async function renderSite(path: string) {
  const McpPage = McpRoute.options.component;
  if (!McpPage) {
    throw new Error('The /mcp route renders no component');
  }
  stubObservers();
  // jsdom has no scrolling; the router scrolls to the top on every navigation.
  vi.stubGlobal('scrollTo', vi.fn());
  const root = createRootRoute({
    component: () => (
      <>
        <SiteHeader />
        <Outlet />
      </>
    ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: root.addChildren([
      createRoute({ component: () => null, getParentRoute: () => root, path: '/' }),
      createRoute({
        component: McpPage,
        getParentRoute: () => root,
        path: '/mcp',
      }),
    ]),
  });
  await act(() => router.load());
  render(<RouterProvider router={router} />);
  return router;
}

const mcpLink = () =>
  within(screen.getByRole('navigation', { name: 'Site menüsü' })).getByRole('link', {
    name: 'MCP',
  });

describe('header', () => {
  test('links to the MCP page next to the trial button', async () => {
    const router = await renderSite('/');

    expect(mcpLink()).toHaveAttribute('href', '/mcp');
    expect(screen.getByRole('link', { name: 'Ücretsiz dene' })).toBeVisible();

    fireEvent.click(mcpLink());
    expect(
      await screen.findByRole('heading', { level: 1, name: "Angaria'yı Claude'a bağla" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/mcp');
    expect(mcpLink()).toHaveAttribute('aria-current', 'page');
  });
});

describe('/mcp', () => {
  test('lists the six tools and no signing tool', async () => {
    await renderSite('/mcp');

    const tools = await screen.findByRole('heading', { level: 2, name: 'Araçlar' });
    const list = tools.closest('section')?.querySelector('dl');
    expect(Array.from(list?.querySelectorAll('code') ?? [], (code) => code.textContent)).toEqual([
      'list_invoices',
      'get_invoice',
      'create_invoice',
      'cancel_invoice',
      'list_customers',
      'list_services',
    ]);
    expect(screen.getByText(/Faturayı onaylayan bir araç yok/)).toBeVisible();
  });

  test('says what leaves the Mac and how to set it up', async () => {
    await renderSite('/mcp');

    expect(await screen.findByText(/kullandığın yapay zekâ uygulamasına gider/)).toBeVisible();
    expect(document.querySelector('pre')).toHaveTextContent(
      "claude mcp add --scope user angaria -- '/Applications/Angaria.app/Contents/MacOS/angaria-mcp'",
    );
    for (const step of ["MCP'yi aç", 'Uygulamana ekle', 'Sor']) {
      expect(screen.getByRole('heading', { level: 3, name: step })).toBeVisible();
    }
    expect(screen.getByText("Geçen ay Northwind'e kestiğim faturaları listele")).toBeVisible();
  });
});
