import React, {useLayoutEffect, useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {Environment, Lightformer, PerspectiveCamera} from '@react-three/drei';
import * as THREE from 'three';
import {continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {F} from '../fonts';

// Generic, unbranded phone. Units ≈ centimetres.
const W = 7.4;
const H = 15.4;
const D = 0.62;
const R = 1.15;
const BEVEL = 0.16;

const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

/** Flat rounded-rect geometry with 0..1 UVs (ShapeGeometry uses raw coordinates). */
const panel = (w: number, h: number, r: number) => {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 24);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  return g;
};

export type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const SCREEN_W = W - 0.5;
const SCREEN_H = H - 0.5;
const TEX_W = 720;
const TEX_H = Math.round((TEX_W * SCREEN_H) / SCREEN_W);

const Screen: React.FC<{paint?: Painter}> = ({paint}) => {
  const frame = useCurrentFrame();
  const {canvas, texture} = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = TEX_W;
    c.height = TEX_H;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return {canvas: c, texture: t};
  }, []);
  useLayoutEffect(() => {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    if (paint) paint(ctx, TEX_W, TEX_H);
    texture.needsUpdate = true;
  }, [frame, paint, canvas, texture]);
  const geo = useMemo(() => panel(SCREEN_W, SCREEN_H, R - 0.25), []);
  return (
    <mesh geometry={geo} position={[0, 0, D / 2 + BEVEL + 0.004]}>
      <meshPhysicalMaterial color="#000" roughness={0.06} clearcoat={1} emissive="#fff" emissiveMap={texture} emissiveIntensity={paint ? 1 : 0} />
    </mesh>
  );
};

const Lens: React.FC<{x: number; y: number}> = ({x, y}) => (
  <group position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
    {/* metal ring */}
    <mesh position={[0, 0.13, 0]}>
      <cylinderGeometry args={[0.8, 0.84, 0.26, 64]} />
      <meshPhysicalMaterial color="#c9ccd3" metalness={1} roughness={0.16} />
    </mesh>
    {/* dark glass */}
    <mesh position={[0, 0.27, 0]}>
      <cylinderGeometry args={[0.66, 0.66, 0.03, 64]} />
      <meshPhysicalMaterial color="#020306" roughness={0.02} clearcoat={1} clearcoatRoughness={0} metalness={0.4} />
    </mesh>
    {/* inner barrel rings */}
    <mesh position={[0, 0.285, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.46, 0.035, 12, 64]} />
      <meshPhysicalMaterial color="#3a3f4c" metalness={1} roughness={0.3} />
    </mesh>
    {/* coated element */}
    <mesh position={[0, 0.29, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 0.02, 48]} />
      <meshPhysicalMaterial color="#20307a" roughness={0.05} metalness={0.7} clearcoat={1} iridescence={1} iridescenceIOR={1.8} iridescenceThicknessRange={[200, 600]} />
    </mesh>
    <mesh position={[0, 0.3, 0]}>
      <cylinderGeometry args={[0.1, 0.1, 0.02, 32]} />
      <meshPhysicalMaterial color="#000" roughness={0.02} clearcoat={1} />
    </mesh>
  </group>
);

