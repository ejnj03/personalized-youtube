import {
  Inter, Space_Grotesk, Bricolage_Grotesque, Geist,
  Anton, Big_Shoulders, Unbounded, Syne,
  Fraunces, DM_Serif_Display, Bodoni_Moda, Cormorant_Garamond,
  Newsreader, Lora, EB_Garamond,
  JetBrains_Mono, IBM_Plex_Mono, Space_Mono,
  Caveat, Permanent_Marker, Architects_Daughter,
  Fredoka,
  Monoton, Bungee,
  Noto_Sans_KR, IBM_Plex_Sans_KR, Black_Han_Sans, Gasoek_One,
  Do_Hyeon, Yeon_Sung, Moirai_One, Bagel_Fat_One,
  Hahmlet, Song_Myung, Nanum_Myeongjo, Gowun_Batang, Nanum_Pen_Script,
} from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter-loaded' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk-loaded' });
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage-loaded' });
const geist = Geist({ subsets: ['latin'], variable: '--font-geist-loaded' });
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton-loaded' });
const bigShoulders = Big_Shoulders({ subsets: ['latin'], variable: '--font-big-shoulders-loaded', adjustFontFallback: false });
const unbounded = Unbounded({ subsets: ['latin'], variable: '--font-unbounded-loaded' });
const syne = Syne({ subsets: ['latin'], variable: '--font-syne-loaded' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces-loaded' });
const dmSerif = DM_Serif_Display({ subsets: ['latin'], weight: '400', variable: '--font-dm-serif-loaded' });
const bodoniModa = Bodoni_Moda({ subsets: ['latin'], variable: '--font-bodoni-moda-loaded' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-cormorant-loaded' });
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader-loaded' });
const lora = Lora({ subsets: ['latin'], variable: '--font-lora-loaded' });
const ebGaramond = EB_Garamond({ subsets: ['latin'], variable: '--font-eb-garamond-loaded' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-loaded' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-ibm-plex-mono-loaded' });
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-space-mono-loaded' });
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat-loaded' });
const permanentMarker = Permanent_Marker({ subsets: ['latin'], weight: '400', variable: '--font-permanent-marker-loaded' });
const architectsDaughter = Architects_Daughter({ subsets: ['latin'], weight: '400', variable: '--font-architects-daughter-loaded' });
const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka-loaded' });
const monoton = Monoton({ subsets: ['latin'], weight: '400', variable: '--font-monoton-loaded' });
const bungee = Bungee({ subsets: ['latin'], weight: '400', variable: '--font-bungee-loaded' });

const notoSansKr = Noto_Sans_KR({ display: 'optional', preload: false, variable: '--font-noto-sans-kr-loaded' });
const ibmPlexSansKr = IBM_Plex_Sans_KR({ weight: ['400', '500', '600', '700'], display: 'optional', preload: false, variable: '--font-ibm-plex-sans-kr-loaded' });
const blackHanSans = Black_Han_Sans({ weight: '400', display: 'optional', preload: false, variable: '--font-black-han-sans-loaded' });
const gasoekOne = Gasoek_One({ weight: '400', display: 'optional', preload: false, variable: '--font-gasoek-one-loaded' });
const doHyeon = Do_Hyeon({ weight: '400', display: 'optional', preload: false, variable: '--font-do-hyeon-loaded' });
const yeonSung = Yeon_Sung({ weight: '400', display: 'optional', preload: false, variable: '--font-yeon-sung-loaded' });
const moiraiOne = Moirai_One({ weight: '400', display: 'optional', preload: false, variable: '--font-moirai-one-loaded' });
const bagelFatOne = Bagel_Fat_One({ weight: '400', display: 'optional', preload: false, variable: '--font-bagel-fat-one-loaded' });
const hahmlet = Hahmlet({ display: 'optional', preload: false, variable: '--font-hahmlet-loaded' });
const songMyung = Song_Myung({ weight: '400', display: 'optional', variable: '--font-song-myung-loaded' });
const nanumMyeongjo = Nanum_Myeongjo({ weight: ['400', '700', '800'], display: 'optional', preload: false, variable: '--font-nanum-myeongjo-loaded' });
const gowunBatang = Gowun_Batang({ weight: ['400', '700'], display: 'optional', preload: false, variable: '--font-gowun-batang-loaded' });
const nanumPenScript = Nanum_Pen_Script({ weight: '400', display: 'optional', preload: false, variable: '--font-nanum-pen-script-loaded' });

export const fontVariables = [
  inter, spaceGrotesk, bricolage, geist,
  anton, bigShoulders, unbounded, syne,
  fraunces, dmSerif, bodoniModa, cormorant,
  newsreader, lora, ebGaramond,
  jetbrains, ibmPlexMono, spaceMono,
  caveat, permanentMarker, architectsDaughter,
  fredoka,
  monoton, bungee,
  notoSansKr, ibmPlexSansKr, blackHanSans, gasoekOne,
  doHyeon, yeonSung, moiraiOne, bagelFatOne,
  hahmlet, songMyung, nanumMyeongjo, gowunBatang, nanumPenScript,
].map((f) => f.variable).join(' ');
