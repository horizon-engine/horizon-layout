import type {
	DropEdge,
	LayoutConfig,
	LayoutNodeConfig,
	LayoutPanelConfig,
	LayoutSplitConfig,
	ResizeConstraints,
	SplitDirection
} from './types.js';

const DEFAULT_PANEL_ID = 'panel';
const DEFAULT_SPLIT_ID = 'split';
const DEFAULT_MIN_SPLIT_SIZE = 10;
const DEFAULT_MAX_SPLIT_SIZE = 90;

let generatedId = 0;

function cloneConfig(config: LayoutConfig): LayoutConfig {
	if (typeof structuredClone === 'function') {
		try {
			return structuredClone(config);
		} catch {
			// Svelte state proxies are not always structured-cloneable; fall back to JSON.
		}
	}

	return JSON.parse(JSON.stringify(config)) as LayoutConfig;
}

export function createNodeId(prefix = DEFAULT_PANEL_ID): string {
	generatedId += 1;

	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${prefix}-${crypto.randomUUID()}`;
	}

	return `${prefix}-${generatedId}`;
}

export function createPanel(
	tabIds: string[] = [],
	id = createNodeId(DEFAULT_PANEL_ID)
): LayoutPanelConfig {
	return {
		id,
		type: 'panel',
		tabs: [...tabIds],
		activeTab: tabIds[0] ?? null
	};
}

export function createLayout(tabIds: string[] = []): LayoutConfig {
	return {
		root: createPanel(tabIds)
	};
}

export function configEquals(
	a: LayoutConfig | null | undefined,
	b: LayoutConfig | null | undefined
): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function getConstraintBounds(
	direction: SplitDirection,
	constraints?: ResizeConstraints
): {
	min: number;
	max: number;
} {
	const min =
		direction === 'row'
			? (constraints?.minWidthPercent ?? DEFAULT_MIN_SPLIT_SIZE)
			: (constraints?.minHeightPercent ?? DEFAULT_MIN_SPLIT_SIZE);
	const max =
		direction === 'row'
			? (constraints?.maxWidthPercent ?? DEFAULT_MAX_SPLIT_SIZE)
			: (constraints?.maxHeightPercent ?? DEFAULT_MAX_SPLIT_SIZE);

	return {
		min: Math.max(0, Math.min(min, 100)),
		max: Math.max(0, Math.min(Math.max(min, max), 100))
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function normalizeSizes(sizes: number[], count: number): number[] {
	if (count <= 0) {
		return [];
	}

	if (sizes.length !== count || sizes.some((size) => !Number.isFinite(size) || size <= 0)) {
		return Array.from({ length: count }, () => 100 / count);
	}

	const total = sizes.reduce((sum, size) => sum + size, 0);

	if (total <= 0) {
		return Array.from({ length: count }, () => 100 / count);
	}

	return sizes.map((size) => (size / total) * 100);
}

export function clampResizePair(
	firstSize: number,
	secondSize: number,
	direction: SplitDirection,
	constraints?: ResizeConstraints
): [number, number] {
	const total = firstSize + secondSize;
	const { min, max } = getConstraintBounds(direction, constraints);
	const safeMax = Math.min(max, total - min);
	const safeMin = Math.min(min, total);
	const nextFirst = clamp(firstSize, safeMin, safeMax);
	const nextSecond = total - nextFirst;

	return [nextFirst, nextSecond];
}

export function canSplit(direction: SplitDirection, constraints?: ResizeConstraints): boolean {
	const { min, max } = getConstraintBounds(direction, constraints);
	return min <= 50 && max >= 50;
}

function collectMissing(availableIds: string[], seen: Set<string>): string[] {
	return availableIds.filter((id) => !seen.has(id));
}

function normalizeNode(
	node: LayoutNodeConfig | null | undefined,
	available: Set<string>,
	seen: Set<string>
): LayoutNodeConfig | null {
	if (!node) {
		return null;
	}

	if (node.type === 'panel') {
		const tabs = node.tabs.filter((id: string) => available.has(id) && !seen.has(id));
		for (const tab of tabs) {
			seen.add(tab);
		}

		if (tabs.length === 0) {
			return null;
		}

		return {
			id: node.id || createNodeId(DEFAULT_PANEL_ID),
			type: 'panel',
			tabs,
			activeTab: tabs.includes(node.activeTab ?? '') ? (node.activeTab ?? null) : (tabs[0] ?? null)
		};
	}

	const children = node.children
		.map((child: LayoutNodeConfig) => normalizeNode(child, available, seen))
		.filter((child: LayoutNodeConfig | null): child is LayoutNodeConfig => child !== null);

	if (children.length === 0) {
		return null;
	}

	if (children.length === 1) {
		return children[0] ?? null;
	}

	return {
		id: node.id || createNodeId(DEFAULT_SPLIT_ID),
		type: 'split',
		direction: node.direction,
		sizes: normalizeSizes(node.sizes, children.length),
		children
	};
}

function appendTabsToFirstPanel(node: LayoutNodeConfig, tabs: string[]): LayoutNodeConfig {
	if (tabs.length === 0) {
		return node;
	}

	if (node.type === 'panel') {
		return {
			...node,
			tabs: [...node.tabs, ...tabs],
			activeTab: node.activeTab ?? node.tabs[0] ?? tabs[0] ?? null
		};
	}

	const [firstChild, ...restChildren] = node.children;

	if (!firstChild) {
		return node;
	}

	return {
		...node,
		children: [appendTabsToFirstPanel(firstChild, tabs), ...restChildren]
	};
}

export function normalizeConfig(
	config: LayoutConfig | null | undefined,
	availableIds: string[]
): LayoutConfig | null {
	if (availableIds.length === 0) {
		return null;
	}

	const seen = new Set<string>();
	const available = new Set(availableIds);
	const normalizedRoot = normalizeNode(config?.root, available, seen);
	const missingTabs = collectMissing(availableIds, seen);

	if (!normalizedRoot) {
		return createLayout(availableIds);
	}

	return {
		root: appendTabsToFirstPanel(normalizedRoot, missingTabs)
	};
}

function findNode(node: LayoutNodeConfig, id: string): LayoutNodeConfig | null {
	if (node.id === id) {
		return node;
	}

	if (node.type === 'panel') {
		return null;
	}

	for (const child of node.children) {
		const match = findNode(child, id);
		if (match) {
			return match;
		}
	}

	return null;
}

export function getPanelById(config: LayoutConfig, panelId: string): LayoutPanelConfig | null {
	return findPanel(config.root, panelId);
}

function findPanel(node: LayoutNodeConfig, panelId: string): LayoutPanelConfig | null {
	const match = findNode(node, panelId);
	return match?.type === 'panel' ? match : null;
}

function findPanelContainingTab(node: LayoutNodeConfig, tabId: string): LayoutPanelConfig | null {
	if (node.type === 'panel') {
		return node.tabs.includes(tabId) ? node : null;
	}

	for (const child of node.children) {
		const match = findPanelContainingTab(child, tabId);
		if (match) {
			return match;
		}
	}

	return null;
}

/** Find the panel that currently contains a given tab id. */
export function getPanelContainingTab(
	config: LayoutConfig,
	tabId: string
): LayoutPanelConfig | null {
	return findPanelContainingTab(config.root, tabId);
}

function removeNodeById(node: LayoutNodeConfig, nodeId: string): LayoutNodeConfig | null {
	if (node.id === nodeId) {
		return null;
	}

	if (node.type === 'panel') {
		return node;
	}

	const children = node.children
		.map((child: LayoutNodeConfig) => removeNodeById(child, nodeId))
		.filter((child: LayoutNodeConfig | null): child is LayoutNodeConfig => child !== null);

	if (children.length === 0) {
		return null;
	}

	if (children.length === 1) {
		return children[0] ?? null;
	}

	return {
		...node,
		children,
		sizes: normalizeSizes(node.sizes, children.length)
	};
}

function replaceNodeById(
	node: LayoutNodeConfig,
	nodeId: string,
	replacement: LayoutNodeConfig
): LayoutNodeConfig {
	if (node.id === nodeId) {
		return replacement;
	}

	if (node.type === 'panel') {
		return node;
	}

	return {
		...node,
		children: node.children.map((child: LayoutNodeConfig) =>
			replaceNodeById(child, nodeId, replacement)
		)
	};
}

function findParentSplit(
	node: LayoutNodeConfig,
	childId: string
): { split: LayoutSplitConfig; childIndex: number } | null {
	if (node.type === 'panel') {
		return null;
	}

	const childIndex = node.children.findIndex((child: LayoutNodeConfig) => child.id === childId);
	if (childIndex !== -1) {
		return { split: node, childIndex };
	}

	for (const child of node.children) {
		const result = findParentSplit(child, childId);
		if (result) {
			return result;
		}
	}

	return null;
}

/**
 * Insert a new panel next to an existing one.
 * Splices into the parent split if the orientation matches; otherwise wraps the target in a new split.
 */
function insertAdjacentPanel(
	root: LayoutNodeConfig,
	targetPanelId: string,
	newPanel: LayoutPanelConfig,
	edge: DropEdge,
	constraints?: ResizeConstraints
): LayoutNodeConfig {
	const targetNode = findNode(root, targetPanelId);
	if (!targetNode) {
		return root;
	}

	const direction: SplitDirection = edge === 'left' || edge === 'right' ? 'row' : 'column';
	const parentInfo = findParentSplit(root, targetPanelId);

	if (!canSplit(direction, constraints)) {
		return root;
	}

	if (parentInfo && parentInfo.split.direction === direction) {
		const insertIndex =
			edge === 'left' || edge === 'top' ? parentInfo.childIndex : parentInfo.childIndex + 1;
		const sizes = [...parentInfo.split.sizes];
		const targetSize = sizes[parentInfo.childIndex] ?? 100 / parentInfo.split.children.length;
		const [currentTargetSize, newSize] = clampResizePair(
			targetSize / 2,
			targetSize / 2,
			direction,
			constraints
		);

		if (currentTargetSize + newSize !== targetSize) {
			return root;
		}

		sizes[parentInfo.childIndex] = currentTargetSize;
		sizes.splice(insertIndex, 0, newSize);
		parentInfo.split.children.splice(insertIndex, 0, newPanel);
		parentInfo.split.sizes = normalizeSizes(sizes, parentInfo.split.children.length);

		return root;
	}

	return replaceNodeById(root, targetPanelId, {
		id: createNodeId(DEFAULT_SPLIT_ID),
		type: 'split',
		direction,
		sizes: [50, 50],
		children: edge === 'left' || edge === 'top' ? [newPanel, targetNode] : [targetNode, newPanel]
	});
}

export function setActiveTab(config: LayoutConfig, panelId: string, tabId: string): LayoutConfig {
	const next = cloneConfig(config);
	const panel = findPanel(next.root, panelId);

	if (!panel || !panel.tabs.includes(tabId)) {
		return next;
	}

	panel.activeTab = tabId;
	return next;
}

export function setPanelTabs(
	config: LayoutConfig,
	panelId: string,
	tabs: string[],
	activeTab: string | null = null
): LayoutConfig {
	const next = cloneConfig(config);
	const panel = findPanel(next.root, panelId);

	if (!panel) {
		return next;
	}

	panel.tabs = [...tabs];
	panel.activeTab = activeTab && tabs.includes(activeTab) ? activeTab : (tabs[0] ?? null);

	return next;
}

export function moveTab(
	config: LayoutConfig,
	tabId: string,
	targetPanelId: string,
	targetIndex?: number
): LayoutConfig {
	const next = cloneConfig(config);
	const sourcePanel = findPanelContainingTab(next.root, tabId);
	const targetPanel = findPanel(next.root, targetPanelId);

	if (!sourcePanel || !targetPanel) {
		return next;
	}

	const sourceIndex = sourcePanel.tabs.indexOf(tabId);
	if (sourceIndex === -1) {
		return next;
	}

	if (sourcePanel.id === targetPanel.id) {
		const tabs = [...sourcePanel.tabs];
		tabs.splice(sourceIndex, 1);

		let insertIndex = targetIndex ?? tabs.length;
		insertIndex = Math.max(0, Math.min(insertIndex, tabs.length));
		tabs.splice(insertIndex, 0, tabId);

		sourcePanel.tabs = tabs;
		sourcePanel.activeTab = tabId;

		return next;
	}

	sourcePanel.tabs.splice(sourceIndex, 1);
	if (sourcePanel.activeTab === tabId) {
		sourcePanel.activeTab = sourcePanel.tabs[0] ?? null;
	}

	let resolvedTargetIndex = targetIndex ?? targetPanel.tabs.length;
	resolvedTargetIndex = Math.max(0, Math.min(resolvedTargetIndex, targetPanel.tabs.length));
	targetPanel.tabs.splice(resolvedTargetIndex, 0, tabId);
	targetPanel.activeTab = tabId;

	if (sourcePanel.tabs.length === 0) {
		const prunedRoot = removeNodeById(next.root, sourcePanel.id);
		next.root = prunedRoot ?? createPanel([tabId]);
	}

	return next;
}

export function insertTab(
	config: LayoutConfig,
	tabId: string,
	targetPanelId: string,
	targetIndex?: number
): LayoutConfig {
	const next = cloneConfig(config);
	const targetPanel = findPanel(next.root, targetPanelId);

	if (!targetPanel || targetPanel.tabs.includes(tabId)) {
		return next;
	}

	let resolvedTargetIndex = targetIndex ?? targetPanel.tabs.length;
	resolvedTargetIndex = Math.max(0, Math.min(resolvedTargetIndex, targetPanel.tabs.length));
	targetPanel.tabs.splice(resolvedTargetIndex, 0, tabId);
	targetPanel.activeTab = tabId;

	return next;
}

export function removeTab(config: LayoutConfig, tabId: string): LayoutConfig {
	const next = cloneConfig(config);
	const sourcePanel = findPanelContainingTab(next.root, tabId);

	if (!sourcePanel) {
		return next;
	}

	sourcePanel.tabs = sourcePanel.tabs.filter((candidate: string) => candidate !== tabId);
	if (sourcePanel.activeTab === tabId) {
		sourcePanel.activeTab = sourcePanel.tabs[0] ?? null;
	}

	if (sourcePanel.tabs.length === 0) {
		next.root = removeNodeById(next.root, sourcePanel.id) ?? createPanel([]);
	}

	return next;
}

export function splitPanel(
	config: LayoutConfig,
	tabId: string,
	targetPanelId: string,
	edge: DropEdge,
	constraints?: ResizeConstraints
): LayoutConfig {
	const next = cloneConfig(config);
	const sourcePanel = findPanelContainingTab(next.root, tabId);
	const targetPanel = findPanel(next.root, targetPanelId);
	const direction: SplitDirection = edge === 'left' || edge === 'right' ? 'row' : 'column';

	if (!sourcePanel || !targetPanel || !canSplit(direction, constraints)) {
		return next;
	}

	if (sourcePanel.id === targetPanel.id && sourcePanel.tabs.length === 1) {
		return next;
	}

	sourcePanel.tabs = sourcePanel.tabs.filter((candidate: string) => candidate !== tabId);
	if (sourcePanel.activeTab === tabId) {
		sourcePanel.activeTab = sourcePanel.tabs[0] ?? null;
	}

	const newPanel = createPanel([tabId]);
	next.root = insertAdjacentPanel(next.root, targetPanelId, newPanel, edge, constraints);

	if (sourcePanel.tabs.length === 0) {
		const prunedRoot = removeNodeById(next.root, sourcePanel.id);
		next.root = prunedRoot ?? newPanel;
	}

	return next;
}

export function setSplitSizes(
	config: LayoutConfig,
	splitId: string,
	sizes: number[],
	constraints?: ResizeConstraints
): LayoutConfig {
	const next = cloneConfig(config);
	const split = findNode(next.root, splitId);

	if (!split || split.type !== 'split') {
		return next;
	}

	const nextSizes = [...sizes];
	if (split.children.length === 2) {
		const [first, second] = clampResizePair(
			nextSizes[0] ?? 50,
			nextSizes[1] ?? 50,
			split.direction,
			constraints
		);
		nextSizes[0] = first;
		nextSizes[1] = second;
	}

	split.sizes = normalizeSizes(nextSizes, split.children.length);

	return next;
}

export function loadStoredConfig(key: string): LayoutConfig | null {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const raw = window.localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as LayoutConfig) : null;
	} catch {
		return null;
	}
}

export function saveStoredConfig(config: LayoutConfig, key: string): void {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		window.localStorage.setItem(key, JSON.stringify(config));
	} catch {
		// Storage failures are ignored so the layout still works without persistence.
	}
}
