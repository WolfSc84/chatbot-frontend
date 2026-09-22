/**
 * Every turn says who said it, in words.
 *
 * Before this, a message was identified only by which side it sat on and what
 * colour it was. That is nothing to a screen reader, nothing once the transcript
 * is exported or pasted elsewhere, and least of all useful in live voice — where
 * a user turn appears without the user having typed anything.
 *
 * The assertions deliberately read TEXT, not classes: a future restyle may move
 * the label or change the icon, and should not be able to quietly remove the only
 * machine-readable statement of who is speaking.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const ctx = {
  uiLang: 'en' as 'en' | 'es',
  assistantName: null as string | null,
  playingMessageId: null,
  audioLoadingId: null,
  audioError: null,
  playMessageAudio: vi.fn(),
  selectionMode: false,
  selectedExportIds: new Set<string>(),
  toggleExportSelection: vi.fn(),
};

vi.mock('@/context/AssistantContext', () => ({ useAssistant: () => ctx }));
vi.mock('../../context/AssistantContext', () => ({ useAssistant: () => ctx }));

import { ChatView } from './ChatView';

// jsdom implements no layout, so the auto-scroll-to-latest effect has nothing to
// call. Unrelated to what is under test; stub it rather than guard the component.
Element.prototype.scrollIntoView = vi.fn();

const MESSAGES = [
  { id: 'm1', role: 'user' as const, content: 'where is the well list' },
  { id: 'm2', role: 'assistant' as const, content: 'In the myWells portal.' },
];

describe('speaker attribution', () => {
  it('labels both the user and the assistant in words', () => {
    ctx.uiLang = 'en';
    ctx.assistantName = null;

    render(<ChatView messages={MESSAGES} streaming={false} />);

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    // The label is additive: adding attribution must not displace the message
    // itself. Both roles' content still renders.
    expect(screen.getByText('where is the well list')).toBeInTheDocument();
    expect(screen.getByText('In the myWells portal.')).toBeInTheDocument();
  });

  it('follows the interface language', () => {
    ctx.uiLang = 'es';
    ctx.assistantName = null;

    render(<ChatView messages={MESSAGES} streaming={false} />);

    expect(screen.getByText('Tú')).toBeInTheDocument();
    expect(screen.getByText('Asistente')).toBeInTheDocument();
  });

  it("uses the tenant's own assistant name when it has one", () => {
    // A rebranded tenant must be named correctly without a rebuild.
    ctx.uiLang = 'en';
    ctx.assistantName = 'Rigline Helper';

    render(<ChatView messages={MESSAGES} streaming={false} />);

    expect(screen.getByText('Rigline Helper')).toBeInTheDocument();
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
  });
});
