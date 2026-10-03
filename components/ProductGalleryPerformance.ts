export type GalleryZoomBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type GalleryZoomPoint = {
  clientX: number;
  clientY: number;
};

export type GalleryPointer = {
  pointerType: string;
  isPrimary: boolean;
};

export function canUseGalleryHoverPointer(pointer: GalleryPointer) {
  return pointer.isPrimary && pointer.pointerType !== "touch";
}

export function galleryZoomPercent(bounds: GalleryZoomBounds, point: GalleryZoomPoint) {
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  const x = ((point.clientX - bounds.left) / bounds.width) * 100;
  const y = ((point.clientY - bounds.top) / bounds.height) * 100;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y))
  };
}

export function createAnimationFrameBatcher<T>(options: {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  flush: (value: T) => void;
}) {
  let frame: number | null = null;
  let latest: T | null = null;
  let disposed = false;

  function cancel() {
    latest = null;
    if (frame === null) return;
    options.cancelFrame(frame);
    frame = null;
  }

  return {
    schedule(value: T) {
      if (disposed) return;
      latest = value;
      if (frame !== null) return;

      frame = options.requestFrame(() => {
        frame = null;
        const valueToFlush = latest;
        latest = null;
        if (!disposed && valueToFlush !== null) options.flush(valueToFlush);
      });
    },
    cancel,
    dispose() {
      disposed = true;
      cancel();
    }
  };
}
