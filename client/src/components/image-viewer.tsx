import { useState, useRef, useEffect, useCallback } from 'react';
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
  const cropOverlayRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const [currentSrc, setCurrentSrc] = useState<string>(imageUrl);

  const ZOOM_STEP = 0.05;
  const MAX_ZOOM = 1.15;
  const MIN_ZOOM = 0.8;

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

  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setIsCropMode(false);
    setPanPosition({ x: 0, y: 0 });
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
  };

  const openCropMode = () => {
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    setIsCropMode(true);
  };

  const closeCropMode = () => {
    setIsCropMode(false);
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    setIsCropping(false);
  };

  // Lock page scroll when crop overlay is open
  useEffect(() => {
    if (isCropMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isCropMode]);

  // Attach non-passive touch listeners to prevent scroll inside the crop overlay
  useEffect(() => {
    if (!isCropMode) return;
    const el = cropOverlayRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove', prevent);
    };
  }, [isCropMode]);

  // Crop drag helpers (relative to the given element ref)
  const getCropCoords = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(clientY - rect.top, rect.height)),
    };
  };

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = cropOverlayRef.current;
    if (!el) return;
    const { x, y } = getCropCoords(e.clientX, e.clientY, el);
    setCropStart({ x, y });
    setIsCropping(true);
    setCropArea({ x, y, width: 0, height: 0 });
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping) return;
    const el = cropOverlayRef.current;
    if (!el) return;
    const { x, y } = getCropCoords(e.clientX, e.clientY, el);
    setCropArea({
      x: Math.min(cropStart.x, x),
      y: Math.min(cropStart.y, y),
      width: Math.abs(x - cropStart.x),
      height: Math.abs(y - cropStart.y),
    });
  };

  const handleCropTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const el = cropOverlayRef.current;
    if (!el) return;
    const { x, y } = getCropCoords(touch.clientX, touch.clientY, el);
    setCropStart({ x, y });
    setIsCropping(true);
    setCropArea({ x, y, width: 0, height: 0 });
  }, []);

  const handleCropTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isCropping || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const el = cropOverlayRef.current;
    if (!el) return;
    const { x, y } = getCropCoords(touch.clientX, touch.clientY, el);
    setCropArea({
      x: Math.min(cropStart.x, x),
      y: Math.min(cropStart.y, y),
      width: Math.abs(x - cropStart.x),
      height: Math.abs(y - cropStart.y),
    });
  }, [isCropping, cropStart]);

  const endCrop = () => setIsCropping(false);

  // Normal viewer pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && zoom > 1) {
      setPanPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && zoom > 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setPanPosition({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
    }
  };

  const applyCrop = async () => {
    if (!cropArea || cropArea.width <= 0 || cropArea.height <= 0) return;

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = src;
      });

    try {
      const imgEl = cropImgRef.current;
      const img = imgEl && imgEl.naturalWidth ? imgEl : await loadImage(currentSrc);

      const overlayEl = cropOverlayRef.current;
      if (!overlayEl) return;
      const overlayRect = overlayEl.getBoundingClientRect();
      const imgRect = cropImgRef.current?.getBoundingClientRect() ?? overlayRect;

      const cropOnImgX = cropArea.x - (imgRect.left - overlayRect.left);
      const cropOnImgY = cropArea.y - (imgRect.top - overlayRect.top);

      const dispX = Math.max(0, cropOnImgX);
      const dispY = Math.max(0, cropOnImgY);
      const dispW = Math.max(0, Math.min(cropArea.width, imgRect.width - dispX));
      const dispH = Math.max(0, Math.min(cropArea.height, imgRect.height - dispY));

      if (dispW <= 0 || dispH <= 0) { closeCropMode(); return; }

      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const rotCanvas = document.createElement('canvas');
      const rotCtx = rotCanvas.getContext('2d')!;
      const r = ((rotation % 360) + 360) % 360;
      if (r === 90 || r === 270) { rotCanvas.width = naturalH; rotCanvas.height = naturalW; }
      else { rotCanvas.width = naturalW; rotCanvas.height = naturalH; }
      rotCtx.save();
      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate((r * Math.PI) / 180);
      rotCtx.drawImage(img, -naturalW / 2, -naturalH / 2);
      rotCtx.restore();

      const displayScale = imgRect.width / rotCanvas.width;
      const cx = Math.max(0, Math.round(dispX / displayScale));
      const cy = Math.max(0, Math.round(dispY / displayScale));
      const cw = Math.max(1, Math.round(dispW / displayScale));
      const ch = Math.max(1, Math.round(dispH / displayScale));

      const outCanvas = document.createElement('canvas');
      outCanvas.width = cw; outCanvas.height = ch;
      outCanvas.getContext('2d')!.drawImage(rotCanvas, cx, cy, cw, ch, 0, 0, cw, ch);

      setCurrentSrc(outCanvas.toDataURL('image/png'));
      closeCropMode();
      setPanPosition({ x: 0, y: 0 });
      setZoom(1);
    } catch (err) {
      console.warn('Crop failed', err);
      closeCropMode();
    }
  };

  return (
    <>
      {/* Full-screen crop overlay */}
      {isCropMode && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          style={{ touchAction: 'none' }}
        >
          {/* Crop header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white flex-shrink-0">
            <button onClick={closeCropMode} className="flex items-center gap-1 text-sm text-gray-300">
              <X className="h-5 w-5" /> Cancel
            </button>
            <span className="text-sm font-medium">
              {cropArea.width > 0
                ? `${Math.round(cropArea.width)} × ${Math.round(cropArea.height)}`
                : 'Draw to select crop area'}
            </span>
            {cropArea.width > 0 && (
              <button
                onClick={applyCrop}
                className="flex items-center gap-1 text-sm text-green-400 font-semibold"
              >
                <Check className="h-5 w-5" /> Apply
              </button>
            )}
            {cropArea.width === 0 && <div className="w-16" />}
          </div>

          {/* Crop canvas area */}
          <div
            ref={cropOverlayRef}
            className="flex-1 relative flex items-center justify-center overflow-hidden"
            style={{ cursor: 'crosshair', touchAction: 'none', userSelect: 'none' }}
            onMouseDown={handleCropMouseDown}
            onMouseMove={handleCropMouseMove}
            onMouseUp={endCrop}
            onMouseLeave={endCrop}
            onTouchStart={handleCropTouchStart}
            onTouchMove={handleCropTouchMove}
            onTouchEnd={endCrop}
          >
            <img
              ref={cropImgRef}
              src={currentSrc}
              alt={alt}
              className="max-w-full max-h-full object-contain pointer-events-none select-none"
              style={{
                transform: `rotate(${rotation}deg)`,
                touchAction: 'none',
              }}
              draggable={false}
            />

            {/* Dimming overlay with crop hole */}
            {cropArea.width > 0 && cropArea.height > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <svg className="absolute inset-0 w-full h-full">
                  <defs>
                    <mask id="crop-mask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect
                        x={cropArea.x}
                        y={cropArea.y}
                        width={cropArea.width}
                        height={cropArea.height}
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#crop-mask)" />
                </svg>
                <div
                  className="absolute border-2 border-white"
                  style={{
                    left: cropArea.x,
                    top: cropArea.y,
                    width: cropArea.width,
                    height: cropArea.height,
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.4)',
                  }}
                >
                  {/* Corner handles */}
                  {[['top-0 left-0', '-translate-x-0.5 -translate-y-0.5'],
                    ['top-0 right-0', 'translate-x-0.5 -translate-y-0.5'],
                    ['bottom-0 left-0', '-translate-x-0.5 translate-y-0.5'],
                    ['bottom-0 right-0', 'translate-x-0.5 translate-y-0.5']].map(([pos, tr], i) => (
                    <div key={i} className={`absolute ${pos} w-4 h-4 border-2 border-white bg-white rounded-sm ${tr}`} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom instruction */}
          <div className="px-4 py-3 bg-gray-900 text-center flex-shrink-0">
            {cropArea.width > 0 ? (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setCropArea({ x: 0, y: 0, width: 0, height: 0 })}
                  className="text-sm text-gray-400"
                >
                  Redraw
                </button>
                <Button
                  onClick={applyCrop}
                  className="bg-green-600 hover:bg-green-700 text-white px-6"
                  size="sm"
                >
                  <Check className="h-4 w-4 mr-1" /> Apply Crop
                </Button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Drag your finger across the image to select the area</p>
            )}
          </div>
        </div>
      )}

      {/* Normal image viewer card */}
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
                  variant="outline"
                  size="sm"
                  onClick={openCropMode}
                  className="h-8 w-8 p-0"
                  data-testid="button-crop"
                >
                  <Crop className="h-4 w-4" />
                </Button>
                {(zoom !== 1 || rotation !== 0) && (
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
              onTouchEnd={() => setIsDragging(false)}
            >
              <div
                className="overflow-hidden max-h-[600px] flex items-center justify-center select-none"
                style={{
                  cursor: (zoom > 1 && isDragging) ? 'grabbing' : zoom > 1 ? 'grab' : 'default'
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
                    touchAction: 'none',
                  }}
                  data-testid="img-receipt-viewer"
                  draggable={false}
                />
              </div>
            </div>

            {zoom > 1 && (
              <p className="text-xs text-gray-500 text-center">
                Drag to pan around the image
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
