import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Environment, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { PayoffPoint } from '@/lib/types';
import { Leg } from '@/lib/types';

interface PayoffChart3DProps {
  data: PayoffPoint[];
  breakevens: number[];
  currentSpotPrice?: number | null;
  legs?: Leg[];
  daysToExpiry?: number;
}

// Smooth color gradient: deep blue → cyan → green → yellow → red
function profitToColor(profit: number, maxAbs: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, profit / maxAbs)); // -1 to 1
  
  if (t > 0.5) {
    // Strong profit: bright green → gold
    const s = (t - 0.5) * 2;
    return [0.2 + s * 0.6, 0.85 - s * 0.15, 0.15 - s * 0.1];
  } else if (t > 0) {
    // Mild profit: teal → green
    const s = t * 2;
    return [0.05, 0.45 + s * 0.4, 0.55 - s * 0.4];
  } else if (t > -0.5) {
    // Mild loss: blue → purple
    const s = Math.abs(t) * 2;
    return [0.15 + s * 0.3, 0.15 + s * 0.05, 0.5 + s * 0.2];
  } else {
    // Strong loss: purple → deep red
    const s = (Math.abs(t) - 0.5) * 2;
    return [0.45 + s * 0.4, 0.1 - s * 0.05, 0.6 - s * 0.45];
  }
}

function generateSurfaceData(data: PayoffPoint[]) {
  const timeSteps = 30;
  const priceSteps = data.length;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];

  const minPrice = data[0]?.price ?? 0;
  const maxPrice = data[data.length - 1]?.price ?? 100;
  const priceRange = maxPrice - minPrice || 1;

  let maxAbs = 1;
  for (const p of data) {
    const abs = Math.max(Math.abs(p.profitAtExpiry), Math.abs(p.profitToday));
    if (abs > maxAbs) maxAbs = abs;
  }

  const yScale = 3.5 / maxAbs;
  const xScale = 10 / priceRange;
  const zScale = 7 / timeSteps;

  for (let ti = 0; ti <= timeSteps; ti++) {
    const tFrac = ti / timeSteps;
    for (let pi = 0; pi < priceSteps; pi++) {
      const p = data[pi];
      // Smooth cubic interpolation for more natural curve evolution
      const smoothT = tFrac * tFrac * (3 - 2 * tFrac);
      const profit = p.profitToday + (p.profitAtExpiry - p.profitToday) * smoothT;

      const x = (p.price - minPrice) * xScale - 5;
      const y = profit * yScale;
      const z = tFrac * timeSteps * zScale - 3.5;

      positions.push(x, y, z);
      uvs.push(pi / (priceSteps - 1), tFrac);

      const [r, g, b] = profitToColor(profit, maxAbs);
      colors.push(r, g, b);
    }
  }

  const indices: number[] = [];
  for (let ti = 0; ti < timeSteps; ti++) {
    for (let pi = 0; pi < priceSteps - 1; pi++) {
      const a = ti * priceSteps + pi;
      const b = a + 1;
      const c = (ti + 1) * priceSteps + pi;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  return { positions, colors, indices, uvs, priceSteps, timeSteps };
}

function GlassSurface({ data }: { data: PayoffPoint[] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const { positions, colors, indices, uvs } = generateSurfaceData(data);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [data]);

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.92}
        roughness={0.15}
        metalness={0.1}
        clearcoat={0.8}
        clearcoatRoughness={0.1}
        reflectivity={0.6}
        envMapIntensity={0.8}
      />
    </mesh>
  );
}

function GlowEdges({ data }: { data: PayoffPoint[] }) {
  const geometry = useMemo(() => {
    const { positions, indices } = generateSurfaceData(data);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    return geom;
  }, [data]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial wireframe color="#00e5ff" opacity={0.08} transparent />
    </mesh>
  );
}

// Zero plane with glass effect
function ZeroPlane() {
  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 9]} />
      <meshPhysicalMaterial
        color="#4488ff"
        transparent
        opacity={0.04}
        roughness={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Glowing grid lines on the floor
function FloorGrid() {
  const gridRef = useRef<THREE.Group>(null);
  
  const lines = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color: '#2244aa', transparent: true, opacity: 0.15 });
    const geometries: THREE.BufferGeometry[] = [];
    
    // X lines
    for (let i = -5; i <= 5; i += 1) {
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, -3.5, -4),
        new THREE.Vector3(i, -3.5, 4),
      ]);
      geometries.push(geom);
    }
    // Z lines
    for (let i = -4; i <= 4; i += 1) {
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-5, -3.5, i),
        new THREE.Vector3(5, -3.5, i),
      ]);
      geometries.push(geom);
    }
    
    return geometries.map((g, idx) => ({ geometry: g, material, key: idx }));
  }, []);

  return (
    <group ref={gridRef}>
      {lines.map(({ geometry, material, key }) => (
        <lineSegments key={key} geometry={geometry} material={material} />
      ))}
    </group>
  );
}

