import { copy } from '@eigenspace/helper-scripts';

const target = 'dist';
copy(['package.json', 'yarn.lock'], target);
