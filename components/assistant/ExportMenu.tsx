'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckSquare, Download, Loader2 } from 'lucide-react';
import { useAssistant } from '@/context/AssistantContext';
import type { ExportFormat } from '@/lib/types';

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Document' },
  { value: 'txt', label: 'Plain text' },
  { value: 'clipboard', label: 'Clipboard' },
];

export function ExportMenu({ onClose }: { onClose: () => void }) {
  const {
    isExporting,
    exportError,
    exportFormat,
    setExportFormat,
    selectionMode,
    toggleSelectionMode,
    selectedExportIds,
    exportConversation,
  } = useAssistant();

  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleExport = async () => {
    setDone(false);
    await exportConversation();
    setDone(true);
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Export conversation
      </p>

      <label className="mb-1 block text-xs font-medium text-gray-600">Format</label>
      <select
        value={exportFormat}
        onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
        className="mb-3 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
      >
        {FORMAT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        onClick={toggleSelectionMode}
        className={`mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
          selectionMode
            ? 'border-accent-400 bg-accent-50 text-accent-600'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <CheckSquare className="h-3.5 w-3.5" />
        {selectionMode
          ? `Selecting (${selectedExportIds.size})`
          : 'Select messages'}
      </button>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-60"
      >
        {isExporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {isExporting ? 'Exporting…' : 'Export'}
      </button>

      {exportError && (
        <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{exportError}</p>
      )}
      {done && !exportError && !isExporting && (
        <p className="mt-2 text-xs text-accent-600">
          {exportFormat === 'clipboard' ? 'Copied to clipboard.' : 'Export ready.'}
        </p>
      )}
    </div>
  );
}
