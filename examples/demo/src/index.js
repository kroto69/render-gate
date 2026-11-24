// Registers the demo composition for Remotion Studio and renders.
// Keeping registration explicit makes its id match render-gate config.
import { registerRoot } from 'remotion';
import { RemotionRoot } from './root.js';

registerRoot(RemotionRoot);
