export interface Glyph {
  id: number;
  char: string;
  x: number;
  y: number;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
}

export interface FontSettings {
  face: string;
  size: number;
  bold: boolean;
  italic: boolean;
  lineHeight: number;
  base: number;
  scaleW: number;
  scaleH: number;
  tracking: number; // Extra spacing between characters
}

export interface SelectionState {
  glyphId: number | null;
}

export enum ToolState {
  IDLE,
  PROCESSING_IMAGE,
  IDENTIFYING_CHARS,
}