import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { Run } from '../lib/model';
import { wallAt, type Direction } from '../lib/rules';

export function Board({
  run,
  tile,
  onMove,
  onRestart,
}: {
  run: Run;
  tile?: number;
  onMove: (d: Direction) => void;
  onRestart: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const sceneRef = useRef<Phaser.Scene | null>(null);
  const current = useRef({ run, tile, onMove, onRestart });
  current.current = { run, tile, onMove, onRestart };
  const drawRef = useRef<() => void>(() => {});
  useEffect(() => {
    let game: Phaser.Game | undefined;
    let disposed = false;
    void import('phaser').then(({ default: Phaser }) => {
      if (disposed || !host.current) return;
      class Dungeon extends Phaser.Scene {
        create() {
          setReady(true);
          sceneRef.current = this;
          drawRef.current = () => {
            this.children.removeAll(true);
            const { run, tile } = current.current;
            const graphics = this.add.graphics();
            for (let i = 0; i < 49; i++) {
              const x = (i % 7) * 80;
              const y = Math.floor(i / 7) * 80;
              const wall = wallAt(run.snapshot.walls, i);
              graphics.fillStyle(wall ? 0x394444 : 0x182325);
              graphics.fillRoundedRect(x + 3, y + 3, 74, 74, 5);
              graphics.lineStyle(1, wall ? 0x566160 : 0x293638);
              graphics.strokeRoundedRect(x + 3, y + 3, 74, 74, 5);
              if (wall) {
                graphics.lineBetween(x + 4, y + 39, x + 76, y + 39);
                graphics.lineBetween(x + 30, y + 4, x + 30, y + 39);
                graphics.lineBetween(x + 55, y + 39, x + 55, y + 76);
              }
              this.add.text(x + 9, y + 7, String(i).padStart(2, '0'), {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: wall ? '#9ca9a4' : '#718782',
              });
              if (i === 0 || i === 48) {
                this.add
                  .text(x + 40, y + 43, i === 0 ? 'START' : 'EXIT', {
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: i === 0 ? '#9bded0' : '#efc880',
                  })
                  .setOrigin(0.5);
                graphics.lineStyle(2, i === 0 ? 0x80baab : 0xefc880);
                graphics.strokeRoundedRect(x + 8, y + 8, 64, 64, 5);
              }
              if (i === tile) {
                graphics.lineStyle(4, 0xe8c98b);
                graphics.strokeRoundedRect(x + 5, y + 5, 70, 70, 5);
                this.add
                  .text(x + 40, y + 62, wall ? '→ FLOOR' : '→ WALL', {
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#ffe4ad',
                    backgroundColor: '#162325',
                  })
                  .setOrigin(0.5);
              }
            }
            const px = (run.position % 7) * 80 + 40;
            const py = Math.floor(run.position / 7) * 80 + 42;
            graphics.fillStyle(0x080e10, 0.5);
            graphics.fillEllipse(px, py + 15, 30, 12);
            graphics.fillStyle(0x9cdbcc);
            graphics.fillTriangle(px, py - 3, px - 13, py + 14, px + 13, py + 14);
            graphics.fillStyle(0xf5d7a0);
            graphics.fillCircle(px, py - 10, 9);
            graphics.fillStyle(0x3b645d);
            graphics.fillTriangle(px - 12, py - 14, px + 12, py - 14, px + 2, py - 27);
          };
          drawRef.current();
          this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (!host.current?.contains(document.activeElement)) return;
            if (event.key.toLowerCase() === 'r') {
              event.preventDefault();
              current.current.onRestart();
              return;
            }
            const direction = (
              {
                ArrowUp: 'U',
                w: 'U',
                W: 'U',
                ArrowRight: 'R',
                d: 'R',
                D: 'R',
                ArrowDown: 'D',
                s: 'D',
                S: 'D',
                ArrowLeft: 'L',
                a: 'L',
                A: 'L',
              } as Record<string, Direction>
            )[event.key];
            if (direction) {
              event.preventDefault();
              current.current.onMove(direction);
            }
          });
        }
      }
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        width: 560,
        height: 560,
        parent: host.current,
        backgroundColor: '#101719',
        scene: Dungeon,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        banner: false,
      });
    });
    return () => {
      disposed = true;
      sceneRef.current = null;
      game?.destroy(true);
    };
  }, []);
  useEffect(() => {
    drawRef.current();
  }, [run, tile]);
  return (
    <div
      className="board"
      ref={host}
      role="application"
      aria-busy={!ready}
      tabIndex={0}
      aria-label={`Dungeon board. Player at tile ${run.position}. Use WASD or arrow keys.`}
      onPointerDown={() => host.current?.focus()}
    >
      {!ready && <span>Loading dungeon controls…</span>}
    </div>
  );
}
