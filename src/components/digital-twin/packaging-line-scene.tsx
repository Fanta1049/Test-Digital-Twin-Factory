"use client";

import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { MachineStatus } from "@/lib/domain/types";
import {
  PackagingLineSimState,
  SimProductItem,
  SimStationConfig,
  StationRuntimeMetrics,
} from "@/lib/simulation/engine";

const STATUS_HEX: Record<MachineStatus, string> = {
  Running: "#10b981", // Green
  Idle: "#64748b", // Gray
  Warning: "#f59e0b", // Amber
  Error: "#f43f5e", // Red
  Maintenance: "#3b82f6", // Blue
};

const STATION_X_COORDS: Record<number, number> = {
  1: -8, // Station A
  2: -4, // Station B
  3: 0, // Station C
  4: 4, // Station D
  5: 8, // Station E
};

function getProductWorldX(product: SimProductItem): number {
  const targetX = STATION_X_COORDS[product.stationOrder] ?? 0;
  if (product.phase === "in_station") {
    // Slight motion inside the station housing (-0.3 to +0.3)
    return targetX + (product.progress - 0.5) * 0.6;
  }
  if (product.phase === "queued") {
    return targetX - 1.1;
  }
  if (product.phase === "transit") {
    const prevOrder = Math.max(1, product.stationOrder - 1);
    const startX = (STATION_X_COORDS[prevOrder] ?? targetX - 4) + 0.8;
    const endX = targetX - 1.0;
    return startX + (endX - startX) * product.progress;
  }
  if (product.phase === "completed") {
    return 10.2;
  }
  return targetX;
}

