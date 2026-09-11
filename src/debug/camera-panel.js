
export function addCameraInputs(pane, camera, controls, resetAccumulation) {

  const st = {
    px: camera.position.x,
    py: camera.position.y,
    pz: camera.position.z,
    tx: controls.target.x,
    ty: controls.target.y,
    tz: controls.target.z,
  };

  const syncFromCamera = () => {
    st.px = camera.position.x;
    st.py = camera.position.y;
    st.pz = camera.position.z;
    st.tx = controls.target.x;
    st.ty = controls.target.y;
    st.tz = controls.target.z;
    pane.refresh();
  };

  const applyToCamera = () => {

    if (![st.px, st.py, st.pz, st.tx, st.ty, st.tz].every(Number.isFinite)) return;
    camera.position.set(st.px, st.py, st.pz);
    controls.target.set(st.tx, st.ty, st.tz);
    resetAccumulation();
  };

  const folder = pane.addFolder({ title: '相机机位' });
  const posFolder = folder.addFolder({ title: 'position' });
  for (const [key, label] of [['px', 'x'], ['py', 'y'], ['pz', 'z']]) {

    posFolder.addInput(st, key, { label, step: 0.001 }).on('change', applyToCamera);
  }
  const tgtFolder = folder.addFolder({ title: 'target' });
  for (const [key, label] of [['tx', 'x'], ['ty', 'y'], ['tz', 'z']]) {
    tgtFolder.addInput(st, key, { label, step: 0.001 }).on('change', applyToCamera);
  }
  folder.addButton({ title: '输出机位（控制台）' }).on('click', () => {
    const f = (v) => Number(v.toPrecision(4));
    console.log(`position: [${[f(st.px), f(st.py), f(st.pz)].join(', ')}],`);
    console.log(`target: [${[f(st.tx), f(st.ty), f(st.tz)].join(', ')}],`);
  });

  return { syncFromCamera };
}
