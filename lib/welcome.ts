/**
 * The greeting a new conversation opens with.
 *
 * Deliberately deterministic and composed on the client: no model call, so it
 * costs nothing, adds no latency to the first thing the user sees, and cannot
 * hallucinate a capability the tenant does not have. The same inputs always
 * produce the same words.
 *
 * It is also never sent to the backend, which is what keeps it out of the
 * conversation history and out of the summarizer — a greeting is framing, not a
 * turn, and counting it as one would waste context on every thread.
 */

import { type Lang } from '@/lib/i18n';

/** First name from an email or username, title-cased. Falls back to no name. */
export function firstNameOf(identity: string | null | undefined): string {
  const raw = (identity ?? '').trim();
  if (!raw) return '';
  const local = raw.includes('@') ? raw.split('@')[0] : raw;
  const first = local.split(/[.\-_\s]+/).filter(Boolean)[0] ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
}

/**
 * Two to three sentences: who is speaking, what they specialize in, an opening.
 *
 * `specialty` is the tenant's own display name, so the greeting names the active
 * tenant and no other — switching tenant switches the greeting.
 */
export function composeWelcome(options: {
  lang: Lang;
  firstName?: string | null;
  specialty: string;
}): string {
  const { lang, specialty } = options;
  const name = (options.firstName ?? '').trim();

  if (lang === 'es') {
    const hola = name ? `¡Hola, ${name}!` : '¡Hola!';
    return (
      `${hola} Soy tu asistente de **${specialty}**. ` +
      `Puedo resolver dudas, ayudarte a diagnosticar un problema paso a paso y abrir un ticket ` +
      `de soporte si hace falta.\n\n¿En qué te ayudo hoy?`
    );
  }

  const hello = name ? `Hi ${name} —` : 'Hi there —';
  return (
    `${hello} I'm your **${specialty}** assistant. ` +
    `I can answer questions, work through a problem with you step by step, and raise a support ` +
    `ticket if we need one.\n\nWhat can I help you with today?`
  );
}