function StationMesh({
  station,
  metrics,
  selected,
  onSelect,
}: {
  station: SimStationConfig;
  metrics?: StationRuntimeMetrics;
  selected: boolean;
  onSelect: (stationId: string) => void;
}) {
  const x = STATION_X_COORDS[station.order] ?? 0;
  const statusColor = STATUS_HEX[station.status];

  return (
    <group
      position={[x, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(station.stationId);
      }}
    >
      {/* Yellow Industrial Safety Floor Perimeter Marking */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.7, 3.2]} />
        <meshStandardMaterial
          color={selected ? "#3b82f6" : "#eab308"}
          transparent
          opacity={selected ? 0.35 : 0.18}
        />
      </mesh>

      {/* Selection Ring / Base Platform */}
      <mesh position={[0, 0.15, -0.3]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.3, 2.2]} />
        <meshStandardMaterial
          color={selected ? "#1e3a8a" : "#1e293b"}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* Main Machine Cabinet Housing */}
      <mesh position={[0, 1.35, -0.65]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 2.1, 1.1]} />
        <meshStandardMaterial
          color={selected ? "#334155" : "#475569"}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      {/* Over-Conveyor Processing Bridge Arch */}
      <mesh position={[0, 1.55, 0.2]} castShadow>
        <boxGeometry args={[1.5, 0.45, 1.4]} />
        <meshStandardMaterial
          color={statusColor}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>

      {/* Illuminated Status Beacon Tower */}
      <mesh position={[0.7, 2.65, -0.65]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 16]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.7, 2.98, -0.65]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={0.85}
        />
      </mesh>

      {/* Floating Station Label & Live Counter Overlay */}
      <Html
        position={[0, 3.55, -0.3]}
        center
        distanceFactor={15}
        zIndexRange={[10, 0]}
      >
        <button
          type="button"
          onClick={() => onSelect(station.stationId)}
          className={`px-2.5 py-1 rounded border text-left shadow-md transition-all whitespace-nowrap ${
            selected
              ? "bg-slate-900 text-white border-blue-400 ring-2 ring-blue-500/50"
              : "bg-slate-900/90 text-slate-100 border-slate-700 hover:border-slate-500"
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: statusColor }}
            />
            <span>{station.stationCode}</span>
            <span className="text-slate-400">({station.status})</span>
          </div>
          <div className="text-[11px] font-semibold truncate max-w-[140px]">
            {station.machineType}
          </div>
          <div className="text-[9px] font-mono text-slate-300 mt-0.5">
            Good: {metrics?.goodCount ?? 0} | Q:{" "}
            {metrics?.queuedProductIds.length ?? 0}
            {metrics?.blocked ? " [BLOCKED]" : ""}
          </div>
        </button>
      </Html>
    </group>
  );
}

function ProductBoxMesh({ product }: { product: SimProductItem }) {
  const x = getProductWorldX(product);
  const zOffset = product.phase === "rejected" ? 1.1 : 0.35;
  const boxColor = product.isDefective ? "#f43f5e" : "#d97706";

  return (
    <group position={[x, 0.92, zOffset]}>
      <mesh castShadow>
        <boxGeometry args={[0.52, 0.42, 0.48]} />
        <meshStandardMaterial color={boxColor} roughness={0.6} />
      </mesh>
      {/* Top carton tape strip */}
      <mesh position={[0, 0.215, 0]}>
        <boxGeometry args={[0.53, 0.01, 0.1]} />
        <meshStandardMaterial
          color={product.isDefective ? "#991b1b" : "#fef3c7"}
        />
      </mesh>
    </group>
  );
}

export function PackagingLineScene({
  simState,
  selectedStationId,
  onSelectStation,
}: {
  simState: PackagingLineSimState;
  selectedStationId: string;
  onSelectStation: (stationId: string) => void;
}) {
  const visibleProducts = useMemo(
    () => simState.products.filter((p) => p.phase !== "completed"),
    [simState.products]
  );

  return (
    <div
      data-testid="digital-twin-canvas-container"
      className="relative w-full h-[480px] rounded-md overflow-hidden bg-slate-950 border border-slate-800"
    >
      <Canvas
        shadows
        camera={{ position: [0, 9.5, 13.5], fov: 42 }}
        gl={{ antialias: true, powerPreference: "default" }}
      >
        <color attach="background" args={["#090d16"]} />
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[8, 16, 10]}
          intensity={1.2}
          castShadow
        />
        <pointLight position={[-8, 6, -4]} intensity={0.5} color="#38bdf8" />

        {/* Industrial Factory Floor Grid */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[32, 18]} />
          <meshStandardMaterial color="#0f172a" roughness={0.85} />
        </mesh>
        <gridHelper args={[32, 32, "#1e293b", "#1e293b"]} position={[0, 0.01, 0]} />

        {/* Continuous Packaging Conveyor Belt Structure (Spans x = -10.5 to +10.5) */}
        <group position={[0, 0.5, 0.35]}>
          {/* Conveyor Frame */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[21.5, 0.35, 0.85]} />
            <meshStandardMaterial
              color="#334155"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          {/* Conveyor Belt Surface */}
          <mesh position={[0, 0.19, 0]} receiveShadow>
            <boxGeometry args={[21.2, 0.04, 0.72]} />
            <meshStandardMaterial color="#090d16" roughness={0.9} />
          </mesh>
        </group>

        {/* Stations A through E */}
        {simState.stations.map((station) => (
          <StationMesh
            key={station.stationId}
            station={station}
            metrics={simState.stationMetrics[station.stationId]}
            selected={selectedStationId === station.stationId}
            onSelect={onSelectStation}
          />
        ))}

        {/* Moving Carton Boxes along Conveyor */}
        {visibleProducts.map((product) => (
          <ProductBoxMesh key={product.id} product={product} />
        ))}

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={5}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>

      {/* Interactive 2D Station Quick-Select Bar (Also ensures full keyboard & headless accessibility) */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded px-3 py-2 text-xs text-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-mono mr-1">
            Stations (Click 3D Mesh or Pill):
          </span>
          {simState.stations.map((st) => {
            const active = selectedStationId === st.stationId;
            return (
              <button
                key={st.stationId}
                type="button"
                data-testid={`select-station-${st.stationId}`}
                onClick={() => onSelectStation(st.stationId)}
                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 border transition-colors ${
                  active
                    ? "bg-blue-600 text-white border-blue-400 font-bold"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_HEX[st.status] }}
                />
                {st.stationCode}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          Orbit: Left-Drag • Pan: Right-Drag • Zoom: Scroll
        </div>
      </div>
    </div>
  );
}
