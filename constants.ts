


export const THEMES = [
  {
    name: 'Idyllic Suburbia',
    sky: '#87CEEB', // Clear Sky Blue
    skyBottom: '#E0F7FA', // Lighter horizon
    ground: '#55efc4', // Manicured Grass
    road: '#636e72', // Grey Asphalt
    stripe: '#dfe6e9',
    obstacle: '#ff7675', // Pastel Red
    details: '#00b894', // Bushes
    sceneryColor: '#ffffff' // House base
  },
  {
    name: 'Sunny Village',
    sky: '#81ecec', // Bright Cyan
    skyBottom: '#00cec9',
    ground: '#55efc4', // Grass
    road: '#b2bec3', // Grey road
    stripe: '#ffffff',
    obstacle: '#e17055', // Burnt Orange
    details: '#00b894', // Darker grass/trees
    sceneryColor: '#00b894' // Trees
  },
  {
    name: 'Construction Site',
    sky: '#ffeaa7', // Yellowish sky
    skyBottom: '#fab1a0',
    ground: '#fdcb6e', // Dirt
    road: '#2d3436', // Dark road
    stripe: '#fdcb6e', // Yellow lines
    obstacle: '#ffeaa7', // Bright yellow barriers
    details: '#636e72', // Metal structures
    sceneryColor: '#2d3436' // Cranes
  }
];

// Difficulty Balancing
export const INITIAL_SPEED = 4; // Reduced from 6 for much easier start
export const MAX_SPEED = 16; 
export const LANE_SWITCH_SPEED = 0.12; 
export const ACCELERATION = 0.0002; // Very slow progression
export const SAFE_ZONE = 1000; // Distance before first obstacle
export const STAGE_LENGTH = 10000; // Increased from implicitly 3000 to 10000 for smoother pacing
