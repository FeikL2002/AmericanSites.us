import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const COLORS = { stone: '#b8b0a0', dark: '#152029', brass: '#b99b68', glow: '#ffd59a', blue: '#28bafb', glass: '#a0bed0' };
const ROOMS = {
  security: { x: -8, y: 0.25, z: 0, name: 'SECURITY', subtitle: 'REVIEW & TRUST', color: '#bb9cff' },
  qa: { x: 7.8, y: 0.25, z: 0, name: 'QA LAB', subtitle: 'TEST & VERIFY', color: '#7be0c8' },
  codex: { x: -7.5, y: 4.25, z: 0, name: 'CODEX', subtitle: 'DEVELOPMENT STUDIO', color: '#5bc6ff' },
  designer: { x: 4.5, y: 4.25, z: 0, name: 'DESIGN', subtitle: 'INTERFACE & 3D', color: '#f2b475' },
  bob: { x: 5.5, y: 8.25, z: 0, name: 'BoB', subtitle: 'ORCHESTRATION', color: '#eff7ff' },
};

function Box({ position, scale, color = COLORS.dark, roughness = 0.5, metalness = 0, emissive, intensity = 1, rotation, ...props }) {
  return <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow {...props}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive || '#000000'} emissiveIntensity={emissive ? intensity : 0} />
  </mesh>;
}

function Strip({ position, scale, color = COLORS.glow, intensity = 2.8 }) {
  return <Box position={position} scale={scale} color={color} emissive={color} intensity={intensity} />;
}

function useTexture(draw, deps = []) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
    draw(c.getContext('2d'), c);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, deps);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Sign({ text, sub = '', width = 6, height = 1.7, position, color = '#f1f5fa', background = '#14212d', brand = false, rotation = [0, 0, 0] }) {
  const texture = useTexture((ctx, canvas) => {
    ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (brand) {
      ctx.fillStyle = '#f1f5fa'; ctx.font = 'italic 900 242px Arial'; ctx.fillText('A', 30, 242);
      ctx.strokeStyle = '#e13b45'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(30, 268); ctx.quadraticCurveTo(160, 185, 224, 251); ctx.stroke();
      ctx.font = '700 100px Arial'; ctx.fillStyle = '#f2f6fa'; ctx.fillText('American', 254, 174);
      ctx.fillStyle = '#39bdff'; ctx.fillText('Sites', 709, 174);
      ctx.font = '500 31px Arial'; ctx.fillStyle = '#b8cedc'; ctx.fillText('A G E N T   H E A D Q U A R T E R S', 260, 252);
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = '700 100px Arial'; ctx.fillText(text, 512, 177);
      if (sub) { ctx.fillStyle = '#b9c6cf'; ctx.font = '500 36px Arial'; ctx.fillText(sub, 512, 260); }
    }
  }, [text, sub, color, background, brand]);
  return <mesh position={position} rotation={rotation}>
    <planeGeometry args={[width, height]} />
    <meshStandardMaterial map={texture} roughness={0.55} emissive={'#ffffff'} emissiveMap={texture} emissiveIntensity={0.38} />
  </mesh>;
}

function Glass({ position, scale, opacity = 0.07 }) {
  return <mesh position={position} scale={scale}>
    <boxGeometry />
    <meshPhysicalMaterial color={COLORS.glass} transparent opacity={opacity} roughness={0.08} metalness={0.2} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}

