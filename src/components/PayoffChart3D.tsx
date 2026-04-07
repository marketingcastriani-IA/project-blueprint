import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Environment, ContactShadows } from '@react-three/drei';
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

/* ─── Color mapping ─── */
function profitToColor(profit: number, maxAbs: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, profit / (maxAbs || 1)));
  if (t > 0.3) return [0.15 + t * 0.3, 0.75 + t * 0.2, 0.3];
  if (t > 0)    return [0.1, 0.5 + t * 0.8, 0.5 + t * 0.3];
  if (t > -0.3) return [0.3 + Math.abs(t) * 0.5, 0.15, 0.4 + Math.abs(t) * 0.3];
  return [0.6 + Math.abs(t) * 0.35, 0.08, 0.15];
}

/* ─── Surface geometry builder ─── */
function buildSurface(data: PayoffPoint[]) {
  const timeSteps = 25;
  const priceSteps = data.length;
  if (priceSteps === 0) return null;

  const positions: number[] = [];
  const colors: number[] = [];

  const minP = data[0].price;
  const maxP = data[priceSteps - 1].price;
  const range = maxP - minP || 1;

  let maxAbs = 1;
  for (const d of data) {
    const a = Math.max(Math.abs(d.profitAtExpiry), Math.abs(d.profitToday));
    if (a > maxAbs) maxAbs = a;
  }

  const yS = 3 / maxAbs;
  const xS = 8 / range;
  const zS = 6 / timeSteps;

  for (let ti = 0; ti <= timeSteps; ti++) {
    const tFrac = ti / timeSteps;
    const smooth = tFrac * tFrac * (3 - 2 * tFrac);
    for (let pi = 0; pi < priceSteps; pi++) {
      const d = data[pi];
      const profit = d.profitToday + (d.profitAtExpiry - d.profitToday) * smooth;
      positions.push((d.price - minP) * xS - 4, profit * yS, tFrac * timeSteps * zS - 3);
      const [r, g, b] = profitToColor(profit, maxAbs);
      colors.push(r, g, b);
    }
  }

  const indices: number[] = [];
  for (let ti = 0; ti < timeSteps; ti++) {
    for (let pi = 0; pi < priceSteps - 1; pi++) {
      const a = ti * priceSteps + pi;
      const c = (ti + 1) * priceSteps + pi;
      indices.push(a, a + 1, c);
      indices.push(a + 1, c + 1, c);
    }
  }

  return { positions, colors, indices, minP, maxP, maxAbs, yS, xS };
}

/* ─── Surface mesh ─── */
function Surface({ data }: { data: PayoffPoint[] }) {
  const geom = useMemo(() => {
    const s = buildSurface(data);
    if (!s) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(s.colors, 3));
    g.setIndex(s.indices);
    g.computeVertexNormals();
    return g;
  }, [data]);

  if (!geom) return null;

  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshPhysicalMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.9}
        roughness={0.2}
        metalness={0.05}
        clearcoat={0.6}
        clearcoatRoughness={0.15}
        envMapIntensity={0.6}
      />
    </mesh>
  );
}

/* ─── Wireframe overlay ─── */
function Wireframe({ data }: { data: PayoffPoint[] }) {
  const geom = useMemo(() => {
    const s = buildSurface(data);
    if (!s) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.positions, 3));
    g.setIndex(s.indices);
    return g;
  }, [data]);

  if (!geom) return null;

  return (
    <mesh geometry={geom}>
      <meshBasicMaterial wireframe color="#66bbff" opacity={0.06} transparent />
    </mesh>
  );
}

/* ─── Zero plane ─── */
function ZeroPlane() {
  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 8]} />
      <meshBasicMaterial color="#4488ff" transparent opacity={0.04} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ─── Floor grid ─── */
