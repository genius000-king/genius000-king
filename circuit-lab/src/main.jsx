import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
class Boundary extends React.Component {state={error:null};static getDerivedStateFromError(error){return {error};}render(){if(this.state.error)return <div style={{fontFamily:'system-ui',padding:48,maxWidth:650,margin:'auto'}}><h1>Circuit Lab needs a restart.</h1><p>Your last autosaved project remains on this device.</p><pre style={{whiteSpace:'pre-wrap'}}>{this.state.error.message}</pre><button onClick={()=>location.reload()}>Reload workspace</button></div>;return this.props.children;}}
createRoot(document.getElementById('root')).render(<Boundary><App/></Boundary>);
