import {
  LayoutConfig,
  Bounds,
  ComputedPosition,
  ComputedSize,
  LayoutChild,
  Spacing,
} from './types';
import {
  getLayerBounds,
  getBoundsWidth,
  getBoundsHeight,
  getChildren,
  isLayerVisible,
} from './measure';
import { parseLayoutName, isContentLayer } from './parser';

/**
 * Represents the result of layout calculation
 */
export interface LayoutResult {
  children: LayoutChild[];
  contentSize: { width: number; height: number };
  containerSize: { width: number; height: number };
}

/**
 * Calculate the layout for a group with layout configuration
 */
export function calculateLayout(
  layerSet: any,
  config: LayoutConfig
): LayoutResult {
  var allChildren = getChildren(layerSet);
  
  // Separate content layers from normal layers
  var contentLayers: any[] = [];
  var normalLayers: any[] = [];
  
  for (var i = 0; i < allChildren.length; i++) {
    var child = allChildren[i];
    if (!isLayerVisible(child)) continue;
    
    if (isContentLayer(child.name)) {
      contentLayers.push(child);
    } else {
      normalLayers.push(child);
    }
  }
  
  // Get bounds of normal layers
  var normalBounds: Bounds[] = [];
  for (var j = 0; j < normalLayers.length; j++) {
    normalBounds.push(getLayerBounds(normalLayers[j]));
  }
  
  // Calculate content size from normal layers
  var contentSize = calculateContentSize(normalBounds, config);
  
  // Calculate container size (content + padding)
  var containerSize = {
    width: contentSize.width + config.padding.left + config.padding.right,
    height: contentSize.height + config.padding.top + config.padding.bottom,
  };
  
  // Calculate positions for normal layers
  var layoutChildren: LayoutChild[] = [];
  
  // Get the top-left of where content should start
  var groupBounds = getLayerBounds(layerSet);
  var contentStartX = groupBounds.left + config.padding.left;
  var contentStartY = groupBounds.top + config.padding.top;
  
  // Calculate positions for each normal layer
  var positions = calculatePositions(
    normalLayers,
    normalBounds,
    config,
    contentSize,
    contentStartX,
    contentStartY
  );
  
  for (var k = 0; k < normalLayers.length; k++) {
    layoutChildren.push({
      layer: normalLayers[k],
      bounds: normalBounds[k],
      config: parseLayoutName(normalLayers[k].name),
      computedPosition: positions[k],
      computedSize: null,
    });
  }
  
  // Add content layers with computed size to fill container
  for (var m = 0; m < contentLayers.length; m++) {
    var contentBounds = getLayerBounds(contentLayers[m]);
    layoutChildren.push({
      layer: contentLayers[m],
      bounds: contentBounds,
      config: parseLayoutName(contentLayers[m].name),
      computedPosition: {
        x: groupBounds.left,
        y: groupBounds.top,
      },
      computedSize: {
        width: containerSize.width,
        height: containerSize.height,
      },
    });
  }
  
  return {
    children: layoutChildren,
    contentSize: contentSize,
    containerSize: containerSize,
  };
}

/**
 * Calculate the total content size based on children bounds and layout direction
 */
function calculateContentSize(
  bounds: Bounds[],
  config: LayoutConfig
): { width: number; height: number } {
  if (bounds.length === 0) {
    return { width: 0, height: 0 };
  }
  
  var width = 0;
  var height = 0;
  
  if (config.direction === 'horizontal') {
    // Horizontal: sum widths, max height
    var maxHeight = 0;
    for (var i = 0; i < bounds.length; i++) {
      width += getBoundsWidth(bounds[i]);
      var h = getBoundsHeight(bounds[i]);
      if (h > maxHeight) maxHeight = h;
    }
    // Add gaps
    width += config.gap * (bounds.length - 1);
    height = maxHeight;
  } else if (config.direction === 'vertical') {
    // Vertical: max width, sum heights
    var maxWidth = 0;
    for (var j = 0; j < bounds.length; j++) {
      height += getBoundsHeight(bounds[j]);
      var w = getBoundsWidth(bounds[j]);
      if (w > maxWidth) maxWidth = w;
    }
    // Add gaps
    height += config.gap * (bounds.length - 1);
    width = maxWidth;
  } else {
    // No direction specified, just use union bounds
    for (var k = 0; k < bounds.length; k++) {
      var bw = getBoundsWidth(bounds[k]);
      var bh = getBoundsHeight(bounds[k]);
      if (bw > width) width = bw;
      if (bh > height) height = bh;
    }
  }
  
  return { width: width, height: height };
}

