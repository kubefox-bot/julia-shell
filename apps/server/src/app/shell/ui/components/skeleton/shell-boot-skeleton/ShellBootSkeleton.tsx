import { useMemo } from 'react';
import { useShellRegistry } from '@app/shell/lib/registry';
import { buildShellSkeletonLayout } from '@app/shell/model/skeleton';
import { useShellStore } from '@app/shell/model/store';
import type { ShellSettingsResponse } from '@app/shell/model/types';
import { ShellSilhouetteGrid } from '../shell-silhouette-grid';

type ShellBootSkeletonProps = {
  animate: boolean;
  initialShellSettings?: ShellSettingsResponse;
};

export function ShellBootSkeleton({ animate, initialShellSettings }: ShellBootSkeletonProps) {
  const storeLayout = useShellStore((state) => state.layout);
  const storeModules = useShellStore((state) => state.modules);
  const storeLayoutSettings = useShellStore((state) => state.layoutSettings);
  const { clientModules } = useShellRegistry();

  const layout = storeLayout.length > 0 ? storeLayout : (initialShellSettings?.layout ?? []);
  const modules = storeModules.length > 0 ? storeModules : (initialShellSettings?.modules ?? []);
  const layoutSettings =
    storeModules.length > 0 || storeLayout.length > 0
      ? storeLayoutSettings
      : (initialShellSettings?.layoutSettings ?? storeLayoutSettings);

  const items = useMemo(
    () => buildShellSkeletonLayout(layout, modules, clientModules),
    [clientModules, layout, modules]
  );

  return <ShellSilhouetteGrid items={items} layoutSettings={layoutSettings} animate={animate} />;
}
