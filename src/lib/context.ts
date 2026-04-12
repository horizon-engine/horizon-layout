import type { LayoutItemDefinition } from './types.js';

export const HORIZON_LAYOUT_REGISTRY = Symbol('horizon-layout-registry');

// Per-instance MIME type set from the layout id so multiple layouts on the same page
// don't accept each other's drag events.
export const HORIZON_LAYOUT_DND_MIME = Symbol('horizon-layout-dnd-mime');

export interface LayoutRegistry {
	register: (item: LayoutItemDefinition) => void;
	unregister: (id: string) => void;
}
