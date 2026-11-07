// A small built-in list of stations (Kanto and the usual day-trip places) with rough positions, used to
//  1) repair station names the reader got wrong (ū, ō and friends are often lost or turned into other letters), and
//  2) tell how far a station is from Home (js/daytrip.js).
// Positions are good to about 1 km. A station that is not in the list simply has no distance; Sukli then uses the travel pattern only.
import { distance } from './textnorm.js';

// "Keikyū", "Keikyu", "Keikyuu" and "Keikyū" are one key: no marks, no capitals, long sounds written short
export const stationKey = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(station|sta)\b\.?/g, '').replace(/[^a-z]/g, '').replace(/ou|oo|oh/g, 'o').replace(/uu/g, 'u');

// [name, lat, lon]
const RAW = [
  ['Tōkyō', 35.6812, 139.7671], ['Shinjuku', 35.6896, 139.7006], ['Shibuya', 35.6580, 139.7016], ['Ikebukuro', 35.7295, 139.7109], ['Ueno', 35.7138, 139.7774],
  ['Shinagawa', 35.6285, 139.7387], ['Akihabara', 35.6984, 139.7731], ['Asakusa', 35.7148, 139.7967], ['Ginza', 35.6717, 139.7649], ['Roppongi', 35.6641, 139.7312],
  ['Ōtemachi', 35.6867, 139.7660], ['Nihombashi', 35.6828, 139.7745], ['Kanda', 35.6918, 139.7709], ['Yūrakuchō', 35.6750, 139.7630], ['Shimbashi', 35.6665, 139.7583],
  ['Hamamatsuchō', 35.6555, 139.7570], ['Tamachi', 35.6456, 139.7476], ['Gotanda', 35.6262, 139.7239], ['Ōsaki', 35.6197, 139.7285], ['Meguro', 35.6339, 139.7158],
  ['Ebisu', 35.6467, 139.7101], ['Harajuku', 35.6702, 139.7027], ['Yoyogi', 35.6833, 139.7020], ['Shin-Ōkubo', 35.7013, 139.7000], ['Takadanobaba', 35.7126, 139.7038],
  ['Mejiro', 35.7210, 139.7066], ['Ōtsuka', 35.7316, 139.7286], ['Sugamo', 35.7335, 139.7393], ['Komagome', 35.7366, 139.7468], ['Tabata', 35.7381, 139.7608],
  ['Nippori', 35.7281, 139.7708], ['Uguisudani', 35.7208, 139.7780], ['Okachimachi', 35.7075, 139.7745], ['Ochanomizu', 35.6993, 139.7650], ['Iidabashi', 35.7020, 139.7450],
  ['Ichigaya', 35.6910, 139.7352], ['Yotsuya', 35.6860, 139.7300], ['Shinanomachi', 35.6800, 139.7204], ['Sendagaya', 35.6811, 139.7113], ['Kōenji', 35.7053, 139.6496],
  ['Asagaya', 35.7046, 139.6350], ['Ogikubo', 35.7046, 139.6200], ['Nakano', 35.7056, 139.6659], ['Higashi-Nakano', 35.7071, 139.6837], ['Kichijōji', 35.7030, 139.5797],
  ['Mitaka', 35.7022, 139.5612], ['Musashisakai', 35.7016, 139.5435], ['Tachikawa', 35.6980, 139.4137], ['Hachiōji', 35.6556, 139.3388], ['Takao', 35.6414, 139.2437],
  ['Takaosanguchi', 35.6317, 139.2437], ['Ōme', 35.7886, 139.2593], ['Mitake', 35.8028, 139.1700], ['Fussa', 35.7456, 139.3266], ['Tokorozawa', 35.7872, 139.4700],
  ['Kokubunji', 35.7006, 139.4807], ['Kunitachi', 35.6838, 139.4413], ['Fuchū', 35.6717, 139.4778], ['Chōfu', 35.6523, 139.5441], ['Machida', 35.5421, 139.4458],
  ['Sagamihara', 35.5578, 139.3715], ['Hashimoto', 35.5948, 139.3453], ['Tama Center', 35.6249, 139.4237], ['Shin-Yurigaoka', 35.6040, 139.5063], ['Noborito', 35.6200, 139.5700],
  ['Shimo-Kitazawa', 35.6613, 139.6684], ['Kichijoji', 35.7030, 139.5797], ['Jiyūgaoka', 35.6075, 139.6688], ['Futako-Tamagawa', 35.6116, 139.6264], ['Chitose-Karasuyama', 35.6670, 139.6000],
  ['Sangenjaya', 35.6437, 139.6699], ['Nakameguro', 35.6440, 139.6989], ['Daikanyama', 35.6486, 139.7032], ['Kamata', 35.5627, 139.7161], ['Keikyū Kamata', 35.5608, 139.7226],
  ['Ōmori', 35.5889, 139.7283], ['Shinagawa-Shuku', 35.6200, 139.7390], ['Haneda Airport Terminal 3', 35.5494, 139.7850], ['Haneda Airport Terminal 1 · 2', 35.5463, 139.7842],
  ['Keikyū Kawasaki', 35.5316, 139.6953], ['Kawasaki', 35.5313, 139.6970], ['Yakō', 35.5703, 139.6965], ['Musashi-Kosugi', 35.5760, 139.6596], ['Tsurumi', 35.5083, 139.6764],
  ['Keikyū Tsurumi', 35.5060, 139.6826], ['Shin-Yokohama', 35.5072, 139.6173], ['Yokohama', 35.4658, 139.6223], ['Sakuragichō', 35.4509, 139.6317], ['Kannai', 35.4440, 139.6366],
  ['Ishikawachō', 35.4388, 139.6475], ['Yamate', 35.4274, 139.6480], ['Negishi', 35.4155, 139.6420], ['Isogo', 35.4004, 139.6150], ['Ōfuna', 35.3539, 139.5313],
  ['Totsuka', 35.3994, 139.5342], ['Fujisawa', 35.3388, 139.4870], ['Kamakura', 35.3190, 139.5500], ['Kita-Kamakura', 35.3354, 139.5500], ['Hase', 35.3117, 139.5360],
  ['Enoshima', 35.3098, 139.4800], ['Katase-Enoshima', 35.3099, 139.4800], ['Kamakura-Kōkōmae', 35.3067, 139.5271], ['Zushi', 35.2965, 139.5800], ['Yokosuka', 35.2820, 139.6720],
  ['Kurihama', 35.2229, 139.7033], ['Miura-Kaigan', 35.1642, 139.6500], ['Misakiguchi', 35.1394, 139.6310], ['Odawara', 35.2563, 139.1550], ['Hakone-Yumoto', 35.2326, 139.1050],
  ['Gōra', 35.2506, 139.0530], ['Atami', 35.1039, 139.0779], ['Itō', 34.9748, 139.1020], ['Shimoda', 34.6714, 138.9490], ['Mishima', 35.1264, 138.9110],
  ['Numazu', 35.0996, 138.8620], ['Shizuoka', 34.9719, 138.3890], ['Kōfu', 35.6661, 138.5680], ['Ōtsuki', 35.6100, 138.9400], ['Kawaguchiko', 35.4975, 138.7680],
  ['Fuji', 35.1619, 138.6760], ['Narita', 35.7762, 140.3190], ['Narita Airport Terminal 1', 35.7647, 140.3860], ['Chiba', 35.6130, 140.1130], ['Funabashi', 35.7016, 139.9852],
  ['Kashiwa', 35.8620, 139.9710], ['Matsudo', 35.7840, 139.9030], ['Ichikawa', 35.7280, 139.9080], ['Nishi-Funabashi', 35.7059, 139.9593], ['Maihama', 35.6360, 139.8830],
  ['Kasai Rinkai Kōen', 35.6477, 139.8610], ['Kinshichō', 35.6965, 139.8140], ['Ryōgoku', 35.6969, 139.7930], ['Kameido', 35.6977, 139.8265], ['Funabori', 35.6870, 139.8640],
  ['Kasai', 35.6615, 139.8730], ['Nishi-Kasai', 35.6645, 139.8590], ['Toyosu', 35.6550, 139.7960], ['Odaiba-Kaihin Kōen', 35.6296, 139.7760], ['Tokyo Teleport', 35.6270, 139.7740],
  ['Kita-Senju', 35.7498, 139.8049], ['Ayase', 35.7434, 139.8250], ['Kameari', 35.7656, 139.8477], ['Kanamachi', 35.7690, 139.8700], ['Akabane', 35.7779, 139.7210],
  ['Urawa', 35.8591, 139.6570], ['Ōmiya', 35.9064, 139.6240], ['Kawagoe', 35.9082, 139.4820], ['Kawagoeshi', 35.9137, 139.4840], ['Hon-Kawagoe', 35.9163, 139.4880],
  ['Kawaguchi', 35.8021, 139.7180], ['Warabi', 35.8265, 139.6800], ['Koshigaya', 35.8895, 139.7910], ['Sōka', 35.8250, 139.8040], ['Chichibu', 35.9910, 139.0830],
  ['Seibu-Chichibu', 35.9870, 139.0830], ['Hanno', 35.8570, 139.3280], ['Takasaki', 36.3220, 139.0120], ['Maebashi', 36.3900, 139.0610], ['Karuizawa', 36.3430, 138.6350],
  ['Nagano', 36.6430, 138.1880], ['Utsunomiya', 36.5590, 139.8990], ['Nikkō', 36.7500, 139.6200], ['Tōbu-Nikkō', 36.7500, 139.6030], ['Kinugawa-Onsen', 36.8240, 139.7170],
  ['Mito', 36.3710, 140.4760], ['Tsukuba', 36.0820, 140.1110], ['Kashima', 35.9640, 140.6370], ['Kita-Kōgane', 35.8310, 139.9170], ['Minami-Senju', 35.7324, 139.7990],
  ['Tsukiji', 35.6670, 139.7700], ['Tsukishima', 35.6646, 139.7840], ['Kiyosumi-Shirakawa', 35.6797, 139.7990], ['Sunamachi', 35.6700, 139.8310], ['Takashimadaira', 35.7900, 139.6600],
  ['Narimasu', 35.7770, 139.6320], ['Nerima', 35.7370, 139.6540], ['Hikarigaoka', 35.7550, 139.6320], ['Tokiwadai', 35.7440, 139.6930], ['Itabashi', 35.7490, 139.7210],
  ['Oji', 35.7530, 139.7370], ['Komagome', 35.7366, 139.7468], ['Mitsukoshimae', 35.6858, 139.7737], ['Jimbōchō', 35.6959, 139.7575], ['Kudanshita', 35.6954, 139.7510],
  ['Hanzōmon', 35.6850, 139.7500], ['Nagatachō', 35.6788, 139.7400], ['Kasumigaseki', 35.6735, 139.7510], ['Toranomon', 35.6700, 139.7500], ['Azabu-Jūban', 35.6550, 139.7360],
  ['Hiroo', 35.6513, 139.7220], ['Omotesandō', 35.6654, 139.7125], ['Aoyama-Itchōme', 35.6728, 139.7241], ['Kōrakuen', 35.7078, 139.7517], ['Myōgadani', 35.7173, 139.7366],
  ['Odawara-Shi', 35.2563, 139.1550], ['Shin-Matsuda', 35.3200, 139.1400], ['Hon-Atsugi', 35.4400, 139.3600], ['Atsugi', 35.4400, 139.3600], ['Ebina', 35.4540, 139.3910],
  ['Chigasaki', 35.3270, 139.4040], ['Hiratsuka', 35.3270, 139.3500], ['Ōiso', 35.3100, 139.3150], ['Kōzu', 35.2970, 139.2200], ['Yugawara', 35.1500, 139.1070],
];
/* Wallet spells most stations plainly (Tokyo, Omiya); the names below keep their long-sound mark, as in the screenshots */
const KEEP = /^(Keikyū|Yakō)/;
const norm = (n) => (KEEP.test(n) ? n : n.normalize('NFKD').replace(/[̀-ͯ]/g, ''));
export const STATIONS = RAW.map(([name, la, lo]) => ({ name: norm(name), la, lo, key: stationKey(name) }));
const BY = new Map(); for (const s of STATIONS) if (!BY.has(s.key)) BY.set(s.key, s);

// the station the text most likely means: exact key first, then a close spelling (the reader drops or swaps a letter, mostly on ū and ō)
export function findStation(text) {
  const k = stationKey(text); if (k.length < 3) return null;
  if (BY.has(k)) return BY.get(k);
  const max = k.length >= 10 ? 2 : k.length >= 5 ? 1 : 0; if (!max) return null;
  let best = null, bd = 99, tie = false;
  for (const s of STATIONS) { if (Math.abs(s.key.length - k.length) > max) continue; const d = distance(k, s.key, max); if (d <= max) { if (d < bd) { best = s; bd = d; tie = false; } else if (d === bd && s.key !== best.key) tie = true; } }
  return best && !tie ? best : null;
}
// a clean display name: the list's own spelling (with ū, ō) when the station is known, else what was read
export const repairStation = (text) => { const s = findStation(text); return s ? s.name : String(text || '').trim(); };