/**
 * Calculate positions for each child based on layout config
 */
function calculatePositions(
  layers: any[],
  bounds: Bounds[],
  config: LayoutConfig,
  contentSize: { width: number; height: number },
  startX: number,
  startY: number
): ComputedPosition[] {
  var positions: ComputedPosition[] = [];
  
  if (layers.length === 0) {
    return positions;
  }
  
  // Calculate main axis starting position based on justify
  var mainAxisOffset = calculateJustifyOffset(
    bounds,
    config,
    contentSize
  );
  
  var currentX = startX + mainAxisOffset;
  var currentY = startY + (config.direction === 'vertical' ? mainAxisOffset : 0);
  
  if (config.direction === 'horizontal') {
    currentX = startX + mainAxisOffset;
  }
  
  for (var i = 0; i < layers.length; i++) {
    var b = bounds[i];
    var childWidth = getBoundsWidth(b);
    var childHeight = getBoundsHeight(b);
    
    var pos: ComputedPosition;
    
    if (config.direction === 'horizontal') {
      // Cross-axis (Y) alignment
      var yOffset = calculateCrossAxisOffset(
        childHeight,
        contentSize.height,
        config.items
      );
      
      pos = {
        x: currentX,
        y: startY + yOffset,
      };
      
      currentX += childWidth + config.gap;
    } else if (config.direction === 'vertical') {
      // Cross-axis (X) alignment
      var xOffset = calculateCrossAxisOffset(
        childWidth,
        contentSize.width,
        config.items
      );
      
      pos = {
        x: startX + xOffset,
        y: currentY,
      };
      
      currentY += childHeight + config.gap;
    } else {
      // No direction, just center or align based on items
      var xOff = calculateCrossAxisOffset(
        childWidth,
        contentSize.width,
        config.items
      );
      var yOff = calculateCrossAxisOffset(
        childHeight,
        contentSize.height,
        config.items
      );
      
      pos = {
        x: startX + xOff,
        y: startY + yOff,
      };
    }
    
    positions.push(pos);
  }
  
  return positions;
}

/**
 * Calculate cross-axis offset based on alignment
 */
function calculateCrossAxisOffset(
  childSize: number,
  containerSize: number,
  alignment: string
): number {
  if (alignment === 'center') {
    return (containerSize - childSize) / 2;
  } else if (alignment === 'end') {
    return containerSize - childSize;
  }
  // 'start' or default
  return 0;
}

/**
 * Calculate main-axis offset based on justify
 */
function calculateJustifyOffset(
  bounds: Bounds[],
  config: LayoutConfig,
  contentSize: { width: number; height: number }
): number {
  // For justify-between, we need to recalculate gaps
  // This returns the starting offset for justify-start, center, end
  
  if (config.justify === 'center') {
    // This would be handled if container is larger than content
    // For now, content auto-sizes to fit, so offset is 0
    return 0;
  } else if (config.justify === 'end') {
    return 0;
  }
  
  // 'start' or 'between' - start from beginning
  return 0;
}

/**
 * Calculate gaps for justify-between
 */
export function calculateJustifyBetweenGap(
  childCount: number,
  totalChildSize: number,
  availableSpace: number
): number {
  if (childCount <= 1) return 0;
  var remainingSpace = availableSpace - totalChildSize;
  return remainingSpace / (childCount - 1);
}

