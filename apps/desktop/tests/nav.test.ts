// @vitest-environment jsdom
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, test } from 'vitest';
import { routeTree } from '../src/routeTree.gen.ts';
import { sections } from '../src/shell/nav.ts';

describe('sections', () => {
  test('lists Hizmetler on its own, after Müşteriler', () => {
    expect(sections.map((section) => [section.label, section.to])).toEqual([
      ['Faturalar', '/faturalar'],
      ['Yeni fatura', '/yeni'],
      ['Müşteriler', '/musteriler'],
      ['Hizmetler', '/hizmetler'],
      ['Ayarlar', '/ayarlar'],
    ]);
  });

  test('⌘1-5 follow the sidebar order', () => {
    expect(sections.map((section) => section.key)).toEqual(['1', '2', '3', '4', '5']);
  });
});

async function open(url: string) {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    routeTree,
  });
  await router.load();
  return router.state.location.href;
}

describe('routes', () => {
  test('the old Hizmetler tab of Müşteriler redirects to /hizmetler', async () => {
    expect(await open('/musteriler?sekme=hizmetler')).toBe('/hizmetler');
  });

  test('Müşteriler stays on the customers', async () => {
    expect(await open('/musteriler')).toBe('/musteriler');
  });
});
