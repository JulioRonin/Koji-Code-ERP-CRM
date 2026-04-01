import React from 'react';
import { motion } from 'framer-motion';

const GEAR_IMG = '/machined_part_gear_1775007835896.png';
const SHAFT_IMG = '/machined_part_shaft_1775007854474.png';

export function Background3D() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1] opacity-15">
      {/* Floating Gear 1 */}
      <motion.div
        className="absolute top-[10%] left-[5%] w-64 h-64 blur-[2px]"
        animate={{
          y: [0, -30, 0],
          rotate: [0, 360],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <img src={GEAR_IMG} alt="Gear" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(0,240,255,0.3)]" />
      </motion.div>

      {/* Floating Shaft 1 */}
      <motion.div
        className="absolute bottom-[15%] right-[10%] w-80 h-80 blur-[3px]"
        animate={{
          y: [0, 40, 0],
          rotate: [0, -180],
          x: [0, -20, 0],
        }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <img src={SHAFT_IMG} alt="Shaft" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(0,240,255,0.2)]" />
      </motion.div>

      {/* Floating Gear 2 (Small) */}
      <motion.div
        className="absolute top-[60%] left-[20%] w-32 h-32 blur-[1px]"
        animate={{
          y: [0, 50, 0],
          rotate: [0, 360],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <img src={GEAR_IMG} alt="Gear small" className="w-full h-full object-contain opacity-50" />
      </motion.div>

      {/* Background Grid Pattern Enhancer */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.03)_0%,transparent_70%)]"></div>
    </div>
  );
}
