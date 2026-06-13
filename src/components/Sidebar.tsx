import React from 'react';
import { Keyboard, Shield, Zap, Crosshair, Sparkles, AlertTriangle } from 'lucide-react';

export default function Sidebar() {
  return (
    <div id="game-sidebar" className="w-full lg:w-80 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-6 text-slate-200 shadow-[0_0_30px_rgba(0,240,255,0.05)] flex flex-col gap-6">
      
      {/* Operating Instructions */}
      <div>
        <h3 className="text-xs font-bold tracking-wider uppercase text-slate-300 mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
          <Keyboard className="w-4 h-4 text-cyan-400" />
          操作指令 CONTROLS
        </h3>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between bg-white/2 rounded-lg p-2 border border-white/5">
            <span className="text-xs text-slate-400 uppercase tracking-wider">移动战机</span>
            <div>
              <span className="key-cap">W</span>
              <span className="key-cap">A</span>
              <span className="key-cap">S</span>
              <span className="key-cap">D</span>
              <span className="text-slate-500 text-xs ml-1">或方向键</span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-white/2 rounded-lg p-2 border border-white/5">
            <span className="text-xs text-slate-400 uppercase tracking-wider">首要开火</span>
            <div>
              <span className="key-cap">Space</span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-white/2 rounded-lg p-2 border border-white/5">
            <span className="text-xs text-slate-400 uppercase tracking-wider">暂停/继续</span>
            <div>
              <span className="key-cap">P</span>
            </div>
          </div>
        </div>
      </div>

      {/* Item descriptions */}
      <div>
        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-300 mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          太空强化道具 ARMORY
        </h3>
        <div className="flex flex-col gap-3">
          {/* Energy Shield */}
          <div className="flex items-start gap-3 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all rounded-xl p-3">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/40 text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-200 text-xs tracking-wide">等离子护盾 (Shield)</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                形成高能等离子偏转场，可完全湮灭敌机或导弹的下一次直接物理碰撞伤害。
              </p>
            </div>
          </div>

          {/* Triple laser */}
          <div className="flex items-start gap-3 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-fuchsia-500/20 transition-all rounded-xl p-3">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-fuchsia-500/10 border border-fuchsia-500/40 text-[#ff00e5] shadow-[0_0_10px_rgba(255,0,229,0.3)]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-200 text-xs tracking-wide">三向重激光 (Triple Shot)</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                全功率过载武器系统，在十秒限时内向前和斜侧区域发射密集集火激光，拥有清屏级统治力。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Target Radar (Enemies Info) */}
      <div>
        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-300 mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
          <Crosshair className="w-4 h-4 text-rose-500" />
          战术目标分析 TARGETS
        </h3>
        <div className="flex flex-col gap-2.5 text-[11px]">
          <div className="flex justify-between items-center p-2 bg-white/2 border border-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block shadow-[0_0_6px_#ff3300]"></span>
              <span className="text-slate-300">侦察战机 (Basic)</span>
            </div>
            <span className="text-slate-400 font-mono">100 HP • 巡航速度</span>
          </div>

          <div className="flex justify-between items-center p-2 bg-white/2 border border-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_#00ffc4]"></span>
              <span className="text-slate-300">极速幽灵 (Swift)</span>
            </div>
            <span className="text-slate-400 font-mono">50 HP • 超速干扰</span>
          </div>

          <div className="flex justify-between items-center p-2 bg-white/2 border border-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block shadow-[0_0_6px_#c084fc]"></span>
              <span className="text-slate-300">重装巡洋舰 (Heavy)</span>
            </div>
            <span className="text-slate-400 font-mono">320 HP • 发射拦截弹</span>
          </div>
        </div>
      </div>

      {/* WARNING NOTIFICATION */}
      <div className="mt-auto bg-[#ff3300]/5 border border-[#ff3300]/15 rounded-xl p-3 flex gap-2 items-start">
        <AlertTriangle className="w-4 h-4 text-[#ff3300] shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-400 leading-relaxed">
          <strong className="text-rose-400">红电防御警告:</strong> 错失漏网敌机将穿透防线，直接扣除 <strong className="glow-red font-mono">50 积分</strong> 并激发空域警报红闪。
        </p>
      </div>

    </div>
  );
}
