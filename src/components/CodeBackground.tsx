import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const CODE_SNIPPETS = [
  'const maher = new Core();',
  'await maher.init();',
  'npm run build',
  'import { motion } from "motion";',
  'const [state, setState] = useState()',
  'git push origin main',
  'docker-compose up -d',
  'SELECT * FROM users;',
  'api.get("/v1/data")',
  'maher.deploy()',
  'const token = jwt.sign()',
  'console.log("Success")',
  'system.upgrade()',
  'engine.process()',
  'process.env.CORE',
  'while(coding) { ... }'
];

const COLORS = [
  'text-gold-500',
  'text-blue-400',
  'text-emerald-400',
  'text-purple-400',
  'text-rose-400',
  'text-amber-400'
];

interface MatrixLineProps {
  id: number;
  onComplete: (id: number) => void;
}

const MatrixLine: React.FC<MatrixLineProps> = ({ id, onComplete }) => {
  const snippet = CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const duration = 10 + Math.random() * 15;
  const [position] = useState({
    left: `${Math.random() * 95}%`,
    fontSize: `${0.6 + Math.random() * 0.4}rem`,
  });

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: '110vh', opacity: [0, 0.4, 0.4, 0] }}
      transition={{ 
        duration: duration, 
        ease: "linear",
      }}
      onAnimationComplete={() => onComplete(id)}
      className={`absolute font-mono pointer-events-none select-none whitespace-nowrap z-0 flex flex-col items-center ${color} opacity-20`}
      style={position}
    >
      {snippet.split('').map((char, i) => (
        <span key={i} className="my-0.5">{char}</span>
      ))}
    </motion.div>
  );
};

export const CodeBackground: React.FC = () => {
  const [lines, setLines] = useState<{ id: number }[]>([]);
  const idCounter = useRef(0);

  useEffect(() => {
    const spawnLine = () => {
      setLines(prev => {
        if (prev.length > 25) return prev;
        const newId = idCounter.current++;
        return [...prev, { id: newId }];
      });
    };

    const interval = setInterval(spawnLine, 1500);
    // Initial burst
    for(let i=0; i<15; i++) {
       setTimeout(spawnLine, Math.random() * 5000);
    }
    
    return () => clearInterval(interval);
  }, []);

  const removeLine = (id: number) => {
    setLines(prev => prev.filter(line => line.id !== id));
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-zinc-950/20" />
      {lines.map(line => (
        <MatrixLine key={line.id} id={line.id} onComplete={removeLine} />
      ))}
    </div>
  );
};
