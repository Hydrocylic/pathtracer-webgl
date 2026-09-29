
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PathTracerEngine, UiSnapshot } from '../engine/PathTracerEngine';

let engine: PathTracerEngine | null = null;
let snapshot: UiSnapshot | undefined;
const listeners = new Set<() => void>();

export function bindEngine(e: PathTracerEngine): void {
  engine = e;
  snapshot = e.getUiSnapshot();
  const refresh = () => {
    snapshot = e.getUiSnapshot();
    listeners.forEach((l) => l());
  };
  e.on('scene', refresh);
  e.on('param', refresh);
  e.on('camera', refresh);
  e.on('bundle', refresh);
}

export function getEngine(): PathTracerEngine {
  if (!engine) throw new Error('engine 未绑定——bindEngine 必须先于 React render 调用');
  return engine;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): UiSnapshot {
  if (!snapshot) throw new Error('store 快照未初始化——bindEngine 先于 useUi');
  return snapshot;
}

export function useUi(): UiSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function usePolled<T>(read: (e: PathTracerEngine) => T, intervalMs = 200): T {
  const e = getEngine();
  const [value, setValue] = useState<T>(() => read(e));
  useEffect(() => {
    const id = setInterval(() => setValue(read(e)), intervalMs);
    return () => clearInterval(id);
  }, [e, intervalMs]);
  return value;
}
