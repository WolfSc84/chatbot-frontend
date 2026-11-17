import { describe, expect, it } from 'vitest';
import { WORKSPACES, workspacesFor } from './mockData';

describe('workspacesFor', () => {
  it('keeps the Sales workspaces unchanged', () => {
    expect(workspacesFor('sales', 'es')).toBe(WORKSPACES);
  });

  it('gives Advanced prompts in the UI language', () => {
    const es = workspacesFor('advanced_care', 'es');
    const en = workspacesFor('advanced_care', 'en');
    expect(es.map((w) => w.id)).toEqual(en.map((w) => w.id));
    expect(es[0].prompt).toMatch(/alta|antibiótico/);
    expect(en[0].prompt).toMatch(/discharged/);
    expect(workspacesFor('advanced_staff', 'en')[0].prompt).toMatch(/PICC/);
  });

  it('is empty for tenants without suggestions', () => {
    expect(workspacesFor('nabors_support', 'en')).toEqual([]);
    expect(workspacesFor(null, 'en')).toEqual([]);
  });
});
