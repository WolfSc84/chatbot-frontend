import { describe, expect, it } from 'vitest';

import { composeWelcome, firstNameOf } from './welcome';

describe('firstNameOf', () => {
  it.each([
    ['wolfgang.santamaria@example.com', 'Wolfgang'],
    ['wolfgang.santamaria', 'Wolfgang'],
    ['demo', 'Demo'],
    ['maria-jose@x.com', 'Maria'],
  ])('derives a first name from %s', (identity, expected) => {
    expect(firstNameOf(identity)).toBe(expected);
  });

  it.each([null, undefined, '', '   '])('returns nothing for %s', (identity) => {
    expect(firstNameOf(identity)).toBe('');
  });
});

describe('composeWelcome', () => {
  it('is deterministic — the same inputs give the same words every time', () => {
    const args = { lang: 'en' as const, firstName: 'Wolfgang', specialty: 'Nabors Support' };

    expect(composeWelcome(args)).toBe(composeWelcome(args));
  });

  it('greets by name and names the tenant specialty', () => {
    const text = composeWelcome({
      lang: 'en',
      firstName: 'Wolfgang',
      specialty: 'Nabors Support',
    });

    expect(text).toContain('Wolfgang');
    expect(text).toContain('Nabors Support');
  });

  it('renders in Spanish when the interface is Spanish', () => {
    const text = composeWelcome({ lang: 'es', firstName: 'Wolfgang', specialty: 'Soporte' });

    expect(text).toContain('¡Hola, Wolfgang!');
    expect(text).toContain('Soporte');
  });

  it('works without a name rather than greeting an empty space', () => {
    expect(composeWelcome({ lang: 'en', firstName: '', specialty: 'Sales' })).toContain('Hi there');
    expect(composeWelcome({ lang: 'es', firstName: null, specialty: 'Ventas' })).toContain('¡Hola!');
  });

  it('mentions only the active tenant, never another', () => {
    const text = composeWelcome({ lang: 'en', firstName: 'A', specialty: 'Nabors Support' });

    expect(text).not.toContain('Sales');
    expect(text).not.toContain('Knowledge Center');
  });

  it('stays to a short greeting rather than an essay', () => {
    const text = composeWelcome({ lang: 'en', firstName: 'Wolfgang', specialty: 'Sales' });

    expect(text.length).toBeLessThan(320);
  });
});
