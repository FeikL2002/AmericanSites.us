import React, { useId } from 'react';
import './fallback.css';

const DESKS = [
  { id: 'bob', name: 'BoB', job: 'Coordinate the team', x: 177, y: 222, w: 392, color: '#e4c292', icon: 'M2 7h16M10 0v14M3 1v12M17 1v12' },
  { id: 'accountant', name: 'Accounting', job: 'Review recorded money', x: 603, y: 222, w: 421, color: '#a8cf9b', icon: 'M3 0h14v15H3zM6 3h8M6 7h1M11 7h1M6 11h1M11 11h1' },
  { id: 'codex', name: 'Codex', job: 'Build & improve', x: 177, y: 350, w: 260, color: '#69c6fb', icon: 'M6 1L0 7l6 6M14 1l6 6-6 6M12 0L8 14' },
  { id: 'designer', name: 'Design', job: 'Shape the experience', x: 466, y: 350, w: 261, color: '#b9a8ef', icon: 'M1 13l3-6L14 0l5 5-10 8zM4 7l5 6' },
  { id: 'qa', name: 'QA lab', job: 'Test the result', x: 754, y: 350, w: 270, color: '#75dbbf', icon: 'M2 7l5 5L18 1' },
  { id: 'scout', name: 'Scout', job: 'Find useful opportunities', x: 177, y: 478, w: 300, color: '#edbc86', icon: 'M15 6a6 6 0 1 1-12 0 6 6 0 0 1 12 0M13 11l6 6' },
  { id: 'security', name: 'Security', job: 'Review before release', x: 727, y: 478, w: 297, color: '#a7bdfa', icon: 'M10 0l8 3v5c0 5-8 8-8 8S2 13 2 8V3zM6 7l3 3 5-5' },
];
const human = value => String(value || 'idle').replaceAll('_', ' ');
const colorFor = worker => worker.active ? '#74e3bb' : /fail|block/.test(worker.state || '') ? '#f19388' : /approval|review|testing/.test(worker.state || '') ? '#efc580' : '#8397a4';
const short = (text, length) => text?.length > length ? text.slice(0, length - 1) + '…' : text;

function Plant({ x, y, scale = 1, pot = '#d4c6ad' }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
    <ellipse cy="2" rx="15" ry="4" fill="#06131c" opacity=".35" />
    <path d="M-10-18H10L7 0H-7Z" fill={pot} /><path d="M0-18V-54" stroke="#617346" strokeWidth="2" />
    <path d="M0-42C-18-70-25-54-3-26C-20-46-31-35-2-20M0-40C18-70 25-55 3-25C25-49 31-34 2-19" fill="#4b7052" />
    <path d="M0-45C-8-75 11-75 0-36M0-30C-14-55-18-39 0-24M0-30C15-52 18-38 0-23" fill="#7b9364" />
  </g>;
}

