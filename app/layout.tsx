import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Assistant',
  description: 'Assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint so there's no light-mode flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.theme==='dark'||(!('theme'in localStorage)&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased text-gray-900 dark:bg-navy-950 dark:text-gray-100">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