function Plant({ position, size = 1, palm = false }) {
  const leaves = palm ? 7 : 6;
  return <group position={position} scale={size}>
    <mesh position={[0, 0.25, 0]} castShadow>
      <cylinderGeometry args={[0.3, 0.23, 0.5, 10]} />
      <meshStandardMaterial color={palm ? '#4b4c48' : '#afa99c'} roughness={0.75} />
    </mesh>
    <mesh position={[0, palm ? 1.5 : 0.9, 0]} castShadow>
      <cylinderGeometry args={[0.055, 0.09, palm ? 2.5 : 1.2, 7]} />
      <meshStandardMaterial color={'#6f5a3c'} />
    </mesh>
    {Array.from({ length: leaves }, (_, i) => <group key={i} rotation={[0, i * Math.PI * 2 / leaves, 0]} position={[0, palm ? 2.7 : 1.3, 0]}>
      <mesh position={[0, 0.04, palm ? 0.5 : 0.24]} rotation={[palm ? 0.5 : -0.4, 0, 0]} scale={[palm ? 0.2 : 0.15, palm ? 0.08 : 0.4, palm ? 1.1 : 0.45]} castShadow>
        <sphereGeometry args={[1, 7, 5]} />
        <meshStandardMaterial color={i % 2 ? '#4d7746' : '#315838'} roughness={0.8} />
      </mesh>
      {palm && <mesh position={[0, -0.3, 1.1]} rotation={[0.95, 0, 0]} scale={[0.15, 0.06, 0.55]}>
        <sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color={'#3c643b'} />
      </mesh>}
    </group>)}
  </group>;
}

function Chair({ position, rotation = [0, 0, 0] }) {
  return <group position={position} rotation={rotation}>
    <Box position={[0, 0.74, 0]} scale={[0.75, 0.16, 0.7]} color={'#202a31'} roughness={0.8} />
    <Box position={[0, 1.28, 0.3]} scale={[0.75, 1.03, 0.13]} color={'#24333b'} roughness={0.8} rotation={[-0.1, 0, 0]} />
    <Box position={[0, 0.38, 0]} scale={[0.09, 0.55, 0.09]} color={'#8d9aa4'} metalness={0.8} />
    <Box position={[0, 0.11, 0]} scale={[0.9, 0.06, 0.1]} color={'#62717a'} metalness={0.6} />
    <Box position={[0, 0.11, 0]} scale={[0.1, 0.06, 0.8]} color={'#62717a'} metalness={0.6} />
    {[-0.42, 0.42].map(x => <Box key={x} position={[x, 1.06, -0.08]} scale={[0.06, 0.07, 0.45]} color={'#59656d'} />)}
  </group>;
}

