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

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
    if (zoom <= 0.75) {
      setPanPosition({ x: 0, y: 0 });
    }
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

  const applyCrop = () => {
    console.log('Crop area:', cropArea);
    setIsCropMode(false);
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
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
                disabled={zoom <= 0.5}
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
                disabled={zoom >= 3}
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
                src={imageUrl} 
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
