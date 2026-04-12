<script lang="ts">
	import LayoutNode from './LayoutNode.svelte';
	import { clampResizePair, setSplitSizes } from './layout.js';
	import type {
		LayoutConfig,
		LayoutItemDefinition,
		LayoutSplitConfig,
		MaximizeControlProps,
		ResizeConstraints
	} from './types.js';
	import type { TabActionControlProps } from './types.js';

	let {
		split,
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
		split: LayoutSplitConfig;
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

	let container = $state<HTMLElement | null>(null);
	let resizeState = $state<{
		handleIndex: number;
		startPosition: number;
		startSizes: number[];
	} | null>(null);

	// Percentages map to pane space, not the full container box.
	// Subtract resizer element widths before converting pointer delta to percent.
	function getAvailablePaneSize(): number {
		if (!container) {
			return 0;
		}

		const rect = container.getBoundingClientRect();
		const total = split.direction === 'row' ? rect.width : rect.height;
		const directChildren = Array.from(container.children);
		const resizerSpace = directChildren.reduce((sum, child) => {
			if (
				!(child instanceof HTMLElement) ||
				!child.classList.contains('horizon-layout-split__resizer')
			) {
				return sum;
			}

			const childRect = child.getBoundingClientRect();
			return sum + (split.direction === 'row' ? childRect.width : childRect.height);
		}, 0);

		return Math.max(0, total - resizerSpace);
	}

	function startResize(event: PointerEvent, handleIndex: number) {
		resizeState = {
			handleIndex,
			startPosition: split.direction === 'row' ? event.clientX : event.clientY,
			startSizes: [...split.sizes]
		};
		event.preventDefault();
	}

	function updateResize(event: PointerEvent) {
		if (!resizeState || !container) {
			return;
		}

		const total = getAvailablePaneSize();
		if (!total) {
			return;
		}

		const currentPosition = split.direction === 'row' ? event.clientX : event.clientY;
		const delta = ((currentPosition - resizeState.startPosition) / total) * 100;
		const firstSize = (resizeState.startSizes[resizeState.handleIndex] ?? 0) + delta;
		const secondSize = (resizeState.startSizes[resizeState.handleIndex + 1] ?? 0) - delta;
		const [clampedFirst, clampedSecond] = clampResizePair(
			firstSize,
			secondSize,
			split.direction,
			resizeConstraints
		);

		const nextSizes = [...resizeState.startSizes];
		nextSizes[resizeState.handleIndex] = clampedFirst;
		nextSizes[resizeState.handleIndex + 1] = clampedSecond;

		const currentFirst = split.sizes[resizeState.handleIndex] ?? 0;
		const currentSecond = split.sizes[resizeState.handleIndex + 1] ?? 0;
		const unchanged =
			Math.abs(currentFirst - clampedFirst) < 0.001 &&
			Math.abs(currentSecond - clampedSecond) < 0.001;

		if (unchanged) {
			return;
		}

		applyConfig((current) => setSplitSizes(current, split.id, nextSizes, resizeConstraints));
	}

	function stopResize() {
		resizeState = null;
	}
</script>

<svelte:window onpointermove={updateResize} onpointerup={stopResize} onpointercancel={stopResize} />

<div
	class="horizon-layout-split"
	class:horizon-layout-split--row={split.direction === 'row'}
	class:horizon-layout-split--column={split.direction === 'column'}
	bind:this={container}
>
	{#each split.children as child, index (child.id)}
		<div
			class="horizon-layout-split__pane"
			style={`flex-grow:${split.sizes[index] ?? 0};flex-shrink:1;flex-basis:0;`}
		>
			<LayoutNode
				node={child}
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
		</div>

		{#if index < split.children.length - 1}
			<button
				type="button"
				class="horizon-layout-split__resizer"
				class:horizon-layout-split__resizer--row={split.direction === 'row'}
				class:horizon-layout-split__resizer--column={split.direction === 'column'}
				aria-label="Resize panes"
				onpointerdown={(event) => startResize(event, index)}
			></button>
		{/if}
	{/each}
</div>
