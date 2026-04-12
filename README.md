# horizon-layout

Resizable, draggable tab layout for Svelte 5, built around snippets.

## Installation

```sh
npm install horizon-layout
```

```ts
import { HorizonLayout, LayoutItem } from 'horizon-layout';
import 'horizon-layout/horizon-layout.css';
```

## Quick start

```svelte
<script lang="ts">
	import { HorizonLayout, LayoutItem, type LayoutConfig } from 'horizon-layout';
	import 'horizon-layout/horizon-layout.css';

	let config = $state<LayoutConfig | null>(null);
</script>

<HorizonLayout id="my-layout" bind:config>
	<LayoutItem id="welcome" title="Welcome">
		<div>Welcome tab</div>
	</LayoutItem>

	<LayoutItem id="editor" title="Editor">
		<div>Editor tab</div>
	</LayoutItem>
</HorizonLayout>
```

`config` starts as `null` and the component builds a default layout from registered items. Pass an initial value to control the starting layout explicitly.

## How it works

horizon-layout separates two concerns:

- **Snippet registry** — `LayoutItem` components register their `id`, `title`, and `children` snippet with the nearest `HorizonLayout` at runtime.
- **Layout config** — the persisted config stores only the panel/split tree structure and snippet ids. It never contains component constructors or props, so it's always serializable.

On mount, the config is normalized against the registered ids: any missing ids are appended to the first available panel, and any unknown ids are removed. Layout mutations (drag, split, resize) update the config immutably via plain snapshots rather than Svelte proxy state.

## Interactions

| Gesture                              | Result                                                |
| ------------------------------------ | ----------------------------------------------------- |
| Drag tab → another panel's tab strip | Merges tab into that panel                            |
| Drag tab → panel content area edge   | Splits panel on the nearest edge                      |
| Click maximize button                | Expands the active tab; state persists through reload |

## API

### `HorizonLayout`

| Prop                | Type                                       | Default | Description                                                                                                                                                       |
| ------------------- | ------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | `string`                                   | —       | **Required.** Unique identifier for this layout instance. Used as the `localStorage` key and to isolate drag events when multiple layouts exist on the same page. |
| `config`            | `LayoutConfig \| null`                     | —       | **Required.** Use `bind:config` to receive updates. Pass `null` to let the component build a default layout.                                                      |
| `persist`           | `boolean`                                  | `true`  | When `true`, the layout (including maximize state) is saved to and restored from `localStorage` under the `id` key.                                               |
| `dragAndDrop`       | `boolean`                                  | `true`  | Enables or disables tab drag-and-drop.                                                                                                                            |
| `popoutEnabled`     | `boolean`                                  | `false` | Default popout permission for tabs that do not set `controls.canPopout`.                                                                                          |
| `onPopoutTab`       | `(tabId: string, panelId: string) => void` | —       | Optional override for custom popout handling. When omitted, the library manages popup windows for you.                                                            |
| `onTabPopout`       | `(tabId: string, panelId: string) => void` | —       | Callback fired when a tab popout action is triggered.                                                                                                             |
| `onTabMaximize`     | `(tabId: string, panelId: string) => void` | —       | Callback fired when a tab becomes maximized.                                                                                                                      |
| `onTabClose`        | `(tabId: string, panelId: string) => void` | —       | Callback fired when a tab is closed from the layout.                                                                                                              |
| `maximizedTabId`    | `string \| null`                           | `null`  | Use `bind:maximizedTabId` to read or control which tab is currently maximized. Any falsy value restores the normal layout.                                        |
| `resizeConstraints` | `ResizeConstraints`                        | —       | Min/max percentage constraints for resizing and split creation.                                                                                                   |
| `popoutButton`      | `Snippet<[TabActionControlProps]>`         | —       | Snippet rendered for per-tab popout controls. Only shown for tabs allowed to pop out.                                                                             |
| `closeButton`       | `Snippet<[TabActionControlProps]>`         | —       | Snippet rendered for per-tab close controls. Only shown for tabs allowed to close.                                                                                |
| `maximizeButton`    | `Snippet<[MaximizeControlProps]>`          | —       | Snippet rendered as the maximize button. Both this and `restoreButton` must be provided to enable maximize mode.                                                  |
| `restoreButton`     | `Snippet<[MaximizeControlProps]>`          | —       | Snippet rendered as the restore button. Both this and `maximizeButton` must be provided to enable maximize mode.                                                  |
| `class`             | `string`                                   | —       | Extra class added to the root `.horizon-layout` element.                                                                                                          |
| `children`          | `Snippet`                                  | —       | Should contain `LayoutItem` components.                                                                                                                           |

### `LayoutItem`

