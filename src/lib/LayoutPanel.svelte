<script lang="ts">
	import { getContext } from 'svelte';
	import { HORIZON_LAYOUT_DND_MIME } from './context.js';
	import { moveTab, setActiveTab, splitPanel } from './layout.js';
	import type {
		DropEdge,
		LayoutConfig,
		LayoutItemDefinition,
		LayoutPanelConfig,
		MaximizeControlProps,
		ResizeConstraints
	} from './types.js';
	import type { TabActionControlProps } from './types.js';

	const dndMime = getContext<string>(HORIZON_LAYOUT_DND_MIME);

	let {
		panel,
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
		panel: LayoutPanelConfig;
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

	const tabs = $derived.by(() =>
		panel.tabs
			.map((id: string) => {
				const item = items[id];
				return item ? { id, item } : null;
			})
			.filter(
				(
					entry: { id: string; item: LayoutItemDefinition } | null
				): entry is { id: string; item: LayoutItemDefinition } => entry !== null
			)
	);
	const activeTabId = $derived(
		panel.activeTab && items[panel.activeTab] ? panel.activeTab : (tabs[0]?.id ?? null)
	);
	const activeItem = $derived(activeTabId ? items[activeTabId] : null);
	const canMaximizeActiveTab = $derived(
		activeItem ? (activeItem.controls?.canMaximize ?? true) : false
	);
	const isMaximized = $derived(activeTabId !== null && maximizedTabId === activeTabId);
	const isRestoring = $derived(restoringPanelId === panel.id);
	const isSelectedPanel = $derived(selectedPanelId === panel.id);
	const isDraggingOnlyTabFromThisPanel = $derived(
		dragState.panelId === panel.id &&
			dragState.tabId !== null &&
			panel.tabs.length === 1 &&
			panel.tabs[0] === dragState.tabId
	);

	let tabBarElement = $state<HTMLElement | null>(null);
	let tabScrollerElement = $state<HTMLElement | null>(null);
	let contentElement = $state<HTMLElement | null>(null);
	let dropIndex = $state<number | null>(null);
	let contentDropEdge = $state<DropEdge | null>(null);
	let autoScrollDirection = $state<-1 | 0 | 1>(0);
	let autoScrollFrame = 0;
	let pointerSession = $state<{
		pointerId: number;
		tabId: string;
		startX: number;
		startY: number;
		active: boolean;
	} | null>(null);

	function resetDropState() {
		dropIndex = null;
		contentDropEdge = null;
		stopAutoScroll();
	}

	function isLayoutDrag(event: DragEvent): boolean {
		return dragAndDrop && Array.from(event.dataTransfer?.types ?? []).includes(dndMime);
	}

	function readDragData(event: DragEvent): { tabId: string; panelId: string } | null {
		try {
			const raw = event.dataTransfer?.getData(dndMime);
			return raw ? (JSON.parse(raw) as { tabId: string; panelId: string }) : null;
		} catch {
			return null;
		}
	}

	function selectTab(tabId: string) {
		onSelectPanel(panel.id);
		applyConfig((current) => setActiveTab(current, panel.id, tabId));
		queueMicrotask(() => {
			scrollTabIntoView(tabId);
		});
	}

	function handlePopoutClick(tabId: string) {
		onSelectPanel(panel.id);
		onPopoutTab?.(tabId, panel.id);
	}

	function handleCloseClick(tabId: string) {
		onSelectPanel(panel.id);
		onCloseTab?.(tabId, panel.id);
	}

	function canPopoutTab(item: LayoutItemDefinition): boolean {
		return item.controls?.canPopout ?? popoutEnabled;
	}

	function canCloseTab(item: LayoutItemDefinition): boolean {
		return item.controls?.canClose ?? false;
	}

	function handleDragEnd() {
		pointerSession = null;
		onDragEnd();
		resetDropState();
	}

	function computeTabDropTargetForScroller(
		scroller: HTMLElement | null,
		clientX: number
	): { tabId: string; position: 'before' | 'after'; index: number } | null {
		if (!scroller) {
			return null;
		}

		const tabHeaders = Array.from(scroller.querySelectorAll<HTMLElement>('[data-tab-id]'));
		if (tabHeaders.length === 0) {
			return null;
		}

		const scrollerRect = scroller.getBoundingClientRect();
		if (clientX < scrollerRect.left || clientX > scrollerRect.right) {
			return null;
		}

		for (const [index, tabElement] of tabHeaders.entries()) {
			const rect = tabElement.getBoundingClientRect();
			const midpoint = rect.left + rect.width / 2;
			const tabId = tabElement.dataset['tabId'];
			if (!tabId) {
				continue;
			}

			if (clientX < midpoint) {
				return { tabId, position: 'before', index };
			}
		}

		const lastTab = tabHeaders.at(-1);
		const tabId = lastTab?.dataset['tabId'];
		return tabId ? { tabId, position: 'after', index: tabHeaders.length } : null;
	}

	function applyTabDropTarget(clientX: number) {
		const target = computeTabDropTargetForScroller(tabScrollerElement, clientX);
		if (!target) {
			dropIndex = null;
			return;
		}

		if (
			dragState.panelId === panel.id &&
			(dragState.tabId === null ||
				isSamePanelInsertNoOp(target.index, panel.tabs.indexOf(dragState.tabId)))
		) {
			dropIndex = null;
			return;
		}

		dropIndex = target.index;
	}

	function resolveSamePanelInsertIndex(targetIndex: number, sourceIndex: number): number {
		const adjustedIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
		return Math.max(0, adjustedIndex);
	}

	function isSamePanelInsertNoOp(targetIndex: number, sourceIndex: number): boolean {
		return resolveSamePanelInsertIndex(targetIndex, sourceIndex) === sourceIndex;
	}

	function isPointInside(clientX: number, clientY: number, element: HTMLElement | null): boolean {
		if (!element) {
			return false;
		}

		const rect = element.getBoundingClientRect();
		return (
			clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
		);
	}

	function scrollTabIntoView(tabId: string) {
		if (!tabScrollerElement) {
			return;
		}

		const tabElement = tabScrollerElement.querySelector<HTMLElement>(`[data-tab-id="${tabId}"]`);
		if (!tabElement) {
			return;
		}

		const tabRect = tabElement.getBoundingClientRect();
		const scrollerRect = tabScrollerElement.getBoundingClientRect();
		if (tabRect.left < scrollerRect.left || tabRect.right > scrollerRect.right) {
			tabElement.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'nearest'
			});
		}
	}

	function handleTabsWheel(event: WheelEvent) {
		if (!tabScrollerElement) {
			return;
		}

		const mostlyVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
		const delta = mostlyVertical ? event.deltaY : event.deltaX;
		if (delta === 0) {
			return;
		}

		event.preventDefault();
		tabScrollerElement.scrollBy({
			left: delta,
			behavior: 'auto'
		});
	}

	function stopAutoScroll() {
		autoScrollDirection = 0;
		if (autoScrollFrame) {
			cancelAnimationFrame(autoScrollFrame);
			autoScrollFrame = 0;
		}
	}

	function tickAutoScroll() {
		if (!tabScrollerElement || autoScrollDirection === 0) {
			autoScrollFrame = 0;
			return;
		}

		tabScrollerElement.scrollBy({
			left: autoScrollDirection * 12,
			behavior: 'auto'
		});
		autoScrollFrame = requestAnimationFrame(tickAutoScroll);
	}

	function updateAutoScroll(clientX: number) {
		if (!tabScrollerElement) {
			return;
		}

		const rect = tabScrollerElement.getBoundingClientRect();
		const edgeDistance = 36;
		let nextDirection: -1 | 0 | 1 = 0;

		if (clientX <= rect.left + edgeDistance) {
			nextDirection = -1;
		} else if (clientX >= rect.right - edgeDistance) {
			nextDirection = 1;
		}

		if (nextDirection === autoScrollDirection) {
			return;
		}

		stopAutoScroll();
		autoScrollDirection = nextDirection;
		if (autoScrollDirection !== 0) {
			autoScrollFrame = requestAnimationFrame(tickAutoScroll);
		}
	}

	function handleTabBarDragOver(event: DragEvent) {
		if (!isLayoutDrag(event) || !tabBarElement) {
			return;
		}

		if (isDraggingOnlyTabFromThisPanel) {
			resetDropState();
			return;
		}

		event.preventDefault();
		updateAutoScroll(event.clientX);
		applyTabDropTarget(event.clientX);
		contentDropEdge = null;
	}

	function handleTabBarDrop(event: DragEvent) {
		if (!isLayoutDrag(event)) {
			return;
		}

		if (isDraggingOnlyTabFromThisPanel) {
			handleDragEnd();
			return;
		}

		event.preventDefault();
		const dragData = readDragData(event);
		if (!dragData) {
			handleDragEnd();
			return;
		}

		if (dragData.panelId === panel.id) {
			const sourceIndex = panel.tabs.indexOf(dragData.tabId);
			if (sourceIndex === -1 || dropIndex === null) {
				handleDragEnd();
				return;
			}

			const targetIndex = resolveSamePanelInsertIndex(dropIndex, sourceIndex);
			if (isSamePanelInsertNoOp(dropIndex, sourceIndex)) {
				handleDragEnd();
				return;
			}

			applyConfig((current) => moveTab(current, dragData.tabId, panel.id, targetIndex));
			handleDragEnd();
			return;
		}

		const targetIndex = dropIndex ?? panel.tabs.length;

		applyConfig((current) => moveTab(current, dragData.tabId, panel.id, targetIndex));
		handleDragEnd();
	}

	function getDropEdge(event: DragEvent, element: HTMLElement): DropEdge {
		return getDropEdgeForPoint(event.clientX, event.clientY, element);
	}

	function getDropEdgeForPoint(clientX: number, clientY: number, element: HTMLElement): DropEdge {
		const rect = element.getBoundingClientRect();
		const distances = {
			top: clientY - rect.top,
			right: rect.right - clientX,
			bottom: rect.bottom - clientY,
			left: clientX - rect.left
		};

		const rankedEdges = Object.entries(distances).sort((a, b) => a[1] - b[1]);
		return rankedEdges[0]?.[0] as DropEdge;
	}

	function handleContentDragOver(event: DragEvent) {
		if (!isLayoutDrag(event) || !contentElement) {
			return;
		}

		if (isDraggingOnlyTabFromThisPanel) {
			contentDropEdge = null;
			return;
		}

		event.preventDefault();
		contentDropEdge = getDropEdge(event, contentElement);
	}

	function handleContentDrop(event: DragEvent) {
		if (!isLayoutDrag(event) || !contentElement) {
			return;
		}

		if (isDraggingOnlyTabFromThisPanel) {
			handleDragEnd();
			return;
		}

		event.preventDefault();
		const dragData = readDragData(event);
		const edge = getDropEdge(event, contentElement);

		if (!dragData) {
			handleDragEnd();
			return;
		}

		applyConfig((current) =>
			splitPanel(current, dragData.tabId, panel.id, edge, resizeConstraints)
		);
		handleDragEnd();
	}

	function startPointerDrag(event: PointerEvent, tabId: string) {
		if (!dragAndDrop || event.button !== 0) {
			return;
		}

		if ((event.target as HTMLElement | null)?.closest('[data-tab-control]')) {
			return;
		}

		onSelectPanel(panel.id);
		selectTab(tabId);
		pointerSession = {
			pointerId: event.pointerId,
			tabId,
			startX: event.clientX,
			startY: event.clientY,
			active: false
		};
	}

	function handleWindowPointerMove(event: PointerEvent) {
		if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
			return;
		}

		const deltaX = event.clientX - pointerSession.startX;
		const deltaY = event.clientY - pointerSession.startY;
		if (!pointerSession.active && Math.hypot(deltaX, deltaY) < 6) {
			return;
		}

		if (!pointerSession.active) {
			pointerSession = { ...pointerSession, active: true };
			onDragStart(pointerSession.tabId, panel.id, {
				clientX: event.clientX,
				clientY: event.clientY,
				input: 'pointer'
			});
		} else {
			onDragMove(event.clientX, event.clientY);
		}

		event.preventDefault();
	}

	function dropFromPointer(clientX: number, clientY: number) {
		const targetElement = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
		const targetPanel = targetElement?.closest<HTMLElement>('[data-panel-id]');
		const targetPanelId = targetPanel?.dataset['panelId'];
		if (!targetPanelId || !dragState.tabId || !dragState.panelId) {
			handleDragEnd();
			return;
		}

		const tabsElement = targetPanel.querySelector<HTMLElement>('[data-panel-tabs]');
		if (isPointInside(clientX, clientY, tabsElement)) {
			const targetScroller = targetPanel.querySelector<HTMLElement>('[data-panel-tabs-inner]');
			const target = computeTabDropTargetForScroller(targetScroller, clientX);
			if (!target) {
				handleDragEnd();
				return;
			}

			if (dragState.panelId === targetPanelId) {
				const sourceIndex = panel.tabs.indexOf(dragState.tabId);
				if (sourceIndex === -1) {
					handleDragEnd();
					return;
				}

				const targetIndex = resolveSamePanelInsertIndex(target.index, sourceIndex);
				if (isSamePanelInsertNoOp(target.index, sourceIndex)) {
					handleDragEnd();
					return;
				}

				applyConfig((current) => moveTab(current, dragState.tabId!, panel.id, targetIndex));
				handleDragEnd();
				return;
			}

			if (target.index < 0) {
				handleDragEnd();
				return;
			}
			applyConfig((current) => moveTab(current, dragState.tabId!, targetPanelId, target.index));
			handleDragEnd();
			return;
		}

		const contentTarget = targetPanel.querySelector<HTMLElement>('[data-panel-content]');
		if (isPointInside(clientX, clientY, contentTarget) && contentTarget) {
			const edge = getDropEdgeForPoint(clientX, clientY, contentTarget);
			applyConfig((current) =>
				splitPanel(current, dragState.tabId!, targetPanelId, edge, resizeConstraints)
			);
		}

		handleDragEnd();
	}

	function handleWindowPointerUp(event: PointerEvent) {
		if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
			return;
		}

		if (pointerSession.active) {
			onDragMove(event.clientX, event.clientY);
			dropFromPointer(event.clientX, event.clientY);
			event.preventDefault();
			return;
		}

		pointerSession = null;
	}

	function handleWindowPointerCancel(event: PointerEvent) {
		if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
			return;
		}

		handleDragEnd();
	}

	$effect(() => {
		if (!dragState.tabId || !items[dragState.tabId]) {
			resetDropState();
			return;
		}

		if (
			dragState.input !== 'pointer' ||
			dragState.tabId === null ||
			dragState.clientX === null ||
			dragState.clientY === null
		) {
			resetDropState();
			return;
		}

		if (isDraggingOnlyTabFromThisPanel) {
			resetDropState();
			return;
		}

		if (isPointInside(dragState.clientX, dragState.clientY, tabScrollerElement)) {
			updateAutoScroll(dragState.clientX);
			applyTabDropTarget(dragState.clientX);
			contentDropEdge = null;
			return;
		}

		stopAutoScroll();
		dropIndex = null;

		if (isPointInside(dragState.clientX, dragState.clientY, contentElement) && contentElement) {
			contentDropEdge = getDropEdgeForPoint(dragState.clientX, dragState.clientY, contentElement);
			return;
		}

		contentDropEdge = null;
	});

	const externalDropTitle = $derived(
		dragState.tabId ? (items[dragState.tabId]?.title ?? null) : null
	);
