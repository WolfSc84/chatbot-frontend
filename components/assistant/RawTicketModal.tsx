'use client';

import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

interface RawTicketModalProps {
  data: unknown;
  loading: boolean;
  onClose: () => void;
}

export function RawTicketModal({ data, loading, onClose }: RawTicketModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-navy-950 px-4 py-3 text-white">
          <span className="text-sm font-semibold">Ticket JSON</span>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 scroll-thin">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </p>
          ) : (
            <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-800">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
