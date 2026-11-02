// App icons, rendered from each app's Icon Composer document with ictool:
// the Default rendition for light pages, Dark for dark ones.
import type { ImageMetadata } from 'astro';
import type { App } from '../../data/projects';
import snaplayouts from './snaplayouts-icon.png';
import snaplayoutsDark from './snaplayouts-icon-dark.png';
import seemantic from './seemantic-icon.png';
import seemanticDark from './seemantic-icon-dark.png';
import monix from './monix-icon.png';
import monixDark from './monix-icon-dark.png';
import quotlas from './quotlas-icon.png';
import quotlasDark from './quotlas-icon-dark.png';

export const appIcons: Record<App['icon'], { light: ImageMetadata; dark: ImageMetadata }> = {
  snaplayouts: { light: snaplayouts, dark: snaplayoutsDark },
  seemantic: { light: seemantic, dark: seemanticDark },
  monix: { light: monix, dark: monixDark },
  quotlas: { light: quotlas, dark: quotlasDark },
};
