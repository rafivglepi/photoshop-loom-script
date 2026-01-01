/// <reference types="types-for-adobe/Photoshop/2015.5"/>

import { parseLayoutName, isLayoutGroup } from './parser';
import { getAllLayerSets, getLayerBounds, getBoundsWidth, getBoundsHeight } from './measure';
import { calculateLayout } from './layout';
import { applyPositions, applyContentSizes, fitLayerToBounds } from './apply';
import { LayoutConfig, Bounds } from './types';

/**
 * Main entry point - processes all layout groups in the active document
 */
function main(): void {
  // Check if a document is open
  if (app.documents.length === 0) {
    alert('Please open a document first.');
    return;
  }

  var doc = app.activeDocument;
  
  // Set units to pixels for consistency
  var originalRulerUnits = app.preferences.rulerUnits;
  app.preferences.rulerUnits = Units.PIXELS;
  
  // Process layout
  processDocument(doc);
  
  // Restore original units
  app.preferences.rulerUnits = originalRulerUnits;
  
  alert('Auto Layout complete!');
}

/**
 * Process all layout groups in the document
 * Processes from deepest nested groups first (bottom-up)
 */
function processDocument(doc: any): void {
  // Get all layer sets
  var allLayerSets = getAllLayerSets(doc);
  
  // Filter to only layout groups (names starting with .)
  var layoutGroups: any[] = [];
  for (var i = 0; i < allLayerSets.length; i++) {
    if (isLayoutGroup(allLayerSets[i].name)) {
      layoutGroups.push(allLayerSets[i]);
    }
  }
  
  if (layoutGroups.length === 0) {
    alert('No layout groups found.\n\nName groups with layout syntax like:\n.vstack.gap(8).padding(16)\n.hstack.items-center');
    return;
  }
  
  // Sort by depth (deepest first) so children are processed before parents
  layoutGroups.sort(function(a, b) {
    return getDepth(b) - getDepth(a);
  });
  
  // Process each layout group
  for (var j = 0; j < layoutGroups.length; j++) {
    processLayoutGroup(layoutGroups[j]);
  }
}

/**
 * Get the nesting depth of a layer
 */
function getDepth(layer: any): number {
  var depth = 0;
  var current = layer.parent;
  while (current && current.typename !== 'Document') {
    depth++;
    current = current.parent;
  }
  return depth;
}

/**
 * Process a single layout group
 */
function processLayoutGroup(layerSet: any): void {
  var config = parseLayoutName(layerSet.name);
  
  // Skip if no layout direction and no padding (nothing to do)
  if (!config.direction && 
      config.padding.top === 0 && 
      config.padding.right === 0 && 
      config.padding.bottom === 0 && 
      config.padding.left === 0) {
    return;
  }
  
  // Calculate layout
  var result = calculateLayout(layerSet, config);
  
  if (result.children.length === 0) {
    return;
  }
  
  // First, apply sizes to content layers
  applyContentSizes(result.children);
  
  // Then, apply positions to all children
  applyPositions(result.children);
}

// Run the script
main();

