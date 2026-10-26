// Japanese item names on a receipt -> romaji (how to say it) and a short English meaning.
// Works offline from a built-in word list (food, drinks, household, receipt words, shops). A word that is not in the list keeps its kanji, and
// kana is always converted. Romaji is written plainly: long sounds are doubled (おう = ou, ー = repeat the vowel), no macrons.

// ---- kana to romaji ----
const SINGLE = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo', た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'o', ゔ: 'vu', ゐ: 'i', ゑ: 'e',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゎ: 'wa',
};
const COMBO = {};
for (const [k, r] of Object.entries({ き: 'ky', し: 'sh', ち: 'ch', に: 'ny', ひ: 'hy', み: 'my', り: 'ry', ぎ: 'gy', じ: 'j', ぢ: 'j', び: 'by', ぴ: 'py' })) {
  const pal = r === 'sh' || r === 'ch' || r === 'j';
  COMBO[k + 'ゃ'] = pal ? r + 'a' : r + 'a'; COMBO[k + 'ゅ'] = pal ? r + 'u' : r + 'u'; COMBO[k + 'ょ'] = pal ? r + 'o' : r + 'o';
}
Object.assign(COMBO, { しぇ: 'she', ちぇ: 'che', じぇ: 'je', ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du', うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso', ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo', いぇ: 'ye', くぁ: 'kwa', ぐぁ: 'gwa' });
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKana = (c) => /[ぁ-ゖァ-ヶー]/.test(c);

export function kanaToRomaji(str) {
  const s = toHira(String(str || '')); let out = '', i = 0;
  while (i < s.length) {
    const c = s[i], two = s.slice(i, i + 2);
    if (c === 'っ') {                                                  // small tsu doubles the next consonant
      const nx = COMBO[s.slice(i + 1, i + 3)] || SINGLE[s[i + 1]] || '';
      if (nx && !/^[aiueo]/.test(nx)) out += nx.startsWith('ch') ? 't' : nx[0]; else out += 't';
      i++; continue;
    }
    if (c === 'ー') { const m = out.match(/[aiueo](?=[^aiueo]*$)/); out += m ? m[0] : '-'; i++; continue; }
    if (COMBO[two]) { out += COMBO[two]; i += 2; continue; }
    if (c === 'ん') { const nx = COMBO[s.slice(i + 1, i + 3)] || SINGLE[s[i + 1]] || ''; out += /^[aiueoy]/.test(nx) ? "n'" : 'n'; i++; continue; }
    out += SINGLE[c] !== undefined ? SINGLE[c] : c; i++;
  }
  return out;
}

// ---- word list: written form | reading in kana | English ----
const WORDS = `
水|みず|water
お水|おみず|water
ミネラルウォーター|みねらるうぉーたー|mineral water
天然水|てんねんすい|natural water
炭酸水|たんさんすい|sparkling water
炭酸|たんさん|fizzy
お茶|おちゃ|tea
緑茶|りょくちゃ|green tea
麦茶|むぎちゃ|barley tea
烏龍茶|うーろんちゃ|oolong tea
ウーロン茶|うーろんちゃ|oolong tea
紅茶|こうちゃ|black tea
抹茶|まっちゃ|matcha
茶|ちゃ|tea
コーヒー|こーひー|coffee
珈琲|こーひー|coffee
カフェオレ|かふぇおれ|café au lait
ココア|ここあ|cocoa
牛乳|ぎゅうにゅう|milk
ミルク|みるく|milk
豆乳|とうにゅう|soy milk
低脂肪|ていしぼう|low fat
無糖|むとう|unsweetened
微糖|びとう|lightly sweet
加糖|かとう|sweetened
ジュース|じゅーす|juice
オレンジジュース|おれんじじゅーす|orange juice
りんごジュース|りんごじゅーす|apple juice
コーラ|こーら|cola
サイダー|さいだー|soda
ビール|びーる|beer
発泡酒|はっぽうしゅ|low-malt beer
ハイボール|はいぼーる|highball
チューハイ|ちゅーはい|chuhai (spirit and soda)
酒|さけ|alcohol / sake
日本酒|にほんしゅ|sake
ワイン|わいん|wine
焼酎|しょうちゅう|shochu
ウイスキー|ういすきー|whisky
ドリンク|どりんく|drink
飲料|いんりょう|drink
栄養ドリンク|えいようどりんく|energy drink
スポーツドリンク|すぽーつどりんく|sports drink
氷|こおり|ice
米|こめ|rice
お米|おこめ|rice
ご飯|ごはん|cooked rice / meal
ごはん|ごはん|cooked rice / meal
パックご飯|ぱっくごはん|packed cooked rice
餅|もち|rice cake
パン|ぱん|bread
食パン|しょくぱん|sliced bread
菓子パン|かしぱん|sweet bread
ロールパン|ろーるぱん|bread rolls
クロワッサン|くろわっさん|croissant
バゲット|ばげっと|baguette
卵|たまご|egg
玉子|たまご|egg
たまご|たまご|egg
豆腐|とうふ|tofu
納豆|なっとう|natto (fermented soybeans)
油揚げ|あぶらあげ|fried tofu
ヨーグルト|よーぐると|yogurt
チーズ|ちーず|cheese
バター|ばたー|butter
マーガリン|まーがりん|margarine
生クリーム|なまくりーむ|fresh cream
醤油|しょうゆ|soy sauce
しょうゆ|しょうゆ|soy sauce
味噌|みそ|miso
みそ|みそ|miso
味噌汁|みそしる|miso soup
油|あぶら|oil
サラダ油|さらだゆ|cooking oil
オリーブオイル|おりーぶおいる|olive oil
ごま油|ごまあぶら|sesame oil
砂糖|さとう|sugar
塩|しお|salt
酢|す|vinegar
みりん|みりん|mirin (sweet cooking sake)
料理酒|りょうりしゅ|cooking sake
だし|だし|soup stock
出汁|だし|soup stock
小麦粉|こむぎこ|flour
片栗粉|かたくりこ|potato starch
パン粉|ぱんこ|breadcrumbs
ケチャップ|けちゃっぷ|ketchup
マヨネーズ|まよねーず|mayonnaise
ソース|そーす|sauce
ドレッシング|どれっしんぐ|dressing
カレールー|かれーるー|curry roux
カレー|かれー|curry
スパイス|すぱいす|spice
胡椒|こしょう|pepper
コショウ|こしょう|pepper
ふりかけ|ふりかけ|rice seasoning
海苔|のり|seaweed (nori)
のり|のり|seaweed (nori)
わかめ|わかめ|wakame seaweed
昆布|こんぶ|kelp
鰹節|かつおぶし|dried bonito flakes
ごま|ごま|sesame
胡麻|ごま|sesame
肉|にく|meat
牛肉|ぎゅうにく|beef
牛|うし|beef / cow
豚肉|ぶたにく|pork
豚|ぶた|pork
豚バラ|ぶたばら|pork belly
バラ|ばら|belly / loose
豚こま|ぶたこま|pork pieces
こま切れ|こまぎれ|small cut pieces
鶏肉|とりにく|chicken
鶏|とり|chicken
とり|とり|chicken
鶏もも|とりもも|chicken thigh
鶏むね|とりむね|chicken breast
ささみ|ささみ|chicken tender
手羽|てば|chicken wing
ひき肉|ひきにく|minced meat
挽肉|ひきにく|minced meat
合挽|あいびき|mixed beef and pork mince
ハム|はむ|ham
ベーコン|べーこん|bacon
ソーセージ|そーせーじ|sausage
ウインナー|ういんなー|sausage
焼豚|やきぶた|roast pork
焼き豚|やきぶた|roast pork
ステーキ|すてーき|steak
チキン|ちきん|chicken
ハンバーグ|はんばーぐ|hamburg steak
メンチカツ|めんちかつ|minced meat cutlet
メンチ|めんち|minced meat cutlet
カツ|かつ|cutlet
コロッケ|ころっけ|croquette
唐揚げ|からあげ|fried chicken
唐揚|からあげ|fried chicken
からあげ|からあげ|fried chicken
フライ|ふらい|fried (breaded)
天ぷら|てんぷら|tempura
魚|さかな|fish
鮭|さけ|salmon
サーモン|さーもん|salmon
さば|さば|mackerel
鯖|さば|mackerel
あじ|あじ|horse mackerel
鰺|あじ|horse mackerel
ぶり|ぶり|yellowtail
鰤|ぶり|yellowtail
まぐろ|まぐろ|tuna
鮪|まぐろ|tuna
マグロ|まぐろ|tuna
ツナ|つな|tuna (canned)
刺身|さしみ|sashimi
海老|えび|shrimp
えび|えび|shrimp
エビ|えび|shrimp
いか|いか|squid
イカ|いか|squid
たこ|たこ|octopus
タコ|たこ|octopus
貝|かい|shellfish
あさり|あさり|clams
かまぼこ|かまぼこ|fish cake
ちくわ|ちくわ|fish paste tube
干物|ひもの|dried fish
明太子|めんたいこ|spicy cod roe
たらこ|たらこ|cod roe
野菜|やさい|vegetables
サラダ|さらだ|salad
カット野菜|かっとやさい|cut vegetables
トマト|とまと|tomato
ミニトマト|みにとまと|cherry tomato
キャベツ|きゃべつ|cabbage
レタス|れたす|lettuce
きゅうり|きゅうり|cucumber
胡瓜|きゅうり|cucumber
キュウリ|きゅうり|cucumber
にんじん|にんじん|carrot
人参|にんじん|carrot
ニンジン|にんじん|carrot
玉ねぎ|たまねぎ|onion
玉葱|たまねぎ|onion
たまねぎ|たまねぎ|onion
じゃがいも|じゃがいも|potato
ジャガイモ|じゃがいも|potato
馬鈴薯|ばれいしょ|potato
さつまいも|さつまいも|sweet potato
里芋|さといも|taro
ほうれん草|ほうれんそう|spinach
小松菜|こまつな|komatsuna (greens)
白菜|はくさい|napa cabbage
ねぎ|ねぎ|green onion
長ねぎ|ながねぎ|long green onion
ネギ|ねぎ|green onion
大根|だいこん|daikon radish
なす|なす|eggplant
茄子|なす|eggplant
ナス|なす|eggplant
ピーマン|ぴーまん|green pepper
パプリカ|ぱぷりか|bell pepper
ブロッコリー|ぶろっこりー|broccoli
カリフラワー|かりふらわー|cauliflower
かぼちゃ|かぼちゃ|pumpkin
南瓜|かぼちゃ|pumpkin
もやし|もやし|bean sprouts
しいたけ|しいたけ|shiitake
椎茸|しいたけ|shiitake
えのき|えのき|enoki mushroom
しめじ|しめじ|shimeji mushroom
きのこ|きのこ|mushroom
舞茸|まいたけ|maitake mushroom
エリンギ|えりんぎ|king oyster mushroom
生姜|しょうが|ginger
しょうが|しょうが|ginger
にんにく|にんにく|garlic
大蒜|にんにく|garlic
ニンニク|にんにく|garlic
アボカド|あぼかど|avocado
とうもろこし|とうもろこし|corn
コーン|こーん|corn
枝豆|えだまめ|edamame
豆|まめ|beans
果物|くだもの|fruit
フルーツ|ふるーつ|fruit
りんご|りんご|apple
林檎|りんご|apple
リンゴ|りんご|apple
バナナ|ばなな|banana
みかん|みかん|mandarin orange
蜜柑|みかん|mandarin orange
オレンジ|おれんじ|orange
レモン|れもん|lemon
いちご|いちご|strawberry
苺|いちご|strawberry
イチゴ|いちご|strawberry
ぶどう|ぶどう|grapes
葡萄|ぶどう|grapes
ブドウ|ぶどう|grapes
もも|もも|peach
桃|もも|peach
すいか|すいか|watermelon
スイカ|すいか|watermelon
メロン|めろん|melon
キウイ|きうい|kiwi
パイン|ぱいん|pineapple
梨|なし|pear
柿|かき|persimmon
弁当|べんとう|lunch box
お弁当|おべんとう|lunch box
おにぎり|おにぎり|rice ball
サンドイッチ|さんどいっち|sandwich
サンド|さんど|sandwich
寿司|すし|sushi
お寿司|おすし|sushi
巻き寿司|まきずし|rolled sushi
惣菜|そうざい|prepared side dish
丼|どん|rice bowl
牛丼|ぎゅうどん|beef bowl
親子丼|おやこどん|chicken and egg bowl
カツ丼|かつどん|pork cutlet bowl
天丼|てんどん|tempura bowl
うどん|うどん|udon noodles
そば|そば|soba noodles
蕎麦|そば|soba noodles
ラーメン|らーめん|ramen
中華麺|ちゅうかめん|ramen noodles
焼きそば|やきそば|fried noodles
パスタ|ぱすた|pasta
スパゲティ|すぱげてぃ|spaghetti
そうめん|そうめん|thin wheat noodles
餃子|ぎょうざ|dumplings (gyoza)
シュウマイ|しゅうまい|shumai dumplings
春巻|はるまき|spring roll
ピザ|ぴざ|pizza
グラタン|ぐらたん|gratin
オムライス|おむらいす|omelette rice
チャーハン|ちゃーはん|fried rice
焼き飯|やきめし|fried rice
カップ麺|かっぷめん|cup noodles
カップ|かっぷ|cup
インスタント|いんすたんと|instant
レトルト|れとると|retort pouch
冷凍|れいとう|frozen
冷凍食品|れいとうしょくひん|frozen food
冷蔵|れいぞう|chilled
国産|こくさん|domestic (Japan-grown)
無添加|むてんか|additive-free
大盛|おおもり|large portion
特盛|とくもり|extra large portion
お菓子|おかし|sweets / snacks
菓子|かし|sweets / snacks
チョコレート|ちょこれーと|chocolate
チョコ|ちょこ|chocolate
アイス|あいす|ice cream
アイスクリーム|あいすくりーむ|ice cream
ガム|がむ|chewing gum
飴|あめ|candy
あめ|あめ|candy
キャンディ|きゃんでぃ|candy
グミ|ぐみ|gummy candy
ケーキ|けーき|cake
プリン|ぷりん|pudding
ゼリー|ぜりー|jelly
せんべい|せんべい|rice cracker
煎餅|せんべい|rice cracker
クッキー|くっきー|cookie
ビスケット|びすけっと|biscuit
スナック|すなっく|snack
ポテトチップス|ぽてとちっぷす|potato chips
ポテト|ぽてと|potato
ナッツ|なっつ|nuts
和菓子|わがし|Japanese sweets
洋菓子|ようがし|Western sweets
団子|だんご|dumpling sweet
洗剤|せんざい|detergent
柔軟剤|じゅうなんざい|fabric softener
漂白剤|ひょうはくざい|bleach
食器用洗剤|しょっきようせんざい|dish soap
食器|しょっき|tableware
ティッシュ|てぃっしゅ|tissues
ティシュ|てぃしゅ|tissues
ボックスティッシュ|ぼっくすてぃっしゅ|box tissues
トイレットペーパー|といれっとぺーぱー|toilet paper
トイレ|といれ|toilet
ペーパー|ぺーぱー|paper
キッチンペーパー|きっちんぺーぱー|kitchen paper
ゴミ袋|ごみぶくろ|trash bags
ごみ袋|ごみぶくろ|trash bags
ポリ袋|ぽりぶくろ|plastic bags
袋|ふくろ|bag
レジ袋|れじぶくろ|checkout bag
スポンジ|すぽんじ|sponge
ラップ|らっぷ|plastic wrap
アルミホイル|あるみほいる|aluminium foil
ホイル|ほいる|foil
電池|でんち|battery
乾電池|かんでんち|battery
単3|たんさん|AA
単4|たんよん|AAA
ゴム手袋|ごむてぶくろ|rubber gloves
手袋|てぶくろ|gloves
マスク|ますく|mask
除菌|じょきん|disinfecting
消毒|しょうどく|disinfectant
アルコール|あるこーる|alcohol
ウェットティッシュ|うぇっとてぃっしゅ|wet wipes
タオル|たおる|towel
ハンカチ|はんかち|handkerchief
シャンプー|しゃんぷー|shampoo
リンス|りんす|conditioner
コンディショナー|こんでぃしょなー|conditioner
トリートメント|とりーとめんと|hair treatment
ボディソープ|ぼでぃそーぷ|body soap
ハンドソープ|はんどそーぷ|hand soap
石鹸|せっけん|soap
せっけん|せっけん|soap
洗顔|せんがん|face wash
化粧水|けしょうすい|lotion (skin)
化粧|けしょう|makeup
クリーム|くりーむ|cream
ローション|ろーしょん|lotion
日焼け止め|ひやけどめ|sunscreen
歯磨き|はみがき|toothpaste
歯ブラシ|はぶらし|toothbrush
歯|は|tooth
マウスウォッシュ|まうすうぉっしゅ|mouthwash
カミソリ|かみそり|razor
髭剃り|ひげそり|shaver
生理用品|せいりようひん|sanitary products
薬|くすり|medicine
絆創膏|ばんそうこう|bandage
ばんそうこう|ばんそうこう|bandage
目薬|めぐすり|eye drops
ビタミン|びたみん|vitamin
サプリ|さぷり|supplement
サプリメント|さぷりめんと|supplement
虫よけ|むしよけ|insect repellent
殺虫剤|さっちゅうざい|insecticide
文房具|ぶんぼうぐ|stationery
ノート|のーと|notebook
ペン|ぺん|pen
ボールペン|ぼーるぺん|ballpoint pen
電球|でんきゅう|light bulb
乾燥|かんそう|dry
合計|ごうけい|total
小計|しょうけい|subtotal
総合計|そうごうけい|grand total
税|ぜい|tax
消費税|しょうひぜい|consumption tax
内税|うちぜい|tax included
外税|そとぜい|tax added
税込|ぜいこみ|tax included
税抜|ぜいぬき|tax excluded
対象|たいしょう|subject to
値引|ねびき|discount
値引き|ねびき|discount
割引|わりびき|discount
割|わり|percent off
クーポン|くーぽん|coupon
ポイント|ぽいんと|points
現金|げんきん|cash
お釣り|おつり|change
お釣|おつり|change
釣銭|つりせん|change
預り|あずかり|tendered
お預り|おあずかり|tendered
領収書|りょうしゅうしょ|receipt (official)
領収証|りょうしゅうしょう|receipt (official)
レシート|れしーと|receipt
お買上|おかいあげ|purchase
お買い上げ|おかいあげ|purchase
点数|てんすう|number of items
軽減税率|けいげんぜいりつ|reduced tax rate
軽|けい|reduced tax rate mark
特売|とくばい|sale
値下げ|ねさげ|price cut
半額|はんがく|half price
個|こ|piece
本|ほん|bottle / piece
枚|まい|sheet
入|いり|pack of
大|だい|large
中|ちゅう|medium
小|しょう|small
徳用|とくよう|value pack
詰替|つめかえ|refill
詰め替え|つめかえ|refill
業務用|ぎょうむよう|bulk pack
セット|せっと|set
お得|おとく|good value
ライフ|らいふ|Life (supermarket)
イオン|いおん|AEON
マルエツ|まるえつ|Maruetsu (supermarket)
西友|せいゆう|Seiyu (supermarket)
ダイエー|だいえー|Daiei (supermarket)
サミット|さみっと|Summit (supermarket)
業務スーパー|ぎょうむすーぱー|Gyomu Super
まいばすけっと|まいばすけっと|My Basket
セブンイレブン|せぶんいれぶん|7-Eleven
セブン-イレブン|せぶんいれぶん|7-Eleven
ファミリーマート|ふぁみりーまーと|FamilyMart
ローソン|ろーそん|Lawson
ドン・キホーテ|どん・きほーて|Don Quijote (discount store)
ドンキ|どんき|Don Quijote
ダイソー|だいそー|Daiso (100-yen shop)
マツモトキヨシ|まつもときよし|Matsumoto Kiyoshi (drugstore)
ユニクロ|ゆにくろ|Uniqlo
マクドナルド|まくどなるど|McDonald's
スターバックス|すたーばっくす|Starbucks
スーパー|すーぱー|supermarket
店|てん|shop
支店|してん|branch
店舗|てんぽ|store
駅|えき|station
`;
const MAP = new Map(); let MAXLEN = 1;
for (const line of WORDS.split('\n')) { const p = line.split('|'); if (p.length < 3 || !p[0].trim()) continue; const w = p[0].trim(); MAP.set(w, { reading: p[1].trim(), en: p[2].trim() }); MAXLEN = Math.max(MAXLEN, w.length); }

export const hasJapanese = (s) => /[぀-ヿ㐀-鿿]/.test(String(s || ''));
// { romaji, english, unknown } : `unknown` lists kanji that are not in the word list (they stay as kanji in the romaji line)
export function describeJa(name) {
  const s = String(name || '').normalize('NFKC').replace(/\s+/g, ' ').trim(); if (!hasJapanese(s)) return null;
  const rom = [], en = [], unknown = []; let i = 0, kana = '';
  const flush = () => { if (kana) { rom.push(kanaToRomaji(kana)); kana = ''; } };
  while (i < s.length) {
    let hit = null, len = 0;
    for (let n = Math.min(MAXLEN, s.length - i); n >= 1; n--) { const w = MAP.get(s.slice(i, i + n)); if (w) { hit = w; len = n; break; } }
    // do not cut a longer kana word in half: a one-letter hiragana entry (の, は…) is never matched on its own
    if (hit && len === 1 && /[぀-ゟ]/.test(s[i])) hit = null;
    if (hit) { flush(); rom.push(kanaToRomaji(hit.reading)); en.push(hit.en); i += len; continue; }
    const c = s[i];
    if (isKana(c)) { kana += c; i++; continue; }
    flush();
    if (/[㐀-鿿]/.test(c)) { rom.push(c); unknown.push(c); } else rom.push(c);
    i++;
  }
  flush();
  // glue digits, units and punctuation to their neighbours instead of spacing them out
  const romaji = rom.join(' ').replace(/ ([0-9%.,/()×x+-]) ?/g, '$1').replace(/([\u3400-\u9fff]) (?=[\u3400-\u9fff])/g, '$1').replace(/ +/g, ' ').trim();
  return { romaji, english: [...new Set(en)].join(' · '), unknown: [...new Set(unknown)] };
}
