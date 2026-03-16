import type { WidgetSize } from './types'

export const WIDGET_SIZE_VALUES = ['small', 'medium', 'large'] as const satisfies readonly WidgetSize[]
export const WIDGET_SIZE_SET = new Set<WidgetSize>(WIDGET_SIZE_VALUES)

