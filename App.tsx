
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UI } from './components/UI';
import { GameState } from './types';
import { useInput } from './hooks/useInput';
import { playSound } from './utils/audio';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(3);
  const [pauseIndex, setPauseIndex] = useState(0); // 0: Resume, 1: Quit
  const inputLockRef = useRef(0); // Timestamp to prevent double input when switching states
  const prevPauseIndexRef = useRef(0);
  
  const getInput = useInput();

  const handleLifeLost = useCallback(() => {
    setLives(prev => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        setGameState(GameState.GAME_OVER);
        return 0;
      }
      return newLives;
    });
  }, []);

  const handleStart = () => {
    playSound('start');
    setLives(3);
    setScore(0);
    setCoins(0);
    setGameState(GameState.PLAYING);
    inputLockRef.current = Date.now() + 200;
  };
  
  const handleGameStateChange = (newState: GameState) => {
    setGameState(newState);
    inputLockRef.current = Date.now() + 300; // Debounce input after state change
    if (newState === GameState.PAUSED) {
      setPauseIndex(0); // Reset selection to "Resume"
    }
  };

  // Global Input Handler for Menu/Pause Navigation
  useEffect(() => {
    let interval: number;
    
    const handleMenuInput = () => {
      if (Date.now() < inputLockRef.current) return;
      
      const input = getInput();

      if (gameState === GameState.MENU || gameState === GameState.GAME_OVER) {
        if (input.confirm || input.gas) {
          handleStart();
        }
      } else if (gameState === GameState.PAUSED) {
        if (input.up) setPauseIndex(0);
        if (input.down) setPauseIndex(1);
        
        // Sound for navigation
        if (prevPauseIndexRef.current !== pauseIndex) {
          playSound('hover');
          prevPauseIndexRef.current = pauseIndex;
        }

        if (input.confirm) {
          playSound('select');
          if (pauseIndex === 0) handleGameStateChange(GameState.PLAYING); // Resume
          else handleGameStateChange(GameState.MENU); // Quit
        }
        
        // Resume on Escape/Start
        if (input.pause) {
           playSound('pause');
           handleGameStateChange(GameState.PLAYING);
        }
      }
    };

    if (gameState !== GameState.PLAYING) {
      interval = window.setInterval(handleMenuInput, 100);
    }
    
    return () => clearInterval(interval);
  }, [gameState, pauseIndex, getInput]);

  return (
    <div className="relative w-screen h-screen bg-neutral-900 flex items-center justify-center overflow-hidden">
      {/* Aspect Ratio Container for TV consistency */}
      <div className="relative w-full max-w-[1920px] aspect-video bg-black shadow-2xl overflow-hidden">
        <GameCanvas 
          gameState={gameState} 
          setGameState={handleGameStateChange} 
          setScore={setScore}
          setCoins={setCoins}
          onLifeLost={handleLifeLost}
          lives={lives}
        />
        <UI 
          gameState={gameState} 
          score={score} 
          coins={coins}
          lives={lives}
          pauseIndex={pauseIndex}
          onStart={handleStart}
          onRestart={handleStart}
          onResume={() => { playSound('select'); handleGameStateChange(GameState.PLAYING); }}
          onQuit={() => { playSound('select'); handleGameStateChange(GameState.MENU); }}
        />
      </div>
    </div>
  );
}