</script>

<svelte:window
	onpointermove={handleWindowPointerMove}
	onpointerup={handleWindowPointerUp}
	onpointercancel={handleWindowPointerCancel}
/>

<section
	class="horizon-layout-panel"
	class:horizon-layout-panel--selected={isSelectedPanel}
	class:horizon-layout-panel--maximized={isMaximized}
	class:horizon-layout-panel--restoring={isRestoring}
	data-panel-id={panel.id}
>
	<div
		class="horizon-layout-panel__tabs"
		role="tablist"
		tabindex="0"
		bind:this={tabBarElement}
		data-panel-tabs
		ondragover={handleTabBarDragOver}
		ondrop={handleTabBarDrop}
		ondragleave={resetDropState}
	>
		<div
			class="horizon-layout-panel__tabs-inner"
			bind:this={tabScrollerElement}
			data-panel-tabs-inner
			onwheel={handleTabsWheel}
		>
			{#each tabs as tab, index (tab.id)}
				{#if dropIndex === index && externalDropTitle}
					<div
						class="horizon-layout-panel__tab horizon-layout-panel__tab--drop-hint"
						aria-hidden="true"
					>
						<span class="horizon-layout-panel__tab-label">{externalDropTitle}</span>
					</div>
				{/if}
				<div
					class="horizon-layout-panel__tab"
					class:horizon-layout-panel__tab--active={tab.id === activeTabId}
					class:horizon-layout-panel__tab--dragging={tab.id === dragState.tabId}
					data-tab-id={tab.id}
					role="tab"
					tabindex="0"
					aria-selected={tab.id === activeTabId}
					onpointerdown={(event) => startPointerDrag(event, tab.id)}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							selectTab(tab.id);
						}
					}}
				>
					<span class="horizon-layout-panel__tab-label">{tab.item.title}</span>
					{#if canPopoutTab(tab.item) && onPopoutTab && popoutButton}
						<span class="horizon-layout-panel__tab-control" data-tab-control>
							{@render popoutButton({
								panelId: panel.id,
								tabId: tab.id,
								action: () => handlePopoutClick(tab.id)
							})}
						</span>
					{/if}
					{#if canCloseTab(tab.item) && onCloseTab && closeButton}
						<span class="horizon-layout-panel__tab-control" data-tab-control>
							{@render closeButton({
								panelId: panel.id,
								tabId: tab.id,
								action: () => handleCloseClick(tab.id)
							})}
						</span>
					{/if}
				</div>
			{/each}
			{#if dropIndex === tabs.length && externalDropTitle}
				<div
					class="horizon-layout-panel__tab horizon-layout-panel__tab--drop-hint"
					aria-hidden="true"
				>
					<span class="horizon-layout-panel__tab-label">{externalDropTitle}</span>
				</div>
			{/if}
		</div>

		<div class="horizon-layout-panel__actions">
			{#if maximizeEnabled}
				{#if isMaximized && restoreButton}
					{@render restoreButton({
						panelId: panel.id,
						tabId: activeTabId,
						action: () => setMaximizedTabId(null)
					})}
				{:else if !isMaximized && canMaximizeActiveTab && maximizeButton}
					{@render maximizeButton({
						panelId: panel.id,
						tabId: activeTabId,
						action: () => setMaximizedTabId(activeTabId)
					})}
				{/if}
			{/if}
		</div>
	</div>

	<div
		class="horizon-layout-panel__content"
		role="presentation"
		bind:this={contentElement}
		data-panel-content
		ondragover={handleContentDragOver}
		ondrop={handleContentDrop}
		ondragleave={() => {
			contentDropEdge = null;
		}}
	>
		{#if activeItem}
			{@render activeItem.snippet()}
		{:else}
			<div class="horizon-layout-panel__empty">No content registered for this tab.</div>
		{/if}

		{#if contentDropEdge}
			<div
				class={`horizon-layout-panel__overlay horizon-layout-panel__overlay--${contentDropEdge}`}
			></div>
		{/if}
	</div>
</section>
