import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
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

// Generate surface data: X = price, Z = days to expiry (0..max), Y = payoff
function generateSurfaceData(data: PayoffPoint[], totalDays: number) {
  const timeSteps = 20;
  const priceSteps = data.length;
  const positions: number[] = [];
  const colors: number[] = [];

  const minPrice = data[0]?.price ?? 0;
  const maxPrice = data[data.length - 1]?.price ?? 100;
  const priceRange = maxPrice - minPrice || 1;

  // Normalize payoff range for Y scaling
  let maxAbs = 1;
  for (const p of data) {
    const abs = Math.max(Math.abs(p.profitAtExpiry), Math.abs(p.profitToday));
    if (abs > maxAbs) maxAbs = abs;
  }
  const yScale = 3 / maxAbs; // normalize to ~3 units height
  const xScale = 8 / priceRange;
  const zScale = 6 / Math.max(timeSteps, 1);

  for (let ti = 0; ti <= timeSteps; ti++) {
    const tFrac = ti / timeSteps; // 0 = today, 1 = expiry
    for (let pi = 0; pi < priceSteps; pi++) {
      const p = data[pi];
      // Interpolate between profitToday and profitAtExpiry
      const profit = p.profitToday + (p.profitAtExpiry - p.profitToday) * tFrac;

      const x = (p.price - minPrice) * xScale - 4; // center
      const y = profit * yScale;
      const z = tFrac * timeSteps * zScale - 3; // center

      positions.push(x, y, z);

      // Color: green for profit, red for loss
      if (profit > 0) {
        const intensity = Math.min(profit / maxAbs, 1);
        colors.push(0.1, 0.4 + intensity * 0.5, 0.2 + intensity * 0.3);
      } else {
        const intensity = Math.min(Math.abs(profit) / maxAbs, 1);
        colors.push(0.5 + intensity * 0.4, 0.1, 0.1);
      }
    }
  }

  // Build indices for triangles
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

  return { positions, colors, indices, priceSteps, timeSteps };
}

function Surface({ data }: { data: PayoffPoint[] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const totalDays = 30;

  const geometry = useMemo(() => {
    const { positions, colors, indices } = generateSurfaceData(data, totalDays);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [data]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshPhongMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.85}
        shininess={60}
      />
    </mesh>
  );
}

function WireframeSurface({ data }: { data: PayoffPoint[] }) {
  const geometry = useMemo(() => {
    const { positions, indices } = generateSurfaceData(data, 30);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    return geom;
  }, [data]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial wireframe color="#00b4d8" opacity={0.3} transparent />
    </mesh>
  );
}

function ZeroPlane() {
  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 8]} />
      <meshBasicMaterial color="#888888" transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

function AxisLabels() {
  return (
    <>
      <Text position={[0, -2.5, -4]} fontSize={0.35} color="#888" anchorX="center">
        Preço do Ativo →
      </Text>
      <Text position={[-5, 0, 0]} fontSize={0.35} color="#888" rotation={[0, Math.PI / 2, 0]} anchorX="center">
        Lucro / Prejuízo (R$)
      </Text>
      <Text position={[4.5, -2.5, 0]} fontSize={0.3} color="#888" rotation={[0, -Math.PI / 4, 0]} anchorX="center">
        Hoje → Vencimento
      </Text>
    </>
  );
}

function RotatingScene({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.15) * 0.1;
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

export default function PayoffChart3D({ data, breakevens, currentSpotPrice }: PayoffChart3DProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[450px] flex items-center justify-center text-muted-foreground">
        Sem dados para exibir em 3D
      </div>
    );
  }

  return (
    <div className="h-[450px] w-full rounded-xl overflow-hidden border border-border/50 bg-gradient-to-b from-background to-muted/30">
      <Canvas
        camera={{ position: [6, 5, 8], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />

        <RotatingScene>
          <Surface data={data} />
          <WireframeSurface data={data} />
          <ZeroPlane />
          <AxisLabels />
          <Grid
            args={[10, 10]}
            position={[0, -3, 0]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#444"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#666"
            fadeDistance={20}
            infiniteGrid={false}
          />
        </RotatingScene>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate={false}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 6}
        />
      </Canvas>
    </div>
  );
}
