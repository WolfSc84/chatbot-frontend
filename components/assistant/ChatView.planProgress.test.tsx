/**
 * A sequenced turn must show its plan, not a row of dots.
 *
 * The backend has emitted plan steps on the existing `step` events since the
 * multi-step phase, and the context collected them into `agentProgress` — but
 * nothing rendered them, so a three-step turn looked exactly like a hang. These
 * assertions read TEXT and status, not classes, so a restyle cannot quietly
 * remove the only visible evidence that work is happening.
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
  agentProgress: [] as Array<Record<string, unknown>>,
};

vi.mock('@/context/AssistantContext', () => ({ useAssistant: () => ctx }));
vi.mock('../../context/AssistantContext', () => ({ useAssistant: () => ctx }));

import { ChatView } from './ChatView';

Element.prototype.scrollIntoView = vi.fn();

// An assistant turn with no content yet is the streaming placeholder — the one
// the dots render into, and the only moment a plan is worth showing.
const PENDING = [
  { id: 'm1', role: 'user' as const, content: 'pull the history, draft it, open a ticket' },
  { id: 'm2', role: 'assistant' as const, content: '' },
];

const PLAN = [
  { id: 'plan:0', name: 'plan_0', label: 'Pull the account history', phase: 'plan', status: 'completed', kind: 'node' },
  { id: 'plan:1', name: 'plan_1', label: 'Draft the proposal section', phase: 'plan', status: 'started', kind: 'node' },
  { id: 'plan:2', name: 'plan_2', label: 'Open a follow-up ticket', phase: 'plan', status: 'started', kind: 'node' },
];

describe('plan progress', () => {
  it('shows every planned step while the turn is streaming', () => {
    ctx.uiLang = 'en';
    ctx.agentProgress = PLAN;

    render(<ChatView messages={PENDING} streaming={true} />);

    expect(screen.getByText('Pull the account history')).toBeInTheDocument();
    expect(screen.getByText('Draft the proposal section')).toBeInTheDocument();
    expect(screen.getByText('Open a follow-up ticket')).toBeInTheDocument();
  });

  it('keeps the steps in the order the agent planned them', () => {
    ctx.uiLang = 'en';
    ctx.agentProgress = PLAN;

    render(<ChatView messages={PENDING} streaming={true} />);

    const rendered = screen.getByTestId('plan-progress').textContent ?? '';
    expect(rendered.indexOf('Pull the account history')).toBeLessThan(
      rendered.indexOf('Draft the proposal section'),
    );
    expect(rendered.indexOf('Draft the proposal section')).toBeLessThan(
      rendered.indexOf('Open a follow-up ticket'),
    );
  });

  it('shows nothing when the turn has no plan', () => {
    // A single-shot answer must not grow an empty checklist above it.
    ctx.uiLang = 'en';
    ctx.agentProgress = [];

    render(<ChatView messages={PENDING} streaming={true} />);

    expect(screen.queryByTestId('plan-progress')).toBeNull();
  });

  it('ignores steps that are not plan steps', () => {
    // Tool steps already have their own meaning; only the plan is a checklist.
    ctx.uiLang = 'en';
    ctx.agentProgress = [
      { id: 'tool:search_knowledge', name: 'search_knowledge', label: 'Searching', phase: 'do', status: 'started', kind: 'tool' },
    ];

    render(<ChatView messages={PENDING} streaming={true} />);

    expect(screen.queryByTestId('plan-progress')).toBeNull();
  });

  it('does not show the plan once the answer has arrived', () => {
    ctx.uiLang = 'en';
    ctx.agentProgress = PLAN;

    render(
      <ChatView
        messages={[PENDING[0], { id: 'm2', role: 'assistant' as const, content: 'Here it is.' }]}
        streaming={false}
      />,
    );

    expect(screen.queryByTestId('plan-progress')).toBeNull();
    expect(screen.getByText('Here it is.')).toBeInTheDocument();
  });
});
