export const DEMO_LAYOUT_ID = 'horizon-layout-demo';
export const DEMO_POPOUT_CHANNEL = 'horizon-layout-demo:popout-channel';
export const DEMO_POPOUT_STATE_KEY = 'horizon-layout-demo:popout-state';

export interface DemoSharedState {
	editorText: string;
	extraTabIds: string[];
}

export const INITIAL_EDITOR_TEXT = `export const createPanel = (tabs) => ({
  type: 'panel',
  tabs,
  activeTab: tabs[0] ?? null
});`;

export function createDemoSharedState(): DemoSharedState {
	return {
		editorText: INITIAL_EDITOR_TEXT,
		extraTabIds: []
	};
}

export function getGeneratedTabNumber(extraTabIds: string[], tabId: string): number | null {
	const index = extraTabIds.indexOf(tabId);
	return index === -1 ? null : index + 1;
}

export function getDemoTabTitle(state: DemoSharedState, tabId: string): string {
	switch (tabId) {
		case 'welcome':
			return 'Welcome';
		case 'editor':
			return 'Editor';
		case 'notes':
			return 'Notes';
		case 'preview':
			return 'Preview';
		default: {
			const generatedNumber = getGeneratedTabNumber(state.extraTabIds, tabId);
			return generatedNumber ? `Tab ${generatedNumber}` : 'Tab';
		}
	}
}

export function isDemoTabAvailable(state: DemoSharedState, tabId: string): boolean {
	return (
		['welcome', 'editor', 'notes', 'preview'].includes(tabId) || state.extraTabIds.includes(tabId)
	);
}