function Worker({ active, connected, reducedMotion, color = '#52768c' }) {
  const armL = useRef(); const armR = useRef(); const head = useRef();
  useFrame(({ clock }) => {
    const working = Boolean(active && connected && !reducedMotion);
    const t = clock.getElapsedTime();
    if (armL.current) armL.current.rotation.x = working ? -0.95 + Math.sin(t * 8) * 0.09 : -0.6;
    if (armR.current) armR.current.rotation.x = working ? -0.95 + Math.sin(t * 8 + 2) * 0.09 : -0.6;
    if (head.current) head.current.rotation.x = working ? -0.08 + Math.sin(t * 1.7) * 0.035 : 0;
  });
  return <group position={[0, 0, 2.1]} rotation={[0, Math.PI, 0]}>
    <mesh position={[0, 1.24, 0]} castShadow scale={[0.32, 0.49, 0.22]}>
      <sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
    <group ref={head} position={[0, 1.94, 0]}>
      <mesh castShadow scale={[0.2, 0.25, 0.21]}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={'#bc9076'} roughness={0.8} /></mesh>
      <mesh position={[0, 0.11, -0.025]} scale={[0.205, 0.16, 0.205]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={'#2d2727'} roughness={0.9} /></mesh>
    </group>
    {[-1, 1].map(side => <group key={side} position={[side * 0.34, 1.53, 0.02]} rotation={[-0.6, 0, side * 0.08]} ref={side === -1 ? armL : armR}>
      <mesh position={[0, -0.23, 0]} castShadow><capsuleGeometry args={[0.095, 0.32, 4, 8]} /><meshStandardMaterial color={color} /></mesh>
      <group position={[0, -0.43, 0]} rotation={[-0.8, 0, 0]}>
        <mesh position={[0, -0.17, 0]}><capsuleGeometry args={[0.075, 0.24, 4, 8]} /><meshStandardMaterial color={'#bc9076'} /></mesh>
        <mesh position={[0, -0.34, 0]} scale={[0.075, 0.11, 0.045]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={'#bc9076'} /></mesh>
      </group>
    </group>)}
    {[-0.16, 0.16].map(x => <group key={x}>
      <Box position={[x, 0.78, 0.22]} scale={[0.23, 0.22, 0.62]} color={'#27323f'} rotation={[0.08, 0, 0]} />
      <Box position={[x, 0.42, 0.49]} scale={[0.21, 0.6, 0.22]} color={'#27323f'} />
      <Box position={[x, 0.12, 0.59]} scale={[0.23, 0.14, 0.4]} color={'#121a22'} />
    </group>)}
  </group>;
}

function stateColor(worker) {
  if (worker.active) return '#6be4c5';
  if (/fail|block/.test(worker.state)) return '#f48a86';
  if (/review|approval|testing/.test(worker.state)) return '#f5c476';
  if (/complete|pass/.test(worker.state)) return '#6be4c5';
  return '#7c91a0';
}

function Monitor({ worker, position = [0, 1.57, 0.55], width = 1.35, height = 0.8 }) {
  const texture = useTexture((ctx) => {
    ctx.fillStyle = '#0b1925'; ctx.fillRect(0, 0, 1024, 384);
    ctx.fillStyle = '#172d3d'; ctx.fillRect(0, 0, 1024, 48);
    ['#e38687', '#dfc688', '#7db5a5'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(30 + i * 30, 24, 7, 0, Math.PI * 2); ctx.fill(); });
    ctx.font = '500 23px monospace'; ctx.fillStyle = '#829aab'; ctx.fillText('AmericanSites / task workspace', 170, 32);
    ctx.font = '700 54px Arial'; ctx.fillStyle = '#e8f1f7'; ctx.fillText((worker.name || worker.id).slice(0, 20), 50, 127);
    ctx.font = '500 36px monospace'; ctx.fillStyle = stateColor(worker); ctx.fillText((worker.state || 'idle').replaceAll('_', ' ').toUpperCase(), 50, 192);
    ctx.fillStyle = '#7e9aab'; ctx.font = '26px Arial';
    const title = worker.taskTitle || 'No active task assigned';
    ctx.fillText(title.slice(0, 56), 50, 252);
    ctx.fillStyle = '#213e52'; ctx.fillRect(50, 290, 920, 1);
    ctx.fillStyle = '#527487'; ctx.font = '23px monospace'; ctx.fillText('EVIDENCE → REVIEW → OWNER APPROVAL', 50, 336);
  }, [worker.name, worker.id, worker.state, worker.active, worker.taskTitle]);
  return <group position={position}>
    <Box position={[0, 0, 0]} scale={[width + 0.07, height + 0.07, 0.06]} color={'#1f303d'} metalness={0.6} />
    <mesh position={[0, 0, 0.035]}><planeGeometry args={[width, height]} /><meshStandardMaterial map={texture} emissiveMap={texture} emissive={'#ffffff'} emissiveIntensity={0.75} roughness={0.4} /></mesh>
    <Box position={[0, -height * 0.65, -0.015]} scale={[0.06, 0.28, 0.07]} color={'#6c7a82'} metalness={0.7} />
    <Box position={[0, -height * 0.81, 0.05]} scale={[0.4, 0.035, 0.26]} color={'#52636e'} metalness={0.7} />
  </group>;
}

function Desk({ id, worker, selected, onSelect, connected, reducedMotion }) {
  const room = ROOMS[id]; const [hovered, setHovered] = useState(false);
  return <group position={[room.x, room.y, room.z]} onClick={e => { e.stopPropagation(); onSelect?.(id); }}
    onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}>
    <mesh position={[0, 0.02, 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[5.4, 4.9]} /><meshStandardMaterial color={selected ? '#274655' : '#37403f'} roughness={0.9} />
    </mesh>
    <Box position={[0, 1.07, 0.9]} scale={[4.8, 0.12, 1.55]} color={'#a88c68'} roughness={0.6} />
    <Box position={[0, 1.01, 0.94]} scale={[4.65, 0.08, 1.4]} color={'#222c31'} />
    {[-2.1, 2.1].map(x => <Box key={x} position={[x, 0.55, 0.9]} scale={[0.12, 1.05, 1.2]} color={'#242f36'} metalness={0.5} />)}
    <Box position={[-1.65, 0.48, 0.5]} scale={[0.65, 0.93, 0.9]} color={'#4c5558'} />
    {[0.3, 0.6, 0.9].map(y => <Box key={y} position={[-1.65, y, 0.96]} scale={[0.24, 0.025, 0.04]} color={'#a6a6a0'} metalness={0.8} />)}
    <Monitor worker={worker} />
    <Monitor worker={worker} position={[-1.3, 1.57, 0.65]} width={0.95} height={0.72} />
    <Box position={[0, 1.155, 1.45]} scale={[0.8, 0.035, 0.3]} color={'#384a55'} />
    {[0, 1, 2, 3].map(i => <Box key={i} position={[0, 1.177, 1.35 + i * 0.05]} scale={[0.7, 0.005, 0.012]} color={'#8d9ca5'} />)}
    <Box position={[0.65, 1.17, 1.45]} scale={[0.12, 0.065, 0.21]} color={'#263b47'} />
    <mesh position={[1.1, 1.23, 1]}><cylinderGeometry args={[0.09, 0.07, 0.2, 12]} /><meshStandardMaterial color={'#e2dbce'} roughness={0.4} /></mesh>
    <Box position={[1.75, 1.16, 0.9]} scale={[0.5, 0.055, 0.38]} color={'#516577'} />
    <Chair position={[0, 0, 2.1]} />
    <Worker active={worker.active} connected={connected} reducedMotion={reducedMotion} color={id === 'designer' ? '#b98c6e' : id === 'bob' ? '#344352' : '#456a80'} />
    <Strip position={[0, 0.1, 3.7]} scale={[selected || hovered ? 5 : 1.7, 0.025, 0.04]} color={selected || hovered ? room.color : stateColor(worker)} intensity={selected || hovered ? 3 : 1.5} />
    <Sign text={room.name} sub={room.subtitle} position={[0, 3.19, 4.18]} width={4.2} height={1.2} color={room.color} />
    <Plant position={[2.8, 0, 1.8]} size={0.85} />
  </group>;
}

function CeilingLight({ position, radius = 0.85 }) {
  return <group position={position}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius, 0.025, 7, 48]} /><meshStandardMaterial color={'#fee0ac'} emissive={'#ffe0a3'} emissiveIntensity={3} /></mesh>
    <Box position={[0, 0.3, 0]} scale={[0.02, 0.6, 0.02]} color={'#7e827e'} />
  </group>;
}

