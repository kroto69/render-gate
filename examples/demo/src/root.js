// Declares the fixed PromoVideo metadata used by deterministic gate checks.
// Dimensions and duration mirror the demo brief exactly.
import React from 'react';
import { Composition } from 'remotion';
import { PromoVideo } from './video.js';

export function RemotionRoot() {
  return React.createElement(Composition, {
    id: 'PromoVideo',
    component: PromoVideo,
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
  });
}
