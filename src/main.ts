import './style.css';
import { Game } from './game';
import { StorageManager } from './storage';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas konnte nicht initialisiert werden.');

new Game(canvas, new StorageManager());
