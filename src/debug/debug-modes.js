
export const DEBUG_MODES = [
  { value: 0, label: '正常渲染' },
  { value: 1, label: '法线' },
  { value: 2, label: 'albedo' },
  { value: 3, label: '命中距离' },
  { value: 4, label: '逃逸' },
  { value: 5, label: '遍历步数热力图' },
];

export function addDebugInputs(pane, uDebugModeUniform, onChange) {
  const input = pane.addInput(uDebugModeUniform, 'value', {
    options: Object.fromEntries(DEBUG_MODES.map((m) => [m.label, m.value])),
    label: '调试模式',
  });
  if (onChange) input.on('change', onChange);
  return input;
}
