import { motion } from 'framer-motion';

export function AIGeneratingBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '-150%', left: '-50%', width: '200%', height: '400%', // Large enough to cover a wide button when rotating
          background: 'conic-gradient(from 0deg, #D4FF00, #1C1D21, #7B4B94, #1C1D21, #D4FF00)',
          opacity: 0.8,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.1, 1, 0.1] }}
            transition={{
              duration: 1.5 + (i % 3) * 0.5,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              top: `${10 + ((i * 23) % 80)}%`, // Keep away from the absolute edges
              left: `${5 + ((i * 37) % 90)}%`,
              width: '4px',
              height: '4px',
              backgroundColor: '#1C1D21',
            }}
          />
        ))}
      </div>
    </div>
  );
}
