// Pictures for groups, accounts and merchants.
//  - Group pictures (GICONS) are a separate, solid-filled set, so a group header never looks like one of its categories.
//  - Accounts and merchants use the same outline pictures as categories (js/caticons.js), chosen automatically from the name, or by you.
//  - You can also use your own image (kept on this device only, as a small picture inside your data).
// No company logos are bundled: logos are trademarks and have no licence for copying, so the automatic picture is a generic one (a bank, a burger, a train).
import { ICONS, iconSvg } from './caticons.js';

const F = (d) => d;
export const GICONS = {
  g_cloche: ['Dish', '<path d="M12 4a1.5 1.5 0 011.5 1.5c4.6.6 8 4.4 8 9h-19c0-4.6 3.4-8.4 8-9A1.5 1.5 0 0112 4zM2 17h20v2.5H2z"/>'],
  g_sign: ['Road sign', '<path fill-rule="evenodd" d="M12 1.5L22.5 12 12 22.5 1.5 12zM7 11h6V8l4.5 4-4.5 4v-3H7z"/>'],
  g_door: ['Door', '<path fill-rule="evenodd" d="M6 2h12v18H6zm8.500 9.500a1 1 0 100 2 1 1 0 000-2zM3 21h18v1.500H3z"/>'],
  g_meter: ['Meter', '<path fill-rule="evenodd" d="M12 3a10 10 0 00-8.600 15.100h17.200A10 10 0 0012 3zm0 3a1 1 0 110 2 1 1 0 010-2zM6.500 11a1 1 0 110 2 1 1 0 010-2zm11 0a1 1 0 110 2 1 1 0 010-2zM11 15.800a1.800 1.800 0 002.600-.6l2.900-5-1.600-.9-3.600 4.800a1.800 1.800 0 00-.3 1.700z"/>'],
  g_person: ['Person', '<circle cx="12" cy="7.500" r="4.500"/><path d="M3 21c0-5 4-8 9-8s9 3 9 8z"/>'],
  g_medcase: ['First aid', '<path fill-rule="evenodd" d="M9 3h6a1 1 0 011 1v2h4a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h4V4a1 1 0 011-1zm1 2v1h4V5zm1 6v2H9v2h2v2h2v-2h2v-2h-2v-2z"/>'],
  g_curtain: ['Star', '<path d="M12 2l3 6.500 7 .8-5.200 4.800 1.500 7L12 17.500 5.700 21l1.500-7L2 9.300l7-.8z"/>'],
  g_balloon: ['Balloon', '<path d="M12 2a6.500 6.500 0 00-6.500 6.500c0 4 3.500 7 6.500 8 3-1 6.500-4 6.500-8A6.500 6.500 0 0012 2zM10.500 17.500h3L14.500 20h-5zM12 20.500v2"/>'],
  g_passport: ['Passport', '<path fill-rule="evenodd" d="M5 2h13a1.500 1.500 0 011.500 1.500v17A1.500 1.500 0 0118 22H5zm7 4.500a4 4 0 100 8 4 4 0 000-8zM8.500 17.500h7V19h-7z"/>'],
  g_board: ['Blackboard', '<path fill-rule="evenodd" d="M3 3h18v14H3zm2 2v10h14V5zM8 19h8l1 2H7z"/>'],
  g_family: ['Family', '<circle cx="7" cy="6" r="2.500"/><circle cx="17" cy="6" r="2.500"/><circle cx="12" cy="11" r="2"/><path d="M2 20v-5a3 3 0 013-3h4a3 3 0 013 3v5zM12 20v-3.500a2.500 2.500 0 012.500-2.500h5a3 3 0 013 3V20z"/>'],
  g_kite: ['Kite', '<path d="M12 1.500l6 7.500-6 7.500L6 9zM12 17l-1.500 2 1.500 1.500-1.500 2h3l-1.500-2 1.500-2z"/>'],
  g_bone: ['Bone', '<g transform="rotate(-45 12 12)"><rect x="6" y="10" width="12" height="4" rx="1"/><circle cx="5" cy="9" r="2.200"/><circle cx="5" cy="15" r="2.200"/><circle cx="19" cy="9" r="2.200"/><circle cx="19" cy="15" r="2.200"/></g>'],
  g_deck: ['Presentation', '<path fill-rule="evenodd" d="M3 3h18v2H3zM4.500 5h15v11h-15zM7 9v5h2V9zm4-2v7h2V7zm4 3v4h2v-4zM11 16h2v3h-2zM8 21h8v-1.500H8z"/>'],
  g_chip: ['Chip', '<path fill-rule="evenodd" d="M7 7h10v10H7zm2.500 2.500v5h5v-5zM9 2h1.500v3H9zm4.500 0H15v3h-1.500zM9 19h1.500v3H9zm4.500 0H15v3h-1.500zM2 9h3v1.500H2zm0 4.500h3V15H2zM19 9h3v1.500h-3zm0 4.500h3V15h-3z"/>'],
  g_scales: ['Scales', '<path d="M11 3h2v2.500h6.500v1.500L22.500 14a4 4 0 01-7 0L18.500 8H13v11h4v2H7v-2h4V8H5.500L8.500 14a4 4 0 01-7 0L4.500 7V5.500H11z"/>'],
  g_buoy: ['Life ring', '<circle cx="12" cy="12" r="7.500" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="5.900 5.900"/>'],
  g_stamp: ['Stamp', '<path d="M9 2h6v7h-1.500v2H18a3 3 0 013 3v2H3v-2a3 3 0 013-3h4.500V9H9zM3 18h18v3H3z"/>'],
  g_calendar: ['Calendar', '<path fill-rule="evenodd" d="M7 2h2v2h6V2h2v2h3a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h3zM5 10v10h14V10zm3 2h3v3H8z"/>'],
  g_burst: ['Sale badge', '<path d="M12 1l2.400 2.700 3.500-.8.8 3.500L22 8.700 20.400 12 22 15.300l-3.300 1.300-.8 3.500-3.500-.8L12 23l-2.400-2.700-3.500.8-.8-3.500L2 15.300 3.600 12 2 8.700l3.300-1.300.8-3.500 3.500.8z"/>'],
  g_plan: ['Floor plan', '<path fill-rule="evenodd" d="M3 3h18v18H3zm2 2v6h6V5zm8 0v3h6V5zm0 5v1h6v-1zM5 13v6h3v-6zm5 0v6h9v-6z"/>'],
  g_wheel: ['Steering wheel', '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.500"/><circle cx="12" cy="12" r="2.500"/><path d="M3 12h6.500M14.500 12H21M12 14.500V21" fill="none" stroke="currentColor" stroke-width="2.500"/>'],
  g_puzzle: ['Puzzle', '<path d="M5 5h4a2.500 2.500 0 015 0h4a1 1 0 011 1v3.500a2.500 2.500 0 010 5V18a1 1 0 01-1 1h-3.500a2.500 2.500 0 00-5 0H5a1 1 0 01-1-1v-3.500a2.500 2.500 0 000-5V6a1 1 0 011-1z"/>'],
  g_sprout: ['Sprout', '<rect x="11" y="12" width="2" height="9"/><path d="M12 13c0-4 2.500-6.500 7-6.500 0 4-2.500 6.500-7 6.500zM12 16c0-3-2-5-6-5 0 3 2 5 6 5zM6 22h12v-1.500H6z"/>'],
  g_grid: ['Grid', '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>'],
  g_lanyard: ['Staff badge', '<path fill-rule="evenodd" d="M8 2h2l2 6 2-6h2l-3 8h-2zM6 11h12a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1zm6 2a2 2 0 100 4 2 2 0 000-4zm-3 6h6c0-1-1.500-1.500-3-1.500s-3 .5-3 1.500z"/>'],
  g_rocket: ['Rocket', '<path fill-rule="evenodd" d="M12 2c3.500 2.500 5 6 5 10l2 3-3 .5-1 3H9l-1-3-3-.5 2-3c0-4 1.500-7.500 5-10zm0 6a2 2 0 100 4 2 2 0 000-4zM10 20h4l-2 3z"/>'],
  g_candles: ['Candles', '<rect x="4" y="9" width="4" height="8" rx=".5"/><rect x="5.500" y="5" width="1" height="16"/><rect x="10" y="5" width="4" height="9" rx=".5"/><rect x="11.500" y="2" width="1" height="15"/><rect x="16" y="11" width="4" height="8" rx=".5"/><rect x="17.500" y="8" width="1" height="14"/>'],
  g_bolt: ['Power', '<path fill-rule="evenodd" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 4l-5 7h3.500L11 18l5-7h-3.500z"/>'],
  g_ribbon: ['Ribbon', '<path d="M12 2a6 6 0 013.500 10.900L17.500 22 12 19l-5.500 3 2-9.100A6 6 0 0112 2z"/>'],
  g_return: ['Return', '<path d="M12 4V1L7 5.500 12 10V7a6 6 0 11-6 6H4a8 8 0 108-9z"/>'],
  g_scroll: ['Document', '<path fill-rule="evenodd" d="M6 3h12a2 2 0 012 2v12H9v2a2 2 0 01-4 0V5a2 2 0 011-2zm1 2v12.500A2 2 0 009 17V5zm4 2h6v1.500h-6zm0 3h6v1.500h-6z"/>'],
  g_medal: ['Medal', '<path d="M7 2h4l1 5-3 2zM17 2h-4l-1 5 3 2z"/><circle cx="12" cy="15" r="6.500"/>'],
  g_swap: ['Swap', '<path d="M3 8l5-5v3.500h13v3H8V13zM21 16l-5 5v-3.500H3v-3h13V11z"/>'],
  g_sliders: ['Sliders', '<path d="M3 5h9v2H3zM16 5h5v2h-5zM12 3h2v6h-2zM3 11h4v2H3zM11 11h10v2H11zM7 9h2v6H7zM3 17h12v2H3zM19 17h2v2h-2zM15 15h2v6h-2z"/>'],
  g_rise: ['Rising', '<path d="M2 18l7-7 4 4 6-7h-3V6h7v7h-2v-3l-8 9-4-4-5 5z"/>']
};
export const GKEYS = Object.keys(GICONS);
export const gsvg = (k, cls = '') => `<svg class="cico gico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${GICONS[k][1]}</svg>`;
const GMAP = { 'Food & Drinks': 'g_cloche', Transportation: 'g_sign', Household: 'g_door', Utilities: 'g_meter', Personal: 'g_person', 'Personal Care': 'g_person', Health: 'g_medcase', Entertainment: 'g_curtain', 'Social & Gifts': 'g_balloon', Travel: 'g_passport', Education: 'g_board', 'Family Support': 'g_family', Kids: 'g_kite', Pets: 'g_bone', 'Work & Business': 'g_deck', Technology: 'g_chip', 'Finance & Fees': 'g_scales', Insurance: 'g_buoy', Taxes: 'g_stamp', Subscriptions: 'g_calendar', Shopping: 'g_burst', Housing: 'g_plan', Vehicle: 'g_wheel', Hobbies: 'g_puzzle', 'Savings & Investments': 'g_sprout', Others: 'g_grid', Employer: 'g_lanyard', Employment: 'g_lanyard', 'Freelance & Business': 'g_rocket', Investments: 'g_candles', Earn: 'g_bolt', 'Gifts & Support': 'g_ribbon', 'Refunds & Cashback': 'g_return', Government: 'g_scroll', Sales: 'g_rise', Rewards: 'g_medal', Transfer: 'g_swap', Adjustments: 'g_sliders' };
const GRULES = [[/food|drink|dining|eat/, 'g_cloche'], [/transport|commut|fare/, 'g_sign'], [/house|home/, 'g_door'], [/util|bill/, 'g_meter'], [/health|medic/, 'g_medcase'], [/entertain|leisure|fun/, 'g_curtain'], [/gift|social/, 'g_balloon'], [/travel|trip/, 'g_passport'], [/educ|school|study/, 'g_board'], [/family/, 'g_family'], [/kid|child|baby/, 'g_kite'], [/pet/, 'g_bone'], [/work|business/, 'g_deck'], [/tech|gadget/, 'g_chip'], [/financ|fee|bank/, 'g_scales'], [/insur/, 'g_buoy'], [/tax/, 'g_stamp'], [/subscri|member/, 'g_calendar'], [/shop|retail/, 'g_burst'], [/hous|rent/, 'g_plan'], [/vehic|car\b/, 'g_wheel'], [/hobb/, 'g_puzzle'], [/saving|invest/, 'g_sprout'], [/salary|employ/, 'g_lanyard'], [/free|side/, 'g_rocket'], [/refund|cashback|return/, 'g_return'], [/reward|prize/, 'g_medal'], [/transfer/, 'g_swap'], [/person|self|care/, 'g_person']];
export const guessGroupG = (g) => GMAP[g] || ((GRULES.find(([re]) => re.test(String(g || '').toLowerCase())) || [])[1]) || 'g_grid';

