'use client';

import { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { fice, mediaUrl, type ScreenState, type VotingScreenData } from '@/lib/api';
import { Pixels, FROG_RUNS } from '@/components/ui/FrogMascot';
import { USER_BOT_USERNAME } from '@/lib/bot';

// Stage screen for a nomination: photo grid / slideshow while voting is open,
// a "votes counted" summary, and a step-by-step podium ceremony driven by the operator.

type ThemeId = 'fice' | 'ny' | 'hw' | 'ball';
type Mode = 'live' | 'closed' | 'ceremony';
type View = 'auto' | 'grid' | 'show';
type Hat = 'none' | 'santa' | 'witch' | 'crown';

const G = 'linear-gradient(90deg, #2eff97 -19.71%, #36dfff 48.48%, #ad46ff 116.67%)';
const NYG = 'linear-gradient(90deg, #ffe29a, #ffc24d)';
const HWG = 'linear-gradient(90deg, #ff7a1a, #ffb020)';
const GOLD = 'linear-gradient(90deg, #b8893a, #f1d594 50%, #b8893a)';

const F = {
  mulish: 'var(--font-mulish), system-ui, sans-serif',
  unb: 'var(--font-unbounded), var(--font-mulish), sans-serif',
  rubik: 'var(--font-rubik), system-ui, sans-serif',
  wet: 'var(--font-wet), var(--font-rubik), sans-serif',
  corm: 'var(--font-cormorant), Georgia, serif',
  forum: 'var(--font-forum), Georgia, serif',
};

const THEMES = {
  fice: {
    id: 'fice', name: 'FICE', swatch: G, hat: 'none',
    bg: '#101010', text: '#ffffff', muted: '#cdcdcd', subtle: '#a1a1aa', ring: '#101010',
    display: F.mulish, dw: 900, ds: 'normal', dls: '-0.02em', qW: 800,
    body: F.mulish, label: F.mulish, lw: 800, lls: '0.14em',
    titleSize: 96, cerTitle: 72, panelHead: 'Голосуй у Telegram', panelHeadSize: 44, slideName: 68,
    nameFont: F.mulish, nameW: 800, nameS: 'normal', gridName: 21, nameAdj: 0,
    a1: '#2eff97', grad: G,
    cardBg: '#16161b', cardBorder: '#2a2a33', cardBw: '2px', cardRadius: '18px', photoRadius: '10px', photoBorder: 'none', cardPadTop: 8, cardOutline: 'none', drip: false,
    cardSolid: '#101010', topR: '20px', innerR: '16px', revPhotoR: '12px',
    monoBg: 'linear-gradient(160deg, rgba(46, 255, 151, 0.32), rgba(54, 223, 255, 0.28) 50%, rgba(173, 70, 255, 0.34))', monoColor: '#ffffff', monoFont: F.mulish, monoW: 900, monoS: 'normal',
    panelBg: 'linear-gradient(#101010, #101010) padding-box, ' + G + ' border-box', panelBorder: '4px solid transparent', panelBw: 4, panelRadius: '20px', panelShadow: 'none',
    pillBg: G, pillText: '#000000', pillRadius: '16px',
    barBg: G, barH: '10px', barW: '220px', barR: '999px',
    slideTint: 'linear-gradient(90deg, rgba(16, 16, 16, 0.25) 0%, rgba(16, 16, 16, 0.35) 66%, rgba(16, 16, 16, 0.92) 73%, #101010 100%)',
    slideRing: '0 40px 120px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.14)', slideR: '16px',
    ped1: G, ped2: 'linear-gradient(90deg, #00e3f3 0%, #2b7fff 100%)', ped3: 'linear-gradient(90deg, #ff8904 0%, #fb2c36 100%)', pedText: '#000000',
    key1: '#2eff97', key2: '#36dfff', key3: '#ff8904', pedFont: F.mulish, pedW: 900, pedS: 'normal', roman: false,
    sealBg: '#16161b', sealBorderStyle: 'dashed', beam: '214, 255, 236',
    marqueeBg: G, marqueeText: '#000000', sepR: '0px', sepRot: '0deg',
    badgeBg: G, badgeText: '#000000', badgeFont: F.mulish, badgeLS: '0.06em',
    conf: ['#2eff97', '#36dfff', '#ad46ff', '#f6339a', '#ff8904', '#ffd700', '#ffffff'], confR: ['0px', '0px', '2px'],
  },
  ny: {
    id: 'ny', name: 'Новий рік', swatch: 'linear-gradient(135deg, #0f2748, #ffc24d)', hat: 'santa',
    bg: 'radial-gradient(1100px 620px at 85% -8%, rgba(143, 227, 255, 0.20), transparent 62%), radial-gradient(900px 600px at -5% 105%, rgba(255, 90, 110, 0.14), transparent 65%), linear-gradient(180deg, #06122a 0%, #0a1b3a 55%, #0f2748 100%)',
    text: '#f4f8ff', muted: '#c3d5ee', subtle: '#93abc9', ring: '#0a1b3a',
    display: F.unb, dw: 800, ds: 'normal', dls: '-0.01em', qW: 700,
    body: F.mulish, label: F.unb, lw: 600, lls: '0.12em',
    titleSize: 76, cerTitle: 60, panelHead: 'Голосуй у Telegram', panelHeadSize: 36, slideName: 52,
    nameFont: F.mulish, nameW: 800, nameS: 'normal', gridName: 21, nameAdj: -4,
    a1: '#ffd27a', grad: 'linear-gradient(90deg, #ffe29a 0%, #ffc24d 45%, #ff5a6e 100%)',
    cardBg: 'rgba(255, 255, 255, 0.06)', cardBorder: 'rgba(176, 214, 255, 0.30)', cardBw: '1.5px', cardRadius: '22px', photoRadius: '14px', photoBorder: 'none', cardPadTop: 8, cardOutline: 'none', drip: false,
    cardSolid: '#0b1d3c', topR: '24px', innerR: '20px', revPhotoR: '16px',
    monoBg: 'linear-gradient(160deg, rgba(143, 227, 255, 0.30), rgba(255, 210, 122, 0.22))', monoColor: '#f4f8ff', monoFont: F.unb, monoW: 700, monoS: 'normal',
    panelBg: 'rgba(8, 22, 48, 0.78)', panelBorder: '2px solid rgba(255, 210, 122, 0.6)', panelBw: 2, panelRadius: '28px', panelShadow: '0 0 60px rgba(255, 210, 122, 0.14)',
    pillBg: NYG, pillText: '#0a1b3a', pillRadius: '999px',
    barBg: 'linear-gradient(90deg, #ffe29a, #ffc24d 50%, #ff5a6e)', barH: '8px', barW: '200px', barR: '999px',
    slideTint: 'linear-gradient(90deg, rgba(6, 18, 42, 0.25) 0%, rgba(6, 18, 42, 0.35) 66%, rgba(8, 22, 48, 0.92) 73%, #0a1b3a 100%)',
    slideRing: '0 40px 120px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255, 210, 122, 0.75)', slideR: '20px',
    ped1: NYG, ped2: 'linear-gradient(90deg, #eef5ff, #a9cdf5)', ped3: 'linear-gradient(90deg, #ff8a7a, #e8354a)', pedText: '#0a1b3a',
    key1: '#ffd27a', key2: '#cfe6ff', key3: '#ff7f8c', pedFont: F.unb, pedW: 800, pedS: 'normal', roman: false,
    sealBg: 'rgba(255, 255, 255, 0.05)', sealBorderStyle: 'solid', beam: '214, 234, 255',
    marqueeBg: 'linear-gradient(90deg, #ffe29a, #ffc24d 50%, #ff8a7a)', marqueeText: '#0a1b3a', sepR: '2px', sepRot: '45deg',
    badgeBg: NYG, badgeText: '#0a1b3a', badgeFont: F.unb, badgeLS: '0.04em',
    conf: ['#ffffff', '#e3f1ff', '#ffd27a', '#ff5a6e', '#8fe3ff'], confR: ['50%', '50%', '2px'],
  },
  hw: {
    id: 'hw', name: 'Хелловін', swatch: 'linear-gradient(135deg, #2a1640, #ff7a1a)', hat: 'witch',
    bg: 'radial-gradient(1000px 640px at 50% -12%, rgba(140, 80, 255, 0.30), transparent 62%), radial-gradient(760px 520px at 0% 105%, rgba(255, 122, 26, 0.18), transparent 68%), #0c0710',
    text: '#f7efff', muted: '#d2c3e2', subtle: '#a594ba', ring: '#0c0710',
    display: F.wet, dw: 400, ds: 'normal', dls: '0', qW: 400,
    body: F.rubik, label: F.rubik, lw: 700, lls: '0.14em',
    titleSize: 84, cerTitle: 68, panelHead: 'Голосуй у Telegram', panelHeadSize: 42, slideName: 64,
    nameFont: F.rubik, nameW: 700, nameS: 'normal', gridName: 21, nameAdj: -2,
    a1: '#ff7a1a', grad: HWG,
    cardBg: '#170f20', cardBorder: '#3d2756', cardBw: '2px', cardRadius: '16px', photoRadius: '10px', photoBorder: 'none', cardPadTop: 20, cardOutline: 'none', drip: true,
    cardSolid: '#130b1a', topR: '22px', innerR: '18px', revPhotoR: '12px',
    monoBg: 'radial-gradient(circle at 50% 38%, rgba(255, 122, 26, 0.45), rgba(120, 60, 200, 0.28) 58%, rgba(0, 0, 0, 0) 80%), #22152f', monoColor: '#ffe7d1', monoFont: F.wet, monoW: 400, monoS: 'normal',
    panelBg: '#120a18', panelBorder: '3px solid #ff7a1a', panelBw: 3, panelRadius: '24px', panelShadow: '0 0 70px rgba(255, 122, 26, 0.22)',
    pillBg: HWG, pillText: '#140a00', pillRadius: '16px',
    barBg: HWG, barH: '10px', barW: '200px', barR: '999px',
    slideTint: 'linear-gradient(90deg, rgba(12, 7, 16, 0.25) 0%, rgba(12, 7, 16, 0.35) 66%, rgba(12, 7, 16, 0.92) 73%, #0c0710 100%)',
    slideRing: '0 40px 120px rgba(0, 0, 0, 0.6), 0 0 0 3px #ff7a1a, 0 0 70px rgba(255, 122, 26, 0.35)', slideR: '12px',
    ped1: HWG, ped2: 'linear-gradient(90deg, #b794ff, #7a45ff)', ped3: 'linear-gradient(90deg, #9be36a, #4fb33f)', pedText: '#0c0710',
    key1: '#ff9a3c', key2: '#b794ff', key3: '#9be36a', pedFont: F.wet, pedW: 400, pedS: 'normal', roman: false,
    sealBg: '#170f20', sealBorderStyle: 'solid', beam: '255, 212, 160',
    marqueeBg: HWG, marqueeText: '#140a00', sepR: '50%', sepRot: '0deg',
    badgeBg: HWG, badgeText: '#140a00', badgeFont: F.wet, badgeLS: '0.02em',
    conf: ['#ff7a1a', '#ffb020', '#b794ff', '#7a45ff', '#b6ff5c'], confR: ['0 100% 0 100%', '50%', '2px'],
  },
  ball: {
    id: 'ball', name: 'Бал', swatch: GOLD, hat: 'crown',
    bg: 'radial-gradient(1100px 600px at 50% -14%, rgba(232, 194, 106, 0.22), transparent 64%), radial-gradient(900px 700px at 50% 118%, rgba(120, 32, 46, 0.38), transparent 70%), #0e0b09',
    text: '#f4ebdd', muted: '#dccfb9', subtle: '#ad9c80', ring: '#0e0b09',
    display: F.corm, dw: 600, ds: 'italic', dls: '0', qW: 600,
    body: F.corm, label: F.forum, lw: 400, lls: '0.3em',
    titleSize: 116, cerTitle: 86, panelHead: 'Голосуйте в Telegram', panelHeadSize: 48, slideName: 84,
    nameFont: F.corm, nameW: 700, nameS: 'italic', gridName: 25, nameAdj: 6,
    a1: '#e2be72', grad: GOLD,
    cardBg: 'rgba(226, 190, 114, 0.04)', cardBorder: 'rgba(226, 190, 114, 0.55)', cardBw: '1px', cardRadius: '2px', photoRadius: '2px', photoBorder: '1px solid rgba(226, 190, 114, 0.6)', cardPadTop: 10, cardOutline: '1px solid rgba(226, 190, 114, 0.22)', drip: false,
    cardSolid: '#120e0b', topR: '6px', innerR: '4px', revPhotoR: '2px',
    monoBg: 'radial-gradient(circle at 50% 40%, rgba(241, 213, 148, 0.26), rgba(142, 42, 59, 0.26) 72%)', monoColor: '#f1d594', monoFont: F.corm, monoW: 600, monoS: 'italic',
    panelBg: 'rgba(14, 11, 9, 0.92)', panelBorder: '1px solid rgba(226, 190, 114, 0.7)', panelBw: 1, panelRadius: '4px', panelShadow: '0 0 0 8px rgba(14, 11, 9, 0.92), 0 0 0 9px rgba(226, 190, 114, 0.3)',
    pillBg: GOLD, pillText: '#1a120a', pillRadius: '4px',
    barBg: GOLD, barH: '2px', barW: '280px', barR: '0px',
    slideTint: 'linear-gradient(90deg, rgba(14, 11, 9, 0.3) 0%, rgba(14, 11, 9, 0.4) 66%, rgba(14, 11, 9, 0.93) 73%, #0e0b09 100%)',
    slideRing: '0 40px 120px rgba(0, 0, 0, 0.6), 0 0 0 2px #e2be72, 0 0 0 10px rgba(14, 11, 9, 0.85), 0 0 0 11px rgba(226, 190, 114, 0.5)', slideR: '2px',
    ped1: GOLD, ped2: 'linear-gradient(90deg, #8e8e8e, #ececec 50%, #8e8e8e)', ped3: 'linear-gradient(90deg, #8a5a35, #d9a273 50%, #8a5a35)', pedText: '#1a120a',
    key1: '#f1d594', key2: '#e6e6e6', key3: '#d9a273', pedFont: F.corm, pedW: 700, pedS: 'normal', roman: true,
    sealBg: 'rgba(226, 190, 114, 0.04)', sealBorderStyle: 'solid', beam: '255, 236, 196',
    marqueeBg: GOLD, marqueeText: '#1a120a', sepR: '0px', sepRot: '45deg',
    badgeBg: GOLD, badgeText: '#1a120a', badgeFont: F.forum, badgeLS: '0.3em',
    conf: ['#f1d594', '#e2be72', '#b8893a', '#f4ebdd', '#8e2a3b'], confR: ['50%', '50% 0 50% 0', '50%'],
  },
} as const;

type Theme = (typeof THEMES)[ThemeId];
const THEME_IDS: ThemeId[] = ['fice', 'ny', 'hw', 'ball'];

const GLIDE = 'cubic-bezier(.65, 0, .35, 1)';
// How the QR glides between the grid panel and the slideshow card.
const QR_GLIDE = ['left', 'top', 'width', 'height', 'padding', 'border-radius']
  .map((prop) => `${prop} .9s ${GLIDE}`)
  .concat('opacity .4s ease')
  .join(', ');
// …and how the panel frame around it grows into the grid panel and back.
const FRAME_GLIDE = ['left', 'top', 'width', 'height', 'box-shadow']
  .map((prop) => `${prop} .9s ${GLIDE}`)
  .concat('opacity .4s ease')
  .join(', ');

const CSS = `
.floaty{animation:floaty 3.2s ease-in-out infinite}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.fadeup{animation:fadeup .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes fadeup{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
.cardin{animation:cardin .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes cardin{from{opacity:0;transform:translateY(40px) scale(.96)}to{opacity:1;transform:none}}
.sheen{position:absolute;top:-20%;left:0;width:45%;height:140%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.10),rgba(255,255,255,0));transform:translateX(-160%) skewX(-12deg);animation:sheen 9s ease-in-out infinite;pointer-events:none}
@keyframes sheen{0%{transform:translateX(-160%) skewX(-12deg)}14%,100%{transform:translateX(420%) skewX(-12deg)}}
.bgin{animation:bgin 1.1s ease both}
@keyframes bgin{from{opacity:0}to{opacity:1}}
.photoin{animation:photoin 1s cubic-bezier(.2,.8,.2,1) .1s both}
@keyframes photoin{from{opacity:0;transform:scale(.9) translateY(30px);filter:blur(18px)}to{opacity:1;transform:none;filter:none}}
.fadein{animation:fadein .6s ease both}
@keyframes fadein{from{opacity:0}to{opacity:1}}
.fillbar{transform-origin:0 50%;animation:fillbar 5s linear both}
@keyframes fillbar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes rise{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-150px) scale(1);opacity:0}}
@keyframes snow{from{transform:translate3d(0,-40px,0)}to{transform:translate3d(40px,1140px,0)}}
@keyframes twinkle{from{opacity:.25}to{opacity:1}}
@keyframes batfly{0%{transform:translate(-200px,40px)}25%{transform:translate(500px,-10px)}50%{transform:translate(1100px,50px)}75%{transform:translate(1700px,0)}100%{transform:translate(2200px,40px)}}
.flap{animation:flap .28s ease-in-out infinite alternate;transform-origin:50% 40%}
@keyframes flap{from{transform:scaleY(1)}to{transform:scaleY(.45)}}
@keyframes fog{from{transform:translateX(-90px)}to{transform:translateX(90px)}}
.breathe{animation:breathe 2.6s ease-in-out infinite}
.breathe.fast{animation-duration:.7s}
@keyframes breathe{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.07);opacity:1}}
.flicker{animation:flicker 3s linear infinite}
.flicker.fast{animation-duration:.9s}
@keyframes flicker{0%,100%{opacity:1}8%{opacity:.5}10%{opacity:1}52%{opacity:.75}54%{opacity:1}70%{opacity:.55}72%{opacity:1}}
.shake{animation:shake .32s ease-in-out infinite alternate}
@keyframes shake{from{transform:rotate(-.7deg) translateY(0)}to{transform:rotate(.7deg) translateY(-4px)}}
@keyframes beamlock{0%{opacity:0;transform:rotate(calc(var(--a) + var(--from)))}25%{opacity:1}70%{transform:rotate(calc(var(--a) - var(--over)))}100%{opacity:1;transform:rotate(var(--a))}}
@keyframes beamidle{0%,100%{transform:rotate(var(--a))}35%{transform:rotate(calc(var(--a) + .9deg))}70%{transform:rotate(calc(var(--a) - .7deg))}}
@keyframes beamsweep{from{transform:rotate(var(--a))}to{transform:rotate(var(--a2))}}
@keyframes beampulse{from{opacity:.78}to{opacity:1}}
@keyframes poolin{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes poolbreath{from{opacity:1;transform:scale(1)}to{opacity:.8;transform:scale(1.05)}}
@keyframes mote{0%{opacity:0;transform:translateY(0)}20%{opacity:.9}80%{opacity:.5}100%{opacity:0;transform:translateY(-70px)}}
.drum{width:16px;height:16px;border-radius:50%;animation:drum .5s ease-in-out infinite alternate}
@keyframes drum{from{transform:translateY(0);opacity:.5}to{transform:translateY(-12px);opacity:1}}
.flash{position:absolute;inset:-140px;pointer-events:none;background:radial-gradient(closest-side,rgba(255,255,255,.95),rgba(255,255,255,.35) 45%,rgba(255,255,255,0));animation:flash 1s ease-out both;z-index:30}
@keyframes flash{0%{opacity:0;transform:scale(.4)}12%{opacity:1}100%{opacity:0;transform:scale(1.6)}}
.flipin{animation:flipin 1s cubic-bezier(.2,.9,.25,1.12) .12s both;transform-origin:50% 100%}
@keyframes flipin{0%{opacity:0;transform:perspective(1400px) rotateY(-90deg) scale(.92)}60%{opacity:1}100%{opacity:1;transform:perspective(1400px) rotateY(0) scale(1)}}
.champin{animation:champin 1.3s cubic-bezier(.16,1,.3,1) .15s both;transform-origin:50% 100%}
@keyframes champin{0%{opacity:0;transform:translateY(80px) scale(.72);filter:blur(14px)}55%{opacity:1;filter:blur(0)}75%{transform:translateY(-10px) scale(1.04)}100%{opacity:1;transform:none;filter:none}}
.unblur{animation:unblur 1.4s ease-out .3s both}
@keyframes unblur{from{filter:blur(26px) brightness(1.8)}to{filter:none}}
.letter{display:inline-block;animation:letter .6s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes letter{from{opacity:0;transform:translateY(.6em) scale(.8)}to{opacity:1;transform:none}}
.late{animation:fadeup .6s ease-out 1.3s both}
.stamp{animation:stamp .55s cubic-bezier(.3,1.7,.5,1) 1.15s both}
@keyframes stamp{from{opacity:0;transform:scale(2.4) rotate(-20deg)}to{opacity:1;transform:scale(1) rotate(-6deg)}}
.drop{animation:drop .9s cubic-bezier(.3,1.5,.5,1) 1.25s both}
@keyframes drop{from{opacity:0;transform:translateY(-160px)}to{opacity:1;transform:none}}
.slidedown{animation:slidedown .8s cubic-bezier(.2,.8,.2,1) .9s both}
@keyframes slidedown{from{transform:translateY(-100%)}to{transform:none}}
.marquee{animation:marquee 26s linear infinite}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.capin{animation:capin .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes capin{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.shimmer{background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shimmer 2.2s linear infinite,capin .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes shimmer{from{background-position:0% 0}to{background-position:-200% 0}}
.pedglow{animation:pedglow 1.6s ease-out .9s both}
@keyframes pedglow{0%{filter:brightness(1)}30%{filter:brightness(1.6)}100%{filter:brightness(1)}}
@keyframes b0{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}8%{opacity:1;transform:translate(0,0) scale(1)}45%{transform:translate(-300px,-360px) rotate(260deg)}100%{opacity:0;transform:translate(-380px,240px) rotate(620deg)}}
@keyframes b1{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}8%{opacity:1;transform:translate(0,0) scale(1)}45%{transform:translate(-160px,-440px) rotate(-220deg)}100%{opacity:0;transform:translate(-210px,260px) rotate(-560deg)}}
@keyframes b2{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}8%{opacity:1;transform:translate(0,0) scale(1)}45%{transform:translate(0,-480px) rotate(200deg)}100%{opacity:0;transform:translate(-30px,300px) rotate(540deg)}}
@keyframes b3{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}8%{opacity:1;transform:translate(0,0) scale(1)}45%{transform:translate(170px,-430px) rotate(-240deg)}100%{opacity:0;transform:translate(220px,240px) rotate(-600deg)}}
@keyframes b4{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}8%{opacity:1;transform:translate(0,0) scale(1)}45%{transform:translate(310px,-350px) rotate(280deg)}100%{opacity:0;transform:translate(400px,230px) rotate(640deg)}}
@keyframes b5{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}8%{opacity:1;transform:translate(0,0) scale(1)}45%{transform:translate(-430px,-190px) rotate(-200deg)}100%{opacity:0;transform:translate(-530px,320px) rotate(-520deg)}}
@keyframes b6{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}8%{opacity:1;transform:translate(0,0) scale(1)}45%{transform:translate(440px,-200px) rotate(220deg)}100%{opacity:0;transform:translate(550px,330px) rotate(560deg)}}
@keyframes b7{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}8%{opacity:1;transform:translate(0,0) scale(1)}45%{transform:translate(60px,-300px) rotate(-260deg)}100%{opacity:0;transform:translate(90px,380px) rotate(-620deg)}}
.dash{animation:dash .8s linear infinite}
@keyframes dash{from{background-position:0 0}to{background-position:28px 0}}
@keyframes fall{0%{opacity:0;transform:translate3d(0,0,0) rotate(0)}6%{opacity:1}100%{opacity:.9;transform:translate3d(70px,1180px,0) rotate(720deg)}}
`;

// Deterministic pseudo-random so decorations don't jump between renders.
function rnd(i: number, s: number) {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function getInitials(name: string): string {
  const people = name.split(/\s+та\s+|\s+і\s+|\s*&\s*/i);
  if (people.length > 1) return people.map((p) => p.trim().charAt(0)).filter(Boolean).join('+').toUpperCase();
  const w = name.trim().split(/\s+/);
  return (w[0]?.charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase();
}

function fit(ar: number, bw: number, bh: number) {
  let w = bw;
  let h = Math.round(bw / ar);
  if (h > bh) {
    h = bh;
    w = Math.round(bh * ar);
  }
  return { w, h };
}

type Particle = { x: number; y: number; w: number; h: number; c: string; r: string; anim: string };

function burst(cx: number, cy: number, n: number, seed: number, t: Theme, d0: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(i, seed), b = rnd(i, seed + 7), c = rnd(i, seed + 13);
    const w = 8 + Math.round(a * 12);
    const strip = i % 4 === 0;
    out.push({
      x: Math.round(cx + (b - 0.5) * 90), y: Math.round(cy + (c - 0.5) * 90),
      w: strip ? w + 8 : w, h: strip ? Math.max(4, Math.round(w * 0.4)) : w,
      c: t.conf[i % t.conf.length], r: t.confR[i % t.confR.length],
      anim: `b${i % 8} ${(1.9 + a * 1.3).toFixed(2)}s cubic-bezier(.12,.72,.3,1) ${(d0 + b * 0.3).toFixed(2)}s both`,
    });
  }
  return out;
}

function rain(n: number, seed: number, t: Theme, d0: number, x0 = 0, w0 = 1920): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(i, seed), b = rnd(i, seed + 5);
    const w = 8 + Math.round(a * 10);
    const strip = i % 3 === 0;
    out.push({
      x: Math.round(x0 + (i / n) * w0 + (b - 0.5) * 60), y: -50,
      w: strip ? w + 8 : w, h: strip ? Math.max(4, Math.round(w * 0.4)) : w,
      c: t.conf[i % t.conf.length], r: t.confR[i % t.confR.length],
      anim: `fall ${(5.5 + a * 4).toFixed(2)}s linear ${(d0 + b * 6).toFixed(2)}s infinite both`,
    });
  }
  return out;
}

