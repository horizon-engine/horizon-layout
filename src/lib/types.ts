import type { Snippet } from 'svelte';

export type SplitDirection = 'row' | 'column';

/** Content-area drops split on edges only; tab-bar merges handle panel-to-panel moves. */
export type DropEdge = 'top' | 'right' | 'bottom' | 'left';

/** Leaf node in the persisted layout tree. Knows nothing about components or snippets. */
export interface LayoutPanelConfig {
	id: string;
	type: 'panel';
	tabs: string[];
	activeTab: string | null;
}

/** Internal node in the persisted layout tree. `sizes` is parallel with `children`, in percentages. */
export interface LayoutSplitConfig {
	id: string;
	type: 'split';
	direction: SplitDirection;
	sizes: number[];
	children: LayoutNodeConfig[];
}

export type LayoutNodeConfig = LayoutPanelConfig | LayoutSplitConfig;

/** Top-level persisted value exposed via `bind:config`. */
export interface LayoutConfig {
	root: LayoutNodeConfig;
	maximizedTabId?: string | null;
	closedTabIds?: string[];
}

export interface LayoutItemControls {
	canPopout?: boolean;
	canMaximize?: boolean;
	canClose?: boolean;
}

/** Runtime registration data for a snippet item. Never serialized into the layout config. */
export interface LayoutItemDefinition {
	id: string;
	title: string;
	snippet: Snippet;
	controls?: LayoutItemControls;
}

/** Width constraints apply to `row` splits; height constraints apply to `column` splits. */
export interface ResizeConstraints {
	minWidthPercent?: number;
	maxWidthPercent?: number;
	minHeightPercent?: number;
	maxHeightPercent?: number;
}

/** Passed to user-provided tab-action snippets. */
export interface TabActionControlProps {
	panelId: string;
	tabId: string | null;
	action: () => void;
}

/** Passed to user-provided maximize/restore snippets. */
export interface MaximizeControlProps extends TabActionControlProps {}
