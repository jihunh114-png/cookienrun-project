import { useEffect, useRef, useState } from 'react'
import './App.css'

// ---------- 게임 상수 ----------
const WIDTH = 960
const HEIGHT = 420
const GROUND_Y = HEIGHT - 70

const PLAYER_X = 130
const PLAYER_W = 38
const PLAYER_H = 62
const PLAYER_SLIDE_H = 30

const GRAVITY = 2200
const JUMP_VELOCITY = -820
const SLIDE_DURATION = 0.6 // 초

const BASE_SPEED = 320
const MAX_SPEED = 760
const SPEED_RAMP = 6 // 초당 증가량

const MAX_HEALTH = 100
const HEALTH_DRAIN = 1.4 // 초당 감소량 (천천히 닳음)
const HIT_PENALTY = 22

const OBSTACLE_MIN_GAP = 0.75 // 초(간격)
const OBSTACLE_MAX_GAP = 1.5

// ---------- 헬퍼 ----------
function rand(min, max) {
  return min + Math.random() * (max - min)
}

// ---------- 게임 컴포넌트 ----------
export default function App() {
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState('start') // 'start' | 'playing' | 'over'
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem('runner_best') || 0))

  const stateRef = useRef(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const resetGame = () => {
    stateRef.current = {
      health: MAX_HEALTH,
      score: 0,
      speed: BASE_SPEED,
      dist: 0,
      player: {
        y: GROUND_Y - PLAYER_H,
        vy: 0,
        grounded: true,
        sliding: false,
        slideTimer: 0,
      },
      obstacles: [],
      spawnTimer: rand(0.8, 1.4),
      bgOffset: 0,
      last: 0,
    }
  }

  useEffect(() => {
    resetGame()

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // ---------- 입력 ----------
    const jump = () => {
      const s = stateRef.current
      if (!s || phaseRef.current !== 'playing') return
      const p = s.player
      if (p.grounded && !p.sliding) {
        p.vy = JUMP_VELOCITY
        p.grounded = false
      }
    }
    const startSlide = () => {
      const s = stateRef.current
      if (!s || phaseRef.current !== 'playing') return
      const p = s.player
      p.sliding = true
      p.slideTimer = SLIDE_DURATION
    }
    const endSlide = () => {
      const s = stateRef.current
      if (!s) return
      s.player.sliding = false
    }

    const onKeyDown = (e) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        if (phaseRef.current === 'start' || phaseRef.current === 'over') {
          resetGame()
          setPhase('playing')
          return
        }
        jump()
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
        startSlide()
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') endSlide()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // ---------- 그림 그리기 ----------
    const drawBackground = (s) => {
      // 하늘 그라데이션
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
      sky.addColorStop(0, '#0f172a')
      sky.addColorStop(1, '#1e3a5f')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, WIDTH, GROUND_Y)

      // 별
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      for (let i = 0; i < 40; i++) {
        const x = ((i * 137) % WIDTH) - ((s.bgOffset * 0.15) % WIDTH)
        const px = (x + WIDTH) % WIDTH
        const y = (i * 53) % (GROUND_Y - 40)
        ctx.globalAlpha = 0.3 + (i % 5) * 0.12
        ctx.fillRect(px, y, 2, 2)
      }
      ctx.globalAlpha = 1

      // 먼 산
      ctx.fillStyle = '#16233b'
      ctx.beginPath()
      const mOff = (s.bgOffset * 0.25) % WIDTH
      for (let x = -20; x <= WIDTH + 20; x += 20) {
        const wx = x - mOff
        const h = 40 + Math.sin((x + mOff) * 0.01) * 30
        ctx.lineTo(wx, GROUND_Y - 40 - Math.abs(Math.sin(x * 0.008)) * h)
      }
      ctx.lineTo(WIDTH, GROUND_Y)
      ctx.lineTo(0, GROUND_Y)
      ctx.closePath()
      ctx.fill()

      // 바닥
      ctx.fillStyle = '#334155'
      ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y)
      ctx.fillStyle = '#475569'
      ctx.fillRect(0, GROUND_Y, WIDTH, 4)

      // 바닥 무늬 (이동감)
      ctx.fillStyle = 'rgba(148,163,184,0.35)'
      const seg = 60
      const offset = s.bgOffset % seg
      for (let x = -seg; x < WIDTH + seg; x += seg) {
        ctx.fillRect(x - offset, GROUND_Y + 22, seg / 2, 3)
      }
    }

    const drawPlayer = (s) => {
      const p = s.player
      const h = p.sliding ? PLAYER_SLIDE_H : PLAYER_H
      const x = PLAYER_X
      const y = p.y

      ctx.save()
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.ellipse(x + PLAYER_W / 2, GROUND_Y + 6, PLAYER_W / 2, 6, 0, 0, Math.PI * 2)
      ctx.fill()

      const bodyColor = '#38bdf8'
      const accent = '#0ea5e9'
      if (p.sliding) {
        // 슬라이딩 자세 (납작)
        ctx.fillStyle = bodyColor
        roundRect(ctx, x, y, PLAYER_W, h, 8)
        ctx.fill()
        ctx.fillStyle = '#e2e8f0'
        roundRect(ctx, x + PLAYER_W - 14, y + 6, 10, 10, 4) // 머리
        ctx.fill()
      } else {
        // 몸통
        ctx.fillStyle = bodyColor
        roundRect(ctx, x, y, PLAYER_W, h - 16, 8)
        ctx.fill()
        // 머리
        ctx.fillStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.arc(x + PLAYER_W / 2, y - 8, 13, 0, Math.PI * 2)
        ctx.fill()
        // 고글
        ctx.fillStyle = accent
        ctx.fillRect(x + PLAYER_W / 2 - 9, y - 11, 18, 6)
        // 다리
        ctx.fillStyle = accent
        const run = Math.sin(s.dist * 0.03) * 6
        ctx.fillRect(x + 6, y + h - 16, 10, 16 + run * 0.3)
        ctx.fillRect(x + PLAYER_W - 16, y + h - 16, 10, 16 - run * 0.3)
      }
      ctx.restore()
    }

    const drawObstacle = (o) => {
      ctx.save()
      if (o.type === 'jump') {
        // 바닥에 있는 장애물 → 점프로 넘기
        const w = o.w
        const h = o.h
        const x = o.x
        const y = GROUND_Y - h
        ctx.fillStyle = '#f97316'
        roundRect(ctx, x, y, w, h, 4)
        ctx.fill()
        ctx.fillStyle = '#c2410c'
        ctx.fillRect(x + 6, y + 6, w - 12, 5)
        ctx.fillRect(x + 6, y + h - 8, w - 12, 4)
        // 위험 표시
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillRect(x + w / 2 - 2, y + h / 2 - 8, 4, 16)
      } else {
        // 머리 높이의 바 → 슬라이딩으로 피하기
        const x = o.x
        const w = o.w
        const top = o.top
        const bot = o.bot
        ctx.fillStyle = '#a855f7'
        roundRect(ctx, x, top, w, bot - top, 4)
        ctx.fill()
        ctx.fillStyle = '#7e22ce'
        ctx.fillRect(x + 6, top + 6, w - 12, 5)
        ctx.fillRect(x + 6, bot - 12, w - 12, 5)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillRect(x + w / 2 - 2, top + (bot - top) / 2 - 6, 4, 12)
      }
      ctx.restore()
    }

    const drawHealthBar = (s) => {
      const x = 20
      const y = 20
      const w = 260
      const h = 22
      ctx.fillStyle = 'rgba(15,23,42,0.55)'
      roundRect(ctx, x, y, w, h, 11)
      ctx.fill()

      const ratio = Math.max(0, s.health / MAX_HEALTH)
      const grad = ctx.createLinearGradient(x, 0, x + w, 0)
      const hue = 120 * ratio // 빨강(0) → 초록(120)
      grad.addColorStop(0, `hsl(${hue}, 85%, 50%)`)
      grad.addColorStop(1, `hsl(${Math.min(hue + 20, 120)}, 85%, 55%)`)
      ctx.fillStyle = grad
      if (ratio > 0) {
        roundRect(ctx, x + 2, y + 2, (w - 4) * ratio, h - 4, 9)
        ctx.fill()
      }
      ctx.fillStyle = '#f1f5f9'
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText('체력', x + w + 12, y + h / 2)
    }

    const drawScore = (s) => {
      ctx.fillStyle = '#f1f5f9'
      ctx.font = 'bold 28px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(String(Math.floor(s.score)), WIDTH - 24, 20)
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText('점수', WIDTH - 24, 54)
      ctx.textAlign = 'left'
    }

    // ---------- 업데이트 ----------
    const update = (dt) => {
      const s = stateRef.current
      s.dist += s.speed * dt
      s.bgOffset += s.speed * dt
      s.score += s.speed * dt * 0.06

      // 난이도 상승
      s.speed = Math.min(MAX_SPEED, BASE_SPEED + s.dist * SPEED_RAMP * 0.01)

      // 체력 천천히 감소
      s.health -= HEALTH_DRAIN * dt
      if (s.health <= 0) {
        s.health = 0
        endGame()
        return
      }

      // 플레이어 물리
      const p = s.player
      if (!p.grounded) {
        p.vy += GRAVITY * dt
        p.y += p.vy * dt
        if (p.y >= GROUND_Y - (p.sliding ? PLAYER_SLIDE_H : PLAYER_H)) {
          p.y = GROUND_Y - (p.sliding ? PLAYER_SLIDE_H : PLAYER_H)
          p.vy = 0
          p.grounded = true
        }
      }
      if (p.sliding) {
        p.slideTimer -= dt
        if (p.slideTimer <= 0) p.sliding = false
      }
      // 슬라이딩 상태에서 지면 재정렬
      if (p.grounded && p.sliding) {
        p.y = GROUND_Y - PLAYER_SLIDE_H
      }

      // 장애물 스폰
      s.spawnTimer -= dt
      if (s.spawnTimer <= 0) {
        spawnObstacle(s)
        s.spawnTimer = rand(OBSTACLE_MIN_GAP, OBSTACLE_MAX_GAP) * (BASE_SPEED / s.speed)
      }

      // 장애물 이동 & 충돌
      for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const o = s.obstacles[i]
        o.x -= s.speed * dt

        if (o.x + o.w < 0) {
          s.obstacles.splice(i, 1)
          continue
        }

        // 충돌 검사 (AABB)
        const ph = p.sliding ? PLAYER_SLIDE_H : PLAYER_H
        const pBox = { x: PLAYER_X + 6, y: p.y, w: PLAYER_W - 12, h: ph }
        let oBox
        if (o.type === 'jump') {
          oBox = { x: o.x + 3, y: GROUND_Y - o.h, w: o.w - 6, h: o.h }
        } else {
          oBox = { x: o.x + 3, y: o.top, w: o.w - 6, h: o.bot - o.top }
        }
        if (hit(pBox, oBox)) {
          s.obstacles.splice(i, 1)
          s.health -= HIT_PENALTY
          // 피격 효과
          s.hitFlash = 0.2
          if (s.health <= 0) {
            s.health = 0
            endGame()
            return
          }
        }
      }

      if (s.hitFlash > 0) s.hitFlash -= dt
    }

    const spawnObstacle = (s) => {
      const type = Math.random() < 0.5 ? 'jump' : 'slide'
      if (type === 'jump') {
        s.obstacles.push({
          type,
          x: WIDTH + 20,
          w: rand(26, 40),
          h: rand(30, 46),
        })
      } else {
        s.obstacles.push({
          type,
          x: WIDTH + 20,
          w: rand(40, 60),
          top: GROUND_Y - rand(74, 88),
          bot: GROUND_Y - rand(44, 52),
        })
      }
    }

    const hit = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

    const endGame = () => {
      const s = stateRef.current
      const finalScore = Math.floor(s.score)
      setScore(finalScore)
      setBest((prev) => {
        const b = Math.max(prev, finalScore)
        localStorage.setItem('runner_best', String(b))
        return b
      })
      setPhase('over')
    }

    // ---------- 메인 루프 ----------
    let raf = 0
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      const s = stateRef.current

      if (phaseRef.current === 'playing') {
        update(dt)
      }

      drawBackground(s)
      for (const o of s.obstacles) drawObstacle(o)
      drawPlayer(s)
      drawHealthBar(s)
      drawScore(s)

      // 피격 시 화면 플래시
      if (s.hitFlash > 0) {
        ctx.fillStyle = `rgba(239,68,68,${Math.min(0.3, s.hitFlash * 1.5)})`
        ctx.fillRect(0, 0, WIDTH, HEIGHT)
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <div className="game-wrap">
      <h1 className="game-title">쿠키런 러너</h1>
      <div className="stage">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="game-canvas" />

        {phase !== 'playing' && (
          <div className="overlay">
            {phase === 'start' ? (
              <>
                <h2>장애물 러너</h2>
                <p className="sub">
                  점프(↑/Space)와 슬라이딩(↓)으로 장애물을 피하세요.
                  <br />
                  체력이 0이 되면 게임이 끝납니다.
                </p>
                <button className="btn" onClick={() => { resetGame(); setPhase('playing') }}>
                  시작하기
                </button>
                <div className="keys">
                  <span className="key">↑ / Space</span> 점프
                  <span className="key">↓ / S</span> 슬라이딩
                </div>
              </>
            ) : (
              <>
                <h2>게임 오버</h2>
                <p className="score">점수: {score}</p>
                <p className="best">최고 기록: {best}</p>
                <button className="btn" onClick={() => { resetGame(); setPhase('playing') }}>
                  다시 하기
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 라운드 사각형 헬퍼
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