function Sofa({ position, rotation = [0, 0, 0] }) {
  return <group position={position} rotation={rotation}>
    <Box position={[0, 0.4, 0]} scale={[3.1, 0.42, 0.95]} color={'#c3b9a9'} roughness={0.9} />
    <Box position={[0, 0.92, -0.35]} scale={[3.1, 0.7, 0.24]} color={'#c3b9a9'} roughness={0.9} />
    {[-1.43, 1.43].map(x => <Box key={x} position={[x, 0.75, 0]} scale={[0.25, 0.55, 1]} color={'#c3b9a9'} roughness={0.9} />)}
    {[-0.93, 0, 0.93].map(x => <Box key={x} position={[x, 0.65, 0]} scale={[0.84, 0.13, 0.75]} color={'#d4cbbd'} roughness={0.95} />)}
  </group>;
}

function Architecture({ workers, onSelect, selectedRole, connected, reducedMotion }) {
  return <group>
    <Box position={[0, 0, 0]} scale={[25.5, 0.5, 10]} color={'#8a8f89'} roughness={0.65} />
    <Box position={[0, 6, -4.4]} scale={[25, 12, 0.35]} color={'#2e3437'} roughness={0.8} />
    <Box position={[-12.5, 6.1, 0]} scale={[0.3, 12.4, 9]} color={'#303a3e'} />
    <Box position={[12.5, 6.1, 0]} scale={[0.3, 12.4, 9]} color={'#303a3e'} />
    {[0, 4, 8, 12.05].map((y, i) => <group key={y}>
      {y > 0 && <Box position={[0, y, 0]} scale={[25.6, 0.25, 9.7]} color={i === 3 ? '#24343d' : '#a5a59a'} roughness={0.5} />}
      <Box position={[0, y + 0.11, 4.67]} scale={[25.6, 0.18, 0.25]} color={'#b9b4a5'} metalness={0.3} />
      <Strip position={[0, y - 0.05, 4.85]} scale={[25.5, 0.035, 0.04]} />
      {y < 12 && <>
        <Box position={[0, y + 3.8, 0]} scale={[25, 0.1, 8.8]} color={'#514e47'} roughness={0.8} />
        {[-9, -3, 3, 9].map(x => <Strip key={x} position={[x, y + 3.72, 0]} scale={[3.5, 0.025, 0.035]} intensity={2} />)}
      </>}
    </group>)}
    {[-12.25, -4.4, 3.9, 12.25].map(x => <group key={x}>
      <Box position={[x, 6.1, 4.45]} scale={[0.14, 12, 0.16]} color={'#303d43'} metalness={0.7} />
      <Strip position={[x + 0.085, 5.9, 4.52]} scale={[0.025, 3.35, 0.025]} color={COLORS.blue} intensity={3.2} />
    </group>)}
    {[0, 4, 8].map(y => <group key={y}>
      <Glass position={[0, y + 1.98, 4.58]} scale={[24.8, 3.5, 0.035]} opacity={0.028} />
      <Glass position={[12.35, y + 1.95, 0]} scale={[0.025, 3.6, 8.8]} opacity={0.1} />
      <Glass position={[-12.35, y + 1.95, 0]} scale={[0.025, 3.6, 8.8]} opacity={0.1} />
      <Box position={[0, y + 0.7, 4.63]} scale={[25, 0.04, 0.06]} color={'#788e97'} metalness={0.9} />
      <Box position={[0, y + 3.6, 4.63]} scale={[25, 0.045, 0.06]} color={'#788e97'} metalness={0.9} />
    </group>)}
    {/* Room dividers leave a central circulation spine and preserve clear sightlines. */}
    {[-4.1, 3.9].map(x => <Glass key={x} position={[x, 2.1, 0]} scale={[0.08, 3.65, 8.6]} opacity={0.08} />)}
    <Glass position={[-1.3, 6.1, 0]} scale={[0.06, 3.65, 8.6]} opacity={0.08} />
    <Glass position={[0.2, 10.1, 0]} scale={[0.06, 3.65, 8.6]} opacity={0.08} />
    {/* Oak battens, architectural wall panels, and a real stair route between floors. */}
    {Array.from({ length: 29 }, (_, i) => <Box key={i} position={[-11.8 + i * 0.85, 6.3, -4.16]} scale={[0.055, 11.3, 0.12]} color={'#856c4d'} roughness={0.7} />)}
    {Array.from({ length: 14 }, (_, i) => <group key={i}>
      <Box position={[i * 0.19 - 1.25, i * 0.28 + 0.28, -2]} scale={[1.8, 0.12, 0.55]} color={'#9a9789'} metalness={0.1} />
      <Strip position={[i * 0.19 - 1.25, i * 0.28 + 0.33, -1.71]} scale={[1.65, 0.015, 0.015]} intensity={1.8} />
    </group>)}
    <Box position={[0, 13.0, 0.1]} scale={[25.7, 1.7, 9.8]} color={'#142633'} roughness={0.4} metalness={0.25} />
    <Sign brand text="AmericanSites" position={[0, 13.03, 5.02]} width={16.6} height={3.05} />
    <Strip position={[0, 12.15, 5.04]} scale={[25.7, 0.035, 0.04]} intensity={3.6} />
    {/* Reception, lounge, and strategy room. */}
    <Box position={[0, 1, 2]} scale={[4.1, 1.55, 1.15]} color={'#b7ac95'} roughness={0.4} />
    <Box position={[0, 1.8, 2]} scale={[4.35, 0.13, 1.35]} color={'#232f36'} roughness={0.25} />
    <Strip position={[0, 0.31, 2.59]} scale={[4.1, 0.035, 0.035]} />
    <Sign brand text="AmericanSites" position={[0, 2.7, -0.9]} width={4.8} height={1.6} />
    <CeilingLight position={[0, 3.25, 2]} radius={1.25} />
    <Sofa position={[-8.5, 8.25, 2.3]} />
    <Sofa position={[-8.5, 8.25, -0.3]} rotation={[0, Math.PI, 0]} />
    <Box position={[-8.5, 8.8, 1.05]} scale={[2.9, 0.1, 1.1]} color={'#7d6951'} roughness={0.4} />
    <Box position={[-8.5, 8.55, 1.05]} scale={[1.3, 0.5, 0.7]} color={'#252f35'} />
    <Sign text="STRATEGY" sub="PLAN / BUILD / VERIFY" position={[-7.3, 11.4, -4.02]} width={6.8} height={1.45} color={'#b2ddf5'} />
    <CeilingLight position={[-8.5, 11.55, 1]} radius={1.5} />
    <CeilingLight position={[5.4, 11.55, 1]} radius={1.2} />
    <Plant position={[-11.4, 8.25, 2]} size={1.3} palm />
    <Plant position={[-2.8, 0.25, 3.5]} size={1.1} />
    <Plant position={[2.8, 0.25, 3.5]} size={1.1} />
    {Object.keys(ROOMS).map(id => <Desk key={id} id={id} worker={workers.find(w => w.id === id) || { id, name: id, state: 'idle', active: false }} selected={selectedRole === id} onSelect={onSelect} connected={connected} reducedMotion={reducedMotion} />)}
  </group>;
}

