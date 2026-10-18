'use client';
// The browser-only entry. The page HTML carries just the splash; the workbench, the 3D engine and the
// simulation worker are separate chunks fetched in parallel as soon as the page starts.
import React from 'react';
import dynamic from 'next/dynamic';
import Splash from './Splash.jsx';
import {preloadScene} from './workbench/scene-loader.js';

if (typeof window !== 'undefined') preloadScene();

const Workbench = dynamic(() => import('./workbench/Workbench.jsx'), {
  ssr: false,
  loading: () => <Splash />,
});

export class Boundary extends React.Component {
  state = {error: null};
  static getDerivedStateFromError(error) {
    return {error};
  }
  render() {
    if (this.state.error)
      return (
        <div className="crash">
          <h1>Circuit Lab needs a restart.</h1>
          <p>Your last autosaved project remains on this device.</p>
          <pre style={{whiteSpace: 'pre-wrap'}}>{this.state.error.message}</pre>
          <button onClick={() => location.reload()}>Reload workspace</button>
        </div>
      );
    return this.props.children;
  }
}

export default function ClientApp() {
  return (
    <Boundary>
      <Workbench />
    </Boundary>
  );
}