function Palm({ x, y, size = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`} aria-hidden="true">
    <ellipse rx="33" ry="8" fill="#06121c" opacity=".45" />
    <path d="M-4 0C-6-46 0-77 6-110" fill="none" stroke="#79634c" strokeWidth="9" />
    <path d="M6-110C-31-141-64-129-70-100C-33-117-12-111 6-110M6-110C-27-168-50-148-47-129C-27-139-8-123 6-110M6-110C11-162 40-159 36-133C27-143 11-122 6-110M6-110C53-153 76-132 68-108C42-125 26-117 6-110M6-110C49-115 63-94 47-79C37-102 20-103 6-110M6-110C-35-121-45-94-28-79C-27-100-12-105 6-110" fill="#294d42" />
    <path d="M6-110C-20-137-39-128-49-114M6-110C36-135 53-128 60-117M6-110C20-143 27-145 31-143" fill="none" stroke="#5b7958" strokeWidth="4" strokeLinecap="round" />
  </g>;
}

function Worker({ x, y, active, color = '#758d9b' }) {
  return <g transform={`translate(${x} ${y})`} aria-hidden="true">
    <ellipse cx="2" cy="22" rx="21" ry="5" fill="#07121b" opacity=".5" />
    <path d="M-11 6l-2 14M10 6l4 14" stroke="#23303b" strokeWidth="9" strokeLinecap="round" />
    <path d="M-13 20h-7M14 20h6" stroke="#17232d" strokeWidth="6" strokeLinecap="round" />
    <path d="M-12-19Q0-29 12-19L15 4Q0 12-15 4Z" fill={color} />
    <rect x="-15" y="-9" width="30" height="23" rx="8" fill="#273b47" stroke="#58717f" strokeWidth="1.5" />
    <path d="M-15-15L-24-17M14-15L24-17" stroke={color} strokeWidth="8" strokeLinecap="round" />
    <g className={active ? 'fallback-hands is-working' : 'fallback-hands'}>
      <path d="M-24-17l6 1M24-17l-6 1" stroke="#cba28a" strokeWidth="5" strokeLinecap="round" />
    </g>
    <path d="M-3-28v7" stroke="#b98d72" strokeWidth="7" />
    <ellipse cy="-38" rx="10" ry="12" fill="#cba28a" />
    <path d="M-10-38Q-12-52 0-52Q13-50 10-35L6-43Q-5-41-10-38" fill="#312d2d" />
  </g>;
}

function Room({ desk, worker, selected, onSelect, prefix, connected, reducedMotion }) {
  const { id, x, y, w, color } = desk;
  const active = Boolean(worker.active && connected && !reducedMotion);
  const stateColor = colorFor({ ...worker, active: Boolean(worker.active && connected) });
  const deskX = x + w / 2;
  return <g className={`fallback-room${selected ? ' is-selected' : ''}`} role="button" tabIndex="0"
    aria-label={`${desk.name}: ${human(worker.state)}. ${worker.taskTitle || 'No task assigned'}. Select desk.`}
    aria-pressed={selected} onClick={() => onSelect?.(id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(id); } }}>
    <title>{`${desk.name} · ${human(worker.state)} · ${worker.taskTitle || 'No task assigned'}`}</title>
    <rect x={x - 7} y={y} width={w + 14} height="119" rx="2" fill={`url(#${prefix}-room)`} />
    <path d={`M${x - 7} ${y + 119}L${x + 12} ${y + 95}H${x + w - 12}L${x + w + 7} ${y + 119}Z`} fill="#7d7e76" />
    <path d={`M${x - 7} ${y + 3}L${x + 12} ${y + 18}V${y + 95}L${x - 7} ${y + 119}Z`} fill="#3b4b51" />
    <path d={`M${x + w + 7} ${y + 3}L${x + w - 12} ${y + 18}V${y + 95}L${x + w + 7} ${y + 119}Z`} fill="#222f38" />
    <path d={`M${x + 12} ${y + 18}H${x + w - 12}`} stroke="#efd4a5" strokeWidth="2.5" opacity=".8" />
    {/* A wall label and work screen show identities/status, never invented output. */}
    <g transform={`translate(${x + 19} ${y + 29})`} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={desk.icon} /></g>
    <text x={x + 48} y={y + 39} fill="#f0eadd" fontSize="17" fontWeight="650">{desk.name}</text>
    <text x={x + w - 18} y={y + 38} textAnchor="end" fill={stateColor} fontSize="10" fontWeight="500">{short(human(worker.state), 22)}</text>
    <ellipse cx={deskX} cy={y + 112} rx={w * .31} ry="6" fill="#14232b" opacity=".55" />
    <path d={`M${deskX - 74} ${y + 84}h148l9 10h-166Z`} fill="#b99e7a" />
    <path d={`M${deskX - 83} ${y + 94}h166v4h-166Z`} fill="#6b5f4d" />
    <path d={`M${deskX - 70} ${y + 98}v17M${deskX + 70} ${y + 98}v17`} stroke="#253640" strokeWidth="5" />
    <rect x={deskX - 51} y={y + 51} width="102" height="37" rx="3" fill="#172d3c" stroke="#5f7b8e" strokeWidth="1.5" />
    <rect x={deskX - 47} y={y + 55} width="94" height="29" rx="1" fill="#0b1b29" />
    <circle cx={deskX - 38} cy={y + 63} r="2.3" fill={stateColor} />
    <text x={deskX - 31} y={y + 66} fill={stateColor} fontSize="8.5" fontFamily="ui-monospace,monospace">{short(human(worker.state).toUpperCase(), 18)}</text>
    <text x={deskX - 38} y={y + 77} fill="#9eb2c0" fontSize="6.6">{short(worker.taskTitle || 'No task assigned', 25)}</text>
    <path d={`M${deskX} ${y + 88}v5m-12 0h24`} stroke="#77858b" strokeWidth="2" />
    <path d={`M${deskX - 28} ${y + 92}h56l3 3h-62Z`} fill="#384a55" />
    <ellipse cx={deskX + 60} cy={y + 89} rx="4" ry="2" fill="#ddd5c5" /><path d={`M${deskX + 56} ${y + 88}v-8h8v8`} fill="#ddd5c5" />
    <Worker x={deskX} y={y + 108} active={active} color={id === 'designer' ? '#ad8f7b' : id === 'accountant' ? '#768d79' : '#68889b'} />
    <Plant x={x + w - 20} y={y + 110} scale={.6} />
    <rect className="fallback-room-outline" x={x - 7} y={y} width={w + 14} height="119" rx="3" fill="none" stroke={selected ? color : 'transparent'} strokeWidth={selected ? 2.5 : 1.5} />
    <path d={`M${x + 18} ${y + 118}H${x + w - 18}`} stroke={selected ? color : '#dcc69c'} strokeWidth={selected ? 2.5 : .8} opacity={selected ? 1 : .4} />
  </g>;
}

function Supercar({ prefix }) {
  return <g transform="translate(102 626)" aria-hidden="true">
    <ellipse cx="165" cy="64" rx="173" ry="21" fill="#08131c" opacity=".75" />
    <path d="M17 24L81-4 187-11 254 12 322 28 331 47 304 61 29 56 0 42Z" fill={`url(#${prefix}-car)`} stroke="#abbac3" strokeWidth="1.2" />
    <path d="M87-3L123-18 192-19 238 12 176 18Z" fill="#162e3e" stroke="#bdcbd3" strokeWidth="2" />
    <path d="M123-18L117 6 176 18 192-19Z" fill="#31516a" /><path d="M127-15L186-16 173 12 122 3Z" fill="#547389" opacity=".4" />
    <path d="M17 24L176 18 254 12 322 28 170 39Z" fill="#dce3e6" opacity=".9" />
    <path d="M170 39L322 28 331 47 304 61 164 61Z" fill="#b3c3cf" />
    <path d="M186 45l36-7 20 18-55 1Z M274 35l40 2 7 13-41 4Z" fill="#152735" />
    <path d="M187 40l38-5M280 32l32 2" stroke="#ddf7ff" strokeWidth="3" strokeLinecap="round" />
    <path d="M32 28L114 24 143 39 36 42Z" fill="#b7c6cf" /><path d="M117 29l23 2-4 14-21 1Z" fill="#1f3847" />
    <g transform="translate(57 48)"><ellipse rx="21" ry="25" fill="#111b25"/><ellipse rx="13" ry="18" fill="#6c7f8e"/><ellipse rx="8" ry="13" fill="#172d3e"/><path d="M0-17V17M-12-8L12 8M-12 8L12-8" stroke="#cbd3d6" strokeWidth="2"/><circle r="3" fill="#c9a869"/></g>
    <g transform="translate(260 50)"><ellipse rx="20" ry="26" fill="#111b25"/><ellipse rx="12" ry="19" fill="#6c7f8e"/><ellipse rx="7" ry="13" fill="#172d3e"/><path d="M0-18V18M-11-8L11 8M-11 8L11-8" stroke="#cbd3d6" strokeWidth="2"/><circle r="3" fill="#c9a869"/></g>
    <path d="M31 56L235 62" stroke="#243849" strokeWidth="4" />
  </g>;
}

export default function OfficeFallback({ workers = [], onSelect, selectedRole, connected = true, reducedMotion = false }) {
  const prefix = 'office' + useId().replaceAll(':', '');
  return <div className="office-fallback">
    <svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid meet" aria-label="Interactive two dimensional AmericanSites office cutaway" className="office-cutaway">
      <defs>
        <linearGradient id={`${prefix}-sky`} x2="0" y2="1"><stop stopColor="#142437"/><stop offset=".6" stopColor="#334457"/><stop offset="1" stopColor="#6a6564"/></linearGradient>
        <linearGradient id={`${prefix}-room`} x2="0" y2="1"><stop stopColor="#344247"/><stop offset=".5" stopColor="#37423e"/><stop offset="1" stopColor="#595c50"/></linearGradient>
        <linearGradient id={`${prefix}-front`} x2="0" y2="1"><stop stopColor="#203444"/><stop offset="1" stopColor="#132532"/></linearGradient>
        <linearGradient id={`${prefix}-side`}><stop stopColor="#1a2e3b"/><stop offset="1" stopColor="#31424c"/></linearGradient>
        <linearGradient id={`${prefix}-car`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#f0f1ea"/><stop offset=".6" stopColor="#b6c5d0"/><stop offset="1" stopColor="#7892a4"/></linearGradient>
        <linearGradient id={`${prefix}-ground`} x2="0" y2="1"><stop stopColor="#526067"/><stop offset="1" stopColor="#253a49"/></linearGradient>
        <linearGradient id={`${prefix}-roof`}><stop stopColor="#455765"/><stop offset="1" stopColor="#293d4c"/></linearGradient>
        <linearGradient id={`${prefix}-glass`}><stop stopColor="#9cd6f6" stopOpacity=".06"/><stop offset=".4" stopColor="#a5d9f8" stopOpacity=".2"/><stop offset="1" stopColor="#8ccdf1" stopOpacity=".03"/></linearGradient>
        <radialGradient id={`${prefix}-halo`}><stop stopColor="#d4b88e" stopOpacity=".12"/><stop offset="1" stopColor="#d4b88e" stopOpacity="0"/></radialGradient>
      </defs>
      <rect width="1200" height="760" fill={`url(#${prefix}-sky)`}/>
      <ellipse cx="670" cy="350" rx="590" ry="340" fill={`url(#${prefix}-halo)`}/>
      <g opacity=".4" fill="#1b3043" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <rect key={i} x={i * 84} y={330 - i % 3 * 27} width={32 + i % 4 * 11} height={250 + i % 3 * 27}/>)}</g>
      <text x="1164" y="39" textAnchor="end" fill="#c0cfda" fontSize="13" letterSpacing="1.2">2D INTERACTIVE CUTAWAY</text>
      <text x="1164" y="58" textAnchor="end" fill="#8298ab" fontSize="11">Live task state · simplified office view</text>
      {/* Campus paving and three-quarter building envelope. */}
      <path d="M0 632L315 459 1200 540V760H0Z" fill={`url(#${prefix}-ground)`}/>
      <g stroke="#8a9698" opacity=".13" strokeWidth="1" aria-hidden="true">
        {[0,1,2,3,4,5].map(i => <path key={i} d={`M${i*220-100} 760L${i*110+200} 550M0 ${650+i*26}L1200 ${550+i*28}`} />)}
      </g>
      <path d="M130 605L249 527 1167 527 1060 632Z" fill="#0b1a25" opacity=".55" />
      <path d="M1049 166L1150 96V526L1049 604Z" fill={`url(#${prefix}-side)`} stroke="#596a72" />
      <path d="M150 166L250 96H1150L1049 166Z" fill={`url(#${prefix}-roof)`} stroke="#7a858a" />
      <path d="M166 155L254 104H1122L1043 155Z" fill="#243b4b" stroke="#4a5f6d" />
      <path d="M150 166H1049V609H150Z" fill={`url(#${prefix}-front)`} stroke="#74828a" strokeWidth="2" />
      <path d="M1050 214L1150 144M1050 342L1150 272M1050 470L1150 400M1050 599L1150 529" stroke="#84938f" strokeWidth="3" />
      {[1080,1115].map((x,i) => <path key={x} d={`M${x} ${194-i*24}V${584-i*26}`} stroke="#71818b" strokeWidth="2" />)}
      <path d="M1056 220L1143 160V521L1056 586Z" fill={`url(#${prefix}-glass)`}/>
      <path d="M159 213H1040" stroke="#f1d2a0" strokeWidth="3"/><path d="M1049 213L1149 144" stroke="#c7ac86" strokeWidth="2" />
      {/* The facade wordmark remains AmericanSites, not a dashboard full of made-up totals. */}
      <g transform="translate(363 181)" aria-label="AmericanSites agent headquarters">
        <path d="M0 24L20-18H34L50 24H37L32 10H16L11 24ZM20 0H29L25-11Z" fill="#f1eee4"/>
        <path d="M-4 21Q22 4 51 17" fill="none" stroke="#dc5f61" strokeWidth="5" strokeLinecap="round"/>
        <text x="66" y="14" fill="#f0eee6" fontSize="40" fontWeight="700" letterSpacing="-1.8">American<tspan fill="#67c5f6">Sites</tspan></text>
        <text x="70" y="30" fill="#a0b9ca" fontSize="8.5" letterSpacing="4.1">AGENT HEADQUARTERS</text>
      </g>
      {DESKS.map(desk => <Room key={desk.id} desk={desk} worker={workers.find(w => w.id === desk.id) || { id:desk.id, state:'idle',active:false }} selected={selectedRole === desk.id} onSelect={onSelect} prefix={prefix} connected={connected} reducedMotion={reducedMotion}/>) }
      {/* Lobby has no fictional worker. */}
      <g aria-hidden="true"><rect x="503" y="478" width="197" height="119" fill={`url(#${prefix}-room)`}/><path d="M503 597l17-24h163l17 24" fill="#999481"/>
        <path d="M530 548h135v29H530Z" fill="#b8a383"/><path d="M524 543h147v6H524Z" fill="#263c48"/><path d="M530 576h135" stroke="#f6d9ac" strokeWidth="2"/>
        <text x="598" y="520" textAnchor="middle" fill="#e9e3d3" fontSize="14" fontWeight="600" letterSpacing="4">WELCOME</text><text x="598" y="536" textAnchor="middle" fill="#9bb2ba" fontSize="7" letterSpacing="2">AMERICANSITES</text>
        <Plant x="519" y="591" scale={.72}/><Plant x="684" y="591" scale={.72}/>
        <ellipse cx="598" cy="489" rx="36" ry="7" fill="none" stroke="#f0d5a7" strokeWidth="2"/>
      </g>
      {/* Slabs and mullions frame the cutaway without obscuring desk selection. */}
      <g aria-hidden="true">{[342,470,599].map(y => <g key={y}><rect x="151" y={y} width="898" height="8" fill="#8b8e84"/><path d={`M153 ${y+1}H1048`} stroke="#e6cd9f" strokeWidth="1.3"/><path d={`M153 ${y+7}H1048`} stroke="#1e303c" strokeWidth="2"/></g>)}
        <path d="M153 219V599M1046 219V599" stroke="#1d3445" strokeWidth="8"/><path d="M152 346V469M1047 346V469" stroke="#6bd2ff" strokeWidth="2"/>
        <path d="M138 608H1060L1073 620H124Z" fill="#a2a396"/><path d="M124 620H1073V627H124Z" fill="#566971"/>
      </g>
      <Palm x="90" y="619" size={1.13}/><Palm x="1127" y="591" size={1.3}/>
      <Plant x="1100" y="647" scale={1.3} pot="#5c6d72"/>
      <path d="M510 627H674L736 760H405Z" fill="#b7b4a4" opacity=".35"/><path d="M510 628L453 760M674 628L733 760" stroke="#ebd4a7" strokeWidth="2" opacity=".6"/>
      <Supercar prefix={prefix}/>
      <g transform="translate(851 651)" aria-hidden="true"><path d="M0 0l22-16h160v58l-22 16H0Z" fill="#263f4c"/><path d="M0 0h160v58H0Z" fill="#344a55" stroke="#72838a"/><text x="80" y="29" textAnchor="middle" fill="#dae8ee" fontSize="19" fontWeight="700">American<tspan fill="#70c9ee">Sites</tspan></text><text x="80" y="43" textAnchor="middle" fill="#91acbb" fontSize="7" letterSpacing="2.2">BUILD SOMETHING USEFUL</text><path d="M-5 59H164" stroke="#62b9dd" strokeWidth="2"/></g>
      <g transform="translate(28 728)" fill="#bed0dc"><circle r="3.5" fill="#74e3bb"/><text x="11" y="4" fontSize="11">Hands move only for a verified active worker.</text></g>
      <text x="1170" y="732" textAnchor="end" fill="#9aafbd" fontSize="11">Select any room to see its actual assignment.</text>
    </svg>
  </div>;
}
