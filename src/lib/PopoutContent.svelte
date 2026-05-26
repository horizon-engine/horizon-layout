<script lang="ts">
	import type { View } from './types.ts';

	let {
		popout,
		title,
		view,
		baseClass
	}: {
		popout: Window;
		title: string;
		view: View;
		baseClass: string;
	} = $props();

	$effect(() => {
		popout.document.title = title;
	});
</script>

<main class="{baseClass} {baseClass}__popout">
	<div class="{baseClass}__content">
		{@render view.snippet()}
	</div>
</main>
