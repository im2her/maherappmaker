import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2, Package, Box, Sparkles, Cpu, Database, Layers,
  Wifi, Cloud, Rocket, Zap, Settings, Command, Globe,
  Smartphone, Laptop, Server, Activity, Terminal, Fingerprint,
  Blocks, Hexagon, Triangle, CircleDashed, Focus, Component, Gamepad2
} from 'lucide-react';

const ICONS = [
  Code2, Package, Box, Sparkles, Cpu, Database, Layers,
  Wifi, Cloud, Rocket, Zap, Settings, Command, Globe,
  Smartphone, Laptop, Server, Activity, Terminal, Fingerprint,
  Blocks, Hexagon, Triangle, CircleDashed, Focus, Component, Gamepad2
];

const COLORS = [
  'bg-blue-500/70',
  'bg-emerald-500/70',
  'bg-purple-500/70',
  'bg-rose-500/70',
  'bg-amber-500/70',
  'bg-indigo-500/70',
  'bg-pink-500/70',
  'bg-cyan-500/70',
  'bg-violet-500/70',
  'bg-orange-500/70'
];

const CODE_SNIPPETS = [
  "const [state, setState] = useState(null)",
  "interface AppProps {",
  "<motion.div animate={{",
  "npm run build",
  "export default function()",
  "import { Cloud } from 'lucide-react'",
  "async function init() {",
  "while (true) {",
  "return <App />",
  "console.log('Hello');",
  "fetch('/api/data')",
  "class SuperHero {",
  "Object.keys(data).map(",
  "useEffect(() => {",
];

interface FallingElementProps {
  id: number;
}

const FallingElement: React.FC<FallingElementProps> = ({ id }) => {
  const isCode = useMemo(() => Math.random() > 0.6, []);
  
  const Icon = useMemo(() => ICONS[Math.floor(Math.random() * ICONS.length)], []);
  const bgClass = useMemo(() => COLORS[Math.floor(Math.random() * COLORS.length)], []);
  const codeSnippet = useMemo(() => CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)], []);
  
  const duration = useMemo(() => 8 + Math.random() * 15, []); // Faster rain
  const delay = useMemo(() => Math.random() * 15, []); // Stagger start times
  
  const size = useMemo(() => isCode ? 100 + Math.random() * 150 : 40 + Math.random() * 40, [isCode]); // code blocks need to be wider
  
  const percentLeft = useMemo(() => isCode ? Math.random() * 60 : Math.random() * 85, [isCode]);
  
  const initialRotate = useMemo(() => isCode ? -5 + Math.random() * 10 : -20 + Math.random() * 40, [isCode]);
  const endRotate = useMemo(() => isCode ? -10 + Math.random() * 20 : -40 + Math.random() * 80, [isCode]);

  return (
    <motion.div
      initial={{ y: '-20vh', opacity: 0, rotate: initialRotate }}
      animate={{ y: ['-20vh', '120vh'], opacity: [0, 0.3, 0.3, 0], rotate: [initialRotate, endRotate] }}
      transition={{ 
        duration: duration, 
        delay: delay,
        ease: "linear",
        repeat: Infinity,
      }}
      className="absolute z-0 pointer-events-none select-none"
      style={{
        left: `${percentLeft}%`,
        width: isCode ? 'auto' : size,
        maxWidth: '80vw',
        height: isCode ? 'auto' : size,
        willChange: 'transform, opacity'
      }}
    >
      {isCode ? (
        <div 
          className="px-4 py-3 rounded-lg md:rounded-xl shadow-lg border border-white/10 relative overflow-hidden bg-zinc-900/80 font-mono text-sm md:text-base text-zinc-300"
          style={{ minWidth: size }}
        >
           <span className="relative z-10 text-emerald-400 font-semibold">{codeSnippet}</span>
        </div>
      ) : (
        <div 
          className={`w-full h-full rounded-2xl md:rounded-3xl shadow-lg flex items-center justify-center ${bgClass} border border-white/30 relative overflow-hidden`}
        >
           <Icon className="text-white w-1/2 h-1/2 opacity-100 relative z-10 drop-shadow-md" />
        </div>
      )}
    </motion.div>
  );
};

export const AppRainBackground: React.FC = () => {
  // Generate a fixed number of items once to prevent unmounting/remounting
  const items = useMemo(() => Array.from({ length: 25 }).map((_, i) => ({ id: i })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <AnimatePresence>
        {items.map(app => (
          <FallingElement key={app.id} id={app.id} />
        ))}
      </AnimatePresence>
    </div>
  );
};

