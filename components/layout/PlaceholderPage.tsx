import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {description ?? 'This area is part of the platform.'}
      </p>

      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-500">
          <Construction className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-gray-600">{title} coming soon</p>
        <p className="mt-1 max-w-sm text-xs text-gray-400">
          Use the AI assistant in the bottom-right corner to ask questions or create tasks.
        </p>
      </div>
    </div>
  );
}
