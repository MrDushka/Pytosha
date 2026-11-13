// Иконки Питоши — свои SVG вместо эмодзи (одинаково выглядят на любом телефоне).
// I('fire') — иконка; svgify(html) — заменяет знакомые эмодзи в готовой разметке на иконки.
(function (root) {
  const D = 'stroke="#0003" stroke-width="1.2" stroke-linejoin="round"'; // тёмная обводка, как у наклеек
  const P = {
    fire: `<path d="M12 2c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.2 2.6-5.5.2 1.6.9 2.6 1.9 3C11 7.5 11 4.5 12 2z" fill="#ff9600" ${D}/><path d="M12 11.5c.5 1.7 2.8 2.6 2.8 5a2.8 2.8 0 0 1-5.6 0c0-1.5 1.1-2.4 1.8-3 .2.8.6 1.2 1 1.4.1-1.2-.4-2.3 0-3.4z" fill="#ffd900"/>`,
    star: `<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.3l6.6-.8z" fill="#ffc800" ${D}/><path d="M12 5.5l1.8 3.8" stroke="#fff8" stroke-width="1.6" stroke-linecap="round"/>`,
    sparkle: `<path d="M12 2l2 6.5L20.5 10 14 12l-2 6.5L10 12 3.5 10 10 8.5z" fill="#ffc800" ${D}/><path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" fill="#ffe066"/>`,
    gem: `<path d="M6.5 3.5h11L22 9l-10 12L2 9z" fill="#1cb0f6" ${D}/><path d="M2 9h20M8.5 3.5L12 9l3.5-5.5M12 9v12M7 9l5 12 5-12" stroke="#fff6" stroke-width="1" fill="none"/><path d="M6.5 3.5L2 9h6z" fill="#fff5"/>`,
    heart: `<path d="M12 21s-8.5-5.2-8.5-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3.2C20.5 15.8 12 21 12 21z" fill="#ff4b4b" ${D}/><path d="M7 8.2a2.3 2.3 0 0 1 2.6-.9" stroke="#fff9" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
    crown: `<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#ffc800" ${D}/><rect x="5" y="17" width="14" height="2.6" rx="1" fill="#e5a800"/><circle cx="12" cy="13.5" r="1.6" fill="#ff4b4b"/>`,
    hourglass: `<path d="M6 3h12M6 21h12" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round"/><path d="M7 4h10c0 4-3.5 5.5-3.5 8S17 16 17 20H7c0-4 3.5-5.5 3.5-8S7 8 7 4z" fill="#dbeafe" ${D}/><path d="M9 7.5h6c-.7 1.4-3 2.4-3 3.6 0-1.2-2.3-2.2-3-3.6zM8.5 19c.5-1.8 3.5-2.5 3.5-4 0 1.5 3 2.2 3.5 4z" fill="#ffb020"/>`,
    trophy: `<path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#ffc800" ${D}/><path d="M7 5H4a3 3 0 0 0 3 4.5M17 5h3a3 3 0 0 1-3 4.5" stroke="#e5a800" stroke-width="1.8" fill="none"/><path d="M10.5 12.5h3l.6 4h-4.2z" fill="#e5a800"/><rect x="7.5" y="16.5" width="9" height="4" rx="1" fill="#a86b2d"/><path d="M9.5 5v3" stroke="#fff9" stroke-width="1.6" stroke-linecap="round"/>`,
    medal_g: `<path d="M8 2h3l2 6H10zM13 2h3l-2 6h-3z" fill="#1cb0f6"/><circle cx="12" cy="15" r="6.5" fill="#ffc800" ${D}/><path d="M12 11.5l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="#fff8"/>`,
    medal_s: `<path d="M8 2h3l2 6H10zM13 2h3l-2 6h-3z" fill="#ce82ff"/><circle cx="12" cy="15" r="6.5" fill="#c9d3dd" ${D}/><path d="M12 11.5l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="#fff9"/>`,
    medal_b: `<path d="M8 2h3l2 6H10zM13 2h3l-2 6h-3z" fill="#ff4b4b"/><circle cx="12" cy="15" r="6.5" fill="#d58a4a" ${D}/><path d="M12 11.5l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="#fff7"/>`,
    flask: `<path d="M9 2.5h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3" fill="#e8f4ff" stroke="#7c8ea3" stroke-width="1.5" stroke-linejoin="round"/><path d="M7.3 15h9.4l2 3.5a1.2 1.2 0 0 1-1 1.8H6.3a1.2 1.2 0 0 1-1-1.8z" fill="#58cc02"/><circle cx="10.5" cy="17.5" r="1" fill="#fff9"/><circle cx="13.5" cy="16.3" r=".7" fill="#fff9"/>`,
    gift: `<rect x="3" y="9" width="18" height="12" rx="2" fill="#ff4b4b" ${D}/><rect x="2" y="6.5" width="20" height="4.5" rx="1.5" fill="#ff6b6b" ${D}/><rect x="10.5" y="6.5" width="3" height="14.5" fill="#ffc800"/><path d="M12 6.5C10 3 6.5 3.5 7.3 5.6 8 7 12 6.5 12 6.5zM12 6.5c2-3.5 5.5-3 4.7-.9C16 7 12 6.5 12 6.5z" fill="#ffc800" ${D}/>`,
    ice: `<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z" fill="#9be7ff" ${D}/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5" stroke="#fff" stroke-width="1.2" fill="none" opacity=".8"/><path d="M6 8.5l3 1.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
    lock: `<path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" stroke="#9aa7b5" stroke-width="2.4" fill="none"/><rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="#b8c2cc" ${D}/><circle cx="12" cy="14.8" r="1.7" fill="#6b7785"/><rect x="11.2" y="15.5" width="1.6" height="3" rx=".8" fill="#6b7785"/>`,
    share: `<path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" stroke="#1cb0f6" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5" stroke="#1cb0f6" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    send: `<path d="M2.5 11.5L21 3l-6 18-3.5-7.5z" fill="#1cb0f6" ${D}/><path d="M11.5 13.5L21 3" stroke="#fff8" stroke-width="1.4"/>`,
    x: `<circle cx="12" cy="12" r="9.5" fill="#ff4b4b" ${D}/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`,
    check: `<circle cx="12" cy="12" r="9.5" fill="#58cc02" ${D}/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    tick: `<path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    party: `<path d="M3 21l4.5-13 8.5 8.5z" fill="#ffc800" ${D}/><path d="M5.2 14.5l4.3 4.3M6.5 10.8l6.7 6.7" stroke="#ff9600" stroke-width="1.6"/><circle cx="15" cy="5" r="1.4" fill="#ff4b4b"/><circle cx="19.5" cy="9" r="1.2" fill="#1cb0f6"/><circle cx="20" cy="3.5" r="1" fill="#58cc02"/><path d="M12 7.5c0-2 1.5-3 3-4M16.5 12c2-.3 3.2.8 4.5 2" stroke="#ce82ff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    bulb: `<path d="M12 2.5a7 7 0 0 0-4 12.7V18h8v-2.8A7 7 0 0 0 12 2.5z" fill="#ffc800" ${D}/><rect x="8.5" y="18" width="7" height="3.5" rx="1.2" fill="#9aa7b5"/><path d="M9 8.5a3.5 3.5 0 0 1 3-3" stroke="#fff9" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
    chick: `<path d="M4 13a8 8 0 0 0 16 0z" fill="#f3e6d3" ${D}/><path d="M4 13l2.5-2 2.5 2 3-2.5 3 2.5 2.5-2 2.5 2" stroke="#d6c2a3" stroke-width="1.4" fill="none"/><circle cx="12" cy="8" r="5" fill="#ffd900" ${D}/><circle cx="10.3" cy="7.3" r=".9" fill="#333"/><circle cx="13.7" cy="7.3" r=".9" fill="#333"/><path d="M11 9.3h2l-1 1.3z" fill="#ff9600"/>`,
    face_sad: `<circle cx="12" cy="12" r="9.5" fill="#ffc800" ${D}/><circle cx="9" cy="10" r="1.2" fill="#4b3b1f"/><circle cx="15" cy="10" r="1.2" fill="#4b3b1f"/><path d="M8.5 16.5a4.5 4.5 0 0 1 7 0" stroke="#4b3b1f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    face_smile: `<circle cx="12" cy="12" r="9.5" fill="#ffc800" ${D}/><circle cx="9" cy="10" r="1.2" fill="#4b3b1f"/><circle cx="15" cy="10" r="1.2" fill="#4b3b1f"/><path d="M8 14a4.5 4.5 0 0 0 8 0" stroke="#4b3b1f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    question: `<circle cx="12" cy="12" r="9.5" fill="#ce82ff" ${D}/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.8v.6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.3" fill="#fff"/>`,
    flag: `<path d="M5 21V3" stroke="#6b7785" stroke-width="2.2" stroke-linecap="round"/><path d="M5.5 4h13l-2.5 4.5L18.5 13h-13z" fill="#fff" ${D}/><path d="M5.5 4h3.25v3H5.5zM12 4h3.25v3H12zM8.75 7H12v3H8.75zM15.25 7h1.5l-.75 1.5.9 1.5h-1.65zM5.5 10h3.25v3H5.5zM12 10h3.25v3H12z" fill="#333"/>`,
    laptop: `<rect x="4" y="4" width="16" height="11" rx="1.6" fill="#3c4a5c" ${D}/><rect x="5.5" y="5.5" width="13" height="8" rx=".6" fill="#1cb0f6"/><path d="M8 8l2 1.5L8 11M11.5 11h3" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17h20l-1 2.5a1 1 0 0 1-1 .5H4a1 1 0 0 1-1-.5z" fill="#9aa7b5" ${D}/>`,
    code: `<path d="M8.5 6L3 12l5.5 6M15.5 6L21 12l-5.5 6" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 4.5l-3 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
    play: `<circle cx="12" cy="12" r="9.5" fill="#58cc02" ${D}/><path d="M10 7.8l6 4.2-6 4.2z" fill="#fff"/>`,
    save: `<path d="M4 5a1 1 0 0 1 1-1h11.5L20 7.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill="#1cb0f6" ${D}/><rect x="7" y="4" width="8" height="5" rx=".6" fill="#e8f4ff"/><rect x="12" y="5" width="2" height="3" fill="#1cb0f6"/><rect x="6.5" y="12" width="11" height="8" rx=".8" fill="#fff"/><path d="M8.5 14.5h7M8.5 17h5" stroke="#9aa7b5" stroke-width="1.2"/>`,
    pencil: `<path d="M4 20l1-4.5L15.5 5a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19z" fill="#ffc800" ${D}/><path d="M4 20l1-4.5 3.5 3.5z" fill="#f3d9b1"/><path d="M4 20l.4-1.8 1.4 1.4z" fill="#333"/><path d="M14 6.5l3.5 3.5" stroke="#ff4b4b" stroke-width="2.2"/>`,
    sprout: `<path d="M12 21v-9" stroke="#3f8f00" stroke-width="2.2" stroke-linecap="round"/><path d="M12 13C12 8 8.5 5.5 3.5 6c0 4.5 3.5 7.2 8.5 7z" fill="#58cc02" ${D}/><path d="M12 11c0-4 2.8-6.5 8.5-6.5 0 4-3 6.8-8.5 6.5z" fill="#89e219" ${D}/><path d="M7 20.5h10" stroke="#a86b2d" stroke-width="2.4" stroke-linecap="round"/>`,
    rocket: `<path d="M14.5 3.5c3-1 5.5-1 6-.5s.5 3-.5 6l-7 7-5-5z" fill="#e8f4ff" ${D}/><circle cx="15.5" cy="8.5" r="2" fill="#1cb0f6" ${D}/><path d="M8 11L4.5 10.5 7.5 7.5 11 8zM13 16l.5 3.5 3-3L16 13z" fill="#ff4b4b" ${D}/><path d="M7.5 15c-2 .5-3 2.5-3.5 5 2.5-.5 4.5-1.5 5-3.5z" fill="#ff9600"/>`,
    people: `<circle cx="9" cy="8" r="3.6" fill="#1cb0f6" ${D}/><path d="M2.5 20a6.5 6.5 0 0 1 13 0z" fill="#1cb0f6" ${D}/><circle cx="16.5" cy="9" r="3" fill="#ce82ff" ${D}/><path d="M14 20a5.5 5.5 0 0 1 8 0z" fill="#ce82ff" ${D}/>`,
    gear: `<path d="M10.5 2.5h3l.5 2.6 2 .9 2.2-1.5 2.1 2.1-1.5 2.2.9 2 2.6.5v3l-2.6.5-.9 2 1.5 2.2-2.1 2.1-2.2-1.5-2 .9-.5 2.6h-3l-.5-2.6-2-.9-2.2 1.5-2.1-2.1 1.5-2.2-.9-2-2.6-.5v-3l2.6-.5.9-2-1.5-2.2 2.1-2.1 2.2 1.5 2-.9z" fill="#9aa7b5" ${D}/><circle cx="12" cy="12" r="3.2" fill="#e8eef3"/>`,
    book: `<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z" fill="#1cb0f6" ${D}/><path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H19v3H5.5A1.5 1.5 0 0 1 4 19.5z" fill="#e8f4ff" ${D}/><path d="M8 7h7M8 10h5" stroke="#fff9" stroke-width="1.6" stroke-linecap="round"/>`,
    clipboard: `<rect x="4.5" y="4" width="15" height="17.5" rx="2" fill="#d58a4a" ${D}/><rect x="6.5" y="6" width="11" height="13.5" rx="1" fill="#fff"/><rect x="8.5" y="2.5" width="7" height="3.5" rx="1.2" fill="#9aa7b5" ${D}/><path d="M8.5 10h7M8.5 13h7M8.5 16h4" stroke="#9aa7b5" stroke-width="1.4"/>`,
    folder: `<path d="M2.5 6a1.5 1.5 0 0 1 1.5-1.5h5l2 2.5h9a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5z" fill="#ffc800" ${D}/><path d="M2.5 10h19" stroke="#e5a800" stroke-width="1.4"/>`,
    dumbbell: `<rect x="1.5" y="8.5" width="3" height="7" rx="1" fill="#6b7785"/><rect x="4" y="6" width="3.5" height="12" rx="1.2" fill="#1cb0f6" ${D}/><rect x="16.5" y="6" width="3.5" height="12" rx="1.2" fill="#1cb0f6" ${D}/><rect x="19.5" y="8.5" width="3" height="7" rx="1" fill="#6b7785"/><rect x="7.5" y="10.8" width="9" height="2.4" fill="#9aa7b5"/>`,
    palette: `<path d="M12 2.5a9.5 9.5 0 0 0 0 19c1.3 0 2-.8 2-1.8 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6h2.6a4.3 4.3 0 0 0 4.3-4.3C21.5 6.2 17.2 2.5 12 2.5z" fill="#f3e6d3" ${D}/><circle cx="7.5" cy="11" r="1.6" fill="#ff4b4b"/><circle cx="9.5" cy="6.8" r="1.6" fill="#ffc800"/><circle cx="14.5" cy="6.5" r="1.6" fill="#58cc02"/><circle cx="17.8" cy="10" r="1.6" fill="#1cb0f6"/>`,
    wave: `<path d="M2 16c2.5-6 6-9.5 11-9.5 3 0 4.5 2 4 3.5-.8-1-2.3-1-3 0 2 0 3 1.5 2.5 3H22v4H2z" fill="#1cb0f6" ${D}/><path d="M2 18.5c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1" stroke="#fff" stroke-width="1.4" fill="none"/>`,
    moon: `<path d="M20 15.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 11.5z" fill="#ffc800" ${D}/><circle cx="17" cy="5" r="1" fill="#ffe066"/><circle cx="20.5" cy="9" r=".7" fill="#ffe066"/>`,
    tree: `<path d="M12 2l5 6.5h-2.5L19 14h-3l4 5.5H4L8 14H5l4.5-5.5H7z" fill="#58cc02" ${D}/><rect x="10.7" y="19.5" width="2.6" height="3" fill="#a86b2d"/>`,
    sunset: `<path d="M4 16a8 8 0 0 1 16 0z" fill="#ff9600" ${D}/><path d="M12 3v3M4.5 7.5l2 2M19.5 7.5l-2 2" stroke="#ffc800" stroke-width="2" stroke-linecap="round"/><path d="M2 16h20M5 19h14" stroke="#ff4b4b" stroke-width="2" stroke-linecap="round"/>`,
    candy: `<circle cx="12" cy="12" r="5.5" fill="#ff86d0" ${D}/><path d="M8 9l-5-3 .5 5zM16 15l5 3-.5-5z" fill="#ce82ff" ${D}/><path d="M9.5 10.5c1.5-1 3.5-1 5 0M9.5 13.5c1.5 1 3.5 1 5 0" stroke="#fff" stroke-width="1.3" fill="none"/>`,
    camera: `<path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#6b7785" ${D}/><circle cx="12" cy="13" r="4.2" fill="#e8f4ff"/><circle cx="12" cy="13" r="2.4" fill="#1cb0f6"/><circle cx="17.5" cy="9" r=".9" fill="#ffc800"/>`,
    home: `<path d="M3 11L12 3.5 21 11" stroke="#ff4b4b" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 9.5V20h13V9.5L12 4.5z" fill="#ffc800" ${D}/><rect x="10" y="13.5" width="4" height="6.5" rx="1" fill="#a86b2d"/>`,
    target: `<circle cx="12" cy="12" r="9.5" fill="#ff4b4b" ${D}/><circle cx="12" cy="12" r="6.5" fill="#fff"/><circle cx="12" cy="12" r="3.5" fill="#ff4b4b"/><path d="M12 12l8-8M17 4h3v3" stroke="#3c4a5c" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    cart: `<path d="M2.5 3.5h2.5l2.3 11h11l2.2-8H6.2" stroke="#3c4a5c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.6 7.3h13.4l-1.8 6.5H8z" fill="#1cb0f6"/><circle cx="9" cy="19" r="1.8" fill="#3c4a5c"/><circle cx="17" cy="19" r="1.8" fill="#3c4a5c"/>`,
    user: `<circle cx="12" cy="8" r="4.5" fill="#1cb0f6" ${D}/><path d="M3.5 21a8.5 8.5 0 0 1 17 0z" fill="#1cb0f6" ${D}/>`,
    skip: `<path d="M4 5.5l8 6.5-8 6.5zM12 5.5l8 6.5-8 6.5z" fill="currentColor"/><rect x="19.5" y="5.5" width="2.2" height="13" rx="1" fill="currentColor"/>`,
    phone: `<rect x="7" y="2.5" width="10" height="19" rx="2.2" fill="#3c4a5c" ${D}/><rect x="8.5" y="5" width="7" height="12.5" rx=".6" fill="#1cb0f6"/><path d="M3.5 8.5c-1 2-1 5 0 7M20.5 8.5c1 2 1 5 0 7" stroke="#ff9600" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    compass: `<circle cx="12" cy="12" r="9.5" fill="#e8f4ff" stroke="#9aa7b5" stroke-width="1.8"/><path d="M12 4.5l2.5 7.5h-5z" fill="#ff4b4b"/><path d="M12 19.5L9.5 12h5z" fill="#6b7785"/><circle cx="12" cy="12" r="1.4" fill="#fff" stroke="#3c4a5c"/>`,
    signal: `<rect x="3" y="15" width="3.5" height="6" rx="1" fill="#58cc02"/><rect x="8.5" y="11" width="3.5" height="10" rx="1" fill="#58cc02"/><rect x="14" y="7" width="3.5" height="14" rx="1" fill="#58cc02"/><rect x="19.5" y="3" width="2.5" height="18" rx="1" fill="#b8c2cc"/>`,
    warn: `<path d="M12 3l10 17.5H2z" fill="#ffc800" ${D}/><path d="M12 9.5v5" stroke="#4b3b1f" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.3" fill="#4b3b1f"/>`,
    bug: `<ellipse cx="12" cy="14" rx="6" ry="7" fill="#ff4b4b" ${D}/><path d="M12 7v14" stroke="#4b1f1f" stroke-width="1.4"/><circle cx="12" cy="6" r="3" fill="#3c4a5c"/><circle cx="9.5" cy="12" r="1.2" fill="#4b1f1f"/><circle cx="14.5" cy="16" r="1.2" fill="#4b1f1f"/><path d="M6 11l-3-1.5M6 15H2.5M6.5 18.5l-3 2M18 11l3-1.5M18 15h3.5M17.5 18.5l3 2M10.5 3.5L9 1.5M13.5 3.5L15 1.5" stroke="#3c4a5c" stroke-width="1.4" stroke-linecap="round"/>`,
    levelup: `<rect x="3" y="3" width="18" height="18" rx="4" fill="#58cc02" ${D}/><path d="M12 17V7.5M7.5 11.5L12 7l4.5 4.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    calendar: `<rect x="3" y="4.5" width="18" height="16.5" rx="2.5" fill="#fff" ${D}/><path d="M3 7a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 7v2.5H3z" fill="#ff4b4b"/><path d="M8 2.5v4M16 2.5v4" stroke="#6b7785" stroke-width="2" stroke-linecap="round"/><path d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2" stroke="#9aa7b5" stroke-width="2" stroke-linecap="round"/>`,
    grad: `<path d="M12 4L1.5 9 12 14l10.5-5z" fill="#3c4a5c" ${D}/><path d="M6 11.5v4c0 1.5 3 3 6 3s6-1.5 6-3v-4L12 14.5z" fill="#4f5f73"/><path d="M21 9.5v5.5" stroke="#ffc800" stroke-width="1.6"/><circle cx="21" cy="15.5" r="1.3" fill="#ffc800"/>`,
    bolt: `<path d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z" fill="#ffc800" ${D}/>`,
    bank: `<path d="M12 2.5L2.5 7.5h19z" fill="#9aa7b5" ${D}/><path d="M5 9.5v8M9.5 9.5v8M14.5 9.5v8M19 9.5v8" stroke="#b8c2cc" stroke-width="2.6"/><rect x="2.5" y="18" width="19" height="3" rx="1" fill="#9aa7b5" ${D}/>`,
    robot: `<path d="M12 2.5v3" stroke="#6b7785" stroke-width="1.8"/><circle cx="12" cy="2.5" r="1.4" fill="#ff4b4b"/><rect x="4" y="6" width="16" height="13" rx="3.5" fill="#b8c2cc" ${D}/><rect x="6.5" y="9" width="11" height="5.5" rx="2.5" fill="#3c4a5c"/><circle cx="9.5" cy="11.7" r="1.3" fill="#1cb0f6"/><circle cx="14.5" cy="11.7" r="1.3" fill="#1cb0f6"/><path d="M9.5 16.8h5" stroke="#6b7785" stroke-width="1.6" stroke-linecap="round"/>`,
    snake: `<path d="M5 19.5c-2 0-2.5-2.5-.5-3.5 2.5-1.2 7 .8 9-1.5 1.8-2-.7-4.3-3.2-4.3-2.6 0-4-1.7-3-3.7C8.3 4.2 11 3.5 14 4c2.5.4 4 1.8 4 3.2" stroke="#58cc02" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="18" cy="7.3" r="2.8" fill="#58cc02"/><circle cx="18.8" cy="6.6" r=".7" fill="#1a1a1a"/><path d="M20.5 8.3l1.6.6M20.5 8.3l1.3 1.2" stroke="#ff4b4b" stroke-width=".9" stroke-linecap="round"/>`,
    swords: `<path d="M4 3l10 10M20 3L10 13" stroke="#9aa7b5" stroke-width="2.4" stroke-linecap="round"/><path d="M6.5 15.5l-3 3M17.5 15.5l3 3M5 13.5l5 5M19 13.5l-5 5" stroke="#a86b2d" stroke-width="2.4" stroke-linecap="round"/>`,
    clock: `<circle cx="12" cy="13" r="8.5" fill="#fff" stroke="#ff4b4b" stroke-width="2.2"/><path d="M12 8.5V13l3 2" stroke="#3c4a5c" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M9.5 2.5h5" stroke="#ff4b4b" stroke-width="2.2" stroke-linecap="round"/>`,
    // Сундуки: бронзовый, серебряный, золотой и открытый
    chest_b: chest('#c27a3e', '#8a5226', '#e0a36b'),
    chest_s: chest('#a9b7c6', '#6f7f91', '#dbe4ec'),
    chest_g: chest('#ffc800', '#d49a00', '#ffe066'),
    // Редкости сундуков: обычный (дерево), редкий (синий), эпический (фиолетовый), легендарный (золото с блеском)
    chest_c: chest('#b8814d', '#7a4e26', '#d9a777'),
    chest_r: chest('#1cb0f6', '#0b6fa3', '#7fd6ff'),
    chest_e: chest('#a560e8', '#6b2fa8', '#d7a8ff'),
    chest_l: chest('#ffc800', '#d49a00', '#fff3a8') + '<path d="M20 2.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7zM3.5 3l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" fill="#fff7b0"/>',
    chest_open: `<path d="M3 11h18v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z" fill="#ffc800" ${D}/><path d="M4 11L2.5 4.5a1 1 0 0 1 1-1.2h17a1 1 0 0 1 1 1.2L20 11z" fill="#d49a00" ${D}/><path d="M7 11l2-4h6l2 4" fill="#1cb0f6"/><path d="M9 8.5l1.3-1.5h3.4L15 8.5l-3 3.5z" fill="#7fd6ff"/><path d="M3 14h18" stroke="#d49a00" stroke-width="1.6"/><path d="M5 2l.8 1.6M19 2l-.8 1.6M12 .5v2" stroke="#ffe066" stroke-width="1.4" stroke-linecap="round"/>`,
  };
  function chest(main, dark, light) {
    return `<path d="M3 10a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v1H3z" fill="${dark}" ${D}/><rect x="3" y="10" width="18" height="11" rx="1.8" fill="${main}" ${D}/><path d="M3 13.5h18" stroke="${dark}" stroke-width="1.6"/><path d="M7 4.5V21M17 4.5V21" stroke="${light}" stroke-width="1.6" opacity=".9"/><rect x="10" y="11" width="4" height="5" rx="1" fill="#ffd900" stroke="${dark}" stroke-width="1"/><circle cx="12" cy="13.2" r=".8" fill="${dark}"/>`;
  }

  function I(name, cls) {
    const body = P[name];
    if (!body) return '';
    return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  // Эмодзи → иконка. Аватарки учеников сюда не попадают: они выводятся как &#…; и остаются эмодзи.
  const EMOJI = {
    '🔥': 'fire', '⭐': 'star', '🌟': 'star', '✨': 'sparkle', '💎': 'gem', '❤': 'heart', '💛': 'heart', '👑': 'crown',
    '⏳': 'hourglass', '⏱': 'clock', '⏰': 'clock', '🏆': 'trophy', '🥇': 'medal_g', '🥈': 'medal_s', '🥉': 'medal_b', '🏅': 'medal_g',
    '🧪': 'flask', '🎁': 'gift', '🧊': 'ice', '🔒': 'lock', '📤': 'share', '📨': 'send', '❌': 'x', '✅': 'check', '🎉': 'party',
    '💡': 'bulb', '🐣': 'chick', '😔': 'face_sad', '🙈': 'face_sad', '🙂': 'face_smile', '👌': 'face_smile', '🤔': 'question',
    '🤷': 'question', '❓': 'question', '🏁': 'flag', '🏳': 'flag', '⌨': 'laptop', '💻': 'laptop', '🖥': 'laptop', '▶': 'play',
    '💾': 'save', '✍': 'pencil', '✏': 'pencil', '🌱': 'sprout', '🚀': 'rocket', '👥': 'people', '🤝': 'people', '⚙': 'gear',
    '🛠': 'gear', '📚': 'book', '📘': 'book', '📋': 'clipboard', '📂': 'folder', '💪': 'dumbbell', '🎨': 'palette', '🌊': 'wave',
    '🌙': 'moon', '🌲': 'tree', '🌅': 'sunset', '🍬': 'candy', '📷': 'camera', '🏠': 'home', '🎯': 'target', '🛒': 'cart',
    '👤': 'user', '⏭': 'skip', '📳': 'phone', '🧭': 'compass', '📶': 'signal', '⚠': 'warn', '🐞': 'bug', '🆙': 'levelup',
    '📅': 'calendar', '🎓': 'grad', '⚡': 'bolt', '🏛': 'bank', '🤖': 'robot', '🐍': 'snake', '⚔': 'swords',
    '🟫': 'chest_b', '⬜': 'chest_s', '🟨': 'chest_g',
  };
  const keys = Object.keys(EMOJI).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const RE = new RegExp(`(${keys.join('|')})\\uFE0F?`, 'gu');
  const swap = text => text.replace(RE, (m, e) => I(EMOJI[e]));
  // Меняем эмодзи только в тексте: теги с атрибутами, поля ввода и код не трогаем
  const SKIP = /(<textarea[\s\S]*?<\/textarea>|<pre[\s\S]*?<\/pre>|<div class="console">[\s\S]*?<\/div>|<[^>]+>)/;
  function svgify(html) {
    return String(html).split(SKIP).map((part, k) => (k % 2 ? part : swap(part))).join('');
  }
  // Эмодзи как &#…; — чтобы аватарки остались картинками-эмодзи
  const ent = s => Array.from(String(s)).map(c => `&#${c.codePointAt(0)};`).join('');

  const api = { I, svgify, ent, EMOJI, names: Object.keys(P) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ICONS = api;
})(typeof self !== 'undefined' ? self : this);
