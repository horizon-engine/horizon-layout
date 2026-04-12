<script lang="ts">
	import { getAllContexts, mount, onDestroy, onMount, setContext, unmount, untrack } from 'svelte';
	import {
		HORIZON_LAYOUT_DND_MIME,
		HORIZON_LAYOUT_REGISTRY,
		type LayoutRegistry
	} from './context.js';
	import LayoutNode from './LayoutNode.svelte';
	import PopoutWindow from './PopoutWindow.svelte';
	import {
		configEquals,
		createLayout,
		getPanelById,
		getPanelContainingTab,
		insertTab,
		loadStoredConfig,
		normalizeConfig,
		removeTab,
		saveStoredConfig
	} from './layout.js';
	import type {
		LayoutConfig,
		LayoutItemDefinition,
		MaximizeControlProps,
		ResizeConstraints
	} from './types.js';
	import type { TabActionControlProps } from './types.js';

	let {
		id,
		config = $bindable<LayoutConfig | null>(),
		maximizedTabId = $bindable<string | null>(null),
		selectedPanelId = $bindable<string | null>(null),
		persist = true,
		dragAndDrop = true,
		popoutEnabled = false,
		onPopoutTab,
		onTabPopout,
		onTabMaximize,
		onTabClose,
		class: className = '',
		resizeConstraints = {},
		popoutButton,
		closeButton,
		maximizeButton,
		restoreButton,
		children
	}: {
		id: string;
		config: LayoutConfig | null;
		maximizedTabId?: string | null;
		selectedPanelId?: string | null;
		persist?: boolean;
		dragAndDrop?: boolean;
		popoutEnabled?: boolean;
		onPopoutTab?: ((tabId: string, panelId: string) => void) | undefined;
		onTabPopout?: ((tabId: string, panelId: string) => void) | undefined;
		onTabMaximize?: ((tabId: string, panelId: string) => void) | undefined;
		onTabClose?: ((tabId: string, panelId: string) => void) | undefined;
		class?: string;
		resizeConstraints?: ResizeConstraints;
		popoutButton?: import('svelte').Snippet<[TabActionControlProps]>;
		closeButton?: import('svelte').Snippet<[TabActionControlProps]>;
		maximizeButton?: import('svelte').Snippet<[MaximizeControlProps]>;
		restoreButton?: import('svelte').Snippet<[MaximizeControlProps]>;
		children?: import('svelte').Snippet;
	} = $props();

	let items = $state<Record<string, LayoutItemDefinition>>({});
	let storageReady = $state(typeof window === 'undefined');
	let dragState = $state<{
		tabId: string | null;
		panelId: string | null;
		clientX: number | null;
		clientY: number | null;
		input: 'pointer' | 'native' | null;
	}>({
		tabId: null,
		panelId: null,
		clientX: null,
		clientY: null,
		input: null
	});
	let restoringPanelId = $state<string | null>(null);
	let restoreAnimationTimer = 0;
	let poppedOutTabs = $state<Record<string, { sourcePanelId: string | null }>>({});

	// Separate from `config` to avoid feedback loops during resize.
	let activeConfig = $state<LayoutConfig | null>(null);
	let skipExternalSync = false;

	// Holds a tab id loaded from localStorage until activeConfig is ready to validate it.
	let pendingMaximize = $state<string | null>(null);
	let lastNotifiedMaximizedTabId = $state<string | null>(null);

	// Normalize any falsy value to null so empty string and undefined also restore.
	const resolvedMaximize = $derived((maximizedTabId || null) as string | null);
	const registeredIds = $derived(Object.keys(items));
	const resolvedClosedTabIds = $derived(normalizeClosedTabIds(config?.closedTabIds, registeredIds));
	const resolvedClosedTabSet = $derived(new Set(resolvedClosedTabIds));
	const availableIds = $derived(
		registeredIds.filter((id) => !(id in poppedOutTabs) && !resolvedClosedTabSet.has(id))
	);
	const maximizedPanel = $derived(
		resolvedMaximize && activeConfig ? getPanelContainingTab(activeConfig, resolvedMaximize) : null
	);
	const maximizedItem = $derived(resolvedMaximize ? (items[resolvedMaximize] ?? null) : null);
	const maximizeEnabled = $derived(Boolean(maximizeButton && restoreButton));
	const inheritedContext = getAllContexts();
	const managedPopoutWindows = new Map<
		string,
		{
			popup: Window;
			component: Record<string, any>;
			cleanup: () => void;
		}
	>();
	let isClosingManagedPopouts = false;

	const registry: LayoutRegistry = {
		register(item: LayoutItemDefinition) {
			if (items[item.id] === item) {
				return;
			}

			items = {
				...items,
				[item.id]: item
			};
		},
		unregister(itemId: string) {
			if (!(itemId in items)) {
				return;
			}

			const next = { ...items };
			delete next[itemId];
			items = next;
		}
	};

	setContext(HORIZON_LAYOUT_REGISTRY, registry);

	// id identifies the layout instance and must not change after mount.
	const layoutId = untrack(() => id);
	setContext(HORIZON_LAYOUT_DND_MIME, `application/x-horizon-layout-tab:${layoutId}`);

	function findFirstPanelId(node: LayoutConfig['root']): string | null {
		if (node.type === 'panel') {
			return node.id;
		}

		for (const child of node.children) {
			const panelId = findFirstPanelId(child);
			if (panelId) {
				return panelId;
			}
		}

		return null;
	}

	function normalizeClosedTabIds(
		tabIds: string[] | null | undefined,
		knownIds: string[]
	): string[] {
		if (!tabIds?.length || knownIds.length === 0) {
			return [];
		}

		const known = new Set(knownIds);
		const seen = new Set<string>();

		return tabIds.filter((tabId): tabId is string => {
			if (typeof tabId !== 'string' || !known.has(tabId) || seen.has(tabId)) {
				return false;
			}

			seen.add(tabId);
			return true;
		});
	}

	function withClosedTabIds(nextConfig: LayoutConfig, closedTabIds: string[]): LayoutConfig {
		if (closedTabIds.length === 0) {
			const { closedTabIds: _closedTabIds, ...rest } = nextConfig;
			return rest;
		}

		return {
			...nextConfig,
			closedTabIds
		};
	}

	function copyStylesToPopup(source: Document, target: Document) {
		for (const existing of Array.from(
			target.head.querySelectorAll('[data-horizon-layout-popout-style]')
		)) {
			existing.remove();
		}

		for (const node of Array.from(source.head.children)) {
			if (
				node instanceof HTMLStyleElement ||
				(node instanceof HTMLLinkElement && node.rel === 'stylesheet')
			) {
				const clone = node.cloneNode(true);
				if (clone instanceof Element) {
					clone.setAttribute('data-horizon-layout-popout-style', 'true');
				}
				target.head.appendChild(clone);
			}
		}
	}

	function syncElementAttributes(source: HTMLElement, target: HTMLElement) {
		for (const { name } of Array.from(target.attributes)) {
			target.removeAttribute(name);
		}

		for (const { name, value } of Array.from(source.attributes)) {
			target.setAttribute(name, value);
		}
	}

	function syncPopupDocument(source: Document, target: Document) {
		syncElementAttributes(source.documentElement, target.documentElement);
		syncElementAttributes(source.body, target.body);
	}

	function closeManagedPopout(tabId: string, options: { skipClose?: boolean } = {}) {
		const entry = managedPopoutWindows.get(tabId);
		if (!entry) {
			return;
		}

		managedPopoutWindows.delete(tabId);
		entry.cleanup();
		void unmount(entry.component);

		if (!options.skipClose && !entry.popup.closed) {
			entry.popup.close();
		}
	}

	function closeAllManagedPopouts() {
		isClosingManagedPopouts = true;

		for (const tabId of Array.from(managedPopoutWindows.keys())) {
			closeManagedPopout(tabId);
		}
	}

	function restoreManagedPopout(tabId: string, options: { skipClose?: boolean } = {}) {
		const metadata = poppedOutTabs[tabId];
		if (!metadata) {
			return;
		}

		const nextPoppedOutTabs = { ...poppedOutTabs };
		delete nextPoppedOutTabs[tabId];
		poppedOutTabs = nextPoppedOutTabs;

		const nextAvailableIds = Object.keys(items).filter((id) => !(id in nextPoppedOutTabs));
		const baseConfig = activeConfig
			? $state.snapshot(activeConfig)
			: config
				? $state.snapshot(config)
				: createLayout([tabId]);
		const preferredPanelId =
			metadata.sourcePanelId && baseConfig
				? getPanelById(baseConfig, metadata.sourcePanelId)?.id
				: null;
		const fallbackPanelId =
			(selectedPanelId && baseConfig ? getPanelById(baseConfig, selectedPanelId)?.id : null) ??
			(baseConfig ? findFirstPanelId(baseConfig.root) : null);
		const targetPanelId = preferredPanelId ?? fallbackPanelId;
		const nextConfig =
			baseConfig && targetPanelId
				? insertTab(baseConfig, tabId, targetPanelId)
				: createLayout([tabId]);
		const normalized = normalizeConfig(nextConfig, nextAvailableIds);
		skipExternalSync = true;
		activeConfig = normalized;
		config = normalized;
		selectedPanelId = targetPanelId ?? findFirstPanelId(nextConfig.root);

		closeManagedPopout(tabId, options);
	}

	function openManagedPopout(tabId: string, panelId: string): boolean {
		const existing = managedPopoutWindows.get(tabId);
		if (existing && !existing.popup.closed) {
			existing.popup.focus();
			return true;
		}

		const item = items[tabId];
		if (!item || !activeConfig || typeof window === 'undefined') {
			return false;
		}

		const popup = window.open('', `horizon-layout-popout-${layoutId}-${tabId}`);
		if (!popup) {
			return false;
		}

		copyStylesToPopup(document, popup.document);
		syncPopupDocument(document, popup.document);
		popup.document.body.innerHTML = '';

		const target = popup.document.createElement('div');
		popup.document.body.appendChild(target);

		const handlePopupUnload = () => {
			if (isClosingManagedPopouts) {
				return;
			}

			restoreManagedPopout(tabId, { skipClose: true });
		};

		popup.addEventListener('beforeunload', handlePopupUnload);
		popup.addEventListener('pagehide', handlePopupUnload);

		const component = mount(PopoutWindow, {
			target,
			context: inheritedContext,
			props: {
				title: item.title,
				snippet: item.snippet,
				popup
			}
		});

		managedPopoutWindows.set(tabId, {
			popup,
			component,
			cleanup: () => {
				popup.removeEventListener('beforeunload', handlePopupUnload);
				popup.removeEventListener('pagehide', handlePopupUnload);
			}
		});

		poppedOutTabs = {
			...poppedOutTabs,
			[tabId]: { sourcePanelId: panelId }
		};
		const nextAvailableIds = Object.keys(items).filter(
			(id) => id !== tabId && !(id in poppedOutTabs)
		);
		const nextBaseConfig = removeTab($state.snapshot(activeConfig) as LayoutConfig, tabId);
		const normalized = normalizeConfig(nextBaseConfig, nextAvailableIds);
		skipExternalSync = true;
		activeConfig = normalized;
		config = normalized
			? withClosedTabIds(normalized, resolvedClosedTabIds)
			: withClosedTabIds(nextBaseConfig, resolvedClosedTabIds);

		return true;
	}

	function handlePopoutTab(tabId: string, panelId: string) {
		if (onPopoutTab) {
			onPopoutTab(tabId, panelId);
			onTabPopout?.(tabId, panelId);
			return;
		}

		if (openManagedPopout(tabId, panelId)) {
			onTabPopout?.(tabId, panelId);
		}
	}

	function handleCloseTab(tabId: string, panelId: string) {
		const baseConfig = activeConfig
			? $state.snapshot(activeConfig)
			: config
				? $state.snapshot(config)
				: null;
		if (!baseConfig) {
			return;
		}

		const nextClosedTabIds = normalizeClosedTabIds([...resolvedClosedTabIds, tabId], registeredIds);
		const nextClosedTabSet = new Set(nextClosedTabIds);
		const nextAvailableIds = registeredIds.filter(
			(id) => id !== tabId && !(id in poppedOutTabs) && !nextClosedTabSet.has(id)
		);
		const nextBaseConfig = removeTab(baseConfig, tabId);
		const normalized = normalizeConfig(nextBaseConfig, nextAvailableIds);
		const nextConfig = withClosedTabIds(normalized ?? nextBaseConfig, nextClosedTabIds);

		if (resolvedMaximize === tabId) {
			maximizedTabId = null;
		}

		skipExternalSync = true;
		activeConfig = normalized;
		config = nextConfig;

		if (!normalized) {
			selectedPanelId = null;
		} else if (!selectedPanelId || !getPanelById(normalized, selectedPanelId)) {
			selectedPanelId = findFirstPanelId(normalized.root);
		}

		onTabClose?.(tabId, panelId);
	}

	onMount(() => {
		if (persist) {
			const storedConfig = loadStoredConfig(layoutId);
			if (storedConfig) {
				// Extract maximize state before normalization strips it from the config.
				pendingMaximize = storedConfig.maximizedTabId ?? null;
				config = storedConfig;
			}
		}

		storageReady = true;
		window.addEventListener('beforeunload', closeAllManagedPopouts);
		window.addEventListener('pagehide', closeAllManagedPopouts);
	});

	onDestroy(() => {
		if (restoreAnimationTimer) {
			clearTimeout(restoreAnimationTimer);
		}

		if (typeof window !== 'undefined') {
			window.removeEventListener('beforeunload', closeAllManagedPopouts);
			window.removeEventListener('pagehide', closeAllManagedPopouts);
		}

		closeAllManagedPopouts();
	});

	$effect(() => {
		if (skipExternalSync) {
			const currentConfig = config ? $state.snapshot(config) : null;
			const currentActiveConfig = untrack(() => activeConfig);
			if (configEquals(currentConfig, currentActiveConfig)) {
				skipExternalSync = false;
				return;
			}

			skipExternalSync = false;
		}

		if (!storageReady || availableIds.length === 0) {
			activeConfig = null;
			return;
		}

		const sourceConfig = config ? $state.snapshot(config) : createLayout(availableIds);
		const normalized = normalizeConfig(sourceConfig, availableIds);
		if (!normalized) {
			activeConfig = null;
			return;
		}

		const previousActiveConfig = untrack(() => activeConfig);
		if (!configEquals(previousActiveConfig, normalized)) {
			activeConfig = normalized;
		}

		const nextConfig = withClosedTabIds(normalized, resolvedClosedTabIds);
		const previousConfig = config ? $state.snapshot(config) : null;
		if (!configEquals(previousConfig, nextConfig)) {
			skipExternalSync = true;
			config = nextConfig;
		}
	});

	// Save layout and maximize state together under the instance id key.
	$effect(() => {
		if (!persist || !storageReady) {
			return;
		}

		const snapshot = config
			? ($state.snapshot(config) as LayoutConfig)
			: activeConfig
				? ($state.snapshot(activeConfig) as LayoutConfig)
				: null;
		if (!snapshot) {
			return;
		}

		saveStoredConfig(
			resolvedMaximize ? { ...snapshot, maximizedTabId: resolvedMaximize } : snapshot,
			layoutId
		);
	});

	// Apply a maximize state loaded from localStorage once the layout and panel are confirmed to exist.
	$effect(() => {
		if (pendingMaximize && activeConfig && maximizeEnabled) {
			const panel = getPanelContainingTab(activeConfig, pendingMaximize);
			if (panel) {
				maximizedTabId = pendingMaximize;
			}
			pendingMaximize = null;
		}
	});

	// Clear maximize if the tab disappears or maximize is disabled.
	$effect(() => {
		if (resolvedMaximize && (!maximizedItem || !maximizedPanel || !maximizeEnabled)) {
			maximizedTabId = null;
		}
	});

	$effect(() => {
		if (resolvedMaximize && maximizedPanel && resolvedMaximize !== lastNotifiedMaximizedTabId) {
			onTabMaximize?.(resolvedMaximize, maximizedPanel.id);
		}

		lastNotifiedMaximizedTabId = resolvedMaximize;
	});

	function applyConfig(updater: (config: LayoutConfig) => LayoutConfig) {
		if (!activeConfig) {
			return;
		}

		const next = normalizeConfig(updater($state.snapshot(activeConfig)), availableIds);
		const nextConfig = next ? withClosedTabIds(next, resolvedClosedTabIds) : null;
		const previousConfig = config ? $state.snapshot(config) : null;
		if (next && nextConfig && !configEquals(previousConfig, nextConfig)) {
			skipExternalSync = true;
			activeConfig = next;
			config = nextConfig;
		}
	}

	function setSelectedPanelId(panelId: string) {
		selectedPanelId = panelId;
	}

	function startDrag(
		tabId: string,
		panelId: string,
		options: { clientX?: number; clientY?: number; input?: 'pointer' | 'native' } = {}
	) {
		dragState = {
			tabId,
			panelId,
			clientX: options.clientX ?? null,
			clientY: options.clientY ?? null,
			input: options.input ?? null
		};
	}

	function updateDrag(clientX: number, clientY: number) {
		if (!dragState.tabId) {
			return;
		}

		dragState = {
			...dragState,
			clientX,
			clientY
		};
	}

	function endDrag() {
		dragState = {
			tabId: null,
			panelId: null,
			clientX: null,
			clientY: null,
			input: null
		};
	}

	function setMaximizedTabId(tabId?: string | null) {
		const resolved = tabId || null;

		if (!maximizeEnabled && resolved !== null) {
			return;
		}

		if (resolved === null && resolvedMaximize && activeConfig) {
			restoringPanelId = getPanelContainingTab(activeConfig, resolvedMaximize)?.id ?? null;
			if (restoreAnimationTimer) {
				clearTimeout(restoreAnimationTimer);
			}

			restoreAnimationTimer = window.setTimeout(() => {
				restoringPanelId = null;
				restoreAnimationTimer = 0;
			}, 220);
		}

		maximizedTabId = resolved;
	}
