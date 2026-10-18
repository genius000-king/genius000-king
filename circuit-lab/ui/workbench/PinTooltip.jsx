/** Hover card for a pin or terminal. */
import {useWorkbench} from './context.js';

export default function PinTooltip() {
  const {hover, sim} = useWorkbench();
  return (
    <div
      className="pin-tooltip"
      style={{
        left: Math.min(hover.x + 14, window.innerWidth - 310),
        top: Math.min(hover.y - 45, window.innerHeight - 80),
      }}
    >
      <span>{hover.label}</span>
      <b>{(sim.voltages[hover.node] ?? 0).toFixed(3)} V</b>
    </div>
  );
}
