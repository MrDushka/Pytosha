// Питоша в SVG — тот же, что на аватарке. mood: 'happy' | 'sad' | 'wow'; cap — шапка выпускника.
(function (root) {
  function pitosha({ mood = 'happy', cap = true, size = 120 } = {}) {
    const body = '#4b8fd6', dark = '#2b5f99', belly = '#FFD43B';
    const path = 'M 150 512 C 255 572, 482 540, 468 438 C 456 350, 215 372, 214 300 C 213 240, 292 232, 352 262';
    const mouth = {
      happy: '<path d="M -30 46 Q 0 74 30 46" fill="none" stroke="#1b1b2f" stroke-width="7" stroke-linecap="round"/>' +
             '<path d="M 0 62 L 0 92 M 0 92 L -10 104 M 0 92 L 10 104" fill="none" stroke="#ff4d6d" stroke-width="7" stroke-linecap="round"/>',
      sad: '<path d="M -26 66 Q 0 46 26 66" fill="none" stroke="#1b1b2f" stroke-width="7" stroke-linecap="round"/>' +
           '<path d="M 70 -10 q 8 18 0 26 q -8 -8 0 -26" fill="#7cc8ff"/>',
      wow: '<ellipse cx="0" cy="56" rx="16" ry="20" fill="#1b1b2f"/><ellipse cx="0" cy="64" rx="9" ry="9" fill="#ff4d6d"/>',
    }[mood];
    const capSvg = cap ? `
      <g transform="translate(0 -96) rotate(-8)">
        <path d="M -58 6 L -58 34 Q 0 58 58 34 L 58 6 Z" fill="#1b1b2f"/>
        <path d="M -118 0 L 0 -46 L 118 0 L 0 46 Z" fill="#26263f" stroke="#3a3a5c" stroke-width="3"/>
        <circle cx="0" cy="0" r="9" fill="#FFD43B"/>
        <path d="M 0 0 Q 70 10 86 60" fill="none" stroke="#FFD43B" stroke-width="6" stroke-linecap="round"/>
        <circle cx="86" cy="66" r="11" fill="#FFD43B"/>
      </g>` : '';
    return `<svg class="pitosha" width="${size}" height="${size}" viewBox="90 60 480 540" xmlns="http://www.w3.org/2000/svg" aria-label="Питоша">
      <path d="${path}" fill="none" stroke="${dark}" stroke-width="92" stroke-linecap="round"/>
      <path d="${path}" fill="none" stroke="${body}" stroke-width="80" stroke-linecap="round"/>
      <path d="${path}" fill="none" stroke="${belly}" stroke-width="26" stroke-linecap="round"/>
      <g transform="translate(392 222)">
        <ellipse cx="0" cy="8" rx="118" ry="104" fill="${dark}"/>
        <ellipse cx="0" cy="0" rx="112" ry="98" fill="${body}"/>
        <ellipse cx="-18" cy="-52" rx="62" ry="26" fill="#fff" opacity=".18"/>
        <ellipse cx="-44" cy="-6" rx="34" ry="38" fill="#fff"/><ellipse cx="44" cy="-6" rx="34" ry="38" fill="#fff"/>
        <circle cx="-38" cy="2" r="19" fill="#1b1b2f"/><circle cx="50" cy="2" r="19" fill="#1b1b2f"/>
        <circle cx="-31" cy="-6" r="7" fill="#fff"/><circle cx="57" cy="-6" r="7" fill="#fff"/>
        <ellipse cx="-80" cy="42" rx="18" ry="11" fill="#ff7aa8" opacity=".75"/><ellipse cx="80" cy="42" rx="18" ry="11" fill="#ff7aa8" opacity=".75"/>
        ${mouth}
        ${capSvg}
      </g>
    </svg>`;
  }
  root.pitosha = pitosha;
})(typeof self !== 'undefined' ? self : this);