function CarBody({ vertices, color, metalness = 0.6 }) {
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [3, 2, 6, 7], [0, 3, 7, 4], [1, 5, 6, 2]];
    for (const f of faces) for (const i of [f[0], f[1], f[2], f[0], f[2], f[3]]) positions.push(...vertices[i]);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals(); return geometry;
  }, [vertices]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} metalness={metalness} roughness={0.24} side={THREE.DoubleSide} /></mesh>;
}
const BODY = [[-1.27,.38,2.5],[1.27,.38,2.5],[1.32,.42,-2.5],[-1.32,.42,-2.5],[-1.15,.74,2.7],[1.15,.74,2.7],[1.27,1.01,-2.4],[-1.27,1.01,-2.4]];
const CABIN = [[-.92,.91,.9],[.92,.91,.9],[.98,.99,-1.7],[-.98,.99,-1.7],[-.72,1.5,-.05],[.72,1.5,-.05],[.75,1.45,-1.2],[-.75,1.45,-1.2]];
function Supercar() {
  return <group position={[-10.8, 0.12, 10.5]} rotation={[0, -0.6, 0]} scale={1.2}>
    <CarBody vertices={BODY} color={'#e0e5e7'} />
    <CarBody vertices={CABIN} color={'#0c2330'} metalness={0.8} />
    <Box position={[0, 1.5, -0.65]} scale={[1.55, 0.055, 1.18]} color={'#e2e8eb'} roughness={0.18} metalness={0.7} />
    <Box position={[0, 0.34, 2.45]} scale={[2.4, 0.1, 0.3]} color={'#13212a'} metalness={0.6} />
    <Box position={[0, 0.55, 2.62]} scale={[1.1, 0.25, 0.04]} color={'#13212a'} />
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * .88, .65, 2.63]} scale={[.57,.19,.07]} color={'#142631'} rotation={[0,0,side*.16]} />
      <Strip position={[side * .9, .76, 2.66]} scale={[.48,.035,.04]} color={'#9adbff'} intensity={4} />
      <Box position={[side * 1.26, .43, 0]} scale={[.09,.09,3.75]} color={'#1d313a'} metalness={.5} />
      <Box position={[side * 1.25, .85, -.7]} scale={[.035,.33,.62]} color={'#18303a'} rotation={[.18,0,0]} />
      <Box position={[side * 1.28, 1.09, .45]} scale={[.3,.1,.18]} color={'#dfe5e8'} />
      {[-1.65, 1.65].map(z => <group key={z} position={[side * 1.25,.49,z]} rotation={[0,0,Math.PI/2]}>
        <mesh castShadow><cylinderGeometry args={[.49,.49,.28,24]} /><meshStandardMaterial color={'#11181e'} roughness={.9} /></mesh>
        <mesh position={[0,-side*.16,0]}><cylinderGeometry args={[.34,.34,.02,20]} /><meshStandardMaterial color={'#354954'} metalness={.95} roughness={.25} /></mesh>
        {Array.from({length:5},(_,i) => <Box key={i} position={[0,-side*.18,0]} scale={[.045,.025,.63]} rotation={[0,i*Math.PI/5,0]} color={'#c5d1d7'} metalness={.9} roughness={.2} />)}
        <mesh position={[0,-side*.2,0]}><cylinderGeometry args={[.09,.09,.03,12]} /><meshStandardMaterial color={'#c8b57c'} metalness={.8} /></mesh>
      </group>)}
    </group>)}
    <Box position={[0, 1.06, -2.26]} scale={[2.44, .06, .3]} color={'#192a32'} metalness={.7} />
    <Strip position={[0,.81,-2.47]} scale={[2.1,.04,.025]} color={'#ff5268'} intensity={1.5} />
  </group>;
}

