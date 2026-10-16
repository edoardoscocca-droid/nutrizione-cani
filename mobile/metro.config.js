// Il codice condiviso (motore, regole, dati) sta in ../src e ../dati: Metro lo legge da lì,
// ma i pacchetti che importa (react, supabase…) li prende SEMPRE da mobile/node_modules (niente doppie copie).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..');
const sharedDirs = [path.join(sharedRoot, 'src'), path.join(sharedRoot, 'dati')];
const config = getDefaultConfig(projectRoot);
config.watchFolders = sharedDirs;
// il motore di ottimizzazione gira sul server: nell'app non si include mai
const esc = (p) => p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const blocked = ['src/ui/[^/]*\\.tsx', 'src/engine/lp\\.ts', 'src/engine/formulate\\.ts'];
config.resolver.blockList = blocked.map((b) => new RegExp('^' + esc(sharedRoot + '/') + b + '$'));
const isBare = (name) => !name.startsWith('.') && !path.isAbsolute(name);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isBare(moduleName) && sharedDirs.some((d) => context.originModulePath.startsWith(d))) {
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, 'index.js') }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