// Breakeven markers as glowing pillars
function BreakevenMarkers({ breakevens, data }: { breakevens: number[]; data: PayoffPoint[] }) {
  const minPrice = data[0]?.price ?? 0;
  const maxPrice = data[data.length - 1]?.price ?? 100;
  const priceRange = maxPrice - minPrice || 1;
  const xScale = 10 / priceRange;

  return (
    <>
      {breakevens.map((be, i) => {
        const x = (be - minPrice) * xScale - 5;
        if (x < -5.5 || x > 5.5) return null;
        return (
          <group key={i} position={[x, 0, -3.5]}>
            <mesh>
              <cylinderGeometry args={[0.02, 0.02, 7, 8]} />
              <meshBasicMaterial color="#ffaa00" transparent opacity={0.5} />
            </mesh>
            <Text
              position={[0, 3.8, 0]}
              fontSize={0.22}
              color="#ffcc44"
              anchorX="center"
              anchorY="bottom"
            >
              BE {be.toFixed(0)}
            </Text>
          </group>
        );
      })}
    </>
  );
}

function AxisLabels({ data }: { data: PayoffPoint[] }) {
  const minPrice = data[0]?.price ?? 0;
  const maxPrice = data[data.length - 1]?.price ?? 100;
  
  return (
    <>
      <Text position={[0, -4.2, -4.5]} fontSize={0.28} color="#6699cc" anchorX="center" font={undefined}>
        Preço do Ativo ({minPrice.toFixed(0)} → {maxPrice.toFixed(0)})
      </Text>
      <Text position={[-6, 0, 0]} fontSize={0.28} color="#6699cc" rotation={[0, Math.PI / 2, 0]} anchorX="center" font={undefined}>
        Lucro / Prejuízo (R$)
      </Text>
      <Text position={[5.5, -4.2, 0]} fontSize={0.24} color="#6699cc" rotation={[0, -Math.PI / 5, 0]} anchorX="center" font={undefined}>
        T+0 → Vencimento
      </Text>
    </>
  );
}

function AnimatedScene({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Gentle float
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

// Ambient particles for depth
function Particles() {
  const count = 60;
  const meshRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#4488ff" transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

export default function PayoffChart3D({ data, breakevens, currentSpotPrice }: PayoffChart3DProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center text-muted-foreground">
        Sem dados para exibir em 3D
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden border border-primary/20 bg-[#070b14] relative">
      {/* Corner accent glow */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <Canvas
        camera={{ position: [8, 6, 10], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        shadows
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight 
          position={[8, 12, 6]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
          color="#ddeeff"
        />
        <directionalLight position={[-6, 8, -4]} intensity={0.4} color="#aaccff" />
        <pointLight position={[0, 5, 0]} intensity={0.3} color="#00aaff" distance={15} />
        
        {/* Environment for reflections */}
        <Environment preset="night" />
        <fog attach="fog" args={['#070b14', 12, 28]} />

        <AnimatedScene>
          <GlassSurface data={data} />
          <GlowEdges data={data} />
          <ZeroPlane />
          <FloorGrid />
          <BreakevenMarkers breakevens={breakevens} data={data} />
          <AxisLabels data={data} />
          <Particles />
          
          <ContactShadows
            position={[0, -3.5, 0]}
            opacity={0.3}
            scale={14}
            blur={2.5}
            far={5}
            color="#001133"
          />
        </AnimatedScene>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate
          autoRotateSpeed={0.4}
          maxPolarAngle={Math.PI / 1.6}
          minPolarAngle={Math.PI / 8}
          maxDistance={20}
          minDistance={5}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>
      
      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 flex gap-3 text-xs font-medium pointer-events-none">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          <span className="text-emerald-300/80">Lucro</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
          <span className="text-red-300/80">Prejuízo</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
          <span className="text-amber-300/80">Breakeven</span>
        </span>
      </div>
      
      {/* Interaction hint */}
      <div className="absolute top-3 right-3 text-xs text-muted-foreground/50 pointer-events-none">
        🖱️ Arraste para girar · Scroll para zoom
      </div>
    </div>
  );
}