function Exterior() {
  return <group>
    <Box position={[0, -0.51, 0]} scale={[160, 0.5, 140]} color={'#121e2a'} roughness={0.33} metalness={0.2} />
    <Box position={[0, -0.2, 7]} scale={[38, 0.15, 25]} color={'#596168'} roughness={0.32} metalness={0.25} />
    {Array.from({ length: 12 }, (_, i) => <Box key={i} position={[0, -0.11, 4.9 + i * 1.35]} scale={[37.8, .015, .018]} color={'#293943'} />)}
    {[-15,-10,-5,0,5,10,15].map(x => <Box key={x} position={[x, -.105, 9]} scale={[.016,.018,19.5]} color={'#2d3d46'} />)}
    <Box position={[0, 0, 8.4]} scale={[5.5, 0.18, 7.5]} color={'#b1b1a7'} roughness={.5} />
    <Box position={[0, .1, 5.7]} scale={[7.5,.2,1.6]} color={'#b9b6a8'} />
    {[-3.2,3.2].map(x => <Strip key={x} position={[x,.05,9]} scale={[.028,.025,8]} color={'#edc68f'} intensity={2} />)}
    {[-14.8,14.8].map(x => <group key={x}>
      <Box position={[x,.2,1]} scale={[2.4,.6,13]} color={'#515b5e'} />
      {[-4,-1,2,5].map(z => <Plant key={z} position={[x,.5,z]} size={1.6} palm />)}
    </group>)}
    {[[-7,6.8],[6.7,6.8],[14,10.6],[-16,12.5]].map(([x,z], i) => <group key={i}>
      <Box position={[x,.13,z]} scale={[i < 2 ? 5.1 : 3.2,.4,1.1]} color={'#6c716c'} />
      {[-1,0,1].map(n => <mesh key={n} position={[x+n,.55,z]} scale={[.7,.45,.42]} castShadow><sphereGeometry args={[1,10,7]} /><meshStandardMaterial color={'#456145'} roughness={.9} /></mesh>)}
    </group>)}
    {[-3.6,3.6,11.7,-15.8].map((x,i) => <group key={x} position={[x,0,i<2 ? 11.8 : 7.5]}>
      <Box position={[0,.48,0]} scale={[.12,.94,.12]} color={'#384751'} metalness={.7} />
      <Strip position={[0,.83,0]} scale={[.16,.16,.16]} intensity={3} />
    </group>)}
    <Supercar />
    <Box position={[10.9,1.2,11.8]} scale={[5.1,2.35,.55]} color={'#38434b'} roughness={.6} />
    <Sign brand text="AmericanSites" position={[10.9,1.5,12.09]} width={4.7} height={1.55} />
    <Strip position={[10.9,.12,12.15]} scale={[5.3,.03,.03]} color={COLORS.blue} />
    {/* Quiet skyline, deliberately decorative rather than business statistics. */}
    {Array.from({ length: 18 }, (_, i) => {
      const h = 5 + (i * 7 % 11); const x = -55 + i * 6;
      return <Box key={i} position={[x,h/2-0.5,-36 - (i%3)*4]} scale={[3.2,h,4]} color={i%2 ? '#17283b' : '#1c2c40'} />;
    })}
  </group>;
}

