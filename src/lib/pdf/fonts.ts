import { Font } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';

let registered = false;

/**
 * Register custom fonts for PDF rendering. Called once per process before any pdf() render.
 *
 * Default: Helvetica (built into @react-pdf/renderer — no download required).
 *
 * To switch to Inter:
 *   1. Place TTF files in public/fonts/:
 *        Inter-Regular.ttf, Inter-SemiBold.ttf, Inter-Bold.ttf
 *   2. Re-run the dev server — ensureFonts() will detect and register them.
 *
 * Font download shortcut:
 *   curl -Lo public/fonts/Inter-Regular.ttf 'https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip'
 *   # unzip and copy the .ttf files
 *
 * Or: pnpm add @fontsource/inter
 *     # then point src to: node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2
 *     # (react-pdf does NOT support woff2; local ttf is required)
 */
export function ensureFonts() {
  if (registered) return;

  const localDir = path.join(process.cwd(), 'public', 'fonts');
  const localRegular  = path.join(localDir, 'Inter-Regular.ttf');
  const localSemiBold = path.join(localDir, 'Inter-SemiBold.ttf');
  const localBold     = path.join(localDir, 'Inter-Bold.ttf');

  if (
    fs.existsSync(localRegular) &&
    fs.existsSync(localSemiBold) &&
    fs.existsSync(localBold)
  ) {
    Font.register({
      family: 'PDFFont',
      fonts: [
        { src: localRegular,  fontWeight: 400 },
        { src: localSemiBold, fontWeight: 600 },
        { src: localBold,     fontWeight: 700 },
      ],
    });
  }
  // If local files are absent, react-pdf falls through to Helvetica
  // (registered in DocumentLayout via fontFamily: 'Helvetica').

  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
