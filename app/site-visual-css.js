function buildSiteVisualCss(config) {
  const visual = config.visual || {};
  const radius = Number.isFinite(Number(visual.radius)) ? Number(visual.radius) : 18;
  const opacity = (Number.isFinite(Number(visual.opacity)) ? Number(visual.opacity) : 96) / 100;
  const blur = Number.isFinite(Number(visual.blur)) ? Math.max(0, Math.min(14, Number(visual.blur))) : 0;
  const scale = Number.isFinite(Number(visual.scale)) ? Number(visual.scale) : 100;
  const density = (Number.isFinite(Number(visual.density)) ? Number(visual.density) : 100) / 100;
  const glow = (Number.isFinite(Number(visual.accentGlow)) ? Number(visual.accentGlow) : 55) / 100;
  const animations = ['off', 'smooth', 'cinematic'].includes(visual.animations) ? visual.animations : 'smooth';
  const transition = animations === 'cinematic'
    ? '620ms cubic-bezier(.16,1,.3,1)'
    : animations === 'smooth' ? '360ms cubic-bezier(.22,1,.36,1)' : '0ms';
  return `:root{--animeon-radius:${radius}px;--animeon-alpha:${opacity};--animeon-blur:${blur}px;--animeon-density:${density};--animeon-transition:${transition};--animeon-glow:${glow};--animeon-scale:${scale / 100}}html{scroll-behavior:${config.smoothSite !== false ? 'smooth' : 'auto'}!important;scroll-padding-top:12px}*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}`;
}

module.exports = { buildSiteVisualCss };
