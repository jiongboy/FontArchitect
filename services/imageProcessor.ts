import { Glyph } from '../types';

// Helper to determine if a pixel is "content" (not background)
// Assumes top-left pixel is the background color.
function isContentPixel(
  data: Uint8ClampedArray,
  idx: number,
  bgR: number,
  bgG: number,
  bgB: number,
  bgA: number,
  tolerance: number = 20
): boolean {
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  const a = data[idx + 3];

  if (bgA === 0) {
    // If background is transparent, content is anything with alpha > tolerance
    return a > tolerance;
  }

  // If background is solid, check color distance
  const dist = Math.sqrt(
    Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
  );
  return dist > tolerance;
}

export const detectGlyphs = (
  image: HTMLImageElement,
  canvas: HTMLCanvasElement
): Glyph[] => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const width = image.width;
  const height = image.height;
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Sample background color from top-left
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];
  const bgA = data[3];

  const visited = new Uint8Array(width * height);
  let rawGlyphs: Glyph[] = [];
  let glyphIdCounter = 0;

  // 1. Connected Component Labeling (BFS approach)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const pixelIndex = y * width + x;

      if (visited[pixelIndex]) continue;

      if (isContentPixel(data, idx, bgR, bgG, bgB, bgA)) {
        // Start a new blob
        let minX = x, maxX = x;
        let minY = y, maxY = y;
        
        const queue = [pixelIndex];
        visited[pixelIndex] = 1;

        while (queue.length > 0) {
          const curr = queue.shift()!;
          const cy = Math.floor(curr / width);
          const cx = curr % width;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // Check neighbors (4-connectivity)
          const neighbors = [
            { nx: cx + 1, ny: cy },
            { nx: cx - 1, ny: cy },
            { nx: cx, ny: cy + 1 },
            { nx: cx, ny: cy - 1 },
          ];

          for (const { nx, ny } of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!visited[nIdx]) {
                const dataIdx = nIdx * 4;
                if (isContentPixel(data, dataIdx, bgR, bgG, bgB, bgA)) {
                  visited[nIdx] = 1;
                  queue.push(nIdx);
                }
              }
            }
          }
        }

        // Found a blob
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;

        // Relaxed filter to allow narrow chars like 'i', '!', '.'
        if (w > 0 && h > 0) {
          rawGlyphs.push({
            id: glyphIdCounter++,
            char: '',
            x: minX,
            y: minY,
            width: w,
            height: h,
            xoffset: 0,
            yoffset: 0,
            xadvance: w + 1,
          });
        }
      }
    }
  }

  // 2. Merge Vertical Components (i, !, :, ;, =, ?)
  // Iterate and merge blobs that are vertically aligned and close
  let mergedOccurred = true;
  while (mergedOccurred) {
      mergedOccurred = false;
      // Sort by Y to process top-down
      rawGlyphs.sort((a, b) => a.y - b.y);

      for (let i = 0; i < rawGlyphs.length; i++) {
          for (let j = 0; j < rawGlyphs.length; j++) {
              if (i === j) continue;
              const g1 = rawGlyphs[i];
              const g2 = rawGlyphs[j];

              // Check horizontal overlap
              const x1 = Math.max(g1.x, g2.x);
              const x2 = Math.min(g1.x + g1.width, g2.x + g2.width);
              const overlapX = x2 - x1;
              const minW = Math.min(g1.width, g2.width);

              // Significant horizontal overlap (relative to the smaller part)
              // or contained within. 
              // Relaxed: if overlap > 0 it counts, as long as they are close vertically
              const isHorizAligned = overlapX > 0;

              if (isHorizAligned) {
                  // Check vertical distance
                  // g1 is above g2 (since sorted by Y, usually i < j implies g1.y <= g2.y)
                  const bottom1 = g1.y + g1.height;
                  const top2 = g2.y;
                  const distY = top2 - bottom1;

                  // Dynamic Distance threshold: 
                  // Allow a gap relative to the size of the character parts.
                  // For a giant '!' the dot might be 20px away.
                  const maxDim = Math.max(g1.height, g2.height);
                  const allowedGap = Math.max(5, maxDim * 0.5); // Allow gap up to 50% of height

                  // Check if they are close enough (or even slightly overlapping vertically)
                  if (distY >= -5 && distY < allowedGap) {
                      // MERGE g2 into g1
                      const newX = Math.min(g1.x, g2.x);
                      const newY = Math.min(g1.y, g2.y);
                      const newMaxX = Math.max(g1.x + g1.width, g2.x + g2.width);
                      const newMaxY = Math.max(g1.y + g1.height, g2.y + g2.height);
                      
                      g1.x = newX;
                      g1.y = newY;
                      g1.width = newMaxX - newX;
                      g1.height = newMaxY - newY;
                      g1.xadvance = g1.width + 1;
                      
                      // Remove g2
                      rawGlyphs.splice(j, 1);
                      mergedOccurred = true;
                      break; // Restart loop to be safe
                  }
              }
          }
          if (mergedOccurred) break;
      }
  }

  // 3. Initial Sort by Y then X to roughly order them
  rawGlyphs.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 20) {
        return a.y - b.y;
    }
    return a.x - b.x;
  });

  // 4. Group into Rows to calculate yoffset correctly
  const rows: Glyph[][] = [];
  if (rawGlyphs.length > 0) {
      let currentRow: Glyph[] = [rawGlyphs[0]];
      let currentRowY = rawGlyphs[0].y;
      let currentRowH = rawGlyphs[0].height;

      for (let i = 1; i < rawGlyphs.length; i++) {
          const g = rawGlyphs[i];
          const centerG = g.y + g.height / 2;
          const centerRow = currentRowY + currentRowH / 2;
          
          if (Math.abs(centerG - centerRow) < (Math.max(g.height, currentRowH) / 1.5)) {
               currentRow.push(g);
               currentRowY = Math.min(currentRowY, g.y);
               currentRowH = Math.max(currentRowH, g.height + (g.y - currentRowY));
          } else {
               rows.push(currentRow);
               currentRow = [g];
               currentRowY = g.y;
               currentRowH = g.height;
          }
      }
      rows.push(currentRow);
  }

  // 5. Process each row to set xoffset/yoffset
  const finalGlyphs: Glyph[] = [];
  rows.forEach(row => {
      const rowMinY = Math.min(...row.map(g => g.y));
      row.sort((a, b) => a.x - b.x);
      row.forEach(g => {
          g.yoffset = g.y - rowMinY;
          finalGlyphs.push(g);
      });
  });

  return finalGlyphs;
};

export const extractGlyphImages = async (
  imageSrc: string, 
  glyphs: Glyph[]
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject("Could not get context");
        return;
      }

      const base64List: string[] = [];

      glyphs.forEach(g => {
        const padding = 2;
        canvas.width = g.width + padding * 2;
        canvas.height = g.height + padding * 2;
        
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(
          img,
          g.x, g.y, g.width, g.height,
          padding, padding, g.width, g.height
        );
        
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        base64List.push(base64);
      });

      resolve(base64List);
    };
    img.onerror = reject;
  });
};