import type { TicketBoardResponse, TicketItem } from './types';

/**
 * Sample SysAid-style tickets used ONLY as a visual placeholder on the Task
 * Manager dashboard while the backend has no real tickets yet (e.g. no live
 * SysAid credentials configured, or the demo tenant has nothing filed).
 *
 * The dashboard always attempts the real `/api/tickets/board` fetch first and
 * automatically stops using this data the moment that call returns any real
 * tickets, so nothing needs to change here once SysAid is wired up live.
 */
const DEMO_TICKETS: TicketItem[] = [
  {
    local_id: 'SR-100482',
    title: 'Cannot access Digital Products exposures workbook',
    description:
      'User reports an error banner on the platform dashboard after SSO login; the ' +
      'exposures workbook fails to load and the submission list stays empty.',
    status: 'Open',
    category: 'Digital Products',
    intent_type: 'access_issue',
    created_at: '2026-07-28T14:12:00Z',
    reported_by: 'jsmith@example.com',
    affected_user: 'jsmith@example.com',
    request_count: 1,
    request_id: 'REQ-482',
    status_bucket: 'open',
  },
  {
    local_id: 'SR-100479',
    title: 'Copilot license request for new associate',
    description:
      'New hire needs a Microsoft Copilot license assigned before their first week of client work.',
    status: 'Open',
    category: 'AI Toolkit',
    intent_type: 'license_request',
    created_at: '2026-07-28T09:40:00Z',
    reported_by: 'mchen@example.com',
    affected_user: 'new.hire@example.com',
    request_count: 1,
    request_id: 'REQ-479',
    status_bucket: 'open',
  },
  {
    local_id: 'SR-100465',
    title: 'Broker Buddha submission stuck in "processing"',
    description:
      'A client submission has been stuck in processing status for over 24 hours; requester ' +
      'needs an update before the renewal deadline.',
    status: 'Open',
    category: 'Broker Buddha',
    intent_type: 'status_check',
    created_at: '2026-07-27T18:05:00Z',
    reported_by: 'rgarcia@example.com',
    affected_user: 'client.contact@example.com',
    request_count: 2,
    request_id: 'REQ-465',
    status_bucket: 'open',
  },
  {
    local_id: 'SR-100458',
    title: 'M-Files document upload permission error',
    description:
      'Producer cannot upload signed policy documents to the M-Files library; gets a ' +
      '"permission denied" error on the upload dialog.',
    status: 'In Progress',
    category: 'M-Files',
    intent_type: 'permissions',
    created_at: '2026-07-27T11:22:00Z',
    reported_by: 'tclark@example.com',
    affected_user: 'tclark@example.com',
    request_count: 1,
    request_id: 'REQ-458',
    status_bucket: 'in_progress',
  },
  {
    local_id: 'SR-100451',
    title: 'Knowledge Center data export failing',
    description:
      'Scheduled export to the Knowledge Center dashboard has failed for two consecutive ' +
      'nights; IT is investigating the connector job.',
    status: 'In Progress',
    category: 'Knowledge Center',
    intent_type: 'data_issue',
    created_at: '2026-07-26T22:10:00Z',
    reported_by: 'hradmin@example.com',
    affected_user: null,
    request_count: 3,
    request_id: 'REQ-451',
    status_bucket: 'in_progress',
  },
  {
    local_id: 'SR-100447',
    title: 'Risk Solutions platform report shows stale exposure totals',
    description:
      'Exposure totals on the Risk Solutions platform report have not refreshed since last week; ' +
      'requester needs current figures for a client meeting tomorrow.',
    status: 'In Progress',
    category: 'Risk Solutions platform',
    intent_type: 'data_issue',
    created_at: '2026-07-26T15:47:00Z',
    reported_by: 'analyst@example.com',
    affected_user: 'analyst@example.com',
    request_count: 1,
    request_id: 'REQ-447',
    status_bucket: 'in_progress',
  },
  {
    local_id: 'SR-100432',
    title: 'Password reset for the platform account',
    description: 'Associate locked out after repeated failed sign-in attempts; reset completed.',
    status: 'Resolved',
    category: 'Account Access',
    intent_type: 'password_reset',
    created_at: '2026-07-24T08:30:00Z',
    reported_by: 'ksmith@example.com',
    affected_user: 'ksmith@example.com',
    request_count: 1,
    request_id: 'REQ-432',
    status_bucket: 'done',
  },
  {
    local_id: 'SR-100420',
    title: 'Add new sub-category for Digital Products intake',
    description:
      'Requested a new SysAid sub-category to route Digital Products access tickets correctly; ' +
      'category added and confirmed with the requester.',
    status: 'Closed',
    category: 'Digital Products',
    intent_type: 'config_change',
    created_at: '2026-07-22T13:15:00Z',
    reported_by: 'admin@example.com',
    affected_user: null,
    request_count: 1,
    request_id: 'REQ-420',
    status_bucket: 'done',
  },
  {
    local_id: 'SR-100411',
    title: 'Producer Corner job aid link broken',
    description:
      'The "Prompting for Producers" job aid link on the Digital Office page returned a 404; ' +
      'link has been corrected and verified.',
    status: 'Closed',
    category: 'Digital Office',
    intent_type: 'content_fix',
    created_at: '2026-07-21T10:05:00Z',
    reported_by: 'content.owner@example.com',
    affected_user: null,
    request_count: 1,
    request_id: 'REQ-411',
    status_bucket: 'done',
  },
];

export const DEMO_TICKET_BOARD: TicketBoardResponse = {
  tickets: DEMO_TICKETS,
  board: {
    open: DEMO_TICKETS.filter((t) => t.status_bucket === 'open'),
    in_progress: DEMO_TICKETS.filter((t) => t.status_bucket === 'in_progress'),
    done: DEMO_TICKETS.filter((t) => t.status_bucket === 'done'),
  },
  counts: {
    open: DEMO_TICKETS.filter((t) => t.status_bucket === 'open').length,
    in_progress: DEMO_TICKETS.filter((t) => t.status_bucket === 'in_progress').length,
    done: DEMO_TICKETS.filter((t) => t.status_bucket === 'done').length,
    total: DEMO_TICKETS.length,
  },
};
