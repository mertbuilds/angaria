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
import { MCP_TOOLS } from '../lib/mcp.ts';
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
  test('lists every tool, marking the ones that need the app’s permission', async () => {
    await renderSite('/mcp');

    const tools = await screen.findByRole('heading', { level: 2, name: 'Araçlar' });
    const list = tools.closest('section')?.querySelector('dl');
    const names = Array.from(list?.querySelectorAll('code') ?? [], (code) => code.textContent);
    expect(names).toEqual(MCP_TOOLS.map((tool) => tool.name));
    expect(names).toContain('sign_invoices');
    const gated = Array.from(list?.querySelectorAll('dt') ?? []).filter((term) =>
      term.textContent?.includes('İzin gerekir'),
    );
    expect(gated.map((term) => term.querySelector('code')?.textContent)).toEqual(
      MCP_TOOLS.filter((tool) => 'gated' in tool).map((tool) => tool.name),
    );
    expect(screen.getByText(/yalnızca sen izin verince çalışır/)).toBeVisible();
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