| Prop       | Type                 | Description                                                       |
| ---------- | -------------------- | ----------------------------------------------------------------- |
| `id`       | `string`             | Stable id used in the layout config to identify this tab.         |
| `title`    | `string`             | Label shown in the tab strip.                                     |
| `controls` | `LayoutItemControls` | Per-tab capability flags for popout, maximize, and close actions. |
| `children` | `Snippet`            | The tab content.                                                  |

### `ResizeConstraints`

```ts
interface ResizeConstraints {
	minWidthPercent?: number; // applies to 'row' splits
	maxWidthPercent?: number;
	minHeightPercent?: number; // applies to 'column' splits
	maxHeightPercent?: number;
}
```

The same constraints govern both resize gestures and whether a new split is allowed.

### `TabActionControlProps`

```ts
interface TabActionControlProps {
	panelId: string; // the panel that currently contains the tab
	tabId: string | null; // the active tab this control applies to
	action: () => void; // call to run the control action
}
```

### `MaximizeControlProps`

```ts
interface MaximizeControlProps extends TabActionControlProps {}
```

### `LayoutItemControls`

```ts
interface LayoutItemControls {
	canPopout?: boolean;
	canMaximize?: boolean;
	canClose?: boolean;
}
```

## Config schema

```ts
interface LayoutConfig {
	root: LayoutNodeConfig;
	maximizedTabId?: string | null; // persisted alongside the layout tree
	closedTabIds?: string[]; // tabs removed from the visible layout
}

type LayoutNodeConfig = LayoutPanelConfig | LayoutSplitConfig;

interface LayoutPanelConfig {
	id: string;
	type: 'panel';
	tabs: string[]; // ordered list of LayoutItem ids
	activeTab: string | null;
}

interface LayoutSplitConfig {
	id: string;
	type: 'split';
	direction: 'row' | 'column'; // 'row' = side-by-side, 'column' = stacked
	sizes: number[]; // percentage array, aligned with children
	children: LayoutNodeConfig[];
}
```

## Examples

### Two-panel side-by-side split

A 70/30 horizontal split with an editor on the left and a file tree on the right.

```svelte
<script lang="ts">
	import { HorizonLayout, LayoutItem, type LayoutConfig } from 'horizon-layout';
	import 'horizon-layout/horizon-layout.css';

	let config = $state<LayoutConfig>({
		root: {
			id: 'root-split',
			type: 'split',
			direction: 'row',
			sizes: [70, 30],
			children: [
				{
					id: 'main-panel',
					type: 'panel',
					tabs: ['editor', 'preview'],
					activeTab: 'editor'
				},
				{
					id: 'side-panel',
					type: 'panel',
					tabs: ['files'],
					activeTab: 'files'
				}
			]
		}
	});
</script>

<HorizonLayout id="ide-layout" bind:config>
	<LayoutItem id="editor" title="Editor">
		<textarea>// your code here</textarea>
	</LayoutItem>

	<LayoutItem id="preview" title="Preview">
		<iframe src="/preview" title="Preview" />
	</LayoutItem>

	<LayoutItem id="files" title="Files">
		<ul><!-- file tree --></ul>
	</LayoutItem>
</HorizonLayout>
```

### Three-panel layout (stacked + side panel)

An editor on the left, with a terminal stacked below a preview pane on the right.

```svelte
<script lang="ts">
	let config = $state<LayoutConfig>({
		root: {
			id: 'outer-split',
			type: 'split',
			direction: 'row',
			sizes: [60, 40],
			children: [
				{
					id: 'editor-panel',
					type: 'panel',
					tabs: ['editor'],
					activeTab: 'editor'
				},
				{
					id: 'right-split',
					type: 'split',
					direction: 'column',
					sizes: [60, 40],
					children: [
						{
							id: 'preview-panel',
							type: 'panel',
							tabs: ['preview'],
							activeTab: 'preview'
						},
						{
							id: 'terminal-panel',
							type: 'panel',
							tabs: ['terminal'],
							activeTab: 'terminal'
						}
					]
				}
			]
		}
	});
</script>

<HorizonLayout id="ide-three-panel" bind:config>
	<LayoutItem id="editor" title="Editor"><!-- ... --></LayoutItem>
	<LayoutItem id="preview" title="Preview"><!-- ... --></LayoutItem>
	<LayoutItem id="terminal" title="Terminal"><!-- ... --></LayoutItem>
</HorizonLayout>
```

### Resize constraints

Use `resizeConstraints` to prevent panels from being resized too small or too large.