// ---------- accounts and merchants ----------
export const isImg = (v) => typeof v === 'string' && v.startsWith('data:image/');
const ACCT_RULES = [
  [/pasmo|suica|icoca|nimoca|toica|manaca|kitaca|sugoca|hayakaken|\bic\b|transit card|beep|octopus/, 'iccard'],
  [/gcash|maya|paymaya|paypay|line ?pay|rakuten ?pay|d-?barai|au ?pay|merpay|grab ?pay|shopee ?pay|coins\.?ph|wise|paypal|revolut|apple ?pay|google ?pay|e-?wallet|wallet app|prepaid|osaifu/, 'ewallet'],
  [/binance|bybit|okx|coinbase|bitget|kraken|kucoin|crypto|ledger|metamask|trust wallet|phantom|bitflyer|coincheck|gmo coin/, 'coins'],
  [/sbi sec|rakuten sec|nisa|ideco|broker|ibkr|moomoo|etf|fund|stock|invest|trading|colfinancial|first metro sec|dragonfi/, 'chart'],
  [/credit|visa|master ?card|jcb|amex|debit|\bcard\b/, 'card'],
  [/saving|ipon|emergency|sinking|time deposit/, 'piggy'], [/safe|vault|strongbox/, 'safe'],
  [/loan|debt|mortgage|borrow|utang/, 'coin'], [/owed|receivable|lent/, 'users'],
  [/\bcash\b|pera|petty|pocket|coins? on hand/, 'cash'], [/wallet|purse|osaif/, 'wallet'],
  [/bank|bdo|bpi|metrobank|landbank|unionbank|security bank|rcbc|pnb|chinabank|eastwest|maybank|cimb|seabank|tonik|gotyme|smbc|mufg|mizuho|yucho|japan post|resona|sbi|shinsei|aeon bank|jibun|sony bank|rakuten bank|mitsui|norinchukin|savings account|checking|atm/, 'bank']
];
const TYPE_ICON = { cash: 'cash', bank: 'bank', ewallet: 'ewallet', ic: 'iccard', card: 'card', crypto: 'coins', invest: 'chart', asset: 'building', owed: 'users', loan: 'coin', other: 'wallet' };
export const guessAcctIcon = (name, type) => { const t = String(name || '').toLowerCase(); for (const [re, k] of ACCT_RULES) if (re.test(t)) return k; return TYPE_ICON[type] || 'wallet'; };
const MERCH_RULES = [
  [/mcdo|mcdonald|jollibee|burger|kfc|wendy|mos ?burger|lotteria|freshness|chowking|greenwich|popeyes|carl'?s|shake ?shack/, 'burger'],
  [/7-?eleven|seven[- ]?eleven|lawson|family ?mart|mini ?stop|alfamart|indomaret|conbini|convenience|daily yamazaki|newdays|natural lawson/, 'store'],
  [/starbucks|tully|doutor|komeda|cafe|café|coffee|costa|dunkin|bo'?s|figaro|arabica|blue bottle|caribou|mister donut|mr\.? ?donut|krispy|gong ?cha|chatime|milk ?tea|tapsi|boba|matcha/, 'coffee'],
  [/ramen|ippudo|ichiran|udon|soba|marugame|hanamaru|noodle|pho\b/, 'bowl'], [/pizza|domino|shakey/, 'pizza'], [/sushi|kura|sukiya|yoshinoya|matsuya|coco ?ichi|saizeriya|gusto|jolly|restaurant|izakaya|yakiniku|gyukaku|bar\b|diner|bistro|grill|kitchen|eatery|canteen/, 'utensils'],
  [/seiyu|aeon|ito-?yokado|\blife\b|maruetsu|summit|ok ?store|inageya|sm ?(hyper|super|market)|puregold|robinsons|savemore|waltermart|landers|costco|don ?quijote|donki|supermarket|grocery|market|palengke|mart\b/, 'cart'],
  [/uniqlo|\bgu\b|muji|zara|h&m|shimamura|workman|clothing|apparel|shoe|abc-?mart|nike|adidas|fashion/, 'shirt'],
  [/drug|matsumoto|sundrug|welcia|tsuruha|cosmos|watsons|mercury|rose pharmacy|pharmacy|clinic|hospital|dental/, 'pill'],
  [/eneos|shell|petron|caltex|cosmo oil|idemitsu|phoenix|gas station|fuel/, 'fuel'],
  [/\bjr\b|metro|subway|tokyu|keikyu|keikyū|odakyu|seibu|tobu|keio|mrt|lrt|train|railway|shinkansen|pasmo|suica/, 'train'],
  [/\bbus\b|jeep|tricycle|nishitetsu|toei bus/, 'bus'], [/grab|uber|go taxi|taxi|didi|cab\b/, 'taxi'],
  [/ana\b|jal\b|peach|jetstar|cebu pacific|philippine airlines|airasia|airline|airport|flight/, 'plane'], [/hotel|apa\b|toyoko|inn\b|hostel|airbnb|resort/, 'bed'],
  [/amazon|rakuten|shopee|lazada|zalora|yahoo|mercari|yodobashi|bic ?camera|ebay|aliexpress|temu|online/, 'package'], [/daiso|nitori|ikea|3coins|seria|home center|hardware|handyman|ace hardware/, 'bag'],
  [/cinema|toho|movie|theat|imax/, 'film'], [/netflix|disney|prime video|youtube|hulu|u-?next/, 'tv'], [/spotify|apple music|music|live ?house|karaoke|big echo/, 'music'],
  [/docomo|softbank|\bau\b|globe|smart\b|rakuten mobile|ntt|pldt|converge|wifi|internet/, 'phone'], [/tepco|kepco|meralco|electric|power/, 'bolt'], [/tokyo gas|gas bill|osaka gas/, 'flame'], [/water/, 'droplet'],
  [/kinokuniya|tsutaya|book ?off|bookstore|book/, 'book'], [/gym|fitness|anytime|curves|yoga/, 'dumbbell'], [/salon|barber|hair/, 'scissors'], [/laundry|coin laundry/, 'washer'],
  [/post office|yu-?pack|yamato|sagawa|jnt|lbc|courier|delivery/, 'mail'], [/seven bank|atm|bank/, 'bank'], [/game|steam|nintendo|playstation|xbox|arcade|round ?1/, 'gamepad'], [/temple|shrine|church/, 'church'], [/park|zoo|aquarium|museum|ticket/, 'ticket']
];
export const guessMerchIcon = (name) => { const t = String(name || '').toLowerCase(); for (const [re, k] of MERCH_RULES) if (re.test(t)) return k; return 'store'; };

// the picture markup: your own image, a chosen picture, or the automatic guess
export const picHtml = (val, auto, cls = '') => (isImg(val) ? `<img class="cimg ${cls}" alt="" src="${val}">` : GICONS[val] ? gsvg(val, cls) : iconSvg(ICONS[val] ? val : auto, cls));
export const acctPic = (a) => picHtml(a && a.icon, guessAcctIcon(a && a.name, a && a.type));
const merchInfo = (db, name) => { const all = ((db || {}).settings || {}).merchantInfo || {}; if (all[name]) return all[name]; const k = String(name || '').toLowerCase(); const hit = Object.keys(all).find((x) => x.toLowerCase() === k); return hit ? all[hit] : {}; };
export const merchIconOf = (db, name) => (merchInfo(db, name) || {}).icon || '';
export const merchPic = (db, name) => picHtml(merchIconOf(db, name), guessMerchIcon(name));

// your own image: pick a file, cut it square and shrink it to 72 px so it stays tiny. Resolves to a data: address, or '' when cancelled.
export function pickOwnImage() {
  return new Promise((res) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return res('');
      const url = URL.createObjectURL(f), im = new Image();
      im.onload = () => { const n = 72, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), m = Math.min(im.width, im.height); x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, n, n); URL.revokeObjectURL(url); res(c.toDataURL('image/png')); };
      im.onerror = () => { URL.revokeObjectURL(url); res(''); }; im.src = url;
    };
    inp.click();
  });
}
