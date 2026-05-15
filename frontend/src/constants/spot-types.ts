/**
 * P26: spot 分类常量 — 6 类
 *
 * 设计:
 * - 单分类(互斥)union literal,通过 SpotItem.type 字段存储
 * - 在 admin select / trip 页 filter chip / marker glyph / popup 共享同一份 meta
 * - emoji 在 marker glyph 显示;label 中文给用户看
 *
 * tags 字段(SpotItem.tags: string[])保留为辅助自由标签(必吃/网红/24h),
 * 不参与本次过滤逻辑。
 */

export const SPOT_TYPE_VALUES = [
  'spot',
  'restaurant',
  'cafe',
  'shopping',
  'accommodation',
  'transport',
] as const;

export type SpotType = (typeof SPOT_TYPE_VALUES)[number];

export interface SpotTypeMetaItem {
  label: string;
  emoji: string;
}

/** 全部地图共享的中文 label + emoji */
export const SPOT_TYPE_META: Record<SpotType, SpotTypeMetaItem> = {
  spot:          { label: '景点', emoji: '📍' },
  restaurant:    { label: '餐厅', emoji: '🍽' },
  cafe:          { label: '咖啡', emoji: '☕' },
  shopping:      { label: '购物', emoji: '🛍' },
  accommodation: { label: '住宿', emoji: '🏨' },
  transport:     { label: '交通', emoji: '🚆' },
};

/** 校验任意输入是否合法 SpotType */
export function isSpotType(value: unknown): value is SpotType {
  return typeof value === 'string'
    && (SPOT_TYPE_VALUES as readonly string[]).includes(value);
}

/** 兜底:取 SpotType 或默认 'spot' */
export function coerceSpotType(value: unknown): SpotType {
  return isSpotType(value) ? value : 'spot';
}
