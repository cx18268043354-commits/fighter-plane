import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Shield, Flame, Heart, Zap, Sword, Award } from 'lucide-react';

interface AchievementToastProps {
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string;
  } | null;
  onClose: () => void;
}

export default function AchievementToast({ achievement, onClose }: AchievementToastProps) {
  // Map icon strings to Lucide icon components
  const renderIcon = (iconName: string) => {
    const iconClass = "w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]";
    switch (iconName) {
      case 'Sword':
        return <Sword className={iconClass} />;
      case 'Shield':
        return <Shield className={iconClass} />;
      case 'Flame':
        return <Flame className={iconClass} />;
      case 'Heart':
        return <Heart className={iconClass} />;
      case 'Trophy':
        return <Trophy className={iconClass} />;
      case 'Zap':
        return <Zap className={iconClass} />;
      default:
        return <Award className={iconClass} />;
    }
  };

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm"
        >
          <div className="bg-slate-900/90 backdrop-blur-xl border-2 border-amber-500/50 rounded-xl p-4 shadow-[0_0_30px_rgba(245,158,11,0.25)] flex items-center gap-4 relative overflow-hidden group">
            
            {/* Ambient Back Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />

            {/* Icon Bubble */}
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-[inset_0_0_12px_rgba(245,158,11,0.2)] animate-pulse">
              {renderIcon(achievement.icon)}
            </div>

            {/* Text details */}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-amber-500 tracking-widest uppercase font-mono">
                成就已解锁 ! UNLOCKED
              </span>
              <h4 className="font-bold text-slate-100 text-base mt-0.5 max-w-[95%] truncate">
                {achievement.name}
              </h4>
              <p className="text-xs text-slate-400 mt-1 truncate">
                {achievement.description}
              </p>
            </div>

            {/* Interactive close button */}
            <button 
              onClick={onClose}
              className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-800/60"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
