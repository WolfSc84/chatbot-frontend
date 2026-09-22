'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Pause, User, Volume2 } from 'lucide-react';
import { useAssistant } from '@/context/AssistantContext';
import { t, type Lang } from '@/lib/i18n';
import type { ChatMessage, ReportAttachment } from '@/lib/types';
import { MarkdownMessage } from './MarkdownMessage';

type ReportFormat = 'pdf' | 'xlsx' | 'docx' | 'png';

/** Sales-only: download buttons for a report generated this turn (PDF/Excel/Word/Image). */
function ReportDownload({ report, lang }: { report: ReportAttachment; lang: Lang }) {
  const { saveReport } = useAssistant();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formats: { key: ReportFormat; label: string; Icon: typeof FileText }[] = [
    { key: 'pdf', label: 'PDF', Icon: FileText },
    { key: 'xlsx', label: 'Excel', Icon: FileSpreadsheet },
    { key: 'docx', label: 'Word', Icon: FileText },
    { key: 'png', label: lang === 'es' ? 'Imagen' : 'Image', Icon: ImageIcon },
  ];

  const onDownload = async (format: ReportFormat) => {
    setError(null);
    setBusy(format);
    try {
      await saveReport(report, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, 'chat.reportFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Download className="h-3.5 w-3.5" />
        {t(lang, 'chat.downloadReport')}
      </span>
      {formats.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onDownload(key)}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-accent-300 hover:text-accent-600 disabled:opacity-60 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-400"
        >
          {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          <span>{label}</span>
        </button>
      ))}
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
}

interface ChatViewProps {
  messages: ChatMessage[];
  streaming: boolean;
}

/** Animated dots shown while waiting for the assistant's response to begin. */
function TypingIndicator({ lang }: { lang: Lang }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={t(lang, 'chat.typing')} role="status">
      <span className="h-2 w-2 animate-bounce rounded-full bg-accent-500 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-accent-500 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-accent-500" />
    </span>
  );
}

export function ChatView({ messages, streaming }: ChatViewProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const {
    uiLang,
    assistantName,
    playingMessageId,
    audioLoadingId,
    audioError,
    playMessageAudio,
    selectionMode,
    selectedExportIds,
    toggleExportSelection,
  } = useAssistant();

  // The assistant's own name for this tenant, falling back to the localized
  // generic. A tenant that rebrands should not need a rebuild to be named
  // correctly in its own transcript.
  const assistantLabel = assistantName?.trim() || t(uiLang, 'chat.speakerAssistant');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => {
        const isUser = msg.role === 'user';
        const isLast = idx === messages.length - 1;
        const showCursor = streaming && isLast && !isUser;
        const isPlaying = playingMessageId === msg.id;
        const isLoadingAudio = audioLoadingId === msg.id;
        const canPlay = !isUser && !!msg.content && !showCursor;

        return (
          <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            {selectionMode && (
              <input
                type="checkbox"
                checked={selectedExportIds.has(msg.id)}
                onChange={() => toggleExportSelection(msg.id)}
                aria-label="Include message in export"
                className="mr-2 mt-2.5 h-4 w-4 shrink-0 accent-accent-500"
              />
            )}
            <div className={`flex max-w-[80%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              {/*
                Explicit speaker attribution, both roles. Alignment and colour alone
                identify nobody once the transcript is exported, copied, or read
                aloud — and a spoken turn appears without the user having typed, so
                "who said this" should never need inferring.
              */}
              <div
                className={`mb-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 ${
                  isUser ? 'flex-row-reverse' : ''
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    isUser
                      ? 'bg-gray-200 text-gray-600 dark:bg-navy-700 dark:text-gray-300'
                      : 'bg-accent-500/15 text-accent-500'
                  }`}
                >
                  {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                </span>
                <span>{isUser ? t(uiLang, 'chat.speakerYou') : assistantLabel}</span>
              </div>
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                  isUser
                    ? 'whitespace-pre-wrap rounded-br-md bg-accent-500 text-white'
                    : 'rounded-bl-md border border-gray-200 bg-white text-gray-800 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-200'
                }`}
              >
                {isUser ? (
                  msg.content || '\u00A0'
                ) : msg.content ? (
                  <div className="inline-flex w-full flex-col">
                    <MarkdownMessage content={msg.content} />
                    {showCursor && <span className="accent-blink mt-0.5">▋</span>}
                  </div>
                ) : showCursor ? (
                  <TypingIndicator lang={uiLang} />
                ) : (
                  '\u00A0'
                )}
              </div>

              {canPlay && (
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    onClick={() => playMessageAudio(msg.id, msg.content)}
                    disabled={isLoadingAudio}
                    aria-label={t(uiLang, isPlaying ? 'chat.stopAudio' : 'chat.listen')}
                    title={t(uiLang, isPlaying ? 'chat.stopAudio' : 'chat.listen')}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                      isPlaying
                        ? 'border-accent-200 bg-accent-50 text-accent-600 hover:bg-accent-100'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-accent-300 hover:text-accent-600 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-400'
                    }`}
                  >
                    {isLoadingAudio ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t(uiLang, 'chat.loading')}</span>
                      </>
                    ) : isPlaying ? (
                      <>
                        <span className="accent-blink inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-accent-500" />
                          {t(uiLang, 'chat.playing')}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-white">
                          <Pause className="h-3.5 w-3.5" />
                          {t(uiLang, 'chat.stop')}
                        </span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4" />
                        <span>{t(uiLang, 'chat.listen')}</span>
                      </>
                    )}
                  </button>
                  {audioError && isPlaying && (
                    <span className="text-xs text-rose-500">{audioError}</span>
                  )}
                </div>
              )}

              {!isUser && msg.report && !showCursor && (
                <ReportDownload report={msg.report} lang={uiLang} />
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
