'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Megaphone, ShieldCheck, Sparkles } from 'lucide-react';

import { warmupCache } from '@/lib/api';

type PolicyOffer = {
  id: string;
  title: string;
  blurb: string;
  discountLabel: string;
  segment: string;
  startsAt: string;
  endsAt: string;
  prompt: string;
};

const POLICY_OFFERS: PolicyOffer[] = [
  {
    id: 'cyber-q2-boost',
    title: 'Cyber Risk Fast-Track',
    blurb: 'Priority quoting for mid-market clients with prefilled questionnaire support.',
    discountLabel: 'Up to 12% launch incentive',
    segment: 'Technology and Services',
    startsAt: '2026-06-01T00:00:00Z',
    endsAt: '2026-06-30T23:59:59Z',
    prompt: 'Show active cyber offers for my clients and list top eligibility criteria.',
  },
  {
    id: 'property-renewal-saver',
    title: 'Property Renewal Saver',
    blurb: 'Bundled renewal advisory for accounts with upcoming property policy expirations.',
    discountLabel: '5% renewal credit',
    segment: 'Manufacturing and Logistics',
    startsAt: '2026-06-10T00:00:00Z',
    endsAt: '2026-07-15T23:59:59Z',
    prompt: 'Which clients are eligible for the Property Renewal Saver this month?',
  },
  {
    id: 'workers-comp-accelerator',
    title: 'Workers Comp Accelerator',
    blurb: 'Reduced turnaround with benchmark pricing for low-loss-ratio accounts.',
    discountLabel: 'Expedited underwriting lane',
    segment: 'Construction and Field Services',
    startsAt: '2026-06-05T00:00:00Z',
    endsAt: '2026-06-25T23:59:59Z',
    prompt: 'Prepare a shortlist of clients that fit the Workers Comp Accelerator profile.',
  },
];

type OfferState = 'live' | 'upcoming' | 'ended';

function getOfferState(now: number, startsAt: number, endsAt: number): OfferState {
  if (now < startsAt) return 'upcoming';
  if (now > endsAt) return 'ended';
  return 'live';
}

function getDaysLeftText(now: number, endsAt: number): string {
  const msLeft = endsAt - now;
  if (msLeft <= 0) return 'Ended';
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
}

export function WelcomePolicyOffers() {
  const [nowMs, setNowMs] = useState(Date.now());
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const clock = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  // Pre-cache the suggested chatbot prompts once on mount so the first click
  // returns instantly from the backend response cache.
  useEffect(() => {
    void warmupCache(POLICY_OFFERS.map((offer) => offer.prompt));
  }, []);

  const orderedOffers = useMemo(() => {
    const enriched = POLICY_OFFERS.map((offer) => {
      const startsAtMs = new Date(offer.startsAt).getTime();
      const endsAtMs = new Date(offer.endsAt).getTime();
      const state = getOfferState(nowMs, startsAtMs, endsAtMs);
      return { offer, startsAtMs, endsAtMs, state };
    });

    return enriched.sort((a, b) => {
      const priority = { live: 0, upcoming: 1, ended: 2 } as const;
      if (priority[a.state] !== priority[b.state]) {
        return priority[a.state] - priority[b.state];
      }
      return a.endsAtMs - b.endsAtMs;
    });
  }, [nowMs]);

  useEffect(() => {
    if (orderedOffers.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % orderedOffers.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [orderedOffers.length]);

  const active = orderedOffers[activeIndex] ?? orderedOffers[0];
  if (!active) return null;

  const { offer, startsAtMs, endsAtMs, state } = active;
  const totalWindow = Math.max(endsAtMs - startsAtMs, 1);
  const elapsed = Math.min(Math.max(nowMs - startsAtMs, 0), totalWindow);
  const progressPct = Math.round((elapsed / totalWindow) * 100);

  const badgeText =
    state === 'live' ? 'Live now' : state === 'upcoming' ? 'Coming soon' : 'Closed';

  return (
    <section className="mb-6 rounded-2xl border border-accent-100 bg-gradient-to-r from-accent-50 via-white to-emerald-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-200">
            <Megaphone className="h-3.5 w-3.5" />
            Dynamic Policy Offers
          </div>
          <h2 className="mt-2 text-lg font-semibold text-gray-900">Offer Spotlight</h2>
          <p className="mt-1 text-sm text-gray-600">Real-time campaign highlights for new policy opportunities.</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-gray-700 ring-1 ring-gray-200">
          <CalendarClock className="h-4 w-4 text-accent-600" />
          {getDaysLeftText(nowMs, endsAtMs)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">{offer.title}</h3>
            <span className="rounded-full bg-accent-100 px-2 py-1 text-[11px] font-semibold text-accent-700">
              {badgeText}
            </span>
          </div>

          <p className="mt-2 text-sm text-gray-600">{offer.blurb}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              {offer.discountLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {offer.segment}
            </span>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-accent-500 transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3 md:max-w-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested chatbot prompt</p>
          <p className="mt-2 text-sm text-gray-700">{offer.prompt}</p>
        </div>
      </div>
    </section>
  );
}