function FloorGrid() {
  const lines = useMemo(() => {
    const pts: [number, number, number, number, number, number][] = [];
    for (let i = -4; i <= 4; i++) {
      pts.push([i, -3, -3.5, i, -3, 3.5]);
      pts.push([-4, -3, i * 3.5 / 4, 4, -3, i * 3.5 / 4]);
    }
    return pts;
  }, []);

  return (
    <group>
      {lines.map(([x1, y1, z1, x2, y2, z2], i) => {
        const geom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x1, y1, z1),
          new THREE.Vector3(x2, y2, z2),
        ]);
        return (
          <lineSegments key={i} geometry={geom}>
            <lineBasicMaterial color="#334477" transparent opacity={0.2} />
          </lineSegments>
        );
      })}
    </group>
  );
}

/* ─── Price tick marks along X axis ─── */
function PriceTicks({ data }: { data: PayoffPoint[] }) {
  if (!data || data.length === 0) return null;
  const minP = data[0].price;
  const maxP = data[data.length - 1].price;
  const range = maxP - minP || 1;
  const xS = 8 / range;

  // Show ~5 ticks
  const step = Math.ceil(range / 5 / 5) * 5;
  const start = Math.ceil(minP / step) * step;
  const ticks: number[] = [];
  for (let p = start; p <= maxP; p += step) ticks.push(p);

  return (
    <>
      {ticks.map((p) => {
        const x = (p - minP) * xS - 4;
        return (
          <group key={p}>
            <Text
              position={[x, -3.3, 3.8]}
              fontSize={0.2}
              color="#88aacc"
              anchorX="center"
              anchorY="top"
            >
              {p.toFixed(0)}
            </Text>
            {/* Small tick line */}
            <mesh position={[x, -3, 3.6]}>
              <boxGeometry args={[0.02, 0.02, 0.3]} />
              <meshBasicMaterial color="#88aacc" transparent opacity={0.3} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/* ─── Profit scale ticks along Y axis ─── */
function ProfitTicks({ data }: { data: PayoffPoint[] }) {
  if (!data || data.length === 0) return null;
  let maxAbs = 1;
  for (const d of data) {
    const a = Math.max(Math.abs(d.profitAtExpiry), Math.abs(d.profitToday));
    if (a > maxAbs) maxAbs = a;
  }
  const yS = 3 / maxAbs;

  const step = Math.ceil(maxAbs / 3 / 100) * 100 || 50;
  const ticks: number[] = [0];
  for (let v = step; v <= maxAbs * 1.1; v += step) {
    ticks.push(v);
    ticks.push(-v);
  }

  return (
    <>
      {ticks.map((v) => {
        const y = v * yS;
        if (Math.abs(y) > 3.5) return null;
        return (
          <group key={v}>
            <Text
              position={[-4.5, y, 3.8]}
              fontSize={0.18}
              color={v > 0 ? '#66cc88' : v < 0 ? '#cc6666' : '#888888'}
              anchorX="right"
              anchorY="middle"
            >
              {v > 0 ? `+${v.toFixed(0)}` : v.toFixed(0)}
            </Text>
          </group>
        );
      })}
    </>
  );
}

/* ─── Axis title labels ─── */
function AxisLabels() {
  return (
    <>
      <Text position={[0, -3.8, 4.5]} fontSize={0.25} color="#88bbdd" anchorX="center">
        Preço do Ativo →
      </Text>
      <Text
        position={[-5.2, 0, 4]}
        fontSize={0.25}
        color="#88bbdd"
        rotation={[0, 0, Math.PI / 2]}
        anchorX="center"
      >
        Lucro / Prejuízo (R$)
      </Text>
      <Text
        position={[4.5, -3.8, 0]}
        fontSize={0.22}
        color="#88bbdd"
        rotation={[0, -Math.PI / 6, 0]}
        anchorX="center"
      >
        Hoje → Vencimento
      </Text>
    </>
  );
}

/* ─── Breakeven markers ─── */
function BreakevenMarkers({ breakevens, data }: { breakevens: number[]; data: PayoffPoint[] }) {
  if (!data || data.length === 0) return null;
  const minP = data[0].price;
  const maxP = data[data.length - 1].price;
  const range = maxP - minP || 1;
  const xS = 8 / range;

  return (
    <>
      {breakevens.map((be, i) => {
        const x = (be - minP) * xS - 4;
        if (x < -5 || x > 5) return null;
        return (
          <group key={i} position={[x, 0, -3]}>
            <mesh>
              <cylinderGeometry args={[0.015, 0.015, 6, 6]} />
              <meshBasicMaterial color="#ffbb33" transparent opacity={0.45} />
            </mesh>
            <Text position={[0, 3.3, 0]} fontSize={0.2} color="#ffcc55" anchorX="center">
              BE {be.toFixed(1)}
            </Text>
          </group>
        );
      })}
    </>
  );
}

/* ─── Spot price vertical line ─── */
function SpotMarker({ spot, data }: { spot: number; data: PayoffPoint[] }) {
  if (!data || data.length === 0) return null;
  const minP = data[0].price;
  const maxP = data[data.length - 1].price;
  const range = maxP - minP || 1;
  const xS = 8 / range;
  const x = (spot - minP) * xS - 4;
  if (x < -5 || x > 5) return null;

  return (
    <group position={[x, 0, -3]}>
      <mesh>
        <cylinderGeometry args={[0.025, 0.025, 6, 8]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={0.5} />
      </mesh>
      <Text position={[0, 3.3, 0]} fontSize={0.2} color="#00eeff" anchorX="center">
        Spot {spot.toFixed(1)}
      </Text>
    </group>
  );
}

/* ─── Gentle animation ─── */
function AnimatedGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.getElapsedTime() * 0.4) * 0.03;
    }
  });
  return <group ref={ref}>{children}</group>;
}

/* ─── Main component ─── */
export default function PayoffChart3D({ data, breakevens, currentSpotPrice }: PayoffChart3DProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center text-muted-foreground">
        Sem dados para exibir em 3D
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden border border-primary/20 relative" style={{ background: '#080e1a' }}>
      <Canvas
        camera={{ position: [7, 5, 9], fov: 48 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        shadows
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[6, 10, 5]} intensity={1} castShadow color="#ddeeff" />
        <directionalLight position={[-5, 6, -3]} intensity={0.35} color="#aaccff" />
        <pointLight position={[0, 4, 0]} intensity={0.25} color="#00aaff" distance={12} />

        <Environment preset="night" />
        <fog attach="fog" args={['#080e1a', 14, 30]} />

        <AnimatedGroup>
          <Surface data={data} />
          <Wireframe data={data} />
          <ZeroPlane />
          <FloorGrid />
          <PriceTicks data={data} />
          <ProfitTicks data={data} />
          <AxisLabels />
          <BreakevenMarkers breakevens={breakevens} data={data} />
          {currentSpotPrice && <SpotMarker spot={currentSpotPrice} data={data} />}
          <ContactShadows position={[0, -3, 0]} opacity={0.25} scale={12} blur={2} far={4} color="#001133" />
        </AnimatedGroup>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate
          autoRotateSpeed={0.35}
          maxPolarAngle={Math.PI / 1.6}
          minPolarAngle={Math.PI / 7}
          maxDistance={18}
          minDistance={5}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3 text-xs font-medium pointer-events-none select-none">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#44cc88', boxShadow: '0 0 6px #44cc8866' }} />
          <span style={{ color: '#88ddaa' }}>Lucro</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#dd5555', boxShadow: '0 0 6px #dd555566' }} />
          <span style={{ color: '#dd8888' }}>Prejuízo</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#ffbb33', boxShadow: '0 0 6px #ffbb3366' }} />
          <span style={{ color: '#ffcc77' }}>Breakeven</span>
        </span>
        {currentSpotPrice && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#00ccff', boxShadow: '0 0 6px #00ccff66' }} />
            <span style={{ color: '#88ddff' }}>Spot</span>
          </span>
        )}
      </div>

      <div className="absolute top-3 right-3 text-xs pointer-events-none select-none" style={{ color: '#556688' }}>
        🖱️ Arraste · Scroll zoom
      </div>
    </div>
  );
}