```svelte
<HorizonLayout
	id="my-layout"
	bind:config
	resizeConstraints={{
		minWidthPercent: 20,
		maxWidthPercent: 80,
		minHeightPercent: 15,
		maxHeightPercent: 85
	}}
>
	<LayoutItem id="main" title="Main"><!-- ... --></LayoutItem>
	<LayoutItem id="sidebar" title="Sidebar"><!-- ... --></LayoutItem>
</HorizonLayout>
```

- Horizontal splits cannot be dragged so that either side is narrower than 20% or wider than 80%.
- Vertical splits cannot be dragged so that either side is shorter than 15% or taller than 85%.
- These bounds also prevent creating a new split that would immediately violate a constraint.

### Popout tabs

Pass a `popoutButton` snippet and enable popout per tab with `controls.canPopout`. The built-in popout behavior removes the tab from the layout while the popup is open and restores it when the popup closes.

```svelte
<script lang="ts">
	import {
		HorizonLayout,
		LayoutItem,
		type LayoutConfig,
		type TabActionControlProps
	} from 'horizon-layout';
	import 'horizon-layout/horizon-layout.css';

	let config = $state<LayoutConfig | null>(null);
</script>

<HorizonLayout id="my-layout" bind:config>
	{#snippet popoutButton({ action }: TabActionControlProps)}
		<button onclick={action} aria-label="Pop out tab">↗</button>
	{/snippet}

	<LayoutItem id="editor" title="Editor" controls={{ canPopout: true }}>
		<textarea>console.log('hello');</textarea>
	</LayoutItem>

	<LayoutItem id="preview" title="Preview">
		<div>Preview output</div>
	</LayoutItem>
</HorizonLayout>
```

### Custom popout handling

Provide `onPopoutTab` if you want to intercept the popout action and manage your own windowing behavior.

```svelte
<script lang="ts">
	function handlePopoutTab(tabId: string, panelId: string) {
		console.log('Pop out', { tabId, panelId });
	}

	function handleTabPopout(tabId: string, panelId: string) {
		console.log('Popout requested', { tabId, panelId });
	}
</script>

<HorizonLayout
	id="my-layout"
	bind:config
	onTabPopout={handleTabPopout}
	onPopoutTab={handlePopoutTab}
>
	{#snippet popoutButton({ action })}
		<button onclick={action}>Pop out</button>
	{/snippet}

	<LayoutItem id="editor" title="Editor" controls={{ canPopout: true }}><!-- ... --></LayoutItem>
</HorizonLayout>
```

When `onPopoutTab` is provided, the library does not open its managed popup window and instead delegates the action to your callback.

### Close buttons

Pass a `closeButton` snippet and enable close per tab with `controls.canClose`. Closed tabs are tracked in `config.closedTabIds`, so they stay removed across persistence and normalization.

```svelte
<HorizonLayout id="my-layout" bind:config onTabClose={(tabId) => console.log('Closed', tabId)}>
	{#snippet closeButton({ action })}
		<button onclick={action} aria-label="Close tab">×</button>
	{/snippet}

	<LayoutItem id="editor" title="Editor" controls={{ canClose: true }}><!-- ... --></LayoutItem>
</HorizonLayout>
```

### Maximize / restore buttons

Pass both `maximizeButton` and `restoreButton` snippets to enable maximize mode. Each snippet receives the current `panelId`, active `tabId`, and an `action` callback. Maximize can then be enabled or disabled per tab with `controls.canMaximize`.

```svelte
<HorizonLayout
	id="my-layout"
	bind:config
	onTabMaximize={(tabId) => console.log('Maximized', tabId)}
>
	{#snippet maximizeButton({ action })}
		<button onclick={action} aria-label="Maximize tab">🗖</button>
	{/snippet}

	{#snippet restoreButton({ action })}
		<button onclick={action} aria-label="Restore panel">🗗</button>
	{/snippet}

	<LayoutItem id="editor" title="Editor" controls={{ canMaximize: true }}><!-- ... --></LayoutItem>
	<LayoutItem id="preview" title="Preview"><!-- ... --></LayoutItem>
</HorizonLayout>
```

Maximize mode is **opt-in**: if either snippet is omitted, tabs cannot be maximized. A tab with `controls.canMaximize={false}` will not show the maximize control, but it can still be restored if it was already maximized. The maximized tab id is written into the persisted config, so a page reload restores the maximized state.

### Controlling maximize programmatically

`bind:maximizedTabId` exposes the current maximize state as a bindable. You can trigger maximize from anywhere by setting it to a tab id directly.

