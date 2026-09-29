
export interface DebugMode {
  value: number;
  label: string;
}

export const DEBUG_MODES: DebugMode[] = [
  { value: 0, label: '正常渲染' },
  { value: 1, label: '法线' },
  { value: 2, label: 'albedo' },
  { value: 3, label: '命中距离' },
  { value: 4, label: '逃逸' },
  { value: 5, label: '遍历步数热力图' },
];

export interface PaneLikeInput {
  on(eventName: 'change', handler: (ev: unknown) => void): PaneLikeInput;
}

export interface PaneLike {
  addInput(object: { value: number }, key: 'value', params: { options: Record<string, number>; label?: string }): PaneLikeInput;
}

export function addDebugInputs(pane: PaneLike, uDebugModeUniform: { value: number }, onChange?: (ev: unknown) => void): PaneLikeInput {
  const input = pane.addInput(uDebugModeUniform, 'value', {
    options: Object.fromEntries(DEBUG_MODES.map((m): [string, number] => [m.label, m.value])),
    label: '调试模式',
  });
  if (onChange) input.on('change', onChange);
  return input;
}
