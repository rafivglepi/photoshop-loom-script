// Layout direction
export type StackDirection = 'horizontal' | 'vertical';

// Cross-axis alignment (perpendicular to stack direction)
export type ItemsAlignment = 'start' | 'center' | 'end';

// Main-axis alignment (along stack direction)
export type JustifyAlignment = 'start' | 'center' | 'end' | 'between';

// Padding/margin values
export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Parsed layout configuration from group name
export interface LayoutConfig {
  direction: StackDirection | null;
  gap: number;
  padding: Spacing;
  items: ItemsAlignment;
  justify: JustifyAlignment;
  isContent: boolean; // If true, this layer stretches to fill parent
}

// Rectangle bounds
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// Computed position for a child
export interface ComputedPosition {
  x: number;
  y: number;
}

// Computed size for content layers
export interface ComputedSize {
  width: number;
  height: number;
}

// Layer info with computed layout
export interface LayoutChild {
  layer: any; // ExtendScript Layer or LayerSet
  bounds: Bounds;
  config: LayoutConfig;
  computedPosition: ComputedPosition | null;
  computedSize: ComputedSize | null;
}

// Default layout config
export function createDefaultConfig(): LayoutConfig {
  return {
    direction: null,
    gap: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    items: 'start',
    justify: 'start',
    isContent: false,
  };
}

