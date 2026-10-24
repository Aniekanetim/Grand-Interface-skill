#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), {execFileSync} = require('node:child_process');

const assets = path.resolve(__dirname, '../assets');
const WIDTHS = {outline: .35, edge: .22, detail: .13, texture: .09, axis: .13};
const AXIS_DASH = '6 1 1 1';
const HIDDEN = .5, PIXELS = 2000, MAX_SPACING = 1.5;

function load(configPath) {
  const base = path.dirname(path.resolve(configPath)), config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const context = {console};
  context.self = context;
  vm.createContext(context);
  for (const file of [path.join(assets, 'geometry.js'), path.join(assets, 'projection.js'), ...config.modelScripts.map(f => path.resolve(base, f))]) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
  }
  return {config, models: context.DrawingModels ?? {}};
}

function pathLength(d) {
  let total = 0;
  for (const run of d.split('M').filter(Boolean)) {
    const points = run.split('L').map(p => p.trim().split(/\s+/).map(Number));
    for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

function inkLengths(markup) {
  const lengths = new Map();
  for (const [, item, body] of markup.matchAll(/<g[^>]*data-item="([^"]*)"[^>]*>([\s\S]*?)<\/g>/g)) {
    const total = [...body.matchAll(/ d="([^"]*)"/g)].reduce((sum, [, d]) => sum + pathLength(d), 0);
    lengths.set(item, (lengths.get(item) ?? 0) + total);
  }
  return lengths;
}

function sheet(markup, title, viewBox = '0 0 420 297', size = 'width="420mm" height="297mm"') {
  const styles = Object.entries(WIDTHS).map(([role, w]) => `[data-line-role="${role}"]{stroke-width:${w}}`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="${viewBox}"><title>${title.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</title>`
    + `<style>path{fill:none;stroke:#202020;stroke-linecap:butt;stroke-linejoin:round}${styles}[data-line-role="axis"]{stroke-dasharray:${AXIS_DASH}}</style>`
    + `<rect x="-1000" y="-1000" width="3000" height="3000" fill="#fff"/>${markup}</svg>`;
}

function rasterizer() {
  const has = command => {
    try {
      execFileSync('which', [command], {stdio: 'ignore'});
      return true;
    } catch {
      return false;
    }
  };
  const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium'].find(c => c.startsWith('/') ? fs.existsSync(c) : has(c));
  const named = (name, run) => Object.assign(run, {label: name});
  if (has('rsvg-convert')) return named('rsvg-convert', (svg, png) => execFileSync('rsvg-convert', ['-w', String(PIXELS), '-o', png, svg]));
  if (has('resvg')) return named('resvg', (svg, png) => execFileSync('resvg', ['-w', String(PIXELS), svg, png]));
  if (chrome) return named('Chrome', (svg, png, height) => execFileSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', `--screenshot=${png}`, `--window-size=${PIXELS},${height}`, '--default-background-color=ffffffff', `file://${svg}`], {stdio: 'ignore'}));
  if (has('qlmanage')) {
    return named('Quick Look', (svg, png) => {
      execFileSync('qlmanage', ['-t', '-s', String(PIXELS), '-o', path.dirname(png), svg], {stdio: 'ignore'});
      fs.renameSync(path.join(path.dirname(png), path.basename(svg) + '.png'), png);
    });
  }
  return null;
}

function writePng(rasterize, markup, title, file, [x, y, w, h] = [0, 0, 420, 297]) {
  const height = Math.round(PIXELS * h / w), pixels = file.replace(/\.png$/, '.px.svg');
  fs.writeFileSync(pixels, sheet(markup, title, `${x} ${y} ${w} ${h}`, `width="${PIXELS}" height="${height}"`));
  try {
    rasterize(pixels, file, height);
  } finally {
    fs.rmSync(pixels, {force: true});
  }
}

function parameterSets(d, quick, overrides = {}) {
  const params = d.parameters ?? [], sets = new Map(), seen = new Set();
  const add = (label, values) => {
    const key = JSON.stringify(values);
    if (seen.has(key)) return;
    seen.add(key);
    sets.set(label, values);
  };
  for (const key of Object.keys(overrides)) {
    if (!params.some(p => p.key === key)) throw Error(`Unknown parameter ${key}`);
  }
  const defaults = Object.fromEntries(params.map(p => [p.key, overrides[p.key] ?? p.default]));
  add(Object.keys(overrides).length ? 'set' : 'default', defaults);
  if (quick) return sets;
  add('min', Object.fromEntries(params.map(p => [p.key, p.min])));
  add('max', Object.fromEntries(params.map(p => [p.key, p.max])));
  if (params.length > 1) {
    for (const p of params) {
      add(`${p.key}-min`, {...defaults, [p.key]: p.min});
      add(`${p.key}-max`, {...defaults, [p.key]: p.max});
    }
  }
  return sets;
}

function proof(configPath, outDir, {png = true, quick = false, crop = null, only = null, view: viewFilter = null, overrides = {}} = {}) {
  const {config, models} = load(configPath);
  fs.mkdirSync(outDir, {recursive: true});
  const rasterize = png ? rasterizer() : null, files = [], warnings = [];
  const drawings = config.drawings.filter(d => !only || d.id === only);
  if (!drawings.length) throw Error(`No drawing with id ${only}`);
  if (crop && !rasterize) throw Error('Crops need an SVG rasterizer');
  for (const d of drawings) {
    const model = models[d.id];
    if (!model) throw Error(`No model registered for ${d.id}`);
    const brief = quick || crop;
    const views = (brief ? [['assembled', 0], ['exploded', 1]] : [['assembled', 0], ['exploded', 1], ['spread', MAX_SPACING]])
      .filter(([name]) => !viewFilter || name === viewFilter);
    if (!views.length) throw Error('View must be assembled, exploded or spread');
    for (const [label, values] of parameterSets(d, brief, overrides)) {
      for (const [view, explosion] of views) {
        const {markup} = model(values, {explosion, fitExplosion: explosion, isolated: null});
        const name = `${d.id}-${label}-${view}`, title = `${d.title}, ${label} parameters, ${view}`;
        if (crop) {
          const file = path.resolve(outDir, `${name}-crop-${crop.join('-')}.png`);
          writePng(rasterize, markup, title, file, crop);
          files.push(file);
          continue;
        }
        const file = path.resolve(outDir, name + '.svg');
        fs.writeFileSync(file, sheet(markup, title));
        files.push(file);
        if (rasterize) {
          try {
            writePng(rasterize, markup, title, file.replace(/\.svg$/, '.png'));
          } catch (e) {
            warnings.push(`Could not rasterize ${path.basename(file)}: ${e.message}`);
          }
        }
        if (!explosion) continue;
        const ink = inkLengths(markup);
        for (const p of d.parts) {
          if (!ink.get(String(p.id))) warnings.push(`${d.id} ${label} parameters, ${view}: part "${p.id}" has no visible ink`);
        }
      }
    }
    if (brief) continue;
    const defaults = [...parameterSets(d, true, overrides).values()][0];
    const full = model(defaults, {explosion: 1, fitExplosion: 1, isolated: null}), fullInk = inkLengths(full.markup);
    if (!Number.isFinite(full.scale)) {
      warnings.push(`${d.id}: the model returns no scale, so the occlusion check is skipped`);
      continue;
    }
    let lowest = null;
    for (const p of d.parts) {
      const alone = model(defaults, {explosion: 1, fitExplosion: 1, isolated: p.id});
      const ratio = (fullInk.get(String(p.id)) ?? 0) / full.scale / ((inkLengths(alone.markup).get(String(p.id)) ?? 0) / alone.scale || 1);
      if (ratio < HIDDEN) warnings.push(`${d.id} exploded: "${p.id}" shows ${Math.round(ratio * 100)}% of its own linework, so another part hides most of it`);
      if (!lowest || ratio < lowest.ratio) lowest = {id: p.id, ratio};
    }
    if (lowest) console.log(`${d.id} exploded: the most hidden part, "${lowest.id}", shows ${Math.round(lowest.ratio * 100)}% of its own linework`);
  }
  if (rasterize && !crop && files.length > 2) {
    const pngs = files.map(f => f.replace(/\.svg$/, '.png')).filter(f => fs.existsSync(f)), columns = 3, w = 420, h = 297, gap = 8;
    const rows = Math.ceil(pngs.length / columns), width = columns * w + (columns + 1) * gap, height = rows * (h + 14) + (rows + 1) * gap;
    const tiles = pngs.map((f, i) => {
      const x = gap + (i % columns) * (w + gap), y = gap + Math.floor(i / columns) * (h + 14 + gap);
      return `<image href="${path.basename(f)}" x="${x}" y="${y}" width="${w}" height="${h}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ccc"/><text x="${x}" y="${y + h + 11}" font-family="sans-serif" font-size="10">${path.basename(f, '.png')}</text>`;
    }).join('');
    const sheetFile = path.resolve(outDir, 'contact.svg'), sheetHeight = Math.round(PIXELS * height / width);
    fs.writeFileSync(sheetFile, `<svg xmlns="http://www.w3.org/2000/svg" width="${PIXELS}" height="${sheetHeight}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#fff"/>${tiles}</svg>`);
    try {
      rasterize(sheetFile, path.resolve(outDir, 'contact.png'), sheetHeight);
    } catch (e) {
      warnings.push(`Could not rasterize the contact sheet: ${e.message}`);
    }
  }
  if (png && !rasterize) warnings.push('No SVG rasterizer found. Install librsvg for rsvg-convert, or Chrome, then rerun');
  for (const w of warnings) console.warn('WARNING ' + w);
  console.log(`Wrote ${files.length} ${crop ? 'crops' : 'sheets'}${rasterize && !crop ? ` with PNG previews from ${rasterize.label}` : ''} to ${path.resolve(outDir)}`);
  return {files, warnings};
}

if (require.main === module) {
  const args = process.argv.slice(2), flag = name => args.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  const value = name => flag(name)?.split('=')[1];
  const [configPath, outDir] = args.filter(a => !a.startsWith('--'));
  try {
    if (!configPath || !outDir) throw Error('Usage: node proof.cjs drawing.json proof/ [--quick] [--only=id] [--view=assembled|exploded|spread] [--set=key=value,...] [--crop=x,y,width,height] [--no-png]');
    const crop = value('crop')?.split(',').map(Number) ?? null;
    if (crop && (crop.length !== 4 || !crop.every(Number.isFinite) || crop[2] <= 0 || crop[3] <= 0)) throw Error('Crop takes sheet millimeters: --crop=x,y,width,height');
    const set = flag('set')?.slice('--set='.length) ?? '';
    const overrides = Object.fromEntries(set.split(',').filter(Boolean).map(pair => {
      const [key, raw] = pair.split('=');
      if (!Number.isFinite(Number(raw))) throw Error(`--set needs numeric values, as in --set=${key}=10`);
      return [key, Number(raw)];
    }));
    proof(configPath, outDir, {png: !flag('no-png'), quick: Boolean(flag('quick')), crop, only: value('only') ?? null, view: value('view') ?? null, overrides});
  } catch (e) {
    console.error(e.stack);
    process.exitCode = 1;
  }
}
module.exports = proof;
