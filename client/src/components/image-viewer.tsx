import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCw, Crop, X, Check } from 'lucide-react';

interface ImageViewerProps {
  imageUrl: string;
  alt: string;
}

export default function ImageViewer({ imageUrl, alt }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isCropMode, setIsCropMode] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [currentSrc, setCurrentSrc] = useState<string>(imageUrl);

  // Zoom configuration: smaller step and lower max to reduce perceived zoom
  const ZOOM_STEP = 0.05;    // 5% per click (additive)
  const MAX_ZOOM = 1.15;     // 115%
  const MIN_ZOOM = 0.8;      // 80%

  // Use simple numeric math (avoid unnecessary toFixed/parseFloat) so signs aren't inverted
  const handleZoomIn = () => {
    setZoom(prev => {
      const next = prev + ZOOM_STEP;
      return next > MAX_ZOOM ? MAX_ZOOM : Number(next.toFixed(3));
    });
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = prev - ZOOM_STEP;
      const newZoom = next < MIN_ZOOM ? MIN_ZOOM : Number(next.toFixed(3));
      if (newZoom === MIN_ZOOM) setPanPosition({ x: 0, y: 0 });
      return newZoom;
    });
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setIsCropMode(false);
    setPanPosition({ x: 0, y: 0 });
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
  };

  const toggleCropMode = () => {
    setIsCropMode(prev => !prev);
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
  };

  // Handle mouse down for panning or cropping
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isCropMode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCropStart({ x, y });
        setIsCropping(true);
        setCropArea({ x, y, width: 0, height: 0 });
      }
    } else if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  // Handle mouse move for panning or cropping
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isCropping && isCropMode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCropArea({
          x: Math.min(cropStart.x, x),
          y: Math.min(cropStart.y, y),
          width: Math.abs(x - cropStart.x),
          height: Math.abs(y - cropStart.y)
        });
      }
    } else if (isDragging && zoom > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsCropping(false);
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (isCropMode) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          setCropStart({ x, y });
          setIsCropping(true);
          setCropArea({ x, y, width: 0, height: 0 });
        }
      } else if (zoom > 1) {
        setIsDragging(true);
        setDragStart({ x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (isCropping && isCropMode) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          setCropArea({
            x: Math.min(cropStart.x, x),
            y: Math.min(cropStart.y, y),
            width: Math.abs(x - cropStart.x),
            height: Math.abs(y - cropStart.y)
          });
        }
      } else if (isDragging && zoom > 1) {
        setPanPosition({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y
        });
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsCropping(false);
  };

  const applyCrop = async () => {
    if (!containerRef.current) return;
    if (!cropArea || cropArea.width <= 0 || cropArea.height <= 0) return;

    // Ensure we have an Image object with natural size
    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = src;
      });

    try {
      const imgEl = imgRef.current;
      const img = imgEl && imgEl.naturalWidth ? imgEl : await loadImage(currentSrc);

      const containerRect = containerRef.current.getBoundingClientRect();
      const imgRect = (imgRef.current && imgRef.current.getBoundingClientRect()) || {
        left: containerRect.left,
        top: containerRect.top,
        width: containerRect.width,
        height: containerRect.height,
      };

      // crop area is relative to container; compute crop region relative to displayed image
      const cropOnImgX = cropArea.x - (imgRect.left - containerRect.left);
      const cropOnImgY = cropArea.y - (imgRect.top - containerRect.top);

      // clamp to image display bounds
      const dispX = Math.max(0, cropOnImgX);
      const dispY = Math.max(0, cropOnImgY);
      const dispW = Math.max(0, Math.min(cropArea.width, imgRect.width - dispX));
      const dispH = Math.max(0, Math.min(cropArea.height, imgRect.height - dispY));
      if (dispW <= 0 || dispH <= 0) {
        setIsCropMode(false);
        setCropArea({ x: 0, y: 0, width: 0, height: 0 });
        return;
      }

      // Determine rotated canvas dimensions and draw the original image there (no scaling)
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      let rotCanvas = document.createElement('canvas');
      let rotCtx = rotCanvas.getContext('2d')!;

      const r = ((rotation % 360) + 360) % 360;
      if (r === 90 || r === 270) {
        rotCanvas.width = naturalH;
        rotCanvas.height = naturalW;
      } else {
        rotCanvas.width = naturalW;
        rotCanvas.height = naturalH;
      }

      // Draw rotated image onto rotCanvas
      rotCtx.save();
      // move to center for rotation
      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate((r * Math.PI) / 180);
      // draw with center alignment
      rotCtx.drawImage(img, -naturalW / 2, -naturalH / 2);
      rotCtx.restore();

      // The displayed image rectangle corresponds to rotCanvas scaled by displayScale
      const displayScale = imgRect.width / rotCanvas.width;

      // Convert displayed crop coords to pixels on rotCanvas
      const canvasCropX = Math.max(0, Math.round(dispX / displayScale));
      const canvasCropY = Math.max(0, Math.round(dispY / displayScale));
      const canvasCropW = Math.max(1, Math.round(dispW / displayScale));
      const canvasCropH = Math.max(1, Math.round(dispH / displayScale));

      // Create final canvas for the cropped area
      const outCanvas = document.createElement('canvas');
      outCanvas.width = canvasCropW;
      outCanvas.height = canvasCropH;
      const outCtx = outCanvas.getContext('2d')!;

      outCtx.drawImage(
        rotCanvas,
        canvasCropX,
        canvasCropY,
        canvasCropW,
        canvasCropH,
        0,
        0,
        canvasCropW,
        canvasCropH
      );

      const dataUrl = outCanvas.toDataURL('image/png');

      // Update viewer to show cropped image
      setCurrentSrc(dataUrl);
      setIsCropMode(false);
      setCropArea({ x: 0, y: 0, width: 0, height: 0 });
      setPanPosition({ x: 0, y: 0 });
      setZoom(1);
    } catch (err) {
      console.warn('Crop failed', err);
      setIsCropMode(false);
      setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    }
  };

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="h-8 w-8 p-0"
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium text-gray-600 min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="h-8 w-8 p-0"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotate}
                className="h-8 w-8 p-0"
                data-testid="button-rotate"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                variant={isCropMode ? "default" : "outline"}
                size="sm"
                onClick={toggleCropMode}
                className="h-8 w-8 p-0"
                data-testid="button-crop"
              >
                <Crop className="h-4 w-4" />
              </Button>
              {(zoom !== 1 || rotation !== 0 || isCropMode) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 px-2"
                  data-testid="button-reset"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Image Container */}
          <div 
            ref={containerRef}
            className="relative rounded-lg overflow-hidden bg-gray-100"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className="overflow-hidden max-h-[600px] flex items-center justify-center select-none"
              style={{ 
                cursor: isCropMode ? 'crosshair' : (zoom > 1 && isDragging) ? 'grabbing' : zoom > 1 ? 'grab' : 'default'
              }}
            >
              <img
                ref={imgRef}
                src={currentSrc}
                alt={alt}
                className="transition-transform duration-100 ease-out pointer-events-none"
                style={{
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  maxWidth: zoom === 1 ? '100%' : 'none',
                  height: 'auto',
                  touchAction: 'none'
                }}
                data-testid="img-receipt-viewer"
                draggable={false}
              />
              
              {/* Crop Selection Box */}
              {isCropMode && cropArea.width > 0 && cropArea.height > 0 && (
                <div 
                  className="absolute border-2 border-green-500 bg-green-500 bg-opacity-20 pointer-events-none"
                  style={{
                    left: cropArea.x,
                    top: cropArea.y,
                    width: cropArea.width,
                    height: cropArea.height
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-green-600 text-white text-xs px-2 py-1 rounded">
                    {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
                  </div>
                </div>
              )}
              
              {/* Crop Mode Indicator */}
              {isCropMode && cropArea.width === 0 && (
                <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded pointer-events-none">
                  Click and drag to select area to crop
                </div>
              )}
            </div>
          </div>

          {/* Crop Actions */}
          {isCropMode && cropArea.width > 0 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={applyCrop}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-apply-crop"
              >
                <Check className="h-4 w-4 mr-1" />
                Apply Crop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCropArea({ x: 0, y: 0, width: 0, height: 0 })}
                data-testid="button-cancel-crop"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {/* Instructions */}
          {zoom > 1 && !isCropMode && (
            <p className="text-xs text-gray-500 text-center">
              Drag with mouse or finger to pan around the image
            </p>
          )}
          {isCropMode && (
            <p className="text-xs text-gray-500 text-center">
              Draw a rectangle to select the area you want to crop
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
