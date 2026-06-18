/* =========================================================================
 * Typed fetch client for the CF Wavescan backend (/api).
 * ========================================================================= */
import { getApiBase } from './cf';

export interface Reading {
  id?: number;
  file_id?: number;
  month_key: string;
  plant: string | null;
  model: string | null;
  color: string;
  family: string;
  zone: string;
  orient: 'H' | 'V';
  cf: number;
}

export interface MonthRollup {
  monthKey: string;
  count: number;
  label: string;
}

export interface FileRow {
  id: number;
  filename: string;
  month_key: string;
  plant: string | null;
  model: string | null;
  row_count: number;
  imported_at: string;
}

export interface StandardRow {
  fordH: number;
  fordV: number;
  minH: number;
  minV: number;
}
export interface Standards {
  families: Record<string, StandardRow>;
  colors: Record<string, StandardRow>;
}

export interface ImportStaged {
  id: string;
  rowCount: number;
  warnings: string[];
  monthHint: { year: number; month: number; key: string } | null;
  modelDetected: string | null;
  plantDetected: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await getApiBase();
  const res = await fetch(base + path, init);
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error || '';
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? ' — ' + detail : ''}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ ok: boolean; version: string }>('/api/health'),

  months: () => req<MonthRollup[]>('/api/months'),
  readings: (key: string) => req<Reading[]>(`/api/months/${encodeURIComponent(key)}/readings`),
  files: (key: string) => req<FileRow[]>(`/api/months/${encodeURIComponent(key)}/files`),
  deleteFile: (id: number) => req<{ ok: boolean; deleted: number }>(`/api/files/${id}`, { method: 'DELETE' }),

  updateReading: (
    id: number,
    patch: Partial<Pick<Reading, 'cf' | 'color' | 'zone' | 'orient' | 'model' | 'plant'>>
  ) =>
    req<Reading>(`/api/readings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  deleteReading: (id: number) =>
    req<{ ok: boolean; deleted: number; fileId: number }>(`/api/readings/${id}`, { method: 'DELETE' }),

  standards: () => req<Standards>('/api/standards'),
  saveStandards: (s: Standards) =>
    req<{ ok: boolean }>('/api/standards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    }),

  upload: async (file: File): Promise<ImportStaged> => {
    const base = await getApiBase();
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(base + '/api/imports', { method: 'POST', body: fd });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.json()).error || '';
      } catch {
        /* ignore */
      }
      throw new Error(`Upload failed: HTTP ${res.status}${detail ? ' — ' + detail : ''}`);
    }
    return res.json();
  },

  commitImport: (id: string, body: { monthKey: string; model?: string | null; plant?: string | null }) =>
    req<{ ok: boolean; monthKey: string; added: number }>(`/api/imports/${id}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  discardImport: (id: string) =>
    req<{ ok: boolean; discarded: number }>(`/api/imports/${id}`, { method: 'DELETE' }),
};