function Particles({ list }: { list: Particle[] }) {
  return (
    <>
      {list.map((p, i) => (
        <span key={i} style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, borderRadius: p.r, background: p.c, animation: p.anim }} />
      ))}
    </>
  );
}

// Letter-by-letter name reveal; a long word may wrap after its hyphens.
function Letters({ name, base }: { name: string; base: number }) {
  let k = 0;
  return (
    <>
      {name.split(' ').map((word, wi) => (
        <span key={wi} style={{ margin: '0 0.14em' }}>
          {word.split(/(?<=-)/).map((part, pi) => (
            <span key={pi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
              {Array.from(part).map((ch, li) => (
                <span key={li} className="letter" style={{ animationDelay: `${(base + k++ * 0.04).toFixed(2)}s` }}>
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

// Shrinks the font until the widest line fits the box (a long word on a narrow column).
function FitText({ size, text, style, children }: { size: number; text: string; style: React.CSSProperties; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fitNow = () => {
      let px = size;
      el.style.fontSize = `${px}px`;
      for (let i = 0; i < 8 && el.scrollWidth > el.clientWidth + 1 && px > 12; i++) {
        px = Math.max(12, Math.floor((px * el.clientWidth) / el.scrollWidth));
        el.style.fontSize = `${px}px`;
      }
    };
    fitNow();
    document.fonts?.ready.then(fitNow);
  }, [size, text]);
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}

// Hat pixels drawn above the 14×14 frog, which sits at y=7 in a 14×21 box.
const HATS: Record<Hat, { y: number; paths: [string, string][] }> = {
  none: { y: 0, paths: [] },
  witch: { y: 0, paths: [['#2a1640', 'M9 0h2v1h-2zM8 1h3v1h-3zM7 2h4v1h-4zM6 3h5v1h-5zM5 4h6v1h-6zM1 6h12v1h-12z'], ['#ff7a1a', 'M4 5h8v1h-8z']] },
  santa: { y: 1, paths: [['#ffffff', 'M11 0h2v1h-2zM11 1h2v1h-2zM2 5h10v1h-10z'], ['#e8353f', 'M10 1h1v1h-1zM8 2h3v1h-3zM6 3h5v1h-5zM4 4h8v1h-8z']] },
  crown: {
    y: 3,
    paths: [
      ['#e8c26a', 'M3 0h1v1h-1zM6 0h2v1h-2zM10 0h1v1h-1zM3 1h2v1h-2zM6 1h2v1h-2zM9 1h2v1h-2zM3 2h8v1h-8zM4 3h1v1h-1zM6 3h2v1h-2zM9 3h1v1h-1z'],
      ['#b8893a', 'M3 3h1v1h-1zM5 3h1v1h-1zM8 3h1v1h-1zM10 3h1v1h-1z'],
    ],
  },
};

function Frog({ hat, size }: { hat: Hat; size: number }) {
  const h = HATS[hat];
  return (
    <svg viewBox="0 0 14 21" width={size} height={size * 1.5} preserveAspectRatio="xMidYMax meet" shapeRendering="crispEdges" role="img" aria-label="Жабка-маскот" style={{ display: 'block' }}>
      <g transform={`translate(0 ${h.y})`}>
        {h.paths.map(([fill, d]) => (
          <path key={fill} fill={fill} d={d} />
        ))}
      </g>
      <g transform="translate(0 7)">
        <Pixels runs={FROG_RUNS} />
      </g>
    </svg>
  );
}

type Person = { id: string; name: string; description: string | null; photoUrl: string | null };

// Photo is never cropped: contain on top of a blurred copy of itself.
function Photo({ p, t, radius, border, blur = 22 }: { p: Person; t: Theme; radius: string; border: string; blur?: number }) {
  const src = mediaUrl(p.photoUrl);
  return (
    <div style={{ position: 'relative', flexGrow: 1, minHeight: 0, overflow: 'hidden', boxSizing: 'border-box', borderRadius: radius, border, background: t.monoBg, height: '100%' }}>
      {src ? (
        <>
          <img src={src} alt="" aria-hidden="true" style={{ position: 'absolute', left: '-14%', top: '-14%', width: '128%', height: '128%', objectFit: 'cover', filter: `blur(${blur}px) brightness(0.55) saturate(1.2)` }} />
          <img src={src} alt={p.name} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.monoFont, fontWeight: t.monoW, fontStyle: t.monoS, fontSize: 64, color: t.monoColor }}>
          {getInitials(p.name)}
        </div>
      )}
    </div>
  );
}

function LockIcon({ size, stroke = 'currentColor' }: { size: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

type Beam = {
  ax: number; // the lamp, just above the top edge
  tx: number; // where the light lands
  ty: number;
  w: number; // cone width where it lands
  power: number;
  from: number; // degrees it swings in from before settling
  sweepTo?: number; // a search light: swings between tx and sweepTo instead of settling
  dur?: number;
  delay?: number;
};

const LAMP_Y = -110;

// A stage light: a soft cone with dust in the air and a pool of light on the floor.
function StageLight({ b, rgb }: { b: Beam; rgb: string }) {
  const dy = b.ty - LAMP_Y;
  const len = Math.round(Math.hypot(b.tx - b.ax, dy)) + 80;
  const half = ((Math.atan(b.w / 2 / len) * 180) / Math.PI) * 1.25;
  const width = Math.round(2 * len * Math.tan((half * Math.PI) / 180)) + 60;
  const angle = (x: number) => (-Math.atan2(x - b.ax, dy) * 180) / Math.PI;
  const c = (a: number) => `rgba(${rgb}, ${(a * b.power).toFixed(3)})`;
  const cone = `conic-gradient(from ${180 - half}deg at 50% 0, ${c(0)} 0deg, ${c(0.08)} ${half * 0.35}deg, ${c(0.34)} ${half * 0.75}deg, ${c(0.46)} ${half}deg, ${c(0.34)} ${half * 1.25}deg, ${c(0.08)} ${half * 1.65}deg, ${c(0)} ${half * 2}deg)`;
  const sweep = b.sweepTo !== undefined;
  const fade = 'linear-gradient(to bottom, transparent 0%, #000 20%, #000 82%, rgba(0, 0, 0, 0.4) 100%)';
  const motes = Array.from({ length: 14 }, (_, i) => {
    const v = 0.3 + 0.62 * rnd(i, b.ax + 3);
    const spread = len * v * Math.tan((half * Math.PI) / 180) * 0.6;
    return {
      x: Math.round(width / 2 + (rnd(i, b.ax + 7) * 2 - 1) * spread),
      y: Math.round(len * v),
      s: 2 + Math.round(rnd(i, b.ax + 11) * 3),
      anim: `mote ${(3.5 + rnd(i, b.ax + 13) * 3).toFixed(1)}s ease-in-out -${(rnd(i, b.ax + 17) * 6).toFixed(1)}s infinite`,
    };
  });
  const vars = {
    '--a': `${angle(b.tx)}deg`,
    '--a2': `${angle(b.sweepTo ?? b.tx)}deg`,
    '--from': `${b.from}deg`,
    '--over': `${Math.sign(b.from) * 2.5}deg`,
  } as React.CSSProperties;
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          ...vars,
          position: 'absolute', left: Math.round(b.ax - width / 2), top: LAMP_Y, width, height: len, zIndex: 4, pointerEvents: 'none',
          transformOrigin: '50% 0', mixBlendMode: 'screen', filter: 'blur(5px)', WebkitMaskImage: fade, maskImage: fade,
          animation: sweep
            ? `fadein .6s ease both, beamsweep ${b.dur ?? 3}s ease-in-out ${b.delay ?? 0}s infinite alternate both`
            : 'beamlock 1.6s cubic-bezier(.45, 0, .2, 1) both, beamidle 7s ease-in-out 1.6s infinite',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: cone, animation: 'beampulse 2.6s ease-in-out infinite alternate' }} />
        {motes.map((m, i) => (
          <span key={i} style={{ position: 'absolute', left: m.x, top: m.y, width: m.s, height: m.s, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.9)', animation: m.anim }} />
        ))}
      </div>
      {!sweep && (
        <div aria-hidden="true" style={{ position: 'absolute', left: Math.round(b.tx - b.w * 0.55), top: b.ty - 65, width: Math.round(b.w * 1.1), height: 130, borderRadius: '50%', zIndex: 4, pointerEvents: 'none', mixBlendMode: 'screen', background: `radial-gradient(closest-side, ${c(0.5)}, ${c(0.18)} 55%, ${c(0)})`, animation: 'poolin .9s ease-out .9s both, poolbreath 2.6s ease-in-out 1.8s infinite alternate' }} />
      )}
      <div aria-hidden="true" style={{ position: 'absolute', left: b.ax - 120, top: -120, width: 240, height: 240, borderRadius: '50%', zIndex: 4, pointerEvents: 'none', mixBlendMode: 'screen', background: `radial-gradient(closest-side, rgba(255, 255, 255, ${(0.55 * b.power).toFixed(2)}), ${c(0.25)} 40%, ${c(0)})`, animation: 'fadein .5s ease both' }} />
    </>
  );
}

// Light falling on the card the stage light is on.
function Lit({ rgb, radius }: { rgb: string; radius: string }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, zIndex: 2, pointerEvents: 'none', mixBlendMode: 'screen', background: `radial-gradient(ellipse 75% 85% at 50% 0%, rgba(${rgb}, 0.22), rgba(${rgb}, 0) 72%)`, animation: 'fadein .8s ease .6s both' }} />
  );
}

// Partner logo on a white tile; the name stands in when there is no logo.
function PartnerLogo({ name, logo, w, h, radius, font, extra }: { name: string; logo: string | null; w: number; h: number; radius: number | string; font: number; extra?: React.CSSProperties }) {
  const src = mediaUrl(logo);
  return (
    <div style={{ width: w, height: h, flexShrink: 0, boxSizing: 'border-box', padding: Math.round(Math.min(w, h) * 0.14), borderRadius: radius, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...extra }}>
      {src ? (
        <img src={src} alt={name} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontFamily: F.mulish, fontWeight: 800, fontSize: font, lineHeight: 1.1, color: '#55555e', textAlign: 'center', overflowWrap: 'anywhere' }}>{name}</span>
      )}
    </div>
  );
}

// Podium slots: 2nd left, 1st centre, 3rd right. `sus`/`rev` are ceremony steps.
const SLOTS = [
  { place: 2, left: 170, width: 470, top: 400, cardH: 500, pedH: 140, sus: 3, rev: 4, q: 'Хто на 2 місці?', qSize: 170, nameSize: 40, em: 190, pedNumSize: 70 },
  { place: 1, left: 680, width: 560, top: 300, cardH: 560, pedH: 180, sus: 5, rev: 6, q: 'Хто переможець?', qSize: 220, nameSize: 48, em: 240, pedNumSize: 92 },
  { place: 3, left: 1280, width: 470, top: 450, cardH: 490, pedH: 100, sus: 1, rev: 2, q: 'Хто на 3 місці?', qSize: 160, nameSize: 40, em: 180, pedNumSize: 54 },
];
const STEP_NAMES = ['вступ', 'інтрига · 3 місце', '3 місце', 'інтрига · 2 місце', '2 місце', 'інтрига · переможець', 'переможець'];
// What the "Далі" button does to reach each step.
const STEP_ACTIONS = ['вступ', 'інтрига 3 місця', 'відкрити 3 місце', 'інтрига 2 місця', 'відкрити 2 місце', 'інтрига переможця', 'відкрити переможця'];
const CAPTIONS = ['Готуємося оголосити переможців', 'Третє місце посідає…', 'Вітаємо з третім місцем!', 'Друге місце посідає…', 'Вітаємо з другим місцем!'];

export default function LiveVotingScreenPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<VotingScreenData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Theme is chosen once per event; remember it per voting on this machine.
  // Safe to read on first render: until data loads the page shows only a loader.
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(`screen-theme:${id}`) as ThemeId | null;
      if (saved && THEME_IDS.includes(saved)) return saved;
    } catch {}
    return 'fice';
  });
  const [mode, setMode] = useState<Mode | null>(null); // null = follow voting status
  const [view, setView] = useState<View>('auto');
  const [phase, setPhase] = useState(-2); // auto view: <0 grid, >=0 slide index
  const [slide, setSlide] = useState(0);
  const [stepWant, setStepWant] = useState(0); // ceremony step asked for (a step number, see `steps`)
  const [salute, setSalute] = useState(0);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [scale, setScale] = useState(1);
  const [showPanel, setShowPanel] = useState(false); // the on-screen remote, toggled with M
  const [cursorOn, setCursorOn] = useState(true);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
  const requested = useRef(new Set<string>());
  const [timerReset, setTimerReset] = useState(0);

  const pickTheme = (tid: ThemeId) => {
    setThemeId(tid);
    try {
      localStorage.setItem(`screen-theme:${id}`, tid);
    } catch {}
  };

  useEffect(() => {
    const onResize = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fice.votingScreen(id);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити дані');
    }
  }, [id]);

  useEffect(() => {
    // Polling an external API; the setState happens after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const t: Theme = THEMES[themeId];
  // The API sorts candidates by votes; the screen must not hint at the ranking.
  const cands = useMemo(() => [...(data?.candidates ?? [])].sort((a, b) => a.order - b.order), [data?.candidates]);
  const n = cands.length;
  const curMode: Mode = mode ?? (data?.voting.status === 'CLOSED' ? 'closed' : 'live');
  const isLive = curMode === 'live';

  // Load each photo's aspect ratio once so the slideshow frame hugs the photo.
  useEffect(() => {
    for (const c of cands) {
      const src = mediaUrl(c.photoUrl);
      if (!src || requested.current.has(c.id)) continue;
      requested.current.add(c.id);
      const img = new Image();
      img.onload = () => setRatios((r) => ({ ...r, [c.id]: img.naturalWidth / img.naturalHeight || 0.75 }));
      img.src = src;
    }
  }, [cands]);

  // Ceremony steps that exist for this voting (skip places without a winner).
  const winners: Record<number, Person | undefined> = {};
  for (const w of data?.winners ?? []) winners[w.place] = w;
  // Partner awards with a pick get two steps each after the podium: 7+2i intrigue, 8+2i reveal.
  const awards = (data?.partnerAwards ?? []).filter((a) => a.pick);
  const steps = [
    0,
    ...(winners[3] ? [1, 2] : []),
    ...(winners[2] ? [3, 4] : []),
    ...(winners[1] ? [5, 6] : []),
    ...awards.flatMap((_, i) => [7 + 2 * i, 8 + 2 * i]),
  ];
  // The step asked for, or the nearest one before it that exists (a place may have no winner).
  const stepIdx = Math.max(0, steps.findLastIndex((s) => s <= stepWant));
  const stepNo = steps[stepIdx] ?? 0;
  const awardIdx = stepNo >= 7 ? Math.floor((stepNo - 7) / 2) : -1;
  const award = awards[awardIdx] ?? null;
  const awardOpen = !!award && (stepNo - 7) % 2 === 1;
  const step = award ? -1 : stepNo; // podium step; -1 while a partner award is on screen
  const isCer = curMode === 'ceremony';
  const stepName = (s: number) =>
    s < 7 ? STEP_NAMES[s] : `${(s - 7) % 2 ? 'вибір' : 'інтрига ·'} ${awards[Math.floor((s - 7) / 2)]?.partnerName}`;
  const stepAction = (s: number) =>
    s < 7 ? STEP_ACTIONS[s] : `${(s - 7) % 2 ? 'відкрити вибір' : 'інтрига:'} ${awards[Math.floor((s - 7) / 2)]?.partnerName}`;

  // Auto view: grid for 10 s, then each photo for 5 s, round and round.
  useEffect(() => {
    if (!isLive || view === 'grid' || n === 0) return;
    const iv = setInterval(() => {
      if (view === 'show') {
        setSlide((s) => (s + 1) % n);
        return;
      }
      setPhase((ph) => {
        const next = ph + 1 >= n ? -2 : ph + 1;
        if (next >= 0) setSlide(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(iv);
  }, [isLive, view, n, timerReset]);

  const inShow = isLive && n > 0 && (view === 'show' || (view === 'auto' && phase >= 0));
  const cur = n ? slide % n : 0;

  const go = useCallback(
    (d: number) => {
      if (!n) return;
      const inGrid = view === 'grid' || (view === 'auto' && phase < 0);
      const base = inGrid ? (d > 0 ? -1 : 0) : slide % n;
      const s = (((base + d) % n) + n) % n;
      setSlide(s);
      setPhase(s);
      if (view === 'grid') setView('show');
      setTimerReset((k) => k + 1);
    },
    [n, view, phase, slide],
  );

  const pickMode = (m: Mode) => {
    setMode(m);
    setStepWant(0);
    setSalute(0);
    setPhase(-2);
    setSlide(0);
  };
  const next = () => setStepWant(steps[Math.min(steps.length - 1, stepIdx + 1)]);
  const back = () => setStepWant(steps[Math.max(0, stepIdx - 1)]);
  const fireSalute = useCallback(() => setSalute(Date.now()), []);
  useEffect(() => {
    if (!salute) return;
    const tm = setTimeout(() => setSalute(0), 4200);
    return () => clearTimeout(tm);
  }, [salute]);

  // The admin remote: poll what the screen should show and apply only what changed,
  // so the screen keeps running its own slideshow between commands.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    if (!id) return;
    let last: ScreenState | null = null;
    const apply = (st: ScreenState) => {
      const first = !last;
      const prev: ScreenState = last ?? { rev: 0 };
      last = st;
      if (st.theme && st.theme !== prev.theme && THEME_IDS.includes(st.theme)) setThemeId(st.theme);
      if (st.mode && st.mode !== prev.mode) {
        setMode(st.mode);
        setStepWant(0);
        setPhase(-2);
        setSlide(0);
      }
      if (st.view && st.view !== prev.view) {
        setView(st.view);
        if (st.view === 'auto') setPhase(-2);
      }
      if (st.step !== undefined && st.step !== prev.step) setStepWant(st.step);
      // One-off commands only fire when they arrive, not when the screen (re)loads.
      if (!first && st.nav && st.nav.rev !== prev.nav?.rev) goRef.current(st.nav.d);
      if (!first && st.salute && st.salute !== prev.salute) setSalute(Date.now());
    };
    const poll = async () => {
      try {
        const st = await fice.screenState(id);
        if (!last || st.rev > last.rev) apply(st);
      } catch {
        // an older API or a network blip: the screen keeps its own state
      }
    };
    poll();
    const iv = setInterval(poll, 1000);
    return () => clearInterval(iv);
  }, [id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    // Physical keys, so the Ukrainian layout works the same.
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button') && e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyF') toggleFullscreen();
      else if (e.code === 'KeyC') fireSalute();
      else if (e.code === 'KeyM') setShowPanel((v) => !v);
      else if (e.code === 'Escape') setShowPanel(false);
      else if (e.code === 'Space' || e.code === 'ArrowRight') {
        e.preventDefault();
        if (isCer) next();
        else if (isLive) go(1);
      } else if (e.code === 'ArrowLeft') {
        if (isCer) back();
        else if (isLive) go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCer, isLive, next, back, go, fireSalute]);

  // The mouse only brings the cursor back; the on-screen remote opens with M.
  const onMouseMove = () => {
    setCursorOn(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setCursorOn(false), 3500);
  };

  if (!data) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#101010', color: '#cdcdcd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
        {error ?? 'Завантаження…'}
      </div>
    );
  }

  const title = data.voting.title;
  const subtitle = data.voting.description || 'Обери образ, який запам’ятався найбільше';
  const botName = `@${USER_BOT_USERNAME}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=1&bgcolor=ffffff&color=000000&data=${encodeURIComponent(`https://t.me/${USER_BOT_USERNAME}?start=vote_${id}`)}`;
  const fill = t.id === 'fice' ? G : t.a1;

  // Grid: one row up to 4, two rows up to 12, then rows of up to 6, filled evenly.
  const rows = n <= 4 ? 1 : n <= 12 ? 2 : Math.ceil(n / 6);
  const cols = Math.max(1, Math.ceil(n / rows));
  const showGrid = (isLive && !inShow) || curMode === 'closed';

  // Ceremony visuals.
  const susStep = step === 1 || step === 3 || step === 5;
  const target = SLOTS.find((s) => s.sus === step);
  // Stage lights: one swings in and settles on the card in suspense (a dimmer fill light
  // from the other side), two search lights cross the podium before the winner.
  const beams: Beam[] = [];
  const lockOn = (cx: number, ty: number, w: number) => {
    const side = cx > 960 ? -1 : 1; // the main lamp hangs towards the middle of the stage
    beams.push({ ax: cx + side * 330, tx: cx, ty, w, power: 1, from: -side * 22 });
    beams.push({ ax: cx - side * 620, tx: cx, ty, w: w * 0.9, power: 0.5, from: side * 16 });
  };
  if (isCer && target && step !== 5) lockOn(target.left + target.width / 2, 1040, target.width * 1.3);
  if (isCer && award && !awardOpen) lockOn(1380, 1000, 700);
  if (isCer && step === 5) {
    beams.push({ ax: 220, tx: 560, sweepTo: 1360, ty: 1040, w: 520, power: 0.9, from: 0, dur: 2.8 });
    beams.push({ ax: 1700, tx: 1360, sweepTo: 560, ty: 1040, w: 520, power: 0.9, from: 0, dur: 3.3, delay: -1.2 });
  }
  let bursts: Particle[] = [];
  if (isCer && step === 2) bursts = burst(1515, 690, 44, 3, t, 0.35);
  if (isCer && step === 4) bursts = burst(405, 650, 44, 2, t, 0.35);
  if (isCer && step === 6) bursts = burst(960, 560, 72, 1, t, 0.45);
  if (isCer && awardOpen) bursts = burst(1380, 640, 52, 8, t, 0.35);
  const rainList = isCer && step === 6 ? rain(64, 11, t, 1.3) : isCer && awardOpen ? rain(30, 81, t, 1.2, 980, 880) : [];
  const saluteList = salute ? [...burst(320, 760, 34, 21, t, 0), ...burst(960, 620, 34, 22, t, 0.25), ...burst(1600, 760, 34, 23, t, 0.5)] : [];
  const dimOp = !isCer ? 0 : step === 5 ? 0.55 : step === 1 || step === 3 || (award && !awardOpen) ? 0.32 : 0;
  const logoAwards = (data?.partnerAwards ?? []).filter((a) => a.showLogo);

  const snow = t.id === 'ny'
    ? Array.from({ length: 46 }, (_, i) => {
        const a = rnd(i, 31), b = rnd(i, 37), c = rnd(i, 41);
        return { x: Math.round(b * 1900), s: 3 + Math.round(a * 6), o: 0.35 + c * 0.55, anim: `snow ${(11 + a * 12).toFixed(1)}s linear -${(c * 22).toFixed(1)}s infinite` };
      })
    : [];
  const bulbColors = ['#ffd27a', '#ff5a6e', '#8fe3ff', '#7dffb0'];
  const bulbs = t.id === 'ny'
    ? Array.from({ length: 16 }, (_, i) => {
        const tt = [0.17, 0.39, 0.61, 0.83][i % 4];
        const a = Math.floor(i / 4);
        return { x: Math.round(a * 480 + 480 * tt) - 8, y: Math.round(12 + 84 * tt * (1 - tt)), c: bulbColors[i % 4], anim: `twinkle ${(1.2 + (i % 3) * 0.5).toFixed(1)}s ease-in-out ${((i % 5) * 0.3).toFixed(1)}s infinite alternate` };
      })
    : [];
  const dust = t.id === 'ball'
    ? Array.from({ length: 34 }, (_, i) => {
        const a = rnd(i, 51), b = rnd(i, 57), c = rnd(i, 61);
        return { x: Math.round(a * 1860 + 30), y: Math.round(b * 1020 + 30), s: 2 + Math.round(c * 4), anim: `twinkle ${(1.6 + c * 2.4).toFixed(1)}s ease-in-out ${(a * 3).toFixed(1)}s infinite alternate` };
      })
    : [];
  const bats = t.id === 'hw'
    ? [
        { y: 70, s: 56, h: 28, anim: 'batfly 19s linear -2s infinite' },
        { y: 150, s: 40, h: 20, anim: 'batfly 24s linear -11s infinite' },
        { y: 36, s: 30, h: 15, anim: 'batfly 28s linear -18s infinite' },
        { y: 230, s: 46, h: 23, anim: 'batfly 21s linear -7s infinite' },
      ]
    : [];
  const pulse = Array.from({ length: 10 }, (_, i) => {
    const a = rnd(i, 71), b = rnd(i, 73);
    return {
      x: i % 2 ? 332 + Math.round(a * 22) : 6 + Math.round(a * 22), y: 140 + Math.round(b * 190), w: 8 + Math.round(a * 8), h: 8 + Math.round(a * 8),
      c: t.conf[i % t.conf.length], r: t.confR[i % t.confR.length], anim: `rise ${(3 + b * 2).toFixed(1)}s ease-out ${(i * 0.7).toFixed(1)}s infinite both`,
    };
  });

  // One QR glides between the grid panel and the slideshow card (both have an empty slot for it).
  const headH = Math.round(t.panelHeadSize * 1.08 * 2);
  const qrBox = inShow
    ? { left: 1424 + t.panelBw + 16, top: 836 - t.panelBw, size: 156, pad: 10, r: 12 }
    : { left: 1480, top: 76 + t.panelBw + 40 + headH + 22, size: 320, pad: 16, r: 16 };

  const cardH = 2 * t.panelBw + 188;
  const frameBox = inShow
    ? { left: 1424, top: 1008 - cardH, width: 432, height: cardH }
    : { left: 1440, top: 76, width: 400, height: 932 };
  // Outgoing contents vanish fast; incoming ones appear once the frame has nearly arrived.
  const FADE_OUT = 'opacity .2s ease, visibility .2s';
  const FADE_IN = 'opacity .45s ease .5s';

  const slideCand = inShow ? cands[cur] : null;
  const slideFit = slideCand ? fit(ratios[slideCand.id] ?? 0.75, 1312, 952) : null;

  const btnGroup: React.CSSProperties = { display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: '#16161b', border: '1px solid #2a2a33', flexShrink: 0 };
  const segBtn = (on: boolean, onBg = '#ffffff'): React.CSSProperties => ({
    height: 44, padding: '0 14px', border: 0, borderRadius: 10, background: on ? onBg : 'transparent', color: on ? '#000000' : '#d3d3d3', fontSize: 15, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8,
  });
  const iconBtn: React.CSSProperties = { width: 48, height: 48, flexShrink: 0, border: '1px solid #2a2a33', borderRadius: 12, background: '#16161b', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const chevron = (d: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );

  return (
    <div onMouseMove={onMouseMove} style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', fontFamily: F.mulish, cursor: cursorOn || showPanel ? 'default' : 'none' }}>
      <style>{CSS}</style>

      {/* ================= 1920×1080 STAGE ================= */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1920, height: 1080, transform: `translate(-50%, -50%) scale(${scale})`, overflow: 'hidden', background: t.bg, color: t.text, fontFamily: t.body }}>
        {inShow && (
          <div className="bgin" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
            {cands.map((c, i) => (
              <div key={c.id} style={{ position: 'absolute', inset: 0, opacity: i === cur ? 1 : 0, visibility: i === cur ? 'visible' : 'hidden', transition: 'opacity 1s ease, visibility 1s' }}>
                {mediaUrl(c.photoUrl) && (
                  <img src={mediaUrl(c.photoUrl)!} alt="" style={{ position: 'absolute', left: -140, top: -140, width: 2200, height: 1360, objectFit: 'cover', filter: 'blur(70px) brightness(0.45) saturate(1.35)' }} />
                )}
              </div>
            ))}
            <div style={{ position: 'absolute', inset: 0, background: t.slideTint }} />
          </div>
        )}

        {/* Theme decorations */}
        {t.id === 'fice' && (
          <>
            <div aria-hidden="true" style={{ position: 'absolute', left: -260, top: 560, width: 1000, height: 760, background: 'radial-gradient(closest-side, rgba(173, 70, 255, 0.30), rgba(173, 70, 255, 0))', pointerEvents: 'none' }} />
            <div aria-hidden="true" style={{ position: 'absolute', left: 1240, top: -120, width: 900, height: 700, background: 'radial-gradient(closest-side, rgba(0, 227, 243, 0.18), rgba(0, 227, 243, 0))', pointerEvents: 'none' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)', backgroundSize: '28px 28px', WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent 70%)', maskImage: 'linear-gradient(to bottom, #000, transparent 70%)', pointerEvents: 'none' }} />
          </>
        )}
        {t.id === 'ny' && (
          <>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {snow.map((f, i) => (
                <span key={i} style={{ position: 'absolute', left: f.x, top: -20, width: f.s, height: f.s, borderRadius: '50%', background: '#ffffff', opacity: f.o, animation: f.anim }} />
              ))}
            </div>
            <svg aria-hidden="true" width="1920" height="64" viewBox="0 0 1920 64" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
              <path d="M0 6 Q240 52 480 10 Q720 52 960 10 Q1200 52 1440 10 Q1680 52 1920 6" fill="none" stroke="#2d4b72" strokeWidth="3" />
            </svg>
            {bulbs.map((b, i) => (
              <span key={i} aria-hidden="true" style={{ position: 'absolute', left: b.x, top: b.y, width: 16, height: 22, borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%', background: b.c, boxShadow: `0 0 18px ${b.c}, 0 0 4px ${b.c}`, animation: b.anim }} />
            ))}
            <svg aria-hidden="true" width="1920" height="120" viewBox="0 0 1920 120" style={{ position: 'absolute', left: 0, top: 960, pointerEvents: 'none', opacity: 0.1 }}>
              <path d="M0 80 C 240 30 420 30 640 70 S 1080 110 1300 60 S 1700 20 1920 70 L1920 120 L0 120 Z" fill="#ffffff" />
            </svg>
          </>
        )}
        {t.id === 'hw' && (
          <>
            <div aria-hidden="true" style={{ position: 'absolute', left: 1640, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle at 38% 36%, #fff6dc, #f1dfae 58%, #cdb27a)', boxShadow: '0 0 120px rgba(255, 228, 170, 0.35)', pointerEvents: 'none' }} />
            <svg aria-hidden="true" width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: 0.22 }}>
              <g fill="none" stroke="#ffffff" strokeWidth="1.5">
                <path d="M0 0 L300 0" /><path d="M0 0 L290 110" /><path d="M0 0 L230 220" /><path d="M0 0 L120 290" /><path d="M0 0 L0 300" />
                <path d="M70 0 Q 66 22 68 26 Q 56 50 56 54 Q 32 66 28 70 Q 6 72 0 70" />
                <path d="M140 0 Q 132 46 136 52 Q 112 100 112 108 Q 64 132 56 140 Q 14 144 0 140" />
                <path d="M215 0 Q 204 70 208 80 Q 172 152 172 164 Q 98 204 86 214 Q 22 220 0 214" />
              </g>
            </svg>
            {bats.map((bt, i) => (
              <div key={i} aria-hidden="true" style={{ position: 'absolute', left: 0, top: bt.y, width: bt.s, height: bt.h, animation: bt.anim, pointerEvents: 'none' }}>
                <svg className="flap" width="100%" height="100%" viewBox="0 0 64 32">
                  <path d="M32 12 C 34 7 36 6 38 6 C 37 8 37 10 38 11 C 44 6 52 5 64 8 C 58 11 55 15 54 21 C 51 18 47 18 44 21 C 42 19 39 18 36 19 C 35 21 34 22 32 22 C 30 22 29 21 28 19 C 25 18 22 19 20 21 C 17 18 13 18 10 21 C 9 15 6 11 0 8 C 12 5 20 6 26 11 C 27 10 27 8 26 6 C 28 6 30 7 32 12 Z" fill="#3b2a52" />
                </svg>
              </div>
            ))}
            <div aria-hidden="true" style={{ position: 'absolute', left: -200, top: 880, width: 1200, height: 300, borderRadius: '50%', background: 'rgba(200, 180, 255, 0.10)', filter: 'blur(50px)', animation: 'fog 14s ease-in-out infinite alternate', pointerEvents: 'none' }} />
            <div aria-hidden="true" style={{ position: 'absolute', left: 900, top: 920, width: 1300, height: 280, borderRadius: '50%', background: 'rgba(200, 180, 255, 0.08)', filter: 'blur(50px)', animation: 'fog 18s ease-in-out -6s infinite alternate-reverse', pointerEvents: 'none' }} />
          </>
        )}
        {t.id === 'ball' && (
          <>
            <div aria-hidden="true" style={{ position: 'absolute', left: 24, top: 24, width: 1872, height: 1032, boxSizing: 'border-box', border: '1px solid rgba(226, 190, 114, 0.45)', pointerEvents: 'none' }} />
            <div aria-hidden="true" style={{ position: 'absolute', left: 34, top: 34, width: 1852, height: 1012, boxSizing: 'border-box', border: '1px solid rgba(226, 190, 114, 0.18)', pointerEvents: 'none' }} />
            {[[17, 17], [1889, 17], [17, 1049], [1889, 1049]].map(([x, y]) => (
              <span key={`${x}-${y}`} aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: 14, height: 14, background: '#e2be72', transform: 'rotate(45deg)' }} />
            ))}
            {dust.map((g, i) => (
              <span key={i} aria-hidden="true" style={{ position: 'absolute', left: g.x, top: g.y, width: g.s, height: g.s, borderRadius: '50%', background: '#f1d594', boxShadow: '0 0 8px rgba(241, 213, 148, 0.8)', animation: g.anim }} />
            ))}
          </>
        )}

        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: '#000000', opacity: dimOp, transition: 'opacity 0.8s ease', zIndex: 3, pointerEvents: 'none' }} />

        {/* ================= GRID (live / closed) ================= */}
        {showGrid && (
          <>
            <div className="fadeup" style={{ position: 'absolute', left: 80, top: 76, width: 1290, zIndex: 5 }}>
              <h1 style={{ margin: 0, fontFamily: t.display, fontWeight: t.dw, fontStyle: t.ds, fontSize: t.titleSize, lineHeight: 1.04, letterSpacing: t.dls, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
              <div style={{ marginTop: 22, width: t.barW, height: t.barH, borderRadius: t.barR, background: t.barBg }} />
              <p style={{ margin: '20px 0 0', fontSize: 30, lineHeight: 1.3, fontWeight: 600, color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</p>
            </div>

            <div style={{ position: 'absolute', left: 80, top: 316, width: 1290, height: 692, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gap: 20, zIndex: 5 }}>
              {cands.map((c, i) => (
                <div key={c.id} className="cardin" style={{ position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, padding: `${t.cardPadTop}px 8px 12px`, background: t.cardBg, border: `${t.cardBw} solid ${t.cardBorder}`, borderRadius: t.cardRadius, outline: t.cardOutline, outlineOffset: -6, animationDelay: `${(0.05 * i).toFixed(2)}s` }}>
                  {t.drip && (
                    <svg aria-hidden="true" width="100%" height="16" viewBox="0 0 200 24" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0 }}>
                      <path d="M0 0H200V7C192 7 190 8 189 13C188 19 184 19 183 13C182 8 176 7 160 7C150 7 148 8 147 16C146 23 141 23 140 16C139 8 132 7 118 7C108 7 106 9 105 12C104 15 101 15 100 12C99 8 90 7 76 7C64 7 62 9 61 17C60 24 55 24 54 17C53 9 46 7 34 7C24 7 22 9 21 12C20 16 17 16 16 12C15 8 10 7 0 7Z" fill="#ff7a1a" />
                    </svg>
                  )}
                  <div style={{ flexGrow: 1, minHeight: 0, display: 'flex' }}>
                    <Photo p={c} t={t} radius={t.photoRadius} border={t.photoBorder} />
                  </div>
                  <div style={{ textAlign: 'center', fontFamily: t.nameFont, fontWeight: t.nameW, fontStyle: t.nameS, fontSize: t.gridName, lineHeight: 1.15, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  {c.description && (
                    <div style={{ textAlign: 'center', fontFamily: t.label, fontSize: 14, fontWeight: 700, letterSpacing: t.lls, textTransform: 'uppercase', color: t.subtle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</div>
                  )}
                  <div className="sheen" aria-hidden="true" style={{ animationDelay: `${(i * 0.9).toFixed(1)}s` }} />
                </div>
              ))}
            </div>

            {isLive && (
              <div aria-hidden="true" style={{ position: 'absolute', left: 1460, top: 142, width: 360, height: 360, zIndex: 6, pointerEvents: 'none' }}>
                <Particles list={pulse} />
              </div>
            )}

            <div className="floaty" style={{ position: 'absolute', left: 1756, top: -4, width: 72, height: 108, zIndex: 7 }}>
              <Frog hat={t.hat} size={72} />
            </div>
          </>
        )}

        {/* The panel frame glides between the grid panel and the slideshow card; what is inside cross-fades. */}
        <div aria-hidden="true" style={{ position: 'absolute', ...frameBox, boxSizing: 'border-box', border: t.panelBorder, background: t.panelBg, borderRadius: t.panelRadius, boxShadow: inShow ? 'none' : t.panelShadow, zIndex: 5, pointerEvents: 'none', opacity: isCer ? 0 : 1, transition: FRAME_GLIDE }} />
        {!isCer && (
          <div aria-hidden={inShow} style={{ position: 'absolute', left: 1440, top: 76, width: 400, height: 932, boxSizing: 'border-box', border: `${t.panelBw}px solid transparent`, padding: '40px 32px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center', zIndex: 6, opacity: inShow ? 0 : 1, visibility: inShow ? 'hidden' : 'visible', transition: inShow ? FADE_OUT : FADE_IN }}>
            {isLive ? (
              <>
                <div style={{ height: headH, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.display, fontStyle: t.ds, fontWeight: t.dw, fontSize: t.panelHeadSize, lineHeight: 1.08, letterSpacing: t.dls, color: t.text }}>{t.panelHead}</div>
                {/* the gliding QR sits here */}
                <div aria-hidden="true" style={{ width: 320, height: 320, flexShrink: 0 }} />
                <div style={{ width: '100%', height: 64, flexShrink: 0, boxSizing: 'border-box', borderRadius: t.pillRadius, background: t.pillBg, color: t.pillText, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: F.mulish, fontSize: 28, fontWeight: 900 }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9 22 2z" />
                  </svg>
                  <span>{botName}</span>
                </div>
                <div style={{ fontSize: 24, lineHeight: 1.25, fontWeight: 700, color: t.muted }}>Наведи камеру телефона на код</div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 36, width: 150, height: 150, flexShrink: 0, borderRadius: '50%', background: t.pillBg, color: t.pillText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LockIcon size={70} />
                </div>
                <div style={{ fontFamily: t.display, fontStyle: t.ds, fontWeight: t.dw, fontSize: t.panelHeadSize, lineHeight: 1.08, letterSpacing: t.dls, color: t.text }}>Голоси пораховано</div>
                <div style={{ fontSize: 28, lineHeight: 1.3, fontWeight: 600, color: t.muted }}>Переможців оголосимо на церемонії нагородження</div>
                <div style={{ fontSize: 26, lineHeight: 1.3, fontWeight: 800, color: t.text }}>Дякуємо всім, хто проголосував!</div>
              </>
            )}
            <div style={{ flexGrow: 1 }} />
            <div style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: '100%', height: 1, background: t.cardBorder }} />
              <div style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', fontSize: 21, lineHeight: 1.35, fontWeight: 600, color: t.muted }}>
                <span style={{ marginTop: 2, display: 'flex' }}><LockIcon size={24} /></span>
                <span>Твій голос анонімний. Результати — лише на церемонії.</span>
              </div>
              {/* FICE × partners on one line, so a partner logo never pushes ours out of the panel */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '10px 16px' }}>
                <img src="/logo_white.png" alt="FICE" style={{ display: 'block', height: 34, width: 'auto', flexShrink: 0 }} />
                {logoAwards.length > 0 && (
                  <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1, fontWeight: 700, color: t.subtle }}>
                    ×
                  </span>
                )}
                {logoAwards.map((a) => (
                  <PartnerLogo key={a.id} name={a.partnerName} logo={a.partnerLogo} w={logoAwards.length > 1 ? 76 : 104} h={logoAwards.length > 1 ? 44 : 52} radius={10} font={12} />
                ))}
              </div>
              {logoAwards.length > 0 && (
                <div style={{ fontSize: 18, lineHeight: 1.3, fontWeight: 700, color: t.text }}>
                  {logoAwards.length > 1 ? '+ спецвідзнаки від партнерів' : '+ спецвідзнака від партнера'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SLIDESHOW ================= */}
        {slideFit && (
          <div style={{ position: 'absolute', left: 64, top: 64, width: 1312, height: 952, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
            <div className="photoin" style={{ width: slideFit.w, height: slideFit.h, flexShrink: 0, transition: `width .8s ${GLIDE}, height .8s ${GLIDE}` }}>
              <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: t.slideR, boxShadow: t.slideRing, background: t.monoBg }}>
                {cands.map((c, i) => (
                  <div key={c.id} aria-hidden={i !== cur} style={{ position: 'absolute', inset: 0, display: 'flex', opacity: i === cur ? 1 : 0, visibility: i === cur ? 'visible' : 'hidden', transform: i === cur ? 'scale(1.025)' : 'scale(1)', transition: 'opacity .8s ease, visibility .8s, transform 5s ease-out' }}>
                    <Photo p={c} t={t} radius="0" border="none" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {isLive && n > 0 && (
          <div aria-hidden={!inShow} style={{ position: 'absolute', left: 1424, top: 72, width: 432, height: 936, display: 'flex', flexDirection: 'column', gap: 18, zIndex: 6, opacity: inShow ? 1 : 0, visibility: inShow ? 'visible' : 'hidden', transition: inShow ? FADE_IN : FADE_OUT }}>
            <div style={{ fontFamily: t.label, fontSize: 20, fontWeight: t.lw, letterSpacing: t.lls, textTransform: 'uppercase', color: t.a1 }}>{title}</div>
            <div key={`name-${cands[cur].id}`} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <FitText size={t.slideName} text={cands[cur].name} style={{ fontFamily: t.display, fontWeight: t.dw, fontStyle: t.ds, lineHeight: 1.04, letterSpacing: t.dls, color: t.text, marginLeft: '-0.14em' }}>
                <Letters name={cands[cur].name} base={0.5} />
              </FitText>
              {cands[cur].description && (
                <div className="capin" style={{ fontFamily: t.label, fontSize: 24, fontWeight: 700, letterSpacing: t.lls, textTransform: 'uppercase', color: t.muted, animationDelay: '0.6s' }}>{cands[cur].description}</div>
              )}
            </div>
            <div style={{ flexGrow: 1 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: t.muted }}>Образ {cur + 1} з {n}</div>
            <div aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
              {cands.map((c, j) => (
                <span key={c.id} style={{ position: 'relative', flexGrow: 1, height: 6, borderRadius: 3, overflow: 'hidden', background: j < cur ? fill : 'rgba(255, 255, 255, 0.18)' }}>
                  {j === cur && <span className="fillbar" style={{ position: 'absolute', inset: 0, background: fill }} />}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 18, padding: 16, boxSizing: 'border-box', border: `${t.panelBw}px solid transparent` }}>
              {/* the gliding frame and QR sit here */}
              <div aria-hidden="true" style={{ width: 156, height: 156, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div style={{ fontFamily: t.display, fontStyle: t.ds, fontWeight: t.dw, fontSize: 26, lineHeight: 1.1, color: t.text }}>{t.panelHead}</div>
                <div style={{ fontFamily: F.mulish, fontSize: 19, fontWeight: 900, color: t.a1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{botName}</div>
                <div style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 600, color: t.muted }}>Голос анонімний</div>
              </div>
            </div>
          </div>
        )}

        <div aria-hidden={!isLive} style={{ position: 'absolute', left: qrBox.left, top: qrBox.top, width: qrBox.size, height: qrBox.size, boxSizing: 'border-box', padding: qrBox.pad, borderRadius: qrBox.r, background: '#ffffff', zIndex: 7, pointerEvents: 'none', opacity: isLive ? 1 : 0, transition: QR_GLIDE }}>
          <img src={qrUrl} alt="QR-код для голосування в Telegram-боті" style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        {/* ================= CEREMONY ================= */}
        {beams.map((b, i) => (
          <StageLight key={`${stepIdx}-${i}`} b={b} rgb={t.beam} />
        ))}

        {isCer && !award && (
          <>
            {step === 6 && (
              <div className="slidedown" style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 68, overflow: 'hidden', background: t.marqueeBg, zIndex: 8 }}>
                <div className="marquee" style={{ display: 'flex', width: 'max-content', height: 68, alignItems: 'center' }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 32, paddingRight: 32 }}>
                      <span style={{ fontFamily: t.display, fontStyle: t.ds, fontWeight: t.dw, fontSize: 34, textTransform: 'uppercase', letterSpacing: '0.02em', color: t.marqueeText, whiteSpace: 'nowrap' }}>Вітаємо переможців</span>
                      <span style={{ width: 18, height: 18, flexShrink: 0, background: t.marqueeText, borderRadius: t.sepR, transform: `rotate(${t.sepRot})` }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ position: 'absolute', left: 0, top: step === 6 ? 100 : 64, width: 1920, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: step === 5 ? 0 : 1, transition: 'top 0.9s cubic-bezier(.2,.8,.2,1), opacity 0.6s ease', zIndex: 7 }}>
              <div style={{ fontFamily: t.label, fontSize: 22, fontWeight: t.lw, letterSpacing: t.lls, textTransform: 'uppercase', color: t.a1 }}>Нагородження</div>
              <h1 style={{ margin: 0, fontFamily: t.display, fontWeight: t.dw, fontStyle: t.ds, fontSize: t.cerTitle, lineHeight: 1.04, letterSpacing: t.dls, color: t.text, textAlign: 'center' }}>{title}</h1>
            </div>

            <div style={{ position: 'absolute', left: 0, top: 232, width: 1920, height: 56, display: 'flex', justifyContent: 'center', zIndex: 7 }}>
              {CAPTIONS[step] && (
                <div key={step} className="capin" style={{ fontFamily: t.body, fontSize: 34, fontWeight: 700, color: step % 2 === 1 ? t.text : t.muted, whiteSpace: 'nowrap' }}>{CAPTIONS[step]}</div>
              )}
            </div>

            {step === 5 && (
              <div style={{ position: 'absolute', left: 0, top: 96, width: 1920, display: 'flex', justifyContent: 'center', zIndex: 9 }}>
                <div className="shimmer" style={{ fontFamily: t.display, fontWeight: t.dw, fontStyle: t.ds, fontSize: 128, lineHeight: 1.1, letterSpacing: t.dls, backgroundImage: `linear-gradient(90deg, ${t.text} 0%, ${t.a1} 25%, ${t.text} 50%, ${t.a1} 75%, ${t.text} 100%)`, whiteSpace: 'nowrap', padding: '0 20px' }}>І перемагає…</div>
              </div>
            )}

            {SLOTS.filter((s) => winners[s.place]).map((s) => {
              const w = winners[s.place]!;
              const grad = s.place === 1 ? t.ped1 : s.place === 2 ? t.ped2 : t.ped3;
              const key = s.place === 1 ? t.key1 : s.place === 2 ? t.key2 : t.key3;
              const num = t.roman ? ['I', 'II', 'III'][s.place - 1] : String(s.place);
              const sealed = step < s.rev;
              const suspense = step === s.sus;
              const dimmed = susStep && !suspense;
              const em = s.em;
              const lidH = Math.round(em * 0.24), boxH = Math.round(em * 0.72);
              const envW = Math.round(em * 1.4), envH = Math.round(em * 0.92), seal = Math.round(em * 0.34);
              const qCls = suspense ? 'breathe fast' : 'breathe';
              return (
                <div key={s.place} style={{ position: 'absolute', left: s.left, top: s.top, width: s.width, height: s.cardH + s.pedH, zIndex: s.place === 1 ? 6 : 5, opacity: dimmed ? 0.28 : 1, filter: dimmed ? 'saturate(.35) blur(2px)' : 'none', transform: suspense ? 'translateY(-10px)' : 'none', transition: 'opacity 0.8s ease, filter 0.8s ease, transform 0.9s cubic-bezier(.2,.8,.2,1)' }}>
                  <div className={suspense ? 'shake' : step === s.rev ? (s.place === 1 ? 'champin' : 'flipin') : undefined} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', height: s.cardH, flexShrink: 0 }}>
                    {sealed ? (
                      <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', border: `3px ${t.sealBorderStyle} ${key}`, borderBottom: 0, borderRadius: `${t.topR} ${t.topR} 0 0`, background: t.sealBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, textAlign: 'center', overflow: 'hidden' }}>
                        {t.id === 'fice' && (
                          <div className={qCls} style={{ fontFamily: F.mulish, fontWeight: 900, fontSize: s.qSize, lineHeight: 0.9, color: key, textShadow: `0 0 48px ${key}` }}>?</div>
                        )}
                        {t.id === 'ny' && (
                          <div className={qCls} style={{ position: 'relative', width: em, height: lidH + boxH }}>
                            <div style={{ position: 'absolute', left: -12, top: 0, width: em + 24, height: lidH, borderRadius: 10, background: '#e23a4f', boxShadow: 'inset 0 -6px 0 rgba(0, 0, 0, 0.18)' }} />
                            <div style={{ position: 'absolute', left: 0, top: lidH, width: '100%', height: boxH, borderRadius: '0 0 12px 12px', background: '#c42a40' }} />
                            <div style={{ position: 'absolute', left: Math.round(em / 2 - 17), top: 0, width: 34, height: '100%', background: 'linear-gradient(90deg, #ffe29a, #ffc24d)' }} />
                            <div style={{ position: 'absolute', left: Math.round(em / 2 - 56), top: -40, width: 56, height: 44, boxSizing: 'border-box', border: '12px solid #ffc24d', borderRadius: '50% 50% 10% 50%', transform: 'rotate(-16deg)' }} />
                            <div style={{ position: 'absolute', left: Math.round(em / 2), top: -40, width: 56, height: 44, boxSizing: 'border-box', border: '12px solid #ffc24d', borderRadius: '50% 50% 50% 10%', transform: 'rotate(16deg)' }} />
                            <div style={{ position: 'absolute', left: 0, top: lidH, width: '100%', height: boxH, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.unb, fontWeight: 800, fontSize: Math.round(em * 0.42), color: '#ffffff', textShadow: '0 4px 0 rgba(0, 0, 0, 0.25)' }}>?</div>
                          </div>
                        )}
                        {t.id === 'hw' && (
                          <div style={{ width: em, height: Math.round(em * 1.3), boxSizing: 'border-box', borderRadius: `${Math.round(em / 2)}px ${Math.round(em / 2)}px 12px 12px`, border: `3px solid ${key}`, background: 'radial-gradient(circle at 50% 42%, rgba(255, 122, 26, 0.40), #1e1028 70%)', boxShadow: '0 0 50px rgba(255, 122, 26, 0.30), inset 0 0 40px rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className={suspense ? 'flicker fast' : 'flicker'} style={{ fontFamily: F.wet, fontSize: Math.round(em * 0.8), lineHeight: 1, color: '#ffb020', textShadow: '0 0 30px rgba(255, 140, 30, 0.8)' }}>?</div>
                          </div>
                        )}
                        {t.id === 'ball' && (
                          <div style={{ position: 'relative', width: envW, height: envH, borderRadius: 6, background: 'linear-gradient(160deg, #f3e7cf, #e1cfab)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.45)' }}>
                            <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(0 100%, 50% 46%, 100% 100%)', background: 'rgba(120, 90, 40, 0.08)' }} />
                            <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '62%', clipPath: 'polygon(0 0, 100% 0, 50% 100%)', background: 'linear-gradient(180deg, #ecdcbc, #d7c199)' }} />
                            <div className={qCls} style={{ position: 'absolute', left: Math.round(envW / 2 - seal / 2), top: Math.round(envH * 0.62 - seal / 2), width: seal, height: seal, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #b2414f, #7a1f2c 70%)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.corm, fontStyle: 'italic', fontWeight: 700, fontSize: Math.round(em * 0.2), color: '#f1d594' }}>F</div>
                          </div>
                        )}
                        <div style={{ fontFamily: t.display, fontStyle: t.ds, fontWeight: t.qW, fontSize: s.place === 1 ? 40 : 34, lineHeight: 1.1, color: t.text }}>{s.q}</div>
                        {suspense && (
                          <div aria-hidden="true" style={{ display: 'flex', gap: 14, height: 28, alignItems: 'flex-end' }}>
                            <span className="drum" style={{ background: key }} />
                            <span className="drum" style={{ background: key, animationDelay: '0.16s' }} />
                            <span className="drum" style={{ background: key, animationDelay: '0.32s' }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: `${s.place === 1 ? 6 : 4}px ${s.place === 1 ? 6 : 4}px 0`, borderRadius: `${t.topR} ${t.topR} 0 0`, background: grad }}>
                          <div style={{ height: '100%', boxSizing: 'border-box', borderRadius: `${t.innerR} ${t.innerR} 0 0`, background: t.cardSolid, padding: '18px 18px 22px', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
                            <div className="unblur" style={{ flexGrow: 1, minHeight: 0, display: 'flex' }}>
                              <Photo p={w} t={t} radius={t.revPhotoR} border={t.photoBorder} blur={26} />
                            </div>
                            <FitText size={s.nameSize + t.nameAdj} text={w.name} style={{ fontFamily: t.display, fontWeight: t.dw, fontStyle: t.ds, lineHeight: 1.08, letterSpacing: t.dls, color: t.text }}>
                              <Letters name={w.name} base={s.place === 1 ? 0.75 : 0.55} />
                            </FitText>
                            {w.description && (
                              <div className="late" style={{ fontFamily: t.label, fontSize: 22, fontWeight: 700, letterSpacing: t.lls, textTransform: 'uppercase', color: t.subtle }}>{w.description}</div>
                            )}
                          </div>
                          {s.place !== 1 && (
                            <div className="stamp" style={{ position: 'absolute', right: -18, top: -30, width: 92, height: 92, borderRadius: '50%', background: grad, color: t.pedText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.pedFont, fontWeight: t.pedW, fontSize: 44, boxShadow: `0 0 0 6px ${t.ring}` }}>{num}</div>
                          )}
                        </div>
                        {step === s.rev && <div className="flash" aria-hidden="true" />}
                        {s.place === 1 && (
                          <>
                            <div className="drop" style={{ position: 'absolute', left: 0, top: -40, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 10, zIndex: 12 }}>
                              <div style={{ padding: '12px 32px', borderRadius: 16, border: `5px solid ${t.ring}`, background: t.badgeBg, color: t.badgeText, fontFamily: t.badgeFont, fontSize: 34, fontWeight: 900, letterSpacing: t.badgeLS, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Переможець</div>
                            </div>
                            <div className="floaty" style={{ position: 'absolute', left: 476, top: -104, width: 64, height: 96, zIndex: 13 }}>
                              <Frog hat={t.hat} size={64} />
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {suspense && <Lit rgb={t.beam} radius={`${t.topR} ${t.topR} 0 0`} />}
                  </div>
                  <div className={!sealed ? 'pedglow' : ''} style={{ flexShrink: 0, height: s.pedH, borderRadius: '0 0 20px 20px', background: grad, boxShadow: !sealed ? `0 -10px 70px ${key}66` : 'none', transition: 'box-shadow 0.8s ease', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 14, paddingTop: Math.round((s.pedH - s.pedNumSize) / 2), boxSizing: 'border-box', color: t.pedText }}>
                    <span style={{ fontFamily: t.pedFont, fontWeight: t.pedW, fontStyle: t.pedS, fontSize: s.pedNumSize, lineHeight: 1 }}>{num}</span>
                    <span style={{ fontFamily: t.label, fontWeight: 800, fontSize: Math.round(s.pedNumSize * 0.36), letterSpacing: t.lls, textTransform: 'uppercase' }}>місце</span>
                  </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ================= PARTNER AWARD ================= */}
        {isCer && award?.pick && (
          <div key={`award-${awardIdx}`}>
            <div className="fadeup" style={{ position: 'absolute', left: 0, top: 64, width: 1920, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: t.label, fontSize: 22, fontWeight: t.lw, letterSpacing: t.lls, textTransform: 'uppercase', color: t.a1 }}>
                <span>Спецвідзнака від партнера</span>
                {awards.length > 1 && (
                  <span style={{ padding: '4px 12px', borderRadius: 8, border: `2px solid ${t.a1}73`, letterSpacing: '0.06em' }}>
                    {awardIdx + 1} з {awards.length}
                  </span>
                )}
              </div>
              <h1 style={{ margin: 0, fontFamily: t.display, fontWeight: t.dw, fontStyle: t.ds, fontSize: t.cerTitle, lineHeight: 1.04, letterSpacing: t.dls, color: t.text, textAlign: 'center' }}>{award.title}</h1>
              <div style={{ marginTop: 8, fontSize: 30, fontWeight: 600, color: t.muted }}>у номінації «{title}»</div>
            </div>

            <div className="fadeup" style={{ position: 'absolute', left: 170, top: 340, width: 700, display: 'flex', flexDirection: 'column', gap: 22, zIndex: 6, animationDelay: '0.2s' }}>
              <PartnerLogo name={award.partnerName} logo={award.partnerLogo} w={560} h={240} radius={24} font={44} extra={{ boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)' }} />
              <div style={{ marginTop: 14, fontFamily: t.display, fontWeight: t.dw, fontStyle: t.ds, fontSize: 60, lineHeight: 1.05, letterSpacing: t.dls, color: t.text }}>{award.partnerName}</div>
              {award.prize && <div style={{ fontSize: 32, lineHeight: 1.3, fontWeight: 700, color: t.muted }}>Приз: {award.prize}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, fontWeight: 600, color: t.subtle }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z" />
                </svg>
                <span>Партнер обрав сам — незалежно від голосування</span>
              </div>
            </div>

            <div aria-hidden="true" style={{ position: 'absolute', left: 900, top: 640, width: 170, height: 6, zIndex: 6 }}>
              <div className="dash" style={{ width: 150, height: 6, borderRadius: 3, backgroundImage: `linear-gradient(90deg, ${t.a1} 0 14px, transparent 14px 28px)`, backgroundSize: '28px 6px' }} />
              <div style={{ position: 'absolute', left: 146, top: -9, width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: `20px solid ${t.a1}` }} />
            </div>

            <div style={{ position: 'absolute', left: 1100, top: 300, width: 560, height: 700, zIndex: 6 }}>
              {!awardOpen ? (
                <div className="shake" style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', border: `3px ${t.sealBorderStyle} ${t.a1}`, borderRadius: t.topR, background: t.sealBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, textAlign: 'center' }}>
                  {t.id === 'fice' && <div className="breathe fast" style={{ fontFamily: F.mulish, fontWeight: 900, fontSize: 220, lineHeight: 0.9, color: t.a1, textShadow: `0 0 48px ${t.a1}` }}>?</div>}
                  {t.id === 'ny' && <div className="breathe fast" style={{ fontFamily: F.unb, fontWeight: 800, fontSize: 200, lineHeight: 0.9, color: t.a1, textShadow: `0 0 48px ${t.a1}` }}>?</div>}
                  {t.id === 'hw' && <div className="flicker fast" style={{ fontFamily: F.wet, fontSize: 210, lineHeight: 1, color: '#ffb020', textShadow: '0 0 30px rgba(255, 140, 30, 0.8)' }}>?</div>}
                  {t.id === 'ball' && (
                    <div className="breathe fast" style={{ width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #b2414f, #7a1f2c 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.corm, fontStyle: 'italic', fontWeight: 700, fontSize: 70, color: '#f1d594' }}>F</div>
                  )}
                  <div style={{ fontFamily: t.display, fontStyle: t.ds, fontWeight: t.qW, fontSize: 40, color: t.text }}>Кого обрав партнер?</div>
                  <div aria-hidden="true" style={{ display: 'flex', gap: 14, height: 28, alignItems: 'flex-end' }}>
                    <span className="drum" style={{ background: t.a1 }} />
                    <span className="drum" style={{ background: t.a1, animationDelay: '0.16s' }} />
                    <span className="drum" style={{ background: t.a1, animationDelay: '0.32s' }} />
                  </div>
                  <Lit rgb={t.beam} radius={t.topR} />
                </div>
              ) : (
                <>
                  <div className="flipin" style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: 6, borderRadius: t.topR, background: t.grad }}>
                    <div style={{ height: '100%', boxSizing: 'border-box', borderRadius: t.innerR, background: t.cardSolid, padding: '18px 18px 26px', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
                      <div className="unblur" style={{ flexGrow: 1, minHeight: 0, display: 'flex' }}>
                        <Photo p={award.pick} t={t} radius={t.revPhotoR} border={t.photoBorder} blur={26} />
                      </div>
                      <FitText size={48 + t.nameAdj} text={award.pick.name} style={{ fontFamily: t.display, fontWeight: t.dw, fontStyle: t.ds, lineHeight: 1.08, letterSpacing: t.dls, color: t.text }}>
                        <Letters name={award.pick.name} base={0.55} />
                      </FitText>
                      {award.pick.description && (
                        <div className="late" style={{ fontFamily: t.label, fontSize: 22, fontWeight: 700, letterSpacing: t.lls, textTransform: 'uppercase', color: t.subtle }}>{award.pick.description}</div>
                      )}
                    </div>
                    <div className="stamp" style={{ position: 'absolute', left: -26, top: 34, padding: '12px 26px', borderRadius: 14, background: t.badgeBg, color: t.badgeText, fontFamily: t.badgeFont, fontSize: 28, fontWeight: 900, letterSpacing: t.badgeLS, textTransform: 'uppercase', boxShadow: `0 0 0 5px ${t.ring}`, whiteSpace: 'nowrap' }}>{award.title}</div>
                    <div className="stamp" style={{ position: 'absolute', right: -34, bottom: 120, animationDelay: '1.35s' }}>
                      <PartnerLogo name={award.partnerName} logo={award.partnerLogo} w={132} h={132} radius="50%" font={16} extra={{ boxShadow: `0 0 0 6px ${t.ring}` }} />
                    </div>
                  </div>
                  <div className="flash" aria-hidden="true" />
                </>
              )}
            </div>
          </div>
        )}

        <div key={`fx-${stepIdx}-${salute}`} aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
          <Particles list={bursts} />
          <Particles list={rainList} />
          <Particles list={saluteList} />
        </div>
      </div>

      {/* ================= OPERATOR REMOTE (M key; the admin has its own) ================= */}
      <div aria-hidden={!showPanel} inert={!showPanel} style={{ position: 'fixed', left: '50%', bottom: 16, transform: `translateX(-50%) translateY(${showPanel ? 0 : 140}%)`, opacity: showPanel ? 1 : 0, transition: 'transform 0.3s ease, opacity 0.3s ease', zIndex: 50, maxWidth: 'calc(100vw - 32px)', overflowX: 'auto', boxSizing: 'border-box', padding: '12px 16px', borderRadius: 20, background: 'rgba(11, 11, 14, 0.92)', border: '1px solid #26262d', display: 'flex', alignItems: 'center', gap: 12, color: '#ffffff', fontFamily: F.mulish }}>
        <div role="group" aria-label="Режим екрана" style={btnGroup}>
          {([['live', 'Голосування'], ['closed', 'Підсумок'], ['ceremony', 'Церемонія']] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => pickMode(m)} style={segBtn(curMode === m, G)}>{label}</button>
          ))}
        </div>
        <div role="group" aria-label="Тема заходу" style={btnGroup}>
          {THEME_IDS.map((tid) => (
            <button key={tid} type="button" onClick={() => pickTheme(tid)} style={segBtn(themeId === tid)}>
              <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', background: THEMES[tid].swatch, flexShrink: 0 }} />
              {THEMES[tid].name}
            </button>
          ))}
        </div>

        {isLive && (
          <>
            <div role="group" aria-label="Показ образів" style={btnGroup}>
              {([['auto', 'Авто'], ['grid', 'Сітка'], ['show', 'По одному']] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => { setView(v); if (v === 'auto') setPhase(-2); }} style={segBtn(view === v)}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={() => go(-1)} aria-label="Попередній образ" style={iconBtn}>{chevron('M15 18l-6-6 6-6')}</button>
            <button type="button" onClick={() => go(1)} aria-label="Наступний образ" style={iconBtn}>{chevron('M9 18l6-6-6-6')}</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>{slideCand ? `На екрані: ${slideCand.name} · ${cur + 1} з ${n}` : 'На екрані: сітка всіх образів'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#d3d3d3', whiteSpace: 'nowrap' }}>
                {view === 'auto' ? 'Сітка 10 с → кожен образ по 5 с → по колу' : view === 'show' ? 'Образи по черзі, кожен по 5 с' : 'Сітка без перемикання'}
              </span>
            </div>
          </>
        )}

        {curMode === 'closed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: '#d3d3d3', whiteSpace: 'nowrap' }}>
            <LockIcon size={20} stroke="#2eff97" />
            <span>Голоси пораховано й приховано до церемонії.</span>
          </div>
        )}

        {isCer && (
          <>
            <button type="button" onClick={back} aria-label="Назад на крок" style={{ ...iconBtn, opacity: stepIdx === 0 ? 0.45 : 1 }}>{chevron('M15 18l-6-6 6-6')}</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, width: 210 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {steps.map((s, i) => (
                  <span key={s} style={{ flexGrow: 1, height: 6, borderRadius: 3, background: i <= stepIdx ? G : '#2a2a33' }} />
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d3d3d3', whiteSpace: 'nowrap' }}>Крок {stepIdx + 1} з {steps.length} · {stepName(stepNo)}</div>
            </div>
            <button type="button" onClick={next} style={{ height: 56, flexShrink: 0, padding: '0 20px', border: 0, borderRadius: 14, background: G, color: '#000000', fontSize: 16, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap', opacity: stepIdx >= steps.length - 1 ? 0.45 : 1 }}>
              <span>Далі: {stepIdx >= steps.length - 1 ? 'сценарій завершено' : stepAction(steps[stepIdx + 1])}</span>
              <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(0, 0, 0, 0.18)', fontSize: 12, fontWeight: 800 }}>Пробіл</span>
            </button>
            <button type="button" onClick={fireSalute} style={{ ...iconBtn, width: 'auto', padding: '0 14px', fontSize: 15, fontWeight: 800 }}>Салют</button>
            <button type="button" onClick={() => setStepWant(0)} style={{ height: 48, flexShrink: 0, padding: '0 12px', border: 0, borderRadius: 12, background: 'transparent', color: '#d3d3d3', fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>З початку</button>
          </>
        )}

        <button type="button" onClick={toggleFullscreen} aria-label="На весь екран (F)" style={iconBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