```svelte
<script lang="ts">
	import { HorizonLayout, LayoutItem, type LayoutConfig } from 'horizon-layout';

	let config = $state<LayoutConfig | null>(null);
	let maximizedTabId = $state<string | null>(null);

	function onKeydown(e: KeyboardEvent) {
		if (!config) return;

		if (e.ctrlKey && e.key === 'm') {
			maximizedTabId = 'editor';
		}

		if (e.key === 'Escape') {
			maximizedTabId = null; // restore
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<HorizonLayout id="my-layout" bind:config bind:maximizedTabId>
	{#snippet maximizeButton({ action })}
		<button onclick={action}>Maximize</button>
	{/snippet}
	{#snippet restoreButton({ action })}
		<button onclick={action}>Restore</button>
	{/snippet}

	<LayoutItem id="editor" title="Editor"><!-- ... --></LayoutItem>
</HorizonLayout>
```

Any falsy value (`null`, `undefined`, `''`) clears the maximize state. `maximizeButton` and `restoreButton` must still be provided for maximize to be enabled.

### Multiple layouts on the same page

Each `HorizonLayout` uses its `id` to scope drag events, so tabs from one layout cannot be dropped into another.

```svelte
<HorizonLayout id="left-panel" bind:config={leftConfig}>
	<LayoutItem id="editor" title="Editor"><!-- ... --></LayoutItem>
</HorizonLayout>

<HorizonLayout id="right-panel" bind:config={rightConfig}>
	<LayoutItem id="preview" title="Preview"><!-- ... --></LayoutItem>
</HorizonLayout>
```

Each layout also persists independently to its own `localStorage` key.

### Disabling persistence

`persist` defaults to `true`. Set it to `false` to opt out of `localStorage` entirely.

```svelte
<HorizonLayout id="my-layout" bind:config persist={false}>
	<LayoutItem id="main" title="Main"><!-- ... --></LayoutItem>
</HorizonLayout>
```

### Disabling drag and drop

```svelte
<HorizonLayout id="my-layout" bind:config dragAndDrop={false}>
	<LayoutItem id="main" title="Main"><!-- ... --></LayoutItem>
</HorizonLayout>
```

### Reading the current config

`bind:config` gives you a reactive reference to the live layout config.

```svelte
<script lang="ts">
	let config = $state<LayoutConfig | null>(null);

	$effect(() => {
		if (config) {
			console.log('Layout changed:', JSON.stringify(config, null, 2));
		}
	});
</script>

<HorizonLayout id="my-layout" bind:config><!-- ... --></HorizonLayout>
```

## Persistence

By default (`persist={true}`), the layout config and current maximize state are written to `localStorage` under the layout's `id` key after every change and restored on mount.

Set `persist={false}` to disable this entirely. The `id` prop is still required even when persistence is off — it is also used to isolate drag-and-drop between multiple layout instances on the same page.

## Styling

Import the default stylesheet:

```ts
import 'horizon-layout/horizon-layout.css';
```

Or copy and override it. The library uses class-based styling with no theme object.

### CSS classes

| Class                         | Element                        |
| ----------------------------- | ------------------------------ |
| `.horizon-layout`             | Root container                 |
| `.horizon-layout__empty`      | Empty layout state             |
| `.horizon-layout-split`              | Split container                |
| `.horizon-layout-split__pane`        | Individual pane inside a split |
| `.horizon-layout-split__resizer`     | Drag handle between panes      |
| `.horizon-layout-panel`              | Panel container                |
| `.horizon-layout-panel__tabs`        | Tab strip                      |
| `.horizon-layout-panel__tab`         | Individual tab                 |
| `.horizon-layout-panel__tab--active` | Active tab                     |
| `.horizon-layout-panel__content`     | Tab content area               |
| `.horizon-layout-panel__overlay`     | Drag-over overlay              |

### CSS custom properties

| Property                 | Purpose               |
| ------------------------ | --------------------- |
| `--horizon-layout-bg`           | Layout background     |
| `--horizon-layout-panel-bg`     | Panel background      |
| `--horizon-layout-border`       | Border color          |
| `--horizon-layout-text`         | Primary text          |
| `--horizon-layout-muted`        | Muted text            |
| `--horizon-layout-accent`       | Accent / active color |
| `--horizon-layout-shadow`       | Shadow                |
| `--horizon-layout-radius-panel` | Panel corner radius   |
| `--horizon-layout-radius-tab`   | Tab corner radius     |
| `--horizon-layout-gap`          | Gap between panels    |

### Theming example

```css
.my-app {
	--horizon-layout-bg: #0f1117;
	--horizon-layout-panel-bg: #1a1d27;
	--horizon-layout-border: #2e3245;
	--horizon-layout-text: #e2e4f0;
	--horizon-layout-muted: #6b7094;
	--horizon-layout-accent: #7c6af7;
}
```

```svelte
<HorizonLayout id="my-layout" bind:config class="my-app">
	<!-- ... -->
</HorizonLayout>
```
