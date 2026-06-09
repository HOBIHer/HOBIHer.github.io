import type { BackgroundId, BackgroundSettings } from '../game/types';
import type { CSSProperties } from 'react';

export interface BackgroundOption {
  id: BackgroundId;
  label: string;
}

export const backgroundOptions: BackgroundOption[] = [
  { id: 'solid', label: '默认纯色背景' },
  { id: 'stealthGrid', label: '低调网格背景' },
  { id: 'documentPaper', label: '文档纸张背景' },
  { id: 'darkCode', label: '深色代码背景' },
  { id: 'custom', label: '自定义本地图片背景' },
];

export function clampBackgroundOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.24;
  }

  return Math.min(0.9, Math.max(0, value));
}

export function getBackgroundStyle(background: BackgroundSettings): CSSProperties {
  const style = {
    '--background-opacity': String(clampBackgroundOpacity(background.opacity)),
  } as CSSProperties;

  if (background.id === 'custom' && background.customImageDataUrl) {
    return {
      ...style,
      '--custom-background-image': `url("${background.customImageDataUrl}")`,
    } as CSSProperties;
  }

  return style;
}

export function readLocalBackgroundFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unsupported background file result.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read background file.'));
    reader.readAsDataURL(file);
  });
}
