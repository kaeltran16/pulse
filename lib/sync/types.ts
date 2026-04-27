import type {
  ConnectRequest,
  ConnectResponse,
  ImapStatusResponse,
  SyncEntriesResponse,
  SyncedEntryDTO,
} from '../api-types';

export type SyncStatus = 'connected' | 'disconnected' | 'error';

export type SyncResult = {
  inserted: number;
  status: SyncStatus;
};

export type {
  ConnectRequest,
  ConnectResponse,
  ImapStatusResponse,
  SyncedEntryDTO,
  SyncEntriesResponse,
};
