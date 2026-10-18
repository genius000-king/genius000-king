import {useState, useEffect} from 'react';
import {thumb} from '../../engines/render/thumbs.js';
import ComponentArt from './ComponentArt.jsx';

export function Thumb({type, size = 58}) {
  const [src, setSrc] = useState(() => thumb(type));
  useEffect(() => {
    if (!src) thumb(type, setSrc);
  }, [type]);
  return src ? (
    <img className="part-thumb" src={src} width={size} height={size} alt="" draggable={false} />
  ) : LEGACY_ART.has(type) ? (
    <ComponentArt type={type} size={size * 0.9} />
  ) : (
    <span className="thumb-placeholder" style={{width: size, height: size}} />
  );
}

export const LEGACY_ART = new Set([
  'board',
  'led',
  'resistor',
  'button',
  'pot',
  'mic',
  'buzzer',
  'oled',
  'lcd',
  'ldr',
  'thermistor',
  'switch',
  'sevenseg',
  'battery',
  'breadboard',
]);
