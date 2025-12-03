
import React from 'react';
import { GameState } from '../types';
import { Truck, Play, RefreshCw, Trophy, Gamepad2, Heart, Pause, Home, Coins } from 'lucide-react';

interface UIProps {
  gameState: GameState;
  score: number;
  lives: number;
  pauseIndex?: number;
  gameOverIndex?: number;
  coins?: number;
  onStart: () => void;
  onRestart: () => void;
  onResume?: () => void;
  onQuit?: () => void;
}

export const UI: React.FC<UIProps> = ({ 
  gameState, 
  score, 
  lives, 
  pauseIndex = 0,
  gameOverIndex = 0,
  coins = 0, 
  onStart, 
  onRestart,
  onResume,
  onQuit 
}) => {
  if (gameState === GameState.PLAYING) {
    return (
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none font-fredoka">
        <div className="flex gap-6 items-start">
          {/* Score - Fixed Width */}
          <div className="bg-yellow-400 text-yellow-900 px-6 py-3 rounded-3xl border-b-8 border-yellow-600 font-black text-5xl shadow-xl flex items-center justify-between gap-4 min-w-[320px]">
             <span className="text-xl uppercase tracking-wider opacity-70 mt-2">СЧЕТ</span>
             <span>{score.toString().padStart(5, '0')}</span>
          </div>

          {/* Coins */}
          <div className="bg-white text-slate-800 px-6 py-3 rounded-3xl border-b-8 border-slate-200 font-black text-4xl shadow-xl flex items-center gap-3">
             <div className="text-yellow-500"><Coins size={36} strokeWidth={3} /></div>
             <span>{coins}</span>
          </div>
        </div>
        
        {/* Lives */}
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
             <div key={i} className={`transform transition-all duration-300 ${i < lives ? 'scale-100' : 'scale-50 opacity-20 grayscale'}`}>
               <Heart 
                 size={48} 
                 className="fill-red-500 text-red-600 drop-shadow-md" 
                 strokeWidth={3}
               />
             </div>
          ))}
        </div>
      </div>
    );
  }

  if (gameState === GameState.PAUSED) {
    return (
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-20 font-fredoka">
         <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center border-b-[12px] border-slate-200 w-full max-w-lg">
             <div className="flex items-center gap-4 text-slate-800 mb-10">
               <Pause size={48} className="fill-current" />
               <h2 className="text-6xl font-black uppercase tracking-wide">ПАУЗА</h2>
             </div>

             <div className="flex flex-col gap-6 w-full">
                <button 
                  onClick={onResume}
                  className={`w-full py-6 rounded-2xl text-3xl font-black uppercase transition-all flex items-center justify-center gap-3 border-b-8 ${
                    pauseIndex === 0 
                    ? 'bg-blue-500 text-white border-blue-700 scale-105 shadow-xl' 
                    : 'bg-slate-100 text-slate-400 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Play size={32} className="fill-current" />
                  ПРОДОЛЖИТЬ
                </button>

                <button 
                  onClick={onQuit}
                  className={`w-full py-6 rounded-2xl text-3xl font-black uppercase transition-all flex items-center justify-center gap-3 border-b-8 ${
                    pauseIndex === 1 
                    ? 'bg-red-500 text-white border-red-700 scale-105 shadow-xl' 
                    : 'bg-slate-100 text-slate-400 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Home size={32} />
                  МЕНЮ
                </button>
             </div>
         </div>
      </div>
    );
  }

  if (gameState === GameState.MENU) {
    return (
      <div className="absolute inset-0 bg-sky-300 flex flex-col items-center justify-center z-10 text-slate-800 font-fredoka overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-10 left-20 text-white/40 animate-pulse"><Cloud size={120} /></div>
        <div className="absolute top-40 right-40 text-white/30"><Cloud size={180} /></div>
        <div className="absolute bottom-20 left-1/4 text-white/20"><Cloud size={100} /></div>

        <div className="z-10 flex flex-col items-center animate-bounce-slow">
            <h1 className="text-8xl font-black uppercase text-white drop-shadow-[0_8px_0_rgba(0,0,0,0.1)] tracking-wider text-center leading-tight">
              Ваня, <br />
              <span className="text-yellow-300">поехали!</span>
            </h1>
        </div>

        <button 
          onClick={onStart}
          className="z-10 mt-20 group relative px-20 py-8 bg-yellow-400 text-yellow-900 font-black text-5xl uppercase rounded-full border-b-[12px] border-yellow-600 hover:bg-yellow-300 hover:border-yellow-500 hover:translate-y-1 active:translate-y-3 active:border-b-0 transition-all outline-none shadow-2xl"
        >
          <span className="flex items-center gap-6 filter drop-shadow-sm">
            <Play size={48} className="fill-current" />
            ПОГНАЛИ!
          </span>
        </button>

        <div className="mt-12 flex gap-8 opacity-80">
            <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border-b-4 border-slate-200 flex items-center gap-3">
               <Gamepad2 className="text-blue-500" />
               <span className="font-bold text-slate-600">ГЕЙМПАД</span>
            </div>
        </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center z-10 text-white font-fredoka">
        
        <div className="bg-white text-slate-800 p-16 rounded-[4rem] shadow-2xl flex flex-col items-center border-b-[16px] border-slate-300 max-w-3xl w-full relative overflow-hidden">
           
           <h2 className="text-7xl font-black uppercase mb-12 text-slate-800 tracking-tight">ПРИЕХАЛИ!</h2>
           
           <div className="grid grid-cols-2 gap-8 w-full mb-12">
               <div className="bg-slate-100 rounded-[2rem] p-8 flex flex-col items-center border-b-8 border-slate-200">
                  <div className="text-slate-400 text-lg font-bold uppercase tracking-[0.1em] mb-2">СЧЕТ</div>
                  <div className="text-6xl font-black text-slate-800">{score}</div>
               </div>
               <div className="bg-yellow-50 rounded-[2rem] p-8 flex flex-col items-center border-b-8 border-yellow-200">
                  <div className="text-yellow-600 text-lg font-bold uppercase tracking-[0.1em] mb-2">МОНЕТЫ</div>
                  <div className="text-6xl font-black text-yellow-500 flex items-center gap-3">
                    <Coins size={48} strokeWidth={3} />
                    {coins}
                  </div>
               </div>
           </div>

           <div className="flex gap-6 w-full">
                <button 
                  onClick={onRestart}
                  className={`flex-1 py-8 rounded-3xl font-black text-4xl uppercase border-b-[10px] transition-all flex items-center justify-center gap-4 shadow-xl ${
                    gameOverIndex === 0
                    ? 'bg-blue-500 text-white border-blue-700 hover:bg-blue-400 hover:border-blue-600 scale-105'
                    : 'bg-slate-100 text-slate-400 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <RefreshCw size={40} strokeWidth={3} />
                  ЗАНОВО
                </button>

                <button 
                  onClick={onQuit}
                  className={`flex-1 py-8 rounded-3xl font-black text-4xl uppercase border-b-[10px] transition-all flex items-center justify-center gap-4 shadow-xl ${
                    gameOverIndex === 1
                    ? 'bg-red-500 text-white border-red-700 hover:bg-red-400 hover:border-red-600 scale-105'
                    : 'bg-slate-100 text-slate-400 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Home size={40} strokeWidth={3} />
                  МЕНЮ
                </button>
           </div>
        </div>
      </div>
    );
  }

  return null;
};

const Cloud = ({ size }: { size: number }) => (
  <svg 
    width={size} 
    height={size * 0.6} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.5 19C19.9853 19 22 16.9853 22 14.5C22 12.132 20.177 10.244 17.819 10.037C17.657 6.657 14.856 4 11.5 4C8.659 4 6.22 5.918 5.433 8.514C2.983 8.784 1 10.963 1 13.5C1 16.538 3.462 19 6.5 19H17.5Z" />
  </svg>
);
