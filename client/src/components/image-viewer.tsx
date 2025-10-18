import { useState } from 'react';
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

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setIsCropMode(false);
  };

  const toggleCropMode = () => {
    setIsCropMode(prev => !prev);
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
          <div className="relative rounded-lg overflow-hidden bg-gray-100">
            <div 
              className="overflow-auto max-h-[600px] flex items-center justify-center"
              style={{ 
                cursor: isCropMode ? 'crosshair' : zoom > 1 ? 'move' : 'default'
              }}
            >
              <img 
                src={imageUrl} 
                alt={alt} 
                className="transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  maxWidth: zoom === 1 ? '100%' : 'none',
                  height: 'auto',
                  touchAction: 'pan-y pinch-zoom'
                }}
                data-testid="img-receipt-viewer"
              />
              
              {isCropMode && (
                <div className="absolute inset-0 border-2 border-dashed border-green-500 bg-black bg-opacity-10 pointer-events-none">
                  <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                    Crop Mode - Coming Soon
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          {zoom > 1 && (
            <p className="text-xs text-gray-500 text-center">
              Pinch or scroll to zoom • Drag to pan
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
