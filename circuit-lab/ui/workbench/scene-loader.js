// The 3D engine (three.js and the scene) is the largest chunk. It is requested once, as early as possible,
// and shared by everyone who needs it.
let pending;
export const preloadScene = () => (pending ??= import('../../engines/render/scene.js'));
