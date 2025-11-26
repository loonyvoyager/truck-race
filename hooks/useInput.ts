import { useEffect, useRef } from 'react';

interface InputState {
  up: boolean;
  down: boolean;
  gas: boolean;
  brake: boolean;
  pause: boolean;
  confirm: boolean;
}

export const useInput = () => {
  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    gas: false,
    brake: false,
    pause: false,
    confirm: false,
  });

  const prevInputRef = useRef<InputState>({ ...inputRef.current });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          inputRef.current.up = true;
          break;
        case 'ArrowDown':
        case 's':
          inputRef.current.down = true;
          break;
        case 'ArrowRight':
        case 'd': // Gas alternative
          inputRef.current.gas = true;
          break;
        case 'ArrowLeft':
        case 'a': // Brake alternative
          inputRef.current.brake = true;
          break;
        case ' ':
        case 'Enter':
          inputRef.current.confirm = true;
          inputRef.current.gas = true; // Space is also gas in some contexts, but here primarily confirm
          break;
        case 'Escape':
          inputRef.current.pause = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          inputRef.current.up = false;
          break;
        case 'ArrowDown':
        case 's':
          inputRef.current.down = false;
          break;
        case 'ArrowRight':
        case 'd':
          inputRef.current.gas = false;
          break;
        case 'ArrowLeft':
        case 'a':
          inputRef.current.brake = false;
          break;
        case ' ':
        case 'Enter':
          inputRef.current.confirm = false;
          inputRef.current.gas = false;
          break;
        case 'Escape':
          inputRef.current.pause = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const pollGamepad = () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0]; // Assume player 1

    if (!gp) return inputRef.current;

    const threshold = 0.5;

    // DualSense Mapping (Standard mapping usually)
    // Buttons: 0:X, 1:Circle, 2:Square, 3:Triangle, 9:Options(Start)
    // Axes: 0:LeftStickX, 1:LeftStickY, 2:RightStickX, 3:RightStickY
    // Triggers might be buttons 6 (L2) and 7 (R2) or axes depending on OS/Browser

    // Stick or D-Pad for steering
    const stickY = gp.axes[1];
    const dpadUp = gp.buttons[12]?.pressed;
    const dpadDown = gp.buttons[13]?.pressed;

    // Triggers
    const l2 = gp.buttons[6]; // Brake
    const r2 = gp.buttons[7]; // Gas
    const gasPressed = (typeof r2 === 'object' && r2.pressed) || (typeof r2 === 'number' && r2 > 0.1);
    const brakePressed = (typeof l2 === 'object' && l2.pressed) || (typeof l2 === 'number' && l2 > 0.1);

    const newState: InputState = {
      up: stickY < -threshold || dpadUp,
      down: stickY > threshold || dpadDown,
      gas: gasPressed || gp.buttons[0]?.pressed, // X button also gas for simplicity
      brake: brakePressed || gp.buttons[1]?.pressed, // Circle button brake
      confirm: gp.buttons[0]?.pressed || gp.buttons[9]?.pressed, // X or Start
      pause: gp.buttons[9]?.pressed, // Options/Start
    };

    inputRef.current = newState;
    return newState;
  };

  // Helper to detect "Just Pressed" events
  const getInput = () => {
    const current = pollGamepad();
    const prev = prevInputRef.current;
    
    const justPressed = {
      up: current.up && !prev.up,
      down: current.down && !prev.down,
      gas: current.gas,
      brake: current.brake,
      confirm: current.confirm && !prev.confirm,
      pause: current.pause && !prev.pause,
    };

    prevInputRef.current = { ...current };
    return justPressed;
  };

  return getInput;
};