</script>

<div class="horizon-layout__registry" aria-hidden="true">
	{@render children?.()}
</div>

<div
	class={`horizon-layout ${className}`.trim()}
	class:horizon-layout--dragging={dragState.tabId !== null}
>
	{#if maximizedItem && resolvedMaximize}
		<div class="horizon-layout__maximized">
			<div class="horizon-layout__maximized-content">
				{@render maximizedItem.snippet()}
			</div>
			{#if restoreButton}
				<div class="horizon-layout__maximized-action">
					{@render restoreButton({
						panelId: maximizedPanel?.id ?? selectedPanelId ?? '',
						tabId: resolvedMaximize,
						action: () => setMaximizedTabId(null)
					})}
				</div>
			{/if}
		</div>
	{:else if activeConfig}
		<LayoutNode
			node={activeConfig.root}
			{items}
			{applyConfig}
			{dragState}
			onDragStart={startDrag}
			onDragMove={updateDrag}
			onDragEnd={endDrag}
			{selectedPanelId}
			onSelectPanel={setSelectedPanelId}
			{dragAndDrop}
			{popoutEnabled}
			onPopoutTab={handlePopoutTab}
			onCloseTab={handleCloseTab}
			{popoutButton}
			{closeButton}
			{maximizeEnabled}
			{maximizeButton}
			{restoreButton}
			maximizedTabId={resolvedMaximize}
			{restoringPanelId}
			{setMaximizedTabId}
			{resizeConstraints}
		/>
	{:else}
		<div class="horizon-layout__blank"></div>
	{/if}
</div>

<style>
	.horizon-layout__blank {
		width: 100%;
		height: 100%;
	}
</style>
