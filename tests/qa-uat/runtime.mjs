import { tmpdir } from 'node:os';
import path from 'node:path';

// Copied data, uploaded models, GLB fixtures and builds of a QA run stay outside the project,
// because no 3D model file may sit in the project folder.
export const runtime = path.join(tmpdir(), 'on-the-book-qa-uat-2026-09-08');
