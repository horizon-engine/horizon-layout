<script lang="ts">
	import { tick } from 'svelte';
	import {
		HorizonLayout,
		LayoutItem,
		type LayoutConfig,
		type LayoutItemControls,
		type LayoutNodeConfig,
		type MaximizeControlProps,
		type TabActionControlProps
	} from '../lib/index.js';
	import DemoTabContent from './DemoTabContent.svelte';
	import { createDemoSharedState, DEMO_LAYOUT_ID, getGeneratedTabNumber } from './demo.ts';
	import '../lib/horizon-layout.css';

	function createInitialConfig(): LayoutConfig {
		return {
			root: {
				id: 'root-split',
				type: 'split',
				direction: 'row',
				sizes: [64, 36],
				children: [
					{
						id: 'workbench-panel',
						type: 'panel',
						tabs: ['welcome', 'editor'],
						activeTab: 'editor'
					},
					{
						id: 'sidebar-panel',
						type: 'panel',
						tabs: ['notes', 'preview'],
						activeTab: 'preview'
					}
				]
			}
		};
	}

	function findFirstPanelId(node: LayoutNodeConfig): string | null {
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

	function moveTabIntoPanel(
		node: LayoutNodeConfig,
		panelId: string,
		tabId: string
	): LayoutNodeConfig {
		if (node.type === 'panel') {
			const tabsWithoutTab = node.tabs.filter((candidate) => candidate !== tabId);

			if (node.id !== panelId) {
				return {
					...node,
					tabs: tabsWithoutTab,
					activeTab:
						node.activeTab === tabId
							? (tabsWithoutTab[0] ?? null)
							: tabsWithoutTab.includes(node.activeTab ?? '')
								? (node.activeTab ?? null)
								: (tabsWithoutTab[0] ?? null)
				};
			}

			return {
				...node,
				tabs: [...tabsWithoutTab, tabId],
				activeTab: tabId
			};
		}

		return {
			...node,
			children: node.children.map((child) => moveTabIntoPanel(child, panelId, tabId))
		};
	}

	function resetGeneratedTabs() {
		extraTabIds = [];
		nextExtraTabNumber = 1;
	}

	function getTabControls(tabId: string): LayoutItemControls {
		switch (tabId) {
			case 'welcome':
				return { canPopout: false, canMaximize: false, canClose: false };
			case 'editor':
				return { canPopout: true, canMaximize: true, canClose: true };
			case 'notes':
				return { canPopout: true, canMaximize: false, canClose: true };
			case 'preview':
				return { canPopout: false, canMaximize: true, canClose: false };
			default:
				return { canPopout: true, canMaximize: true, canClose: true };
		}
	}

	let config = $state<LayoutConfig>(createInitialConfig());
	let dragAndDrop = $state(true);
	let persist = $state(true);
	let selectedPanelId = $state<string | null>('workbench-panel');
	let minWidthPercent = $state(18);
	let maxWidthPercent = $state(82);
	let editorText = $state(createDemoSharedState().editorText);
	let extraTabIds = $state<string[]>([]);
	let nextExtraTabNumber = $state(1);

	async function addTab() {
		const nextId = `demo-tab-${nextExtraTabNumber}`;
		extraTabIds = [...extraTabIds, nextId];
		nextExtraTabNumber += 1;
		await tick();

		const targetPanelId = selectedPanelId ?? findFirstPanelId(config.root);
		if (!targetPanelId) {
			return;
		}

		config = {
			...config,
			root: moveTabIntoPanel(config.root, targetPanelId, nextId)
		};
	}

	function setEditorText(value: string) {
		if (editorText === value) {
			return;
		}

		editorText = value;
	}

	function resetLayout() {
		resetGeneratedTabs();
		config = createInitialConfig();
		selectedPanelId = 'workbench-panel';
	}
</script>

<svelte:head>
	<title>horizon-layout</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link
		href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="page">
	<aside class="sidebar">
		<header class="sidebar__header">
			<div class="wordmark">
				<span class="wordmark__slash">/</span>horizon-layout
			</div>
			<p class="sidebar__tagline">Resizable, draggable tab layout for Svelte 5.</p>
		</header>

		<nav class="sidebar__controls">
			<div class="control-group">
				<span class="control-group__label">actions</span>
				<div class="btn-row">
					<button type="button" class="btn btn--primary" onclick={resetLayout}>
						Reset layout
					</button>
					<button type="button" class="btn btn--ghost" onclick={addTab}> + Add tab </button>
				</div>
			</div>

			<div class="control-group">
				<span class="control-group__label">options</span>
				<label class="toggle">
					<input type="checkbox" bind:checked={dragAndDrop} />
					<span class="toggle__track"></span>
					<span class="toggle__text">drag &amp; drop</span>
				</label>
				<label class="toggle">
					<input type="checkbox" bind:checked={persist} />
					<span class="toggle__track"></span>
					<span class="toggle__text">persist to localStorage</span>
				</label>
			</div>

			<div class="control-group">
				<span class="control-group__label">resize constraints</span>
				<label class="slider-row">
					<span class="slider-row__label">min width</span>
					<input type="range" min="5" max="45" step="1" bind:value={minWidthPercent} />
					<span class="slider-row__value">{minWidthPercent}%</span>
				</label>
				<label class="slider-row">
					<span class="slider-row__label">max width</span>
					<input type="range" min="55" max="95" step="1" bind:value={maxWidthPercent} />
					<span class="slider-row__value">{maxWidthPercent}%</span>
				</label>
			</div>

			<div class="control-group control-group--flush">
				<span class="control-group__label">config snapshot</span>
				<pre class="config-pre">{JSON.stringify(config, null, 2)}</pre>
			</div>
		</nav>
	</aside>

	<main class="canvas">
		<HorizonLayout
			id={DEMO_LAYOUT_ID}
			bind:config
			bind:selectedPanelId
			{persist}
			{dragAndDrop}
			class="horizon-layout-demo"
			resizeConstraints={{
				minWidthPercent,
				maxWidthPercent,
				minHeightPercent: 18,
				maxHeightPercent: 82
			}}
			{popoutButton}
			{closeButton}
			{maximizeButton}
			{restoreButton}
		>
			<LayoutItem id="welcome" title="Welcome" controls={getTabControls('welcome')}>
				<DemoTabContent tabId="welcome" {editorText} />
			</LayoutItem>

			<LayoutItem id="editor" title="Editor" controls={getTabControls('editor')}>
				<DemoTabContent tabId="editor" {editorText} onEditorTextInput={setEditorText} />
			</LayoutItem>

			<LayoutItem id="notes" title="Notes" controls={getTabControls('notes')}>
				<DemoTabContent tabId="notes" {editorText} />
			</LayoutItem>

			<LayoutItem id="preview" title="Preview" controls={getTabControls('preview')}>
				<DemoTabContent tabId="preview" {editorText} />
			</LayoutItem>

			{#each extraTabIds as tabId, index (tabId)}
				<LayoutItem id={tabId} title={`Tab ${index + 1}`} controls={getTabControls(tabId)}>
					<DemoTabContent
						{editorText}
						{tabId}
						generatedTabNumber={getGeneratedTabNumber(extraTabIds, tabId)}
					/>
				</LayoutItem>
			{/each}
		</HorizonLayout>
	</main>
</div>

{#snippet maximizeButton(props: MaximizeControlProps)}
	<button type="button" class="panel-action" onclick={props.action} title="Maximize tab">
		<svg width="11" height="11" viewBox="0 0 11 11" fill="none">
			<path
				d="M1 4V1h3M7 1h3v3M10 7v3H7M4 10H1V7"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>
{/snippet}

{#snippet popoutButton(props: TabActionControlProps)}
	<button
		type="button"
		class="panel-action panel-action--tab"
		onclick={props.action}
		title="Pop out tab"
	>
		↗
	</button>
{/snippet}

{#snippet closeButton(props: TabActionControlProps)}
	<button
		type="button"
		class="panel-action panel-action--tab"
		onclick={props.action}
		title="Close tab"
	>
		×
	</button>
{/snippet}

{#snippet restoreButton(props: MaximizeControlProps)}
	<button type="button" class="panel-action" onclick={props.action} title="Restore">
		<svg width="11" height="11" viewBox="0 0 11 11" fill="none">
			<path
				d="M4 1H1v3M1 4l3-3M7 10h3V7M10 7l-3 3"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>
{/snippet}

<style>
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		font-family: 'DM Sans', 'Segoe UI', sans-serif;
		font-size: 14px;
		line-height: 1.5;
		background: #0c0e12;
		color: #e2e6ef;
		-webkit-font-smoothing: antialiased;
	}

	:global(.horizon-layout-demo) {
		--horizon-layout-accent: #818cf8;
		--horizon-layout-drop-border: rgba(129, 140, 248, 0.5);
		--horizon-layout-drop-preview: rgba(129, 140, 248, 0.1);
	}

	:global(.panel-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.05);
		color: #8896a8;
		cursor: pointer;
		transition:
			background 100ms,
			color 100ms,
			border-color 100ms;
	}

	:global(.panel-action:hover) {
		background: rgba(129, 140, 248, 0.15);
		border-color: rgba(129, 140, 248, 0.4);
		color: #a5b4fc;
	}

	:global(.panel-action--tab) {
		width: 18px;
		height: 18px;
		font-size: 0.82rem;
		line-height: 1;
	}

	.page {
		display: grid;
		grid-template-columns: 260px 1fr;
		height: 100vh;
		overflow: hidden;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #10131a;
		border-right: 1px solid rgba(255, 255, 255, 0.07);
	}

	.sidebar__header {
		padding: 1.5rem 1.25rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
	}

	.wordmark {
		font-family: 'DM Mono', monospace;
		font-size: 1.05rem;
		font-weight: 400;
		letter-spacing: -0.01em;
		color: #e2e6ef;
		margin-bottom: 0.4rem;
	}

	.wordmark__slash {
		color: #818cf8;
		margin-right: 1px;
	}

	.sidebar__tagline {
		margin: 0;
		font-size: 0.78rem;
		color: #5a6478;
		line-height: 1.5;
	}

	.sidebar__controls {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.control-group__label {
		font-family: 'DM Mono', monospace;
		font-size: 0.67rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #3d4558;
	}

	.control-group--flush {
		gap: 0.4rem;
	}

	.btn-row {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		flex: 1;
		padding: 0.45rem 0.75rem;
		border-radius: 6px;
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		transition:
			background 120ms,
			color 120ms,
			border-color 120ms;
	}

	.btn--primary {
		background: #818cf8;
		border: 1px solid #818cf8;
		color: #0c0e12;
		font-weight: 500;
	}

	.btn--primary:hover {
		background: #a5b4fc;
		border-color: #a5b4fc;
	}

	.btn--ghost {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #8896a8;
	}

	.btn--ghost:hover {
		background: rgba(255, 255, 255, 0.06);
		color: #c8cfdf;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		user-select: none;
	}

	.toggle input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle__track {
		width: 30px;
		height: 17px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.12);
		position: relative;
		flex-shrink: 0;
		transition:
			background 150ms,
			border-color 150ms;
	}

	.toggle__track::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: #5a6478;
		transition:
			transform 150ms,
			background 150ms;
	}

	.toggle input:checked ~ .toggle__track {
		background: rgba(129, 140, 248, 0.25);
		border-color: #818cf8;
	}

	.toggle input:checked ~ .toggle__track::after {
		background: #818cf8;
		transform: translateX(13px);
	}

	.toggle__text {
		font-size: 0.82rem;
		color: #8896a8;
	}

	.slider-row {
		display: grid;
		grid-template-columns: 5rem 1fr 2.5rem;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
	}

	.slider-row__label {
		font-size: 0.78rem;
		color: #5a6478;
		white-space: nowrap;
	}

	.slider-row input[type='range'] {
		width: 100%;
		accent-color: #818cf8;
		cursor: pointer;
	}

	.slider-row__value {
		font-family: 'DM Mono', monospace;
		font-size: 0.72rem;
		color: #818cf8;
		text-align: right;
	}

	.config-pre {
		margin: 0;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 7px;
		font-family: 'DM Mono', monospace;
		font-size: 0.68rem;
		line-height: 1.6;
		color: #5a6478;
		overflow: auto;
		max-height: 220px;
		white-space: pre;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
	}

	.canvas {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	@media (max-width: 860px) {
		.page {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		.sidebar {
			border-right: none;
			border-bottom: 1px solid rgba(255, 255, 255, 0.07);
			overflow-y: auto;
		}

		.sidebar__controls {
			max-height: 40vh;
		}
	}
</style>
