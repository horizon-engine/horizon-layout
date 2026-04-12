<script lang="ts">
	let {
		tabId,
		editorText = '',
		generatedTabNumber = null,
		onEditorTextInput
	}: {
		tabId: string;
		editorText?: string;
		generatedTabNumber?: number | null;
		onEditorTextInput?: ((value: string) => void) | undefined;
	} = $props();
</script>

{#if tabId === 'welcome'}
	<div class="tab-content tab-content--prose">
		<h2>Welcome</h2>
		<p>
			Drag a tab onto another panel's tab strip to merge it. Drag onto a content edge to split the
			panel. Use the maximize button to temporarily expand the active tab.
		</p>
	</div>
{:else if tabId === 'editor'}
	<div class="tab-content tab-content--editor">
		<div class="editor-bar">
			<span class="editor-bar__filename">layout.ts</span>
			<span class="editor-bar__badge">ids only</span>
		</div>
		<textarea
			class="code-area"
			spellcheck="false"
			value={editorText}
			oninput={(event) => onEditorTextInput?.((event.currentTarget as HTMLTextAreaElement).value)}
		></textarea>
	</div>
{:else if tabId === 'notes'}
	<div class="tab-content tab-content--prose">
		<h2>Notes</h2>
		<ul>
			<li>Snippet ids are the only tab payload stored in the config.</li>
			<li>The content area no longer accepts center-drop tab insertion.</li>
			<li>Tabs can be maximized transiently without changing the saved layout.</li>
			<li>All theming is plain CSS against exported class names.</li>
		</ul>
	</div>
{:else if tabId === 'preview'}
	<div class="tab-content tab-content--preview">
		<div class="preview-swatch"></div>
		<p class="preview-caption">
			Override <code>.horizon-layout-demo</code> or copy the shipped CSS.
		</p>
	</div>
{:else}
	<div class="tab-content tab-content--prose">
		<h2>Generated tab {generatedTabNumber ?? ''}</h2>
		<p>
			Useful for stress-testing crowded tab bars, drag reordering, and horizontal overflow scroll.
		</p>
	</div>
{/if}

<style>
	.tab-content {
		height: 100%;
	}

	.tab-content--prose {
		padding: 1.1rem 1.2rem 1.25rem;
	}

	.tab-content--prose h2 {
		margin: 0 0 0.55rem;
		font-size: 1rem;
		font-weight: 500;
		letter-spacing: -0.01em;
	}

	.tab-content--prose p,
	.tab-content--prose li {
		color: #9aa4b6;
	}

	.tab-content--prose ul {
		margin: 0.7rem 0 0;
		padding-left: 1.1rem;
	}

	.tab-content--editor {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.editor-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 0.8rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.02);
	}

	.editor-bar__filename {
		font-family: 'DM Mono', monospace;
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.editor-bar__badge {
		padding: 0.14rem 0.4rem;
		border-radius: 999px;
		background: rgba(129, 140, 248, 0.12);
		color: #a5b4fc;
		font-size: 0.67rem;
	}

	.code-area {
		flex: 1;
		width: 100%;
		padding: 0.9rem 1rem 1rem;
		border: 0;
		background: transparent;
		color: #d6deeb;
		font:
			0.8rem/1.65 'DM Mono',
			monospace;
		resize: none;
		outline: none;
	}

	.tab-content--preview {
		display: grid;
		place-items: center;
		gap: 1rem;
		padding: 1.4rem;
	}

	.preview-swatch {
		width: min(100%, 18rem);
		aspect-ratio: 16 / 10;
		border-radius: 14px;
		background:
			radial-gradient(circle at top left, rgba(129, 140, 248, 0.55), transparent 48%),
			linear-gradient(135deg, #1f2330, #0f1117 70%);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	.preview-caption {
		margin: 0;
		color: #8b96a8;
		font-size: 0.78rem;
	}

	code {
		font-family: 'DM Mono', monospace;
		font-size: 0.9em;
	}
</style>
