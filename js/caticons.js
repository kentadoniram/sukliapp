// Category pictures: one small drawing per category, shown in a coloured circle with the name underneath.
// The library is below (ICONS). A category uses the picture you chose (cat.icon); if you chose none, one is guessed from its name and group.
// Every drawing is a 24 x 24 outline in the same style, so they look alike wherever a category is shown.
const S = (d) => d;
export const ICONS = {
  bus: ['Bus', '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M7 18v3M17 18v3M8 15h.01M16 15h.01"/>'],
  train: ['Train', '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l2-4M15 21l-2-4M9 14h.01M15 14h.01"/>'],
  car: ['Car', '<path d="M3 13l2-5a2 2 0 011.9-1.4h10.2A2 2 0 0119 8l2 5v4H3zM3 13h18M7 17v2M17 17v2M7.5 15h.01M16.5 15h.01"/>'],
  taxi: ['Taxi', '<path d="M3 13l2-5a2 2 0 011.9-1.4h10.2A2 2 0 0119 8l2 5v4H3zM3 13h18M7 17v2M17 17v2M10 4h4v2.6h-4z"/>'],
  bike: ['Bike', '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h4l4 8M10 8l3 8M9 6h3"/>'],
  plane: ['Plane', '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'],
  fuel: ['Fuel', '<path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 10h2a2 2 0 012 2v4a1.5 1.5 0 003 0V9l-3-3M6 8h6"/>'],
  parking: ['Parking', '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 17V8h4a3 3 0 010 6H9"/>'],
  luggage: ['Travel', '<rect x="6" y="7" width="12" height="14" rx="2"/><path d="M9 7V4h6v3M10 11v6M14 11v6"/>'],
  bed: ['Hotel', '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 00-3-3h-7v5M7 11.5h.01"/>'],
  mountain: ['Hiking', '<path d="M2 20l7-13 4 7 3-4 6 10z"/>'],
  utensils: ['Eating Out', '<path d="M5 3v7a2 2 0 002 2v9M9 3v7a2 2 0 01-2 2M7 3v6M16 21V3c-2 2-3 5-3 8h3"/>'],
  coffee: ['Coffee', '<path d="M4 9h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5zM17 10h1.5a2.5 2.5 0 010 5H17M8 3v3M12 3v3"/>'],
  burger: ['Fast Food', '<path d="M4 11a8 6 0 0116 0zM3 15h18M5 19h14a1 1 0 001-1v-1H4v1a1 1 0 001 1z"/>'],
  beer: ['Drinks', '<path d="M6 8h9v11a1 1 0 01-1 1H7a1 1 0 01-1-1zM15 10h2.5a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5H15M6 8a3 3 0 013-3 3 3 0 016 0M9 12v5M12 12v5"/>'],
  wine: ['Wine', '<path d="M7 3h10v5a5 5 0 01-10 0zM12 13v8M8 21h8"/>'],
  cart: ['Groceries', '<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h3l2.7 12.4a1 1 0 001 .8h9.6a1 1 0 001-.8L21 7H6"/>'],
  basket: ['Market', '<path d="M3 10h18l-2 10H5zM8 10l3-6M16 10l-3-6M9 14v3M12 14v3M15 14v3"/>'],
  cake: ['Sweets', '<path d="M4 20h16v-6a2 2 0 00-2-2H6a2 2 0 00-2 2zM4 16c2 2 4-2 8 0s6 2 8 0M12 12V8M12 3c1 1 1 2 0 3-1-1-1-2 0-3z"/>'],
  apple: ['Fruit', '<path d="M12 8c-3-2-7 0-7 5 0 4 3 8 5 8 1 0 1-.6 2-.6s1 .6 2 .6c2 0 5-4 5-8 0-5-4-7-7-5zM12 8c0-2 1-4 3-5"/>'],
  house: ['Home', '<path d="M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5"/>'],
  building: ['Rent', '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3"/>'],
  bolt: ['Electricity', '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'],
  droplet: ['Water', '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>'],
  flame: ['Gas', '<path d="M12 22a7 7 0 007-7c0-4-3-6-4-10-3 2-4 5-4 7-1-1-2-2-2-4-2 2-4 5-4 8a7 7 0 007 6z"/>'],
  wifi: ['Internet', '<path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01"/>'],
  phone: ['Phone', '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'],
  tv: ['TV', '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>'],
  sofa: ['Furniture', '<path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3M3 13a2 2 0 014 0v1h10v-1a2 2 0 014 0v5H3zM6 18v2M18 18v2"/>'],
  wrench: ['Repairs', '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>'],
  heart: ['Health', '<path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z"/>'],
  pill: ['Medicine', '<rect x="2.5" y="9" width="19" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>'],
  cross: ['Hospital', '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>'],
  dumbbell: ['Fitness', '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>'],
  smile: ['Personal', '<circle cx="12" cy="12" r="9"/><path d="M8 14a4.5 4.5 0 008 0M9 9.5h.01M15 9.5h.01"/>'],
  scissors: ['Hair', '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>'],
  bag: ['Shopping', '<path d="M5 8h14l1 13H4zM9 8V6a3 3 0 016 0v2"/>'],
  shirt: ['Clothes', '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 01-8 0z"/>'],
  gift: ['Gifts', '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10 3 8 4s0 4 4 4zM12 8s2-5 4-4 0 4-4 4z"/>'],
  tag: ['Tag', '<path d="M3 12V4h8l10 10-8 8zM7.5 7.5h.01"/>'],
  laptop: ['Gadgets', '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M2 19h20"/>'],
  gamepad: ['Games', '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v5M4.5 12.5h5M15.5 11h.01M18 14h.01"/>'],
  film: ['Movies', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'],
  music: ['Music', '<path d="M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z"/>'],
  camera: ['Photos', '<path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="3.5"/>'],
  ticket: ['Events', '<path d="M4 5h16a1 1 0 011 1v3.5a2.5 2.5 0 000 5V18a1 1 0 01-1 1H4a1 1 0 01-1-1v-3.5a2.5 2.5 0 000-5V6a1 1 0 011-1zM14 5v14"/>'],
  book: ['Books', '<path d="M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z"/>'],
  cap: ['School', '<path d="M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>'],
  baby: ['Kids', '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M9 15c1.5 1.5 4.5 1.5 6 0M12 3c1-1 3 0 2 2"/>'],
  paw: ['Pets', '<circle cx="7" cy="10" r="1.8"/><circle cx="17" cy="10" r="1.8"/><circle cx="10.5" cy="5.8" r="1.8"/><circle cx="13.5" cy="5.8" r="1.8"/><path d="M12 11c-3 0-5 3-5 5.5 0 2 1.7 2.7 3 2.2 1-.4 1.5-.5 2-.5s1 .1 2 .5c1.3.5 3-.2 3-2.2 0-2.5-2-5.5-5-5.5z"/>'],
  leaf: ['Garden', '<path d="M11 20A7 7 0 014 13c0-6 7-9 16-9 0 9-3 16-9 16zM4 21c3-5 6-8 11-11"/>'],
  umbrella: ['Rainy Day', '<path d="M3 12a9 9 0 0118 0zM12 12v7a2 2 0 004 0"/>'],
  shield: ['Insurance', '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'],
  card: ['Card', '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'],
  bank: ['Bank', '<path d="M3 10l9-6 9 6zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>'],
  coin: ['Coin', '<circle cx="12" cy="12" r="9"/><path d="M9.5 8h3.5a2 2 0 010 4H9.5zM9.5 12H14a2 2 0 010 4H9.5zM9.5 8v8"/>'],
  cash: ['Cash', '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v.01M18 14v.01"/>'],
  piggy: ['Savings', '<path d="M5 11a7 6 0 0113-2.5l3-.5v4l-2 1.5V17h-3v-2H9v2H6v-3a6 6 0 01-1-3zM16 11h.01"/>'],
  briefcase: ['Work', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M3 13h18"/>'],
  receipt: ['Bills', '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM8.5 8h7M8.5 12h7"/>'],
  chart: ['Investing', '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'],
  star: ['Star', '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'],
  globe: ['World', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'],
  key: ['Keys', '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>'],
  mail: ['Post', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
  bell: ['Reminder', '<path d="M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4"/>'],
  repeat: ['Subscription', '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/>'],
  swap: ['Transfer', '<path d="M7 7h13l-4-4M17 17H4l4 4"/>'],
  spark: ['Beauty', '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>'],
  dots: ['Other', '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>']
};
export const ICON_KEYS = Object.keys(ICONS);
const svg = (k, cls = '') => `<svg class="cico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${(ICONS[k] || ICONS.tag)[1]}</svg>`;
export const iconSvg = svg;
// word -> picture. The first rule that matches the category name (then its group) wins.
const RULES = [
  [/bus|jeep|tricycle|commut/, 'bus'], [/train|subway|metro|rail|suica|pasmo|icoca|mrt|lrt/, 'train'], [/taxi|grab|uber|cab/, 'taxi'], [/bike|bicycle|cycl/, 'bike'],
  [/flight|plane|airline|air ?fare|airport/, 'plane'], [/fuel|gas(oline)?\b|petrol|diesel/, 'fuel'], [/parking|toll|expressway/, 'parking'], [/\bcars?\b|vehicle|\bauto/, 'car'],
  [/hotel|lodging|hostel|airbnb|accommodation/, 'bed'], [/hik|trek|mount|camp|outdoor/, 'mountain'], [/trip|travel|vacation|tour|luggage/, 'luggage'],
  [/coffee|cafe|café|tea|starbucks/, 'coffee'], [/burger|fast ?food|jollibee|mcdo|snack/, 'burger'], [/beer|bar\b|alcohol|drink|izakaya/, 'beer'], [/wine/, 'wine'],
  [/grocer|supermarket|market|palengke/, 'cart'], [/dessert|sweet|cake|bakery|candy/, 'cake'], [/fruit|vegetable|produce/, 'apple'],
  [/restaurant|dining|dine|eat|meal|food|lunch|dinner|breakfast|bento|ramen/, 'utensils'],
  [/rent|mortgage|apartment|lease|condo/, 'building'], [/electric|power/, 'bolt'], [/water/, 'droplet'], [/\bgas\b|heating/, 'flame'], [/internet|wifi|wi-fi|broadband|fiber/, 'wifi'],
  [/phone|mobile|load|sim|data plan/, 'phone'], [/tv|television|cable|netflix|stream/, 'tv'], [/furniture|appliance|household|home goods/, 'sofa'], [/repair|maintenance|fix|tool/, 'wrench'],
  [/home|house|housing|utilit/, 'house'],
  [/medic|pharmac|drug|vitamin|supplement/, 'pill'], [/hospital|clinic|doctor|dental|dentist|checkup|consult/, 'cross'], [/gym|fitness|sport|workout|yoga/, 'dumbbell'], [/health|wellness/, 'heart'],
  [/hair|salon|barber/, 'scissors'], [/beauty|cosmetic|skincare|spa|massage/, 'spark'], [/personal/, 'smile'],
  [/cloth|apparel|fashion|shoes|uniform/, 'shirt'], [/gift|donation|charity|present|omiyage|souvenir/, 'gift'], [/gadget|electronic|computer|laptop|software|app\b/, 'laptop'],
  [/game|gaming|steam|playstation|nintendo/, 'gamepad'], [/movie|cinema|film/, 'film'], [/music|concert|spotify/, 'music'], [/photo|camera/, 'camera'], [/event|ticket|show|festival/, 'ticket'],
  [/book|magazine|manga|reading/, 'book'], [/school|tuition|education|course|class|study|lesson|learning/, 'cap'], [/kid|child|baby|diaper|toy/, 'baby'], [/pet|dog|cat|vet\b/, 'paw'], [/garden|plant|flower/, 'leaf'],
  [/insurance/, 'shield'], [/credit ?card|card fee|annual fee/, 'card'], [/bank|fee|charge|atm|remittance|forex/, 'bank'], [/tax|bill|invoice|receipt/, 'receipt'], [/subscri|membership|recurring/, 'repeat'],
  [/saving|emergency/, 'piggy'], [/invest|dividend|stock|crypto|interest|yield|earn/, 'chart'], [/salary|wage|paycheck|bonus|income|allowance|13th/, 'cash'], [/freelance|business|work|office|job|employer|side/, 'briefcase'],
  [/shop|retail|online|clothes|store|amazon|rakuten|shopee/, 'bag'], [/transport|commute|fare/, 'bus'], [/entertain|leisure|fun|hobby/, 'film'], [/refund|reimburs|cashback|reward/, 'coin'], [/transfer|adjust/, 'swap'], [/misc|other|uncategor/, 'dots']
];
export function guessIcon(name, group = '') {
  const t = String(name || '').toLowerCase(), g = String(group || '').toLowerCase();
  for (const [re, k] of RULES) if (re.test(t)) return k;
  for (const [re, k] of RULES) if (re.test(g)) return k;
  return 'tag';
}
export const iconKeyOf = (c) => (c && c.icon && ICONS[c.icon] ? c.icon : guessIcon(c && c.name, c && c.group));
export const catIcon = (c, cls = '') => svg(iconKeyOf(c), cls);
