
export const messages = {

  'panel.scene': { zh: '场景', en: 'Scene' },
  'panel.parameters': { zh: '参数', en: 'Parameters' },
  'panel.debug': { zh: '调试', en: 'Debug' },
  'panel.camera': { zh: '机位', en: 'Camera' },
  'panel.status': { zh: '状态', en: 'Status' },
  'panel.environment': { zh: '环境信息', en: 'Environment' },

  'ui.loading': { zh: '加载中…（{scene}）', en: 'Loading… ({scene})' },

  'label.scene': { zh: '场景', en: 'Scene' },
  'opt.loading': { zh: '（加载中…）', en: ' (loading…)' },
  'opt.onDemand': { zh: '（按需加载）', en: ' (on demand)' },

  'label.spp': { zh: 'spp', en: 'spp' },
  'label.bvh': { zh: 'BVH', en: 'BVH' },
  'opt.bvh': { zh: 'BVH', en: 'BVH' },
  'opt.linear': { zh: '线性', en: 'Linear' },
  'label.nee': { zh: 'NEE', en: 'NEE' },
  'opt.nee': { zh: 'NEE', en: 'NEE' },
  'opt.random': { zh: '随机', en: 'Random' },
  'section.background': { zh: '背景色', en: 'Background' },
  'section.constants': { zh: '场景常量', en: 'Constants' },
  'label.maxBounces': { zh: 'maxBounces', en: 'maxBounces' },
  'value.readOnly': { zh: '只读', en: 'Read-only' },

  'label.debugMode': { zh: '调试模式', en: 'Debug mode' },
  'debug.rendered': { zh: '正常渲染', en: 'Rendered' },
  'debug.normals': { zh: '法线', en: 'Normals' },
  'debug.albedo': { zh: 'albedo', en: 'Albedo' },
  'debug.hitDistance': { zh: '命中距离', en: 'Hit distance' },
  'debug.escape': { zh: '逃逸', en: 'Escape' },
  'debug.traversalHeatmap': { zh: '遍历步数热力图', en: 'Traversal heatmap' },

  'label.fov': { zh: 'fov', en: 'fov' },
  'btn.outputCamera': { zh: '输出机位', en: 'Log camera' },

  'stat.scene': { zh: '场景', en: 'Scene' },
  'stat.triangles': { zh: '三角形数', en: 'Triangles' },
  'stat.nodes': { zh: '节点数', en: 'Nodes' },
  'stat.maxDepth': { zh: 'maxDepth', en: 'maxDepth' },
  'stat.buildMs': { zh: 'BVH 构建', en: 'BVH build' },
  'stat.samples': { zh: '累积样本数', en: 'Samples' },
  'stat.frameMs': { zh: 'frame ms', en: 'frame ms' },

  'btn.collect': { zh: '采集并复制', en: 'Collect & copy' },
  'btn.recollect': { zh: '重新采集并复制', en: 'Recollect & copy' },
  'hint.copied': { zh: '已复制', en: 'Copied' },
} as const;

export type MessageKey = keyof typeof messages;
