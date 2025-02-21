/**
 * 2D coordinate spaces and image processing utilities
 * 
 * This module handles coordinate transformations and image processing for the screenshot workflow.
 * 
 * Coordinate Spaces:
 * 1. Canvas Space: Raw coordinates from mouse events in the canvas element
 *    - Used for: Mouse selection, initial interaction
 *    - Properties: startX, startY, width, height (can be negative for drag direction)
 * 
 * 2. Display Space: Coordinates in the screen's logical display space
 *    - Used for: UI elements positioning, bounds calculation
 *    - Properties: x, y, width, height (always positive)
 *    - Transform: Canvas -> Display via canvasToDisplay()
 * 
 * 3. Device Space: Physical pixel coordinates
 *    - Used for: Canvas rendering, actual pixel operations
 *    - Scaled by: window.devicePixelRatio
 *    - Transform: Display -> Device via displayToDevice()
 * 
 * 4. Image Space: Coordinates in the captured image
 *    - Used for: Final image cropping
 *    - Scaled by: imageSize / captureSize ratio
 *    - Transform: Display -> Image via displayToImage()
 * 
 * Screenshot Workflow:
 * 1. User drags to select area -> Canvas Space coordinates
 * 2. Convert to Display Space for UI elements (info panel, toolbar)
 * 3. Convert to Device Space for rendering selection overlay
 * 4. Convert to Image Space for final image cropping
 * 
 * Scale Factors:
 * - devicePixelRatio: Physical pixels per logical pixel
 * - displayScaleFactor: Display scaling (e.g., Retina displays)
 * - imageScale: Ratio between image size and capture size
 */

import { NativeImage } from 'electron'

// Basic types
export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/**
 * Canvas Space rectangle from mouse selection
 * Width and height can be negative depending on drag direction
 */
export interface Rect {
  startX: number
  startY: number
  width: number
  height: number
}

/**
 * Display Space bounds with normalized positive dimensions
 */
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayInfo {
  bounds: Bounds
  scaleFactor: number
}

// Coordinate space transformations
export const coordinates = {
  /**
   * Convert canvas space coordinates to display space
   * 
   * Canvas Space -> Display Space
   * - Normalizes negative width/height from drag direction
   * - Used when converting selection to UI coordinates
   * 
   * @param canvasRect Raw rectangle from canvas selection
   * @returns Normalized bounds in display space
   */
  canvasToDisplay(canvasRect: Rect): Bounds {
    return {
      x: canvasRect.width > 0 ? canvasRect.startX : canvasRect.startX + canvasRect.width,
      y: canvasRect.height > 0 ? canvasRect.startY : canvasRect.startY + canvasRect.height,
      width: Math.abs(canvasRect.width),
      height: Math.abs(canvasRect.height)
    }
  },

  /**
   * Convert display space coordinates to device space
   * 
   * Display Space -> Device Space
   * - Scales coordinates by display scale factor
   * - Used for actual canvas rendering
   * - Ensures pixel-perfect rendering
   * 
   * @param displayBounds Bounds in display space
   * @param scaleFactor Display scale factor (e.g., 2 for Retina)
   * @returns Bounds in device space (physical pixels)
   */
  displayToDevice(displayBounds: Bounds, scaleFactor: number): Bounds {
    return {
      x: Math.round(displayBounds.x * scaleFactor),
      y: Math.round(displayBounds.y * scaleFactor),
      width: Math.round(displayBounds.width * scaleFactor),
      height: Math.round(displayBounds.height * scaleFactor)
    }
  },

  /**
   * Convert display space coordinates to image space
   * 
   * Display Space -> Image Space
   * - Scales coordinates based on image/capture size ratio
   * - Used for final image cropping
   * - Handles high-DPI screenshot scaling
   * 
   * Example:
   * Display: 1000x1000
   * Image: 2000x2000
   * Scale: 2
   * Display coord (100,100) -> Image coord (200,200)
   * 
   * @param displayBounds Bounds in display space
   * @param captureSize Size of the capture area
   * @param imageSize Size of the actual image
   * @returns Bounds in image space
   */
  displayToImage(
    displayBounds: Bounds,
    captureSize: Size,
    imageSize: Size
  ): Bounds {
    const scale = imageSize.width / captureSize.width
    return {
      x: Math.round(displayBounds.x * scale),
      y: Math.round(displayBounds.y * scale),
      width: Math.round(displayBounds.width * scale),
      height: Math.round(displayBounds.height * scale)
    }
  },

  /**
   * Clamp coordinates to ensure they stay within bounds
   * 
   * Used to:
   * - Keep selection within screen bounds
   * - Prevent out-of-bounds coordinates
   * - Ensure valid mouse positions
   */
  clamp(point: Point, bounds: Bounds): Point {
    return {
      x: Math.max(0, Math.min(point.x, bounds.width)),
      y: Math.max(0, Math.min(point.y, bounds.height))
    }
  }
}

// Image processing
export const image = {
  /**
   * Validate image bounds and ensure minimum size requirements
   * 
   * Ensures:
   * 1. Bounds are within image dimensions
   * 2. Selection meets minimum size (default 10px)
   * 3. Coordinates are properly clamped
   * 
   * Used before:
   * - Cropping final image
   * - Sending to OCR
   * - Copying to clipboard
   */
  validateBounds(bounds: Bounds, imageSize: Size, minSize = 10): Bounds {
    return {
      x: Math.max(0, Math.min(bounds.x, imageSize.width - minSize)),
      y: Math.max(0, Math.min(bounds.y, imageSize.height - minSize)),
      width: Math.max(minSize, Math.min(bounds.width, imageSize.width - bounds.x)),
      height: Math.max(minSize, Math.min(bounds.height, imageSize.height - bounds.y))
    }
  },

  /**
   * Crop image using display space coordinates
   * 
   * Process:
   * 1. Convert display coords to image space
   * 2. Validate and clamp bounds
   * 3. Crop image at exact pixel boundaries
   * 
   * Used for:
   * - Final screenshot cropping
   * - OCR region extraction
   * - Clipboard image creation
   */
  cropFromDisplay(
    fullImage: NativeImage,
    displayBounds: Bounds,
    captureSize: Size
  ): NativeImage {
    // Get image dimensions
    const imageSize = fullImage.getSize()

    // Convert display coordinates to image space
    const imageSpaceBounds = coordinates.displayToImage(
      displayBounds,
      captureSize,
      imageSize
    )

    // Validate and clamp bounds
    const validBounds = this.validateBounds(imageSpaceBounds, imageSize)

    // Return cropped image
    return fullImage.crop(validBounds)
  },

  /**
   * Check if image meets minimum size requirements
   * 
   * Used for:
   * - Validating crop regions
   * - Ensuring OCR has sufficient data
   * - Preventing invalid selections
   */
  meetsMinimumSize(image: NativeImage, minSize = 10): boolean {
    const size = image.getSize()
    return size.width >= minSize && size.height >= minSize
  }
}

// Validation utilities
export const validation = {
  /**
   * Check if bounds are valid (positive dimensions and within container)
   * 
   * Used for:
   * - Validating selection bounds
   * - Checking crop regions
   * - Ensuring UI element placement
   */
  isValidBounds(bounds: Bounds, container: Size): boolean {
    return (
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= container.width &&
      bounds.y + bounds.height <= container.height
    )
  },

  /**
   * Check if point is within bounds
   * 
   * Used for:
   * - Hit testing
   * - Mouse interaction checks
   * - UI element placement
   */
  isPointInBounds(point: Point, bounds: Bounds): boolean {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    )
  }
} 