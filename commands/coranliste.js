const config = require("../config");

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1
    }
  };
}

const CORAN_IMAGE = "https://files.catbox.moe/yoat83.jpg";

const sourates = [
["الفاتحة","Al-Fatiha"],
["البقرة","Al-Baqara"],
["آل عمران","Aal-Imran"],
["النساء","An-Nisa"],
["المائدة","Al-Ma'idah"],
["الأنعام","Al-An'am"],
["الأعراف","Al-A'raf"],
["الأنفال","Al-Anfal"],
["التوبة","At-Tawbah"],
["يونس","Yunus"],
["هود","Hud"],
["يوسف","Yusuf"],
["الرعد","Ar-Ra'd"],
["إبراهيم","Ibrahim"],
["الحجر","Al-Hijr"],
["النحل","An-Nahl"],
["الإسراء","Al-Isra"],
["الكهف","Al-Kahf"],
["مريم","Maryam"],
["طه","Ta-Ha"],
["الأنبياء","Al-Anbiya"],
["الحج","Al-Hajj"],
["المؤمنون","Al-Mu'minun"],
["النور","An-Nur"],
["الفرقان","Al-Furqan"],
["الشعراء","Ash-Shu'ara"],
["النمل","An-Naml"],
["القصص","Al-Qasas"],
["العنكبوت","Al-Ankabut"],
["الروم","Ar-Rum"],
["لقمان","Luqman"],
["السجدة","As-Sajda"],
["الأحزاب","Al-Ahzab"],
["سبأ","Saba"],
["فاطر","Fatir"],
["يس","Ya-Sin"],
["الصافات","As-Saffat"],
["ص","Sad"],
["الزمر","Az-Zumar"],
["غافر","Ghafir"],
["فصلت","Fussilat"],
["الشورى","Ash-Shura"],
["الزخرف","Az-Zukhruf"],
["الدخان","Ad-Dukhan"],
["الجاثية","Al-Jathiya"],
["الأحقاف","Al-Ahqaf"],
["محمد","Muhammad"],
["الفتح","Al-Fath"],
["الحجرات","Al-Hujurat"],
["ق","Qaf"],
["الذاريات","Adh-Dhariyat"],
["الطور","At-Tur"],
["النجم","An-Najm"],
["القمر","Al-Qamar"],
["الرحمن","Ar-Rahman"],
["الواقعة","Al-Waqi'a"],
["الحديد","Al-Hadid"],
["المجادلة","Al-Mujadila"],
["الحشر","Al-Hashr"],
["الممتحنة","Al-Mumtahana"],
["الصف","As-Saff"],
["الجمعة","Al-Jumu'a"],
["المنافقون","Al-Munafiqun"],
["التغابن","At-Taghabun"],
["الطلاق","At-Talaq"],
["التحريم","At-Tahrim"],
["الملك","Al-Mulk"],
["القلم","Al-Qalam"],
["الحاقة","Al-Haqqa"],
["المعارج","Al-Ma'arij"],
["نوح","Nuh"],
["الجن","Al-Jinn"],
["المزمل","Al-Muzzammil"],
["المدثر","Al-Muddaththir"],
["القيامة","Al-Qiyama"],
["الإنسان","Al-Insan"],
["المرسلات","Al-Mursalat"],
["النبأ","An-Naba"],
["النازعات","An-Nazi'at"],
["عبس","Abasa"],
["التكوير","At-Takwir"],
["الإنفطار","Al-Infitar"],
["المطففين","Al-Mutaffifin"],
["الإنشقاق","Al-Inshiqaq"],
["البروج","Al-Buruj"],
["الطارق","At-Tariq"],
["الأعلى","Al-A'la"],
["الغاشية","Al-Ghashiya"],
["الفجر","Al-Fajr"],
["البلد","Al-Balad"],
["الشمس","Ash-Shams"],
["الليل","Al-Layl"],
["الضحى","Ad-Duha"],
["الشرح","Ash-Sharh"],
["التين","At-Tin"],
["العلق","Al-Alaq"],
["القدر","Al-Qadr"],
["البينة","Al-Bayyina"],
["الزلزلة","Az-Zalzala"],
["العاديات","Al-Adiyat"],
["القارعة","Al-Qari'a"],
["التكاثر","At-Takathur"],
["العصر","Al-Asr"],
["الهمزة","Al-Humaza"],
["الفيل","Al-Fil"],
["قريش","Quraysh"],
["الماعون","Al-Ma'un"],
["الكوثر","Al-Kawthar"],
["الكافرون","Al-Kafirun"],
["النصر","An-Nasr"],
["المسد","Al-Masad"],
["الإخلاص","Al-Ikhlas"],
["الفلق","Al-Falaq"],
["الناس","An-Nas"]
];

module.exports = {
  name: "coranliste",
  category: "Islam",
  description: "Liste complète FR + AR des 114 sourates",

  async execute(sock, m) {
    const from = m.key.remoteJid;

    let text =
`╭━━〔 📖 LISTE DU CORAN 〕━━╮
┃ 📚 114 Sourates
┃ 🎧 Utilise : ${config.PREFIX || "."}coran <num>
╰━━━━━━━━━━━━━━━━━━━━━━╯

`;

    sourates.forEach((s, i) => {
      text += `*${i + 1}.* ${s[0]}  -  ${s[1]}\n`;
    });

    await sock.sendMessage(
      from,
      {
        image: { url: CORAN_IMAGE },
        caption: text,
        contextInfo: newsletterCtx()
      },
      { quoted: m }
    );
  }
};