import React from 'react';
import {Composition} from 'remotion';
import {Euler} from './scenes/01-Euler';
import {Fourier} from './scenes/02-Fourier';
import {Terminal} from './scenes/03-Terminal';
import {Neural} from './scenes/04-Neural';
import {Lorenz} from './scenes/05-Lorenz';
import {Manifesto} from './scenes/06-Manifesto';
import {Pendulums} from './scenes/07-Pendulums';
import {Synthwave} from './scenes/08-Synthwave';
import {Life} from './scenes/09-Life';
import {Golden} from './scenes/10-Golden';

export const SCENES = [
  {id: '01-Euler', component: Euler, seconds: 15},
  {id: '02-Fourier', component: Fourier, seconds: 20},
  {id: '03-Terminal', component: Terminal, seconds: 15},
  {id: '04-Neural', component: Neural, seconds: 12},
  {id: '05-Lorenz', component: Lorenz, seconds: 15},
  {id: '06-Manifesto', component: Manifesto, seconds: 10},
  {id: '07-Pendulums', component: Pendulums, seconds: 20},
  {id: '08-Synthwave', component: Synthwave, seconds: 12},
  {id: '09-Life', component: Life, seconds: 15},
  {id: '10-Golden', component: Golden, seconds: 15},
];

export const Root: React.FC = () => (
  <>
    {SCENES.map((s) => (
      <Composition
        key={s.id}
        id={s.id}
        component={s.component}
        // +1 so the pendulum wave lands exactly on t = 20.00 s
        durationInFrames={s.seconds * 30 + (s.id === '07-Pendulums' ? 1 : 0)}
        fps={30}
        width={1920}
        height={1080}
      />
    ))}
  </>
);
