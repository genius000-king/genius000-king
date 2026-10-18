/** Values computed from state on each render: the selection and the merged diagnostics. */
export function useDerived(wb) {
  const {error, project, selected, sim, wireId} = wb;
  const selectedComponent = project.components.find(c => c.id === selected[0]),
    selectedWire = project.wires.find(w => w.id === wireId),
    live = sim.components[selectedComponent?.id] ?? {};
  const diagnostics = [
    ...(error ? [{level: 'error', message: error.message}] : []),
    ...sim.diagnostics,
    ...sim.warnings.map(message => ({level: 'warning', message})),
  ];
  return {selectedComponent, selectedWire, live, diagnostics};
}
