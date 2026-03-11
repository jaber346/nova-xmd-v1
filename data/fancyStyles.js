// ==================== data/fancyStyles.js ====================
// ✅ 35 styles d'écriture SAFE WhatsApp (sans �) | ✅ CommonJS

const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const az = "abcdefghijklmnopqrstuvwxyz";
const d09 = "0123456789";

function makeMap(from, to) {
  const m = new Map();
  for (let i = 0; i < from.length; i++) m.set(from[i], to[i]);
  return (s) => [...String(s)].map(c => m.get(c) ?? c).join("");
}
const chain = (...f) => (s) => f.reduce((a, fn) => fn(a), String(s));

// === Alphabets ===
const BOLD_AZ = "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙";
const BOLD_az = "𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳";

const ITB_AZ = "𝑨𝑩𝑪𝑫𝑬𝑭𝑮𝑯𝑰𝑱𝑲𝑳𝑴𝑵𝑶𝑷𝑸𝑹𝑺𝑻𝑼𝑽𝑾𝑿𝒀𝒁";
const ITB_az = "𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛";

const SCRIPT_AZ = "𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩";
const SCRIPT_az = "𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃";

const FRAK_AZ = "𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅";
const FRAK_az = "𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟";

const FW_AZ = "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ";
const FW_az = "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ";
const FW_09 = "０１２３４５６７８９";

const OUT_AZ = "🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉";
const SQ_AZ  = "🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉";

// === Mappers ===
const bold = chain(makeMap(AZ,BOLD_AZ), makeMap(az,BOLD_az));
const itbold = chain(makeMap(AZ,ITB_AZ), makeMap(az,ITB_az));
const script = chain(makeMap(AZ,SCRIPT_AZ), makeMap(az,SCRIPT_az));
const frak = chain(makeMap(AZ,FRAK_AZ), makeMap(az,FRAK_az));
const full = chain(makeMap(AZ,FW_AZ), makeMap(az,FW_az), makeMap(d09,FW_09));
const outlined = makeMap(AZ,OUT_AZ);
const squared = makeMap(AZ,SQ_AZ);

// === Simple safe effects ===
const spaced = s => [...String(s)].join(" ");
const dotted = s => [...String(s)].join("•");
const dashed = s => [...String(s)].join("-");
const under = s => [...String(s)].join("_");
const wave = s => `~ ${s} ~`;
const stars = s => `★ ${s} ★`;
const arrows = s => `➤ ${s}`;
const brackets = s => `[ ${s} ]`;
const braces = s => `{ ${s} }`;
const quotes = s => `❝ ${s} ❞`;
const caps = s => String(s).toUpperCase();
const lower = s => String(s).toLowerCase();
const reverse = s => [...String(s)].reverse().join("");
const double = s => [...String(s)].map(c=>c+c).join("");
const box = s => `『 ${s} 』`;
const angle = s => `《 ${s} 》`;
const dotsides = s => `• ${s} •`;
const dashsides = s => `- ${s} -`;
const pipes = s => `| ${s} |`;
const mix = s => String(s).split("").map((c,i)=>i%2?c.toUpperCase():c.toLowerCase()).join("");

const clean = s => String(s).replace(/\uFFFD/g,"").trim();

// === 35 STYLES ===
const FANCY_STYLES = [
  s=>s,            // 1 Normal
  bold,            // 2 Bold
  itbold,          // 3 Italic Bold
  script,          // 4 Script
  frak,            // 5 Fraktur
  full,            // 6 Fullwidth
  outlined,        // 7 Outlined
  squared,         // 8 Squared
  spaced,          // 9 Spaced
  dotted,          //10 Dot
  dashed,          //11 Dash
  under,           //12 Underline
  stars,           //13 Stars
  arrows,          //14 Arrow
  brackets,        //15 Brackets
  braces,          //16 Braces
  quotes,          //17 Quotes
  caps,            //18 ALL CAPS
  lower,           //19 lower
  reverse,         //20 Reverse
  double,          //21 Double
  wave,            //22 Wave
  box,             //23 Box
  angle,           //24 Angle
  dotsides,        //25 Dot sides
  dashsides,       //26 Dash sides
  pipes,           //27 Pipes
  mix,             //28 MiXeD
  s=>`★${s}★`,     //29 Tight stars
  s=>`(${s})`,     //30 Parenthesis
  s=>`「${s}」`,   //31 Japanese quotes
  s=>`《${s}》`,   //32 Double angle
  s=>`【${s}】`,   //33 Heavy box
  s=>`✦ ${s} ✦`,  //34 Diamond
  s=>`❖ ${s} ❖`,  //35 Fancy diamond
];

function fancyApply(num, text) {
  const i = Number(num) - 1;
  if (!FANCY_STYLES[i]) return null;
  return clean(FANCY_STYLES[i](text));
}

function fancyListPreview(example="NOVA XMD V1") {
  return FANCY_STYLES
    .map((fn,i)=>`${i+1}- ${clean(fn(example))}`)
    .join("\n");
}

module.exports = {
  FANCY_STYLES,
  fancyApply,
  fancyListPreview
};