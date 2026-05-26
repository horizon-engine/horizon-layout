<script lang="ts">
	import HorizonLayout from '$lib/HorizonLayout.svelte';
	import type { Id, LayoutConfig, NodeConfig, SplitConfig, TabGroupConfig } from '$lib/types.js';
	import '$lib/horizon-layout.css';
	import { SvelteMap } from 'svelte/reactivity';
	import { buildNodeParentMap, cloneConfig, nodeConfigType, simplifyTabGroup } from '$lib/utils.js';

	let config: LayoutConfig = $state({
		root: {
			direction: 'horizontal',
			views: [
				{
					direction: 'vertical',
					views: [
						{ tabs: ['slateblue'], activeTabIndex: 0 },
						{ tabs: ['cadetblue'], activeTabIndex: 0 }
					],
					splitPoints: [0.5]
				},
				{
					direction: 'vertical',
					views: [
						{ tabs: ['rosybrown'], activeTabIndex: 0 },
						{ tabs: ['brown'], activeTabIndex: 0 }
					],
					splitPoints: [0.5]
				},
				{
					direction: 'vertical',
					views: [
						{ tabs: ['dimgray'], activeTabIndex: 0 },
						{ tabs: ['darkslategray'], activeTabIndex: 0 }
					],
					splitPoints: [0.5]
				},
				{
					direction: 'vertical',
					views: [
						{ tabs: ['steelblue'], activeTabIndex: 0 },
						{ tabs: ['sienna'], activeTabIndex: 0 },
						{
							tabs: ['darkolivegreen', 'peru'],
							activeTabIndex: 1
						}
					],
					splitPoints: [0.25, 0.5]
				}
			],
			splitPoints: [0.25, 0.5, 0.75]
		}
	});

	let views = new SvelteMap([
		['slateblue', { title: 'slateblue', snippet: slateblue, tabControls: [popoutButton] }],
		['cadetblue', { title: 'cadetblue', snippet: cadetblue, tabControls: [popoutButton] }],
		['rosybrown', { title: 'rosybrown', snippet: rosybrown, tabControls: [popoutButton] }],
		['brown', { title: 'brown', snippet: brown, tabControls: [popoutButton] }],
		['dimgray', { title: 'dimgray', snippet: dimgray, tabControls: [popoutButton] }],
		[
			'darkslategray',
			{ title: 'darkslategray', snippet: darkslategray, tabControls: [popoutButton] }
		],
		['steelblue', { title: 'steelblue', snippet: steelblue, tabControls: [popoutButton] }],
		['sienna', { title: 'sienna', snippet: sienna, tabControls: [popoutButton] }],
		[
			'darkolivegreen',
			{ title: 'darkolivegreen', snippet: darkolivegreen, tabControls: [popoutButton] }
		],
		['peru', { title: 'peru', snippet: peru, tabControls: [popoutButton] }]
	]);

	let popoutsOriginalPositions: { viewId: Id; position: number[] }[] = [];

	function popout(viewId: Id) {
		if (!config.root || config.popouts?.includes(viewId)) return;
		popoutsOriginalPositions = popoutsOriginalPositions.filter((p) => p.viewId !== viewId);

		const config_copy = cloneConfig(config);
		const position: number[] = [];
		const walk = (node: NodeConfig): { tabgroup: TabGroupConfig; index: number } | null => {
			if (nodeConfigType(node) === 'split') {
				const split = node as SplitConfig;
				for (let i = 0; i < split.views.length; i++) {
					const result = walk(split.views[i]!);
					if (result) {
						position.push(i);
						return result;
					}
				}
				return null;
			} else {
				const tabgroup = node as TabGroupConfig;
				for (let i = 0; i < tabgroup.tabs.length; i++) {
					if (tabgroup.tabs[i] === viewId) {
						position.push(i);
						return { tabgroup, index: i };
					}
				}
				return null;
			}
		};

		const result = walk(config_copy.root!);
		if (!result) return;

		result.tabgroup.tabs.splice(result.index, 1);
		result.tabgroup.activeTabIndex = Math.min(
			result.tabgroup.activeTabIndex,
			result.tabgroup.tabs.length - 1
		);
		simplifyTabGroup(result.tabgroup, buildNodeParentMap(config_copy.root!), config_copy);
		config_copy.popouts = [...(config_copy.popouts ?? []), viewId];
		popoutsOriginalPositions.push({
			viewId,
			position: position
		});
		config = config_copy;
	}

	function onPopoutClose(viewId: Id) {
		if (!config.popouts?.includes(viewId)) return;
		const position = popoutsOriginalPositions.reduceRight<number[]>(
			(acc, p, i, arr) => (p.viewId === viewId ? (arr.splice(i, 1), p.position) : acc),
			[]
		);
		const config_copy = cloneConfig(config);

		if (config_copy.root) {
			const place = (node: NodeConfig) => {
				const index = position.pop() ?? 0;
				if (nodeConfigType(node) === 'split') {
					const split = node as SplitConfig;
					if (index >= split.views.length) {
						split.views.push({ tabs: [viewId], activeTabIndex: 0 });
					} else {
						place(split.views[index]!);
					}
				} else {
					const tabgroup = node as TabGroupConfig;
					tabgroup.tabs.splice(index, 0, viewId);
				}
			};

			place(config_copy.root);
		} else {
			config_copy.root = { tabs: [viewId], activeTabIndex: 0 };
		}

		config_copy.popouts = config_copy.popouts?.filter((id) => id !== viewId);
		if (config_copy.popouts?.length === 0) config_copy.popouts = undefined;

		config = config_copy;
	}
