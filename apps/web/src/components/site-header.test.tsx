import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Route as McpRoute } from '../routes/mcp.tsx';
import { stubObservers } from '../test/observers.ts';
import { SiteHeader } from './site-header.tsx';

vi.mock('../lib/analytics.ts', () => ({ track: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The site's frame (header over the page) with the landing and /gizlilik stubbed, and the real /mcp redirect. */
async function renderSite(path: string) {
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
      createRoute({ component: () => null, getParentRoute: () => root, path: '/gizlilik' }),
      createRoute({
        beforeLoad: () => redirectFromMcp(),
        getParentRoute: () => root,
        path: '/mcp',
      }),
    ]),
  });
  await act(() => router.load());
  render(<RouterProvider router={router} />);
  return router;
}

/** The /mcp route's redirect, which ignores the match context beforeLoad's type asks for. */
const redirectFromMcp = McpRoute.options.beforeLoad as () => never;

const nav = () => within(screen.getByRole('navigation', { name: 'Site menüsü' }));

describe('header', () => {
  test('links to the landing’s sections, the source and the download', async () => {
    await renderSite('/');

    expect(
      nav()
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['MCP', '#mcp'],
      ['Nasıl çalışır', '#nasil'],
      ['Özellikler', '#ozellikler'],
      ['Gizlilik', '#gizlilik'],
      ['SSS', '#sss'],
    ]);
    expect(screen.getByRole('link', { name: 'Angaria ana sayfa' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/vinenastudio/angaria',
    );
    expect(screen.getByRole('link', { name: 'İndir' })).toHaveAttribute(
      'href',
      'https://dl.angaria.app/latest/Angaria.dmg',
    );
    expect(screen.getByRole('button', { name: 'Menüyü aç' })).toBeInTheDocument();
  });

  test('on another page, the section links go back to the landing', async () => {
    await renderSite('/gizlilik');

    expect(nav().getByRole('link', { name: 'MCP' })).toHaveAttribute('href', '/#mcp');
  });
});

describe('/mcp', () => {
  test('moved into the landing: it redirects to its section for good', async () => {
    const router = await renderSite('/mcp');

    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.hash).toBe('mcp');
  });

  test('answers with a permanent redirect', () => {
    let thrown: unknown;
    try {
      redirectFromMcp();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(301);
  });
});
