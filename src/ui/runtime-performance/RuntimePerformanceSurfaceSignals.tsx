import { useEffect } from 'react';
import type { RuntimeHeavySurface } from '../../app/developer/runtime-performance/runtimePerformanceEvent';
import { completeHeavySurfaceOpen, recordHeavySurfaceFallback } from '../../app/developer/runtime-performance/runtimePerformanceDebug';

type RuntimePerformanceSurfaceMountedProps = {
  surface: RuntimeHeavySurface;
};

type RuntimePerformanceSurfaceFallbackProps = {
  surface: RuntimeHeavySurface;
  label: string;
};

export function RuntimePerformanceSurfaceMounted({ surface }: RuntimePerformanceSurfaceMountedProps) {
  useEffect(() => {
    completeHeavySurfaceOpen(surface);
  }, [surface]);

  return null;
}

export function RuntimePerformanceSurfaceFallback({
  surface,
  label
}: RuntimePerformanceSurfaceFallbackProps) {
  useEffect(() => {
    recordHeavySurfaceFallback(surface);
  }, [surface]);

  return (
    <div className="runtime-surface-placeholder" aria-hidden="true">
      <span>{label}</span>
    </div>
  );
}