</script>

{#snippet popoutButton(viewId: Id)}
	<button class="btn" onclick={() => popout(viewId)} title="Popout"> ⤢ </button>
{/snippet}

{#snippet maximizeButton(activeViewId: Id)}
	<button class="btn" onclick={() => (config.maximizedView = activeViewId)} title="Maximize">
		⛶
	</button>
{/snippet}

{#snippet colorView(color: string)}
	<div class="view" style:background-color={color}>
		{#if config.maximizedView === color}
			<button
				class="btn restore"
				onclick={() => (config.maximizedView = undefined)}
				title="Restore"
			>
				🗗
			</button>
		{/if}
	</div>
{/snippet}

{#snippet slateblue()}
	{@render colorView('slateblue')}
{/snippet}

{#snippet cadetblue()}
	{@render colorView('cadetblue')}
{/snippet}

{#snippet rosybrown()}
	{@render colorView('rosybrown')}
{/snippet}

{#snippet brown()}
	{@render colorView('brown')}
{/snippet}

{#snippet dimgray()}
	{@render colorView('dimgray')}
{/snippet}

{#snippet darkslategray()}
	{@render colorView('darkslategray')}
{/snippet}

{#snippet steelblue()}
	{@render colorView('steelblue')}
{/snippet}

{#snippet sienna()}
	{@render colorView('sienna')}
{/snippet}

{#snippet darkolivegreen()}
	{@render colorView('darkolivegreen')}
{/snippet}

{#snippet peru()}
	{@render colorView('peru')}
{/snippet}

<div class="layout">
	<HorizonLayout
		bind:config
		{views}
		showSplitRatio={true}
		tabgroupControls={[maximizeButton]}
		{onPopoutClose}
	/>
</div>

<style>
	:global(body) {
		font-family: system-ui;
		margin: 0;
		padding: 0;
	}

	.layout {
		width: 100vw;
		height: 100vh;
	}

	.view {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.restore {
		position: absolute;
		top: 10px;
		right: 10px;
	}

	.btn {
		border: none;
		color: oklch(0.65 0.18 277);
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 3px;
		font-size: 0.75rem;
		line-height: 1;
		background: oklch(0.2 0.05 266);
	}
</style>
