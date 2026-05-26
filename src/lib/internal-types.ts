export type DropSide = 'top' | 'right' | 'bottom' | 'left';

export type DropTarget =
	| {
			side: DropSide;
			tabIndex?: never;
	  }
	| {
			tabIndex: number;
			side?: never;
	  };
