import type { ThemeId } from '../../game/types';

export interface ThemeOption {
  id: ThemeId;
  label: string;
}

export const themeOptions: ThemeOption[] = [
  { id: 'normal', label: '普通' },
  { id: 'document', label: '文档' },
  { id: 'dashboard', label: '仪表盘' },
  { id: 'code', label: '代码' },
  { id: 'meeting', label: '会议' },
  { id: 'terminal', label: '终端' },
];
