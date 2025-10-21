// Simple script to create placeholder icons
// Run with: node create-icons.js

const fs = require('fs');

// Minimal PNG file structure (1x1 blue pixel) - we'll create larger ones by scaling
// These are base64 encoded minimal valid PNG files

// Create a simple PNG programmatically
function createPNG(size, color) {
  const Canvas = require('canvas');
  const canvas = Canvas.createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  // Draw a simple tree/hierarchy icon
  ctx.strokeStyle = 'white';
  ctx.fillStyle = 'white';
  ctx.lineWidth = Math.max(2, size / 16);

  const padding = size * 0.2;
  const centerX = size / 2;
  const topY = padding;
  const bottomY = size - padding;
  const nodeSize = size * 0.12;

  // Root node (top)
  ctx.beginPath();
  ctx.arc(centerX, topY + nodeSize, nodeSize, 0, Math.PI * 2);
  ctx.fill();

  // Vertical line from root
  ctx.beginPath();
  ctx.moveTo(centerX, topY + nodeSize * 2);
  ctx.lineTo(centerX, size / 2);
  ctx.stroke();

  // Horizontal line for branches
  const branchY = size / 2;
  const branchSpread = size * 0.25;
  ctx.beginPath();
  ctx.moveTo(centerX - branchSpread, branchY);
  ctx.lineTo(centerX + branchSpread, branchY);
  ctx.stroke();

  // Left child node
  ctx.beginPath();
  ctx.moveTo(centerX - branchSpread, branchY);
  ctx.lineTo(centerX - branchSpread, bottomY - nodeSize);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX - branchSpread, bottomY - nodeSize, nodeSize, 0, Math.PI * 2);
  ctx.fill();

  // Right child node
  ctx.beginPath();
  ctx.moveTo(centerX + branchSpread, branchY);
  ctx.lineTo(centerX + branchSpread, bottomY - nodeSize);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX + branchSpread, bottomY - nodeSize, nodeSize, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

// Try to use canvas package if available, otherwise use base64 placeholders
try {
  require.resolve('canvas');

  const color = '#3498db'; // Blue color

  fs.writeFileSync('icon16.png', createPNG(16, color));
  fs.writeFileSync('icon48.png', createPNG(48, color));
  fs.writeFileSync('icon128.png', createPNG(128, color));

  console.log('Icons created successfully!');
} catch (e) {
  console.log('Canvas package not found. Creating simple placeholder icons...');
  console.log('For better icons, either:');
  console.log('1. Install canvas: npm install canvas');
  console.log('2. Open generate-icons.html in your browser and download the icons');

  // Create minimal valid PNG files as fallback (simple blue squares)
  // These are base64 encoded 16x16, 48x48, and 128x128 blue squares
  const placeholder16 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  fs.writeFileSync('icon16.png', placeholder16);
  fs.writeFileSync('icon48.png', placeholder16);
  fs.writeFileSync('icon128.png', placeholder16);

  console.log('Simple placeholder icons created. Replace with better icons later.');
}