const BackLogo: React.FC = () => {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(200,205,220,0.55)';
    ctx.font = `500 120px "${F.readex}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText('لَمحة', 256, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, -4.2, -(D / 2 + BEVEL + 0.004)]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[2.4, 1.2]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
};

const PhoneModel: React.FC<{paint?: Painter; color: string}> = ({paint, color}) => {
  const body = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedRect(W - 2 * BEVEL, H - 2 * BEVEL, R - BEVEL), {
      depth: D,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 8,
      curveSegments: 24,
    });
    g.translate(0, 0, -D / 2);
    return g;
  }, []);
  const backGlass = useMemo(() => panel(W - 0.3, H - 0.3, R - 0.15), []);
  const island = useMemo(() => panel(3.4, 3.4, 0.9), []);
  const bump = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedRect(3.3, 3.3, 0.85), {depth: 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 5, curveSegments: 20});
    return g;
  }, []);
  const zBack = -(D / 2 + BEVEL);
  return (
    <group>
      <mesh geometry={body}>
        <meshPhysicalMaterial attach="material-0" color="#0c0d10" roughness={0.12} clearcoat={1} />
        <meshPhysicalMaterial attach="material-1" color="#a7abb4" metalness={1} roughness={0.28} />
      </mesh>
      {/* frosted back glass */}
      <mesh geometry={backGlass} position={[0, 0, zBack - 0.003]} rotation={[0, Math.PI, 0]}>
        <meshPhysicalMaterial color={color} roughness={0.42} metalness={0.15} clearcoat={0.6} clearcoatRoughness={0.3} />
      </mesh>
      {/* camera plateau */}
      <group position={[1.75, 5.25, zBack - 0.005]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={bump}>
          <meshPhysicalMaterial color={color} roughness={0.12} metalness={0.2} clearcoat={1} />
        </mesh>
        <mesh geometry={island} position={[0, 0, 0.19]}>
          <meshPhysicalMaterial color={color} roughness={0.08} clearcoat={1} metalness={0.25} />
        </mesh>
        <group position={[0, 0, 0.19]}>
          <Lens x={-0.78} y={0.78} />
          <Lens x={0.78} y={-0.78} />
          <mesh position={[0.82, 0.82, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.04, 32]} />
            <meshStandardMaterial color="#fff6dd" emissive="#ffeebb" emissiveIntensity={0.25} roughness={0.3} />
          </mesh>
        </group>
      </group>
      <BackLogo />
      {/* side buttons */}
      {[
        [W / 2 + 0.03, 3.4, 1.6],
        [-W / 2 - 0.03, 4.6, 0.9],
        [-W / 2 - 0.03, 3.0, 1.4],
        [-W / 2 - 0.03, 1.2, 1.4],
      ].map(([x, y, h], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[0.14, h, 0.42]} />
          <meshPhysicalMaterial color="#a7abb4" metalness={1} roughness={0.25} />
        </mesh>
      ))}
      <Screen paint={paint} />
      {/* dynamic island */}
      <mesh geometry={useMemo(() => panel(2.2, 0.62, 0.31), [])} position={[0, H / 2 - 1.0, D / 2 + BEVEL + 0.008]}>
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
};

export type PhoneProps = {
  width?: number;
  height?: number;
  /** degrees */
  rot?: [number, number, number];
  pos?: [number, number, number];
  scale?: number;
  /** camera distance and look offset (for macro shots) */
  camZ?: number;
  camX?: number;
  camY?: number;
  fov?: number;
  /** 0..1 position of a bright strip light sweeping across the phone */
  sweep?: number;
  /** key light strength 0..1 */
  studio?: number;
  rim?: string;
  color?: string;
  paint?: Painter;
};

const deg = (v: number) => (v * Math.PI) / 180;

const Rig: React.FC<PhoneProps> = ({sweep = -1, studio = 0.6, rim = '#6E8BFF'}) => (
  <>
    <ambientLight intensity={0.25} />
    <directionalLight position={[6, 10, 14]} intensity={1.2 + studio * 1.5} />
    <directionalLight position={[-12, -4, -8]} intensity={1.4} color={rim} />
    <Environment resolution={256} frames={Infinity}>
      <Lightformer form="rect" intensity={1.2 + studio * 2.5} position={[0, 12, 8]} scale={[18, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={2.2} position={[-14, 0, 4]} scale={[3, 22, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.6} position={[14, 2, -2]} scale={[3, 22, 1]} target={[0, 0, 0]} color={rim} />
      <Lightformer form="rect" intensity={0.8} position={[0, -12, 6]} scale={[18, 4, 1]} target={[0, 0, 0]} />
      {sweep > -1 && <Lightformer form="rect" intensity={14} position={[-20 + sweep * 40, 0, 12]} scale={[1.6, 40, 1]} target={[0, 0, 0]} />}
    </Environment>
  </>
);

const CameraSetter: React.FC<{camX: number; camY: number; camZ: number; fov: number}> = ({camX, camY, camZ, fov}) => {
  // looking straight down -z, so offsetting x/y pans the view (macro shots)
  return <PerspectiveCamera makeDefault position={[camX, camY, camZ]} fov={fov} near={0.1} far={500} />;
};

export const Phone3D: React.FC<PhoneProps> = (props) => {
  const {width: vw, height: vh} = useVideoConfig();
  const {width = vw, height = vh, rot = [0, 0, 0], pos = [0, 0, 0], scale = 1, camZ = 46, camX = 0, camY = 0, fov = 28, color = '#353c52', paint} = props;
  return (
    <ThreeCanvas width={width} height={height} gl={{alpha: true, antialias: true, preserveDrawingBuffer: true}} style={{background: 'transparent'}}>
      <CameraSetter camX={camX} camY={camY} camZ={camZ} fov={fov} />
      <Rig {...props} />
      <group position={pos} rotation={[deg(rot[0]), deg(rot[1]), deg(rot[2])]} scale={scale}>
        <PhoneModel paint={paint} color={color} />
      </group>
    </ThreeCanvas>
  );
};

/** Loads pre-rendered illustrations (public/art/*.png) for drawing on the phone screen. */
export const useScreenImages = (names: string[]) => {
  const [handle] = React.useState(() => delayRender('phone screen images'));
  const [imgs, setImgs] = React.useState<Record<string, HTMLImageElement> | null>(null);
  React.useEffect(() => {
    Promise.all(
      names.map(
        (n) =>
          new Promise<[string, HTMLImageElement]>((res, rej) => {
            const im = new Image();
            im.onload = () => res([n, im]);
            im.onerror = rej;
            im.src = staticFile(`art/${n}.png`);
          }),
      ),
    )
      .then((pairs) => {
        setImgs(Object.fromEntries(pairs));
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return imgs;
};

/** Draws an image to fill (cover) the screen, optionally shifted vertically by `dy` screen-heights. */
export const drawCover = (ctx: CanvasRenderingContext2D, im: HTMLImageElement | undefined, w: number, h: number, dy = 0, focusX = 0.52) => {
  if (!im) return;
  const scale = Math.max(w / im.width, h / im.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = Math.min(im.width - sw, Math.max(0, im.width * focusX - sw / 2));
  const sy = (im.height - sh) / 2;
  ctx.drawImage(im, sx, sy, sw, sh, 0, dy * h, w, h);
};