function CameraRig({ selectedRole, view, reducedMotion }) {
  const { camera, gl } = useThree(); const controls = useRef();
  const desired = useRef(null); const last = useRef('');
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true; orbit.dampingFactor = .065;
    orbit.minDistance = 4; orbit.maxDistance = 65;
    orbit.maxPolarAngle = Math.PI * .48; orbit.minPolarAngle = .18;
    orbit.target.set(0,6,1.5); orbit.update();
    const cancel = () => { desired.current = null; };
    orbit.addEventListener('start', cancel); controls.current = orbit;
    return () => { orbit.removeEventListener('start', cancel); orbit.dispose(); };
  }, [camera,gl]);
  useEffect(() => {
    const key = `${view}:${selectedRole || ''}`;
    if (last.current === key) return; last.current = key;
    const room = ROOMS[selectedRole];
    const setting = view === 'desk' && room
      ? { position: [room.x+3.6,room.y+3.4,9.4], target: [room.x,room.y+1.45,1.3] }
      : view === 'campus'
        ? { position: [30,24,36], target: [0,5,2] }
        : view === 'front'
          ? { position: [0,8,37], target: [0,6.4,1] }
          : { position: [24,18,31], target: [0,6.1,2.1] };
    desired.current = {position:new THREE.Vector3(...setting.position),target:new THREE.Vector3(...setting.target)};
    if (reducedMotion) { camera.position.copy(desired.current.position); controls.current?.target.copy(desired.current.target); controls.current?.update(); desired.current=null; }
  }, [selectedRole, view, reducedMotion, camera]);
  useFrame((_,dt) => {
    if (controls.current && desired.current) {
      const k = 1-Math.exp(-dt*3.4);
      camera.position.lerp(desired.current.position,k); controls.current.target.lerp(desired.current.target,k);
      if (camera.position.distanceTo(desired.current.position)<.01) desired.current=null;
    }
    controls.current?.update();
  });
  return null;
}

