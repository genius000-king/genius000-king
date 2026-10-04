import React from 'react';
import {useSec} from '../lib';
import {Concert, Jumper} from './Action';
import {Factory, Gears, MapArt} from './Archive';
import {City} from './City';
import {Desert} from './Desert';
import {Camera, Coffin, FilmStrip, Soup} from './Objects';
import {Person} from './People';

type Opts = {pan?: number; focus?: number};

/** Named illustrations; the names are the "shots" the scenes ask for. */
const ART: Record<string, (t: number, o: Opts) => React.ReactNode> = {
  face: (t) => <Person t={t} />,
  interview: (t) => <Person t={t} variant="speaker" />,
  soup: (t) => <Soup t={t} />,
  'soup-color': (t) => <Soup t={t} bright />,
  coffin: (t) => <Coffin t={t} />,
  camera: (t) => <Camera t={t} />,
  film: (t) => <FilmStrip t={t} />,
  'desert-boy': (t, o) => <Desert t={t} pan={o.pan} focus={o.focus} />,
  'dune-sunset': (t, o) => <Desert t={t} variant="sunset" figure={false} pan={o.pan} />,
  'desert-night': (t, o) => <Desert t={t} variant="night" pan={o.pan} />,
  neon: (t) => <City t={t} />,
  'neon-alley': (t) => <City t={t} variant="alley" />,
  factory: (t) => <Factory t={t} />,
  machine: (t) => <Gears t={t} />,
  pipes: (t) => <Gears t={t} close />,
  map: (t) => <MapArt t={t} />,
  'skate-stairs': (t) => <Jumper t={t} color="yellow" />,
  'skate-smoke': (t) => <Jumper t={t} color="pink" flip />,
  'skate-park': (t) => <Jumper t={t} color="cyan" />,
  'sneakers-jump': (t) => <Jumper t={t} color="purple" flip />,
  'sneakers-splash': (t) => <Jumper t={t} color="orange" />,
  concert: (t) => <Concert t={t} />,
  'concert-blue': (t) => <Concert t={t} cool />,
};

export const ART_NAMES = Object.keys(ART);

/** Renders a named illustration filling its parent (like an <Img objectFit="cover">). */
export const Action: React.FC<{name: string; style?: React.CSSProperties; pan?: number; focus?: number; t?: number}> = ({name, style, pan, focus, t}) => {
  const s = useSec();
  const draw = ART[name];
  if (!draw) throw new Error(`Unknown art: ${name}`);
  return <div style={{width: '100%', height: '100%', overflow: 'hidden', ...style}}>{draw(t ?? s, {pan, focus})}</div>;
};
