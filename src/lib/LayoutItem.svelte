<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import { HORIZON_LAYOUT_REGISTRY, type LayoutRegistry } from './context.js';
	import type { LayoutItemControls } from './types.js';

	let {
		id,
		title,
		controls = {},
		children
	}: {
		id: string;
		title: string;
		controls?: LayoutItemControls;
		children: import('svelte').Snippet;
	} = $props();

	const registry = getContext<LayoutRegistry>(HORIZON_LAYOUT_REGISTRY);

	// Getters keep the registered object stable while allowing title/snippet to update reactively.
	const item = {
		get id() {
			return id;
		},
		get title() {
			return title;
		},
		get snippet() {
			return children;
		},
		get controls() {
			return controls;
		}
	};

	// Lifecycle-based registration avoids reactive feedback loops with the hidden registry subtree.
	onMount(() => {
		registry.register(item);
	});

	onDestroy(() => {
		registry.unregister(id);
	});
</script>
