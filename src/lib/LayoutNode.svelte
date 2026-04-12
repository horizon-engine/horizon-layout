<script lang="ts">
	import LayoutPanel from './LayoutPanel.svelte';
	import LayoutSplit from './LayoutSplit.svelte';
	import type {
		LayoutConfig,
		LayoutItemDefinition,
		LayoutNodeConfig,
		MaximizeControlProps,
		ResizeConstraints
	} from './types.js';
	import type { TabActionControlProps } from './types.js';

	let {
		node,
		items,
		applyConfig,
		dragState,
		onDragStart,
		onDragMove,
		onDragEnd,
		selectedPanelId,
		onSelectPanel,
		dragAndDrop,
		popoutEnabled,
		onPopoutTab,
		onCloseTab,
		popoutButton,
		closeButton,
		maximizeEnabled,
		maximizeButton,
		restoreButton,
		maximizedTabId,
		restoringPanelId,
		setMaximizedTabId,
		resizeConstraints
	}: {
		node: LayoutNodeConfig;
		items: Record<string, LayoutItemDefinition>;
		applyConfig: (updater: (config: LayoutConfig) => LayoutConfig) => void;
		dragState: {
			tabId: string | null;
			panelId: string | null;
			clientX: number | null;
			clientY: number | null;
			input: 'pointer' | 'native' | null;
		};
		onDragStart: (
			tabId: string,
			panelId: string,
			options?: { clientX?: number; clientY?: number; input?: 'pointer' | 'native' }
		) => void;
		onDragMove: (clientX: number, clientY: number) => void;
		onDragEnd: () => void;
		selectedPanelId: string | null;
		onSelectPanel: (panelId: string) => void;
		dragAndDrop: boolean;
		popoutEnabled: boolean;
		onPopoutTab?: ((tabId: string, panelId: string) => void) | undefined;
		onCloseTab?: ((tabId: string, panelId: string) => void) | undefined;
		popoutButton?: import('svelte').Snippet<[TabActionControlProps]>;
		closeButton?: import('svelte').Snippet<[TabActionControlProps]>;
		maximizeEnabled: boolean;
		maximizeButton?: import('svelte').Snippet<[MaximizeControlProps]>;
		restoreButton?: import('svelte').Snippet<[MaximizeControlProps]>;
		maximizedTabId: string | null;
		restoringPanelId: string | null;
		setMaximizedTabId: (tabId?: string | null) => void;
		resizeConstraints?: ResizeConstraints;
	} = $props();
</script>

{#if node.type === 'panel'}
	<LayoutPanel
		panel={node}
		{items}
		{applyConfig}
		{dragState}
		{onDragStart}
		{onDragMove}
		{onDragEnd}
		{selectedPanelId}
		{onSelectPanel}
		{dragAndDrop}
		{popoutEnabled}
		{onPopoutTab}
		{onCloseTab}
		{popoutButton}
		{closeButton}
		{maximizeEnabled}
		{maximizeButton}
		{restoreButton}
		{maximizedTabId}
		{restoringPanelId}
		{setMaximizedTabId}
		{resizeConstraints}
	/>
{:else}
	<LayoutSplit
		split={node}
		{items}
		{applyConfig}
		{dragState}
		{onDragStart}
		{onDragMove}
		{onDragEnd}
		{selectedPanelId}
		{onSelectPanel}
		{dragAndDrop}
		{popoutEnabled}
		{onPopoutTab}
		{onCloseTab}
		{popoutButton}
		{closeButton}
		{maximizeEnabled}
		{maximizeButton}
		{restoreButton}
		{maximizedTabId}
		{restoringPanelId}
		{setMaximizedTabId}
		{resizeConstraints}
	/>
{/if}
