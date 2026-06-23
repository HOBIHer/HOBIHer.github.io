import type { RunSummary, UserSettings } from '../game/types';

export type CloudSyncDisabledResult = {
  ok: false;
  reason: 'NotEnabled';
  message: string;
};

export interface CloudSyncAdapter {
  uploadRunSummary(summary: RunSummary): Promise<CloudSyncDisabledResult>;
  downloadRunHistory(): Promise<CloudSyncDisabledResult>;
  syncSettings(settings: UserSettings): Promise<CloudSyncDisabledResult>;
}

const disabledResult: CloudSyncDisabledResult = {
  ok: false,
  reason: 'NotEnabled',
  message: '云同步：预留接口，当前未启用',
};

export class CloudSyncAdapterPlaceholder implements CloudSyncAdapter {
  async uploadRunSummary(_summary: RunSummary): Promise<CloudSyncDisabledResult> {
    return disabledResult;
  }

  async downloadRunHistory(): Promise<CloudSyncDisabledResult> {
    return disabledResult;
  }

  async syncSettings(_settings: UserSettings): Promise<CloudSyncDisabledResult> {
    return disabledResult;
  }
}