export default function OfficeScene({ workers = [], onSelect, selectedRole, view = 'exterior', reducedMotion = false, connected = true }) {
  return <Canvas shadows dpr={[1,1.5]} camera={{ position:[24,18,31],fov:42,near:.1,far:220 }} gl={{ antialias:true,powerPreference:'high-performance',alpha:false }}
    style={{width:'100%',height:'100%',minHeight:340,touchAction:'none'}} onCreated={({gl}) => { gl.toneMapping=THREE.ACESFilmicToneMapping; gl.toneMappingExposure=1.23; }}>
    <color attach="background" args={['#111e30']} />
    <fog attach="fog" args={['#172438',60,145]} />
    <hemisphereLight args={['#a6c8ee','#4b4032',1.5]} />
    <ambientLight intensity={.35} />
    <directionalLight position={[-18,28,15]} color={'#bfd5ff'} intensity={2.8} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={30} shadow-camera-bottom={-24} shadow-bias={-.0004} />
    <directionalLight position={[20,10,-20]} color={'#7e8ad5'} intensity={1.3} />
    <pointLight position={[-6,3,1]} intensity={45} distance={19} color={'#ffd299'} decay={2} />
    <pointLight position={[6,7,1]} intensity={45} distance={19} color={'#ffd299'} decay={2} />
    <pointLight position={[0,11,1]} intensity={55} distance={21} color={'#ffd8a7'} decay={2} />
    <pointLight position={[0,2,7]} intensity={28} distance={15} color={'#ffd8ad'} decay={2} />
    <Exterior />
    <Architecture workers={workers} onSelect={onSelect} selectedRole={selectedRole} connected={connected} reducedMotion={reducedMotion} />
    <CameraRig selectedRole={selectedRole} view={view} reducedMotion={reducedMotion} />
  </Canvas>;
}
