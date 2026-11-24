// Draws the promo headline, logo, and caption in one portrait composition.
// Break/fix scripts alter only assets and copy so the defect stays reproducible.
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

export function PromoVideo() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  return React.createElement(AbsoluteFill, {
    style: { backgroundColor: '#101827', color: 'white', fontFamily: 'Arial, sans-serif', justifyContent: 'center', alignItems: 'center' },
  },
  React.createElement('div', { style: { opacity, fontSize: 92, fontWeight: 700, textAlign: 'center', padding: 80, marginBottom: 80 } }, 'Make your next idea visible'),
  React.createElement(Img, { src: staticFile('brand/absent-logo.png'), style: { width: 300, height: 300, objectFit: 'contain' } }),
  React.createElement('div', { style: { position: 'absolute', bottom: 100, left: 60, right: 60, fontSize: 40, lineHeight: 1.2, textAlign: 'center' } },
    'The longest demo caption extends past the edges of this portrait video frame, making the complete message impossible to read at once.'));
}
