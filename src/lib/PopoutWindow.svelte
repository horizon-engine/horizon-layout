<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	let {
		title,
		snippet,
		popup
	}: {
		title: string;
		snippet: Snippet;
		popup: Window;
	} = $props();

	onMount(() => {
		popup.document.title = title;
	});

	$effect(() => {
		popup.document.title = title;
	});
</script>

{@render snippet()}
