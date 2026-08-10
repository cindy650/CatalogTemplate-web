import { useCallback, useEffect, useState } from 'react';
import type { ModuleId } from '../modules/types';
import {
  getModuleDefinitionByRoute,
  getModulePath
} from '../modules/moduleRegistry';

function readActiveModuleFromLocation(): ModuleId {
  if (typeof window === 'undefined') return 'shops';
  const routeSource = window.location.hash || window.location.pathname;
  return getModuleDefinitionByRoute(routeSource).id;
}

function currentHashForModule(moduleId: ModuleId): string {
  return `#${getModulePath(moduleId)}`;
}

export function useAppRoute() {
  const [activeModule, setActiveModule] = useState<ModuleId>(readActiveModuleFromLocation);

  useEffect(() => {
    const syncRoute = () => setActiveModule(readActiveModuleFromLocation());
    const activeHash = currentHashForModule(readActiveModuleFromLocation());

    if (window.location.hash !== activeHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${activeHash}`);
    }

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);

    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  const navigateToModule = useCallback((moduleId: ModuleId) => {
    const nextHash = currentHashForModule(moduleId);
    if (window.location.hash === nextHash) {
      setActiveModule(moduleId);
      return;
    }
    window.location.hash = nextHash;
  }, []);

  return { activeModule, navigateToModule };
}
