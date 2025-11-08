// Tests for canvas drag-and-drop coordinate conversion
// This test file specifically targets the Bug #1: Canvas drag jump to (0,0)

describe('Canvas Drag-and-Drop Coordinate Conversion', () => {

  describe('Coordinate system conversions', () => {

    // Helper function to simulate the current (buggy) coordinate conversion
    function convertCoordinatesBuggy(clientX, clientY, workspaceRect, scrollLeft, scrollTop, dragOffset, offsetX, offsetY) {
      const newX = clientX - workspaceRect.left + scrollLeft - dragOffset.x;
      const newY = clientY - workspaceRect.top + scrollTop - dragOffset.y;

      const canvasX = newX - offsetX;
      const canvasY = newY - offsetY;

      return { canvasX, canvasY, screenX: newX, screenY: newY };
    }

    // Helper function with the proposed fix (using tracked mouse position)
    function convertCoordinatesFixed(clientX, clientY, lastValidX, lastValidY, workspaceRect, scrollLeft, scrollTop, dragOffset, offsetX, offsetY) {
      // Use tracked position if clientX/clientY are invalid (0,0)
      const safeClientX = (clientX === 0 && clientY === 0) ? lastValidX : clientX;
      const safeClientY = (clientX === 0 && clientY === 0) ? lastValidY : clientY;

      const newX = safeClientX - workspaceRect.left + scrollLeft - dragOffset.x;
      const newY = safeClientY - workspaceRect.top + scrollTop - dragOffset.y;

      const canvasX = newX - offsetX;
      const canvasY = newY - offsetY;

      return { canvasX, canvasY, screenX: newX, screenY: newY };
    }

    test('should handle normal drag with valid clientX/clientY', () => {
      const params = {
        clientX: 300,
        clientY: 200,
        workspaceRect: { left: 100, top: 80 },
        scrollLeft: 50,
        scrollTop: 20,
        dragOffset: { x: 30, y: 25 },
        offsetX: 100,
        offsetY: 80
      };

      const result = convertCoordinatesBuggy(
        params.clientX, params.clientY,
        params.workspaceRect,
        params.scrollLeft, params.scrollTop,
        params.dragOffset,
        params.offsetX, params.offsetY
      );

      // Should produce valid positive coordinates
      expect(result.screenX).toBe(220); // 300 - 100 + 50 - 30
      expect(result.screenY).toBe(115); // 200 - 80 + 20 - 25
      expect(result.canvasX).toBe(120); // 220 - 100
      expect(result.canvasY).toBe(35);  // 115 - 80
    });

    test('BUG: should demonstrate the jump bug when clientX=0, clientY=0', () => {
      const params = {
        clientX: 0,  // INVALID VALUE from dragend event
        clientY: 0,  // INVALID VALUE from dragend event
        workspaceRect: { left: 100, top: 80 },
        scrollLeft: 50,
        scrollTop: 20,
        dragOffset: { x: 30, y: 25 },
        offsetX: 100,
        offsetY: 80
      };

      const result = convertCoordinatesBuggy(
        params.clientX, params.clientY,
        params.workspaceRect,
        params.scrollLeft, params.scrollTop,
        params.dragOffset,
        params.offsetX, params.offsetY
      );

      // This produces NEGATIVE coordinates, causing the jump bug
      expect(result.screenX).toBe(-80);  // 0 - 100 + 50 - 30 = -80
      expect(result.screenY).toBe(-85);  // 0 - 80 + 20 - 25 = -85
      expect(result.canvasX).toBe(-180); // -80 - 100 = -180
      expect(result.canvasY).toBe(-165); // -85 - 80 = -165

      // These negative values cause the "jump to top-left" bug
      expect(result.canvasX).toBeLessThan(0);
      expect(result.canvasY).toBeLessThan(0);
    });

    test('FIX: should use tracked position when clientX=0, clientY=0', () => {
      const params = {
        clientX: 0,  // Invalid from dragend
        clientY: 0,  // Invalid from dragend
        lastValidX: 300,  // Tracked from dragover
        lastValidY: 200,  // Tracked from dragover
        workspaceRect: { left: 100, top: 80 },
        scrollLeft: 50,
        scrollTop: 20,
        dragOffset: { x: 30, y: 25 },
        offsetX: 100,
        offsetY: 80
      };

      const result = convertCoordinatesFixed(
        params.clientX, params.clientY,
        params.lastValidX, params.lastValidY,
        params.workspaceRect,
        params.scrollLeft, params.scrollTop,
        params.dragOffset,
        params.offsetX, params.offsetY
      );

      // Should use the tracked valid position instead
      expect(result.screenX).toBe(220); // Uses lastValidX: 300 - 100 + 50 - 30
      expect(result.screenY).toBe(115); // Uses lastValidY: 200 - 80 + 20 - 25
      expect(result.canvasX).toBe(120);
      expect(result.canvasY).toBe(35);

      // No negative jump!
      expect(result.canvasX).toBeGreaterThan(0);
      expect(result.canvasY).toBeGreaterThan(0);
    });

    test('FIX: should use actual clientX/clientY when they are valid (not 0,0)', () => {
      const params = {
        clientX: 300,
        clientY: 200,
        lastValidX: 500,  // Different tracked value
        lastValidY: 400,  // Different tracked value
        workspaceRect: { left: 100, top: 80 },
        scrollLeft: 50,
        scrollTop: 20,
        dragOffset: { x: 30, y: 25 },
        offsetX: 100,
        offsetY: 80
      };

      const result = convertCoordinatesFixed(
        params.clientX, params.clientY,
        params.lastValidX, params.lastValidY,
        params.workspaceRect,
        params.scrollLeft, params.scrollTop,
        params.dragOffset,
        params.offsetX, params.offsetY
      );

      // Should use actual clientX/clientY, NOT the tracked values
      expect(result.screenX).toBe(220); // Uses clientX: 300 - 100 + 50 - 30
      expect(result.screenY).toBe(115); // Uses clientY: 200 - 80 + 20 - 25
    });

    test('should handle edge case where only clientX is 0 but clientY is valid', () => {
      // Test that we don't trigger fallback unless BOTH are 0
      const params = {
        clientX: 0,
        clientY: 200,  // Valid
        lastValidX: 300,
        lastValidY: 400,
        workspaceRect: { left: 100, top: 80 },
        scrollLeft: 50,
        scrollTop: 20,
        dragOffset: { x: 30, y: 25 },
        offsetX: 100,
        offsetY: 80
      };

      const result = convertCoordinatesFixed(
        params.clientX, params.clientY,
        params.lastValidX, params.lastValidY,
        params.workspaceRect,
        params.scrollLeft, params.scrollTop,
        params.dragOffset,
        params.offsetX, params.offsetY
      );

      // Should use actual clientX/clientY (not fallback) because only one is 0
      expect(result.screenX).toBe(-80); // 0 - 100 + 50 - 30
      expect(result.screenY).toBe(115); // 200 - 80 + 20 - 25
    });
  });

  describe('Grid snapping with coordinate conversion', () => {
    function snapToGrid(value, gridSize = 20) {
      return Math.round(value / gridSize) * gridSize;
    }

    test('should snap converted coordinates to grid when enabled', () => {
      const canvasX = 127;
      const canvasY = 83;
      const gridSize = 20;

      const snappedX = snapToGrid(canvasX, gridSize);
      const snappedY = snapToGrid(canvasY, gridSize);

      expect(snappedX).toBe(120); // Closest grid point to 127
      expect(snappedY).toBe(80);  // Closest grid point to 83
    });

    test('should NOT snap when grid snapping is disabled', () => {
      const canvasX = 127;
      const canvasY = 83;
      const gridSnapEnabled = false;

      const snappedX = gridSnapEnabled ? snapToGrid(canvasX) : canvasX;
      const snappedY = gridSnapEnabled ? snapToGrid(canvasY) : canvasY;

      expect(snappedX).toBe(127); // No snapping
      expect(snappedY).toBe(83);  // No snapping
    });

    test('BUG: current implementation always snaps regardless of gridSnapEnabled', () => {
      // This demonstrates the secondary bug found in the code
      const canvasX = 127;
      const canvasY = 83;
      const gridSnapEnabled = false;

      // Current buggy code always calls snapToGrid
      const buggySnappedX = snapToGrid(canvasX);
      const buggySnappedY = snapToGrid(canvasY);

      expect(buggySnappedX).toBe(120); // Snapped even though disabled
      expect(buggySnappedY).toBe(80);  // Snapped even though disabled

      // Should have been:
      expect(canvasX).toBe(127);
      expect(canvasY).toBe(83);
    });
  });

  describe('Infinite canvas support (negative coordinates)', () => {
    test('should handle negative canvas coordinates correctly', () => {
      const params = {
        clientX: 50,
        clientY: 40,
        workspaceRect: { left: 100, top: 80 },
        scrollLeft: 10,
        scrollTop: 5,
        dragOffset: { x: 30, y: 25 },
        offsetX: 200,  // Large offset to support negative coords
        offsetY: 150
      };

      const newX = params.clientX - params.workspaceRect.left + params.scrollLeft - params.dragOffset.x;
      const newY = params.clientY - params.workspaceRect.top + params.scrollTop - params.dragOffset.y;

      const canvasX = newX - params.offsetX;
      const canvasY = newY - params.offsetY;

      // Calculation: 50 - 100 + 10 - 30 = -70
      expect(newX).toBe(-70);
      // Canvas: -70 - 200 = -270
      expect(canvasX).toBe(-270);

      // Negative coordinates should be valid for infinite canvas
      expect(canvasX).toBeLessThan(0);
      expect(canvasY).toBeLessThan(0);

      // But they should be intentional, not from a bug
    });
  });
});
