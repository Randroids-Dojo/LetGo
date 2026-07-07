'use client'

// LETGO: an endless brick dungeon.
//
// First-person Doom-mechanics shooter in an endless streamed dungeon, built
// out of bright plastic bricks and minifigs. This component owns the
// Three.js world, the frame loop, and the screen flow (title -> run ->
// death -> workshop). All simulation rules live in src/game; all drawing
// recipes in src/art.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import * as THREE from 'three'
import { z } from 'zod'
import { drawPostFrame, plasticFilter, makeSparkleTiles, POST_PRESETS, type PostPreset } from '@/art/post'
import { drawMugshot, mugTierForHp, type MugExpression } from '@/art/mugshot'
import {
  drawCrateSprites,
  drawEnemySprites,
  drawExplosion,
  drawImpactStar,
  drawDebrisSprites,
  drawPickupSprites,
  drawProjectileSprites,
  type ProjectileArt,
  type SpriteSheet,
  type EnemyFrame
} from '@/art/sprites'
import { drawCeiling, drawDoor, drawFloor, drawWorkshopDoor, drawWall, themeForRing } from '@/art/textures'
import { drawViewmodel, VIEW_H, VIEW_W, type ViewmodelSet } from '@/art/viewmodel'
import { Sfx } from '@/audio/sfx'
import { moveWithSliding, type SolidAt } from '@/game/collision'
import { applyPlayerDamage, type PlayerVitals } from '@/game/combat'
import {
  CELL_DOOR,
  CELL_M,
  CELL_SOLID,
  CELL_VAULT_DOOR,
  CHUNK_SIZE,
  WALL_HEIGHT_M,
  cellAtGlobal,
  cellCenter,
  cellToChunk,
  chunkKey,
  generateChunk,
  worldToCell,
  type Chunk,
  type EnemyKind,
  type PickupKind
} from '@/game/dungeon'
import { createDoor, doorBlocks, doorKey, operateDoor, tickDoor, type DoorState } from '@/game/doors'
import {
  ENEMY_DEFS,
  createEnemy,
  damageEnemy,
  enemyMoveSpeed,
  projectileHarmless,
  rollDamage,
  tickEnemy,
  type Enemy
} from '@/game/enemies'
import {
  WEAPON_TIER_DAMAGE_PER_TIER,
  beginRun,
  createMetaState,
  deriveRunConfig,
  endRun,
  metaSchema,
  type MetaState,
  type RunConfig
} from '@/game/meta'
import { applyFriction, applyThrust } from '@/game/movement'
import { applyPickup, type PickupPlayerState } from '@/game/pickups'
import { createProjectile, resolveSplash, tickProjectile, type Projectile } from '@/game/projectiles'
import { castRay, hasLineOfSight, rayPointDistance } from '@/game/raycast'
import { hashString, mulberry32, rngInt, type Rng } from '@/game/rng'
import {
  JOYSTICK_RADIUS,
  LOOK_PITCH_RATE,
  LOOK_YAW_RATE,
  beginJoystick,
  createJoystick,
  endJoystick,
  isPhantomOrigin,
  isTapRelease,
  lookVectorFromStick,
  moveInputFromStick,
  moveJoystick,
  readJoystick,
  rebaseOriginIfPhantom,
  type JoystickState
} from '@/game/touch'
import { angleTo, clamp, dist, type Vec2 } from '@/game/types'
import { readStorage, writeStorage } from '@/lib/storage'
import {
  AMMO_MAX_BASE,
  WEAPONS,
  WEAPON_ORDER,
  bestFallbackWeapon,
  canFire,
  spendAmmo,
  type AmmoState,
  type WeaponId
} from '@/game/weapons'
import { WorkshopScreen } from './WorkshopScreen'

const filmSchema = z.enum(['clean', 'playful', 'retro'])

const META_KEY = 'letgo.meta.v1'
const FILM_KEY = 'letgo.style.v1'
const PLAYER_RADIUS = 0.45
const EYE_HEIGHT = 1.5
const ACTIVE_CHUNK_RADIUS = 2
const KEEP_CHUNK_RADIUS = 3
const ENEMY_THINK_RADIUS = 30
const HITSCAN_RANGE = 44

type Screen = 'title' | 'playing' | 'dead' | 'workshop'

type HudSnapshot = {
  hp: number
  armor: number
  ammoInWeapon: number | null
  weapon: WeaponId
  owned: WeaponId[]
  studs: number
  ring: number
  hasKey: boolean
}

type RunSummaryView = { studs: number; kills: number; ring: number; seconds: number }

type EnemyEntity = {
  logic: Enemy
  sprite: THREE.Sprite
  boilAt: number
  variant: number
  // Line-of-sight rechecks are staggered (~Doom's sight throttling).
  losUntil: number
  losCached: boolean
}
type PickupEntity = { id: number; kind: PickupKind; pos: Vec2; sprite: THREE.Sprite; bob: number }
type CrateEntity = { id: number; pos: Vec2; sprite: THREE.Sprite; hp: number }
type ProjectileEntity = { p: Projectile; sprite: THREE.Sprite }
type EffectEntity = { sprite: THREE.Object3D; ttl: number; total: number; frames?: THREE.Texture[] }

type ChunkEntry = { chunk: Chunk; group: THREE.Group | null }

type TouchSticks = { move: JoystickState; look: JoystickState }

// One identity for everything projectiles and splashes can hurt; the
// projectile/splash modules treat it as an opaque id.
type TargetRef = { kind: 'player' } | { kind: 'enemy'; id: number } | { kind: 'crate'; id: number }

type Art = ReturnType<typeof buildArt>

function buildArt() {
  const tex = (canvas: HTMLCanvasElement, repeat = false) => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    if (repeat) {
      t.wrapS = THREE.RepeatWrapping
      t.wrapT = THREE.RepeatWrapping
    }
    return t
  }
  const enemySheets: Record<EnemyKind, SpriteSheet> = {
    skeleton: drawEnemySprites('skeleton'),
    guard: drawEnemySprites('guard'),
    wizard: drawEnemySprites('wizard'),
    knight: drawEnemySprites('knight'),
    golem: drawEnemySprites('golem')
  }
  const enemyTex = {} as Record<EnemyKind, Record<EnemyFrame, THREE.Texture[]>>
  for (const kind of Object.keys(enemySheets) as EnemyKind[]) {
    enemyTex[kind] = {} as Record<EnemyFrame, THREE.Texture[]>
    for (const frame of Object.keys(enemySheets[kind]) as EnemyFrame[]) {
      enemyTex[kind][frame] = enemySheets[kind][frame].map((c) => tex(c))
    }
  }
  const pickupSheets = drawPickupSprites()
  const pickupTex = {} as Record<PickupKind, THREE.Texture[]>
  for (const kind of Object.keys(pickupSheets) as PickupKind[]) {
    pickupTex[kind] = pickupSheets[kind].map((c) => tex(c))
  }
  const projSheets = drawProjectileSprites()
  const projTex = {} as Record<ProjectileArt, THREE.Texture[]>
  for (const kind of Object.keys(projSheets) as ProjectileArt[]) {
    projTex[kind] = projSheets[kind].map((c) => tex(c))
  }
  const wallMaterials: Record<string, THREE.MeshLambertMaterial> = {}
  for (const theme of ['classic', 'castle', 'space'] as const) {
    wallMaterials[theme] = new THREE.MeshLambertMaterial({ map: tex(drawWall(theme, hashString(`wall-${theme}`))) })
  }
  // Shared chunk-building resources: repeat is identical for every chunk,
  // so cloning textures per chunk only cost redundant GPU uploads.
  const floorTex = tex(drawFloor(11), true)
  floorTex.repeat.set(CHUNK_SIZE / 2, CHUNK_SIZE / 2)
  const ceilTex = tex(drawCeiling(12), true)
  ceilTex.repeat.set(CHUNK_SIZE / 2, CHUNK_SIZE / 2)
  const viewmodels = {} as Record<WeaponId, ViewmodelSet>
  for (const id of WEAPON_ORDER) {
    viewmodels[id] = drawViewmodel(id)
  }
  const splatTextures = drawDebrisSprites().map((c) => tex(c))
  return {
    wallMaterials,
    wallGeo: new THREE.BoxGeometry(CELL_M, WALL_HEIGHT_M, CELL_M),
    chunkPlaneGeo: new THREE.PlaneGeometry(CHUNK_SIZE * CELL_M, CHUNK_SIZE * CELL_M),
    floorMaterial: new THREE.MeshLambertMaterial({ map: floorTex }),
    ceilingMaterial: new THREE.MeshBasicMaterial({ map: ceilTex, fog: true }),
    splatGeo: new THREE.PlaneGeometry(1.6, 1.6),
    splatMaterials: splatTextures.map((t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })),
    door: tex(drawDoor(false, 21)),
    vaultDoor: tex(drawDoor(true, 22)),
    workshopDoor: tex(drawWorkshopDoor()),
    enemyTex,
    pickupTex,
    projTex,
    crate: drawCrateSprites().map((c) => tex(c)),
    impact: drawImpactStar().map((c) => tex(c)),
    explosion: drawExplosion().map((c) => tex(c)),
    splat: splatTextures,
    viewmodels
  }
}

type World = {
  seed: number
  rng: Rng
  chunks: Map<string, ChunkEntry>
  // Hot-path caches: last chunk touched by solidAt, last streamed chunk
  // coordinate, last visited automap cell.
  lastChunk: ChunkEntry | null
  lastStreamKey: string
  lastVisitKey: string
  spawned: Set<string>
  doors: Map<string, { state: DoorState; mesh: THREE.Mesh; pos: Vec2 }>
  enemies: Map<number, EnemyEntity>
  pickups: Map<number, PickupEntity>
  crates: Map<number, CrateEntity>
  projectiles: Map<number, ProjectileEntity>
  effects: EffectEntity[]
  corpses: THREE.Object3D[]
  visited: Set<string>
  player: {
    pos: Vec2
    momentum: Vec2
    yaw: number
    pitch: number
    vitals: PlayerVitals
    ammo: AmmoState
    ammoMax: AmmoState
    weapon: WeaponId
    owned: WeaponId[]
    cooldown: number
    fireHeld: boolean
    fireQueued: boolean
    firedWhileHeld: boolean
    studsRun: number
    kills: number
    maxRing: number
    hasVaultKey: boolean
    reviveUsed: boolean
    damageFlash: number
    pickupFlash: number
    painUntil: number
    grinUntil: number
    dead: boolean
    deathAt: number
    runStartAt: number
    muzzleUntil: number
  }
  config: RunConfig
  weaponTiers: Record<string, number>
  nextId: number
  time: number
}

function makeAmmoMax(config: RunConfig): AmmoState {
  return {
    bullets: Math.round(AMMO_MAX_BASE.bullets * config.ammoMaxMult),
    shells: Math.round(AMMO_MAX_BASE.shells * config.ammoMaxMult),
    tnt: Math.round(AMMO_MAX_BASE.tnt * config.ammoMaxMult),
    cells: Math.round(AMMO_MAX_BASE.cells * config.ammoMaxMult)
  }
}

function createWorld(seed: number, config: RunConfig, meta: MetaState): World {
  const ammoMax = makeAmmoMax(config)
  const start: AmmoState = config.startFullAmmo
    ? { ...ammoMax }
    : { bullets: 50, shells: 0, tnt: 0, cells: 0 }
  return {
    seed,
    rng: mulberry32(seed ^ 0x9e3779b9),
    chunks: new Map(),
    lastChunk: null,
    lastStreamKey: '',
    lastVisitKey: '',
    spawned: new Set(),
    doors: new Map(),
    enemies: new Map(),
    pickups: new Map(),
    crates: new Map(),
    projectiles: new Map(),
    effects: [],
    corpses: [],
    visited: new Set(),
    player: {
      pos: { x: cellCenter(12), z: cellCenter(12) },
      momentum: { x: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      vitals: { hp: config.startHp, maxHp: config.maxHp, armor: config.startArmor, armorClass: config.startArmorClass },
      ammo: start,
      ammoMax,
      weapon: 'studgun',
      owned: [...meta.weaponsUnlocked] as WeaponId[],
      cooldown: 0.3,
      fireHeld: false,
      fireQueued: false,
      firedWhileHeld: false,
      studsRun: 0,
      kills: 0,
      maxRing: 0,
      hasVaultKey: false,
      reviveUsed: false,
      damageFlash: 0,
      pickupFlash: 0,
      painUntil: 0,
      grinUntil: 0,
      dead: false,
      deathAt: 0,
      runStartAt: 0,
      muzzleUntil: 0
    },
    config,
    weaponTiers: { ...meta.weaponTiers },
    nextId: 1,
    time: 0
  }
}

export function LetGoGame() {
  const [screen, setScreen] = useState<Screen>('title')
  const [paused, setPaused] = useState(false)
  const [meta, setMeta] = useState<MetaState>(createMetaState)
  const [film, setFilm] = useState<PostPreset>('playful')
  const [muted, setMuted] = useState(false)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [summary, setSummary] = useState<RunSummaryView | null>(null)
  const [booted, setBooted] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  const [mapOn, setMapOn] = useState(false)

  const mountRef = useRef<HTMLDivElement>(null)
  const filmCanvasRef = useRef<HTMLCanvasElement>(null)
  const weaponCanvasRef = useRef<HTMLCanvasElement>(null)
  const mugCanvasRef = useRef<HTMLCanvasElement>(null)
  const automapRef = useRef<HTMLCanvasElement>(null)

  const threeRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null>(null)
  const artRef = useRef<Art | null>(null)
  const worldRef = useRef<World | null>(null)
  const sfxRef = useRef<Sfx | null>(null)
  const metaRef = useRef(meta)
  const screenRef = useRef(screen)
  const pausedRef = useRef(paused)
  const filmRef = useRef(film)
  const keysRef = useRef(new Set<string>())
  const automapHeldRef = useRef(false)
  const touchSticksRef = useRef<TouchSticks>({ move: createJoystick(), look: createJoystick() })
  const touchLookStartAtRef = useRef(0)
  // The stick layer registers a repaint callback here so stick visuals can
  // re-render without touching the rest of the component tree.
  const stickRepaintRef = useRef<(() => void) | null>(null)
  const grainRef = useRef<{ tiles: HTMLCanvasElement[]; frame: number } | null>(null)
  const lastFilmDrawRef = useRef(0)
  const lastAutomapDrawRef = useRef(0)
  const lastHudRef = useRef(0)
  const mugCacheRef = useRef(new Map<string, HTMLCanvasElement>())
  const mugLookRef = useRef({ look: 0, nextAt: 0 })
  const spriteMaterialCache = useRef(new Map<THREE.Texture, THREE.SpriteMaterial>())

  metaRef.current = meta
  screenRef.current = screen
  pausedRef.current = paused
  filmRef.current = film

  // --- Boot: pull saved progress from localStorage once the client mounts.
  // Deferred to a microtask so hydration completes against default state.
  useEffect(() => {
    queueMicrotask(() => {
      const saved = readStorage(META_KEY, metaSchema)
      if (saved) {
        setMeta(saved)
      }
      const savedFilm = readStorage(FILM_KEY, filmSchema)
      if (savedFilm) {
        setFilm(savedFilm)
      }
      // Coarse primary pointer only: touchscreen laptops keep the desktop
      // layout, and per-event pointerType handles their touch input.
      setIsTouch(window.matchMedia('(pointer: coarse)').matches)
      setBooted(true)
    })
  }, [])

  const saveMeta = useCallback((next: MetaState) => {
    setMeta(next)
    writeStorage(META_KEY, next)
  }, [])

  const changeFilm = useCallback((preset: PostPreset) => {
    setFilm(preset)
    writeStorage(FILM_KEY, preset)
  }, [])

  const spriteFor = useCallback((texture: THREE.Texture, scale: number): THREE.Sprite => {
    const sprite = new THREE.Sprite(getSpriteMaterial(texture))
    sprite.scale.set(scale, scale, 1)
    return sprite
  }, [])

  // --- Shared input helpers: every input path (keyboard, mouse, touch)
  // funnels through these so the playable-state rule lives in one place.
  // They read only refs, so effects with empty deps can close over them.

  const liveWorld = () => {
    const world = worldRef.current
    return world && !world.player.dead && screenRef.current === 'playing' && !pausedRef.current ? world : null
  }

  const startFire = () => {
    const world = liveWorld()
    if (!world) {
      return
    }
    world.player.fireHeld = true
    world.player.fireQueued = true
    world.player.firedWhileHeld = false
  }

  const stopFire = () => {
    const world = worldRef.current
    if (world) {
      world.player.fireHeld = false
    }
  }

  const switchWeapon = (id: WeaponId) => {
    const world = liveWorld()
    if (world && world.player.owned.includes(id)) {
      world.player.weapon = id
    }
  }

  // Single writer for the automap toggle: the ref feeds the render loop,
  // the state feeds aria-pressed on the MAP button.
  const setAutomap = (on: boolean) => {
    automapHeldRef.current = on
    setMapOn(on)
  }

  // --- Run lifecycle ---
  const startRun = useCallback(() => {
    const currentMeta = metaRef.current
    const afterRent = beginRun(currentMeta)
    saveMeta(afterRent)
    const config = deriveRunConfig(currentMeta)
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
    const world = createWorld(seed, config, afterRent)
    world.player.runStartAt = performance.now()

    const three = threeRef.current
    if (three) {
      // Clear previous run's scene objects (lights are re-added below).
      three.scene.clear()
      setupSceneBasics(three.scene)
    }
    worldRef.current = world
    setAutomap(false)
    setSummary(null)
    setPaused(false)
    setScreen('playing')
    sfxRef.current?.startAmbience()
  }, [saveMeta])

  const finishDeath = useCallback(() => {
    const world = worldRef.current
    if (!world) {
      return
    }
    const seconds = Math.round((performance.now() - world.player.runStartAt) / 1000)
    const next = endRun(metaRef.current, {
      studsEarned: world.player.studsRun,
      kills: world.player.kills,
      ring: world.player.maxRing
    })
    saveMeta(next)
    setSummary({ studs: world.player.studsRun, kills: world.player.kills, ring: world.player.maxRing, seconds })
    setScreen('dead')
    sfxRef.current?.stopAmbience()
  }, [saveMeta])

  const finishDeathRef = useRef(finishDeath)
  finishDeathRef.current = finishDeath

  // --- Three.js boot + frame loop ---
  useEffect(() => {
    if (!booted || !mountRef.current) {
      return
    }
    const mount = mountRef.current
    // preserveDrawingBuffer keeps the canvas readable after compositing so
    // smoke tests can assert real pixels were drawn.
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    setupSceneBasics(scene)
    const camera = new THREE.PerspectiveCamera(74, mount.clientWidth / mount.clientHeight, 0.1, 60)
    threeRef.current = { renderer, scene, camera }
    artRef.current = buildArt()
    sfxRef.current = new Sfx()
    grainRef.current = { tiles: makeSparkleTiles(), frame: 0 }

    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      const filmCanvas = filmCanvasRef.current
      if (filmCanvas) {
        filmCanvas.width = mount.clientWidth
        filmCanvas.height = mount.clientHeight
      }
    }
    onResize()
    window.addEventListener('resize', onResize)

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (screenRef.current === 'playing' && !pausedRef.current) {
        stepWorld(dt, now)
      }
      renderer.render(scene, camera)
      drawOverlays(now)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      sfxRef.current?.stopAmbience()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted])

  // --- Input ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if (e.code === 'Tab') {
        e.preventDefault()
        setAutomap(true)
      }
      const world = worldRef.current
      if (screenRef.current === 'playing' && world && !world.player.dead) {
        const slotKeys: Record<string, number> = {
          Digit1: 1,
          Digit2: 2,
          Digit3: 3,
          Digit4: 4,
          Digit5: 5,
          Digit6: 6,
          Digit7: 7
        }
        const slot = slotKeys[e.code]
        if (slot) {
          const target = WEAPON_ORDER.find((id) => WEAPONS[id].slot === slot)
          if (target) {
            switchWeapon(target)
          }
        }
        if (e.code === 'KeyE' || e.code === 'Space') {
          e.preventDefault()
          tryUseDoor()
        }
        if (e.code === 'Escape') {
          setPaused(true)
          document.exitPointerLock()
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code)
      if (e.code === 'Tab') {
        setAutomap(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
     
  }, [])

  // Mouse aim and fire. Pointer events carry per-event provenance, so
  // touch-derived synthetic input never reaches this path: only real mouse
  // presses fire the weapon or grab pointer lock.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        return
      }
      const world = liveWorld()
      if (world && document.pointerLockElement) {
        world.player.yaw -= e.movementX * 0.0022
        world.player.pitch = clamp(world.player.pitch - e.movementY * 0.0022, -0.6, 0.6)
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !liveWorld()) {
        return
      }
      if (!document.pointerLockElement) {
        mountRef.current?.querySelector('canvas')?.requestPointerLock()
      }
      startFire()
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        stopFire()
      }
    }
    const onLockChange = () => {
      if (!document.pointerLockElement && screenRef.current === 'playing' && !worldRef.current?.player.dead) {
        setPaused(true)
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [])

  // Touch: float-where-you-tap dual sticks (vibekit math). The left half
  // of the screen moves, the right half aims, and a quick still tap on the
  // aim side fires one shot. The handlers only mutate stick state; the
  // frame loop derives movement and look from the sticks once per frame.
  useEffect(() => {
    const sticks = touchSticksRef.current
    // Stick visuals repaint at most once per animation frame, not per
    // touchmove event, and only the stick layer re-renders.
    let viewRaf = 0
    const syncView = () => {
      if (viewRaf) {
        return
      }
      viewRaf = requestAnimationFrame(() => {
        viewRaf = 0
        stickRepaintRef.current?.()
      })
    }
    const releaseAll = () => {
      if (viewRaf) {
        cancelAnimationFrame(viewRaf)
        viewRaf = 0
      }
      endJoystick(sticks.move)
      endJoystick(sticks.look)
      stickRepaintRef.current?.()
    }
    const isInteractive = (target: EventTarget | null) =>
      target instanceof Element && target.closest('button, select, a, .hud') !== null

    const claim = (touch: Touch): boolean => {
      if (touch.clientX < window.innerWidth / 2) {
        if (sticks.move.active) {
          return false
        }
        beginJoystick(sticks.move, touch.identifier, touch.clientX, touch.clientY)
      } else {
        if (sticks.look.active) {
          return false
        }
        beginJoystick(sticks.look, touch.identifier, touch.clientX, touch.clientY)
        touchLookStartAtRef.current = performance.now()
      }
      return true
    }

    const onTouchStart = (e: TouchEvent) => {
      if (!liveWorld() || isInteractive(e.target)) {
        return
      }
      let claimed = false
      for (let i = 0; i < e.changedTouches.length; i++) {
        claimed = claim(e.changedTouches[i]) || claimed
      }
      if (claimed) {
        e.preventDefault()
        syncView()
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      let claimed = false
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i]
        const stick =
          sticks.move.pointerId === touch.identifier
            ? sticks.move
            : sticks.look.pointerId === touch.identifier
              ? sticks.look
              : null
        if (!stick) {
          continue
        }
        claimed = true
        rebaseOriginIfPhantom(stick, touch.clientX, touch.clientY)
        moveJoystick(stick, touch.clientX, touch.clientY)
      }
      if (claimed) {
        e.preventDefault()
        syncView()
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      let released = false
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i]
        if (sticks.move.pointerId === touch.identifier) {
          endJoystick(sticks.move)
          released = true
        } else if (sticks.look.pointerId === touch.identifier) {
          const tap = isTapRelease(sticks.look, performance.now() - touchLookStartAtRef.current)
          endJoystick(sticks.look)
          released = true
          const world = liveWorld()
          if (tap && world) {
            world.player.fireQueued = true
          }
        }
      }
      if (released) {
        syncView()
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        releaseAll()
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    window.addEventListener('blur', releaseAll)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('blur', releaseAll)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseAll()
    }
  }, [])

  // Test hooks: deterministic ways for e2e to drive the loop. Not wired in
  // production builds.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return
    }
    const forceDeath = () => {
      const world = worldRef.current
      if (world && screenRef.current === 'playing') {
        world.player.vitals = { ...world.player.vitals, hp: 0 }
        killPlayer(performance.now())
      }
    }
    const grant = (e: Event) => {
      const amount = (e as CustomEvent<number>).detail ?? 0
      saveMeta({ ...metaRef.current, studs: metaRef.current.studs + amount })
    }
    const spawnGoons = () => {
      const world = worldRef.current
      if (!world || screenRef.current !== 'playing') {
        return
      }
      const kinds: EnemyKind[] = ['skeleton', 'guard', 'wizard', 'knight', 'golem']
      kinds.forEach((kind, i) => {
        addEnemy(kind, {
          x: world.player.pos.x + Math.sin(world.player.yaw + (i - 2) * 0.35) * (5 + i),
          z: world.player.pos.z + Math.cos(world.player.yaw + (i - 2) * 0.35) * (5 + i)
        })
      })
    }
    // Read-only probe so motion tests can assert the player actually moved.
    const debugWindow = window as Window & { letgoDebug?: () => { x: number; z: number; yaw: number } | null }
    debugWindow.letgoDebug = () => {
      const world = worldRef.current
      return world ? { x: world.player.pos.x, z: world.player.pos.z, yaw: world.player.yaw } : null
    }
    window.addEventListener('letgo:force-death', forceDeath)
    window.addEventListener('letgo:grant-studs', grant)
    window.addEventListener('letgo:spawn-goons', spawnGoons)
    return () => {
      delete debugWindow.letgoDebug
      window.removeEventListener('letgo:force-death', forceDeath)
      window.removeEventListener('letgo:grant-studs', grant)
      window.removeEventListener('letgo:spawn-goons', spawnGoons)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- killPlayer/addEnemy read only refs
  }, [saveMeta])

  useEffect(() => {
    sfxRef.current?.setMuted(muted)
  }, [muted])

  // ================= WORLD SIMULATION =================

  function getChunk(cx: number, cz: number): Chunk {
    const world = worldRef.current as World
    // Movement, raycasts, and projectiles hammer the same chunk in bursts;
    // the one-entry cache skips the string key on almost every call.
    const last = world.lastChunk
    if (last && last.chunk.cx === cx && last.chunk.cz === cz) {
      return last.chunk
    }
    const key = chunkKey(cx, cz)
    let entry = world.chunks.get(key)
    if (!entry) {
      // Data only: meshes are built lazily by ensureChunkMesh so that a
      // neighbor lookup during mesh building cannot recurse outward forever.
      entry = { chunk: generateChunk(world.seed, cx, cz), group: null }
      world.chunks.set(key, entry)
    }
    world.lastChunk = entry
    return entry.chunk
  }

  function ensureChunkMesh(cx: number, cz: number) {
    const world = worldRef.current as World
    getChunk(cx, cz)
    const entry = world.chunks.get(chunkKey(cx, cz))
    if (!entry || entry.group) {
      return
    }
    entry.group = buildChunkMeshes(entry.chunk)
    threeRef.current?.scene.add(entry.group)
  }

  const solidAt: SolidAt = (gx, gz) => {
    const world = worldRef.current as World
    const cell = cellAtGlobal(getChunk, gx, gz)
    if (cell === CELL_SOLID) {
      return true
    }
    if (cell === CELL_DOOR || cell === CELL_VAULT_DOOR) {
      const door = world.doors.get(doorKey(gx, gz))
      return door ? doorBlocks(door.state) : true
    }
    return false
  }

  function buildChunkMeshes(chunk: Chunk): THREE.Group {
    const art = artRef.current as Art
    const group = new THREE.Group()
    const theme = themeForRing(chunk.ring)

    // Visible wall cells: solid with at least one walkable neighbor.
    const instances: Array<[number, number]> = []
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (chunk.cells[lz * CHUNK_SIZE + lx] !== CELL_SOLID) {
          continue
        }
        const gx = chunk.cx * CHUNK_SIZE + lx
        const gz = chunk.cz * CHUNK_SIZE + lz
        let visible = false
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          if (cellAtGlobal(getChunk, gx + dx, gz + dz) !== CELL_SOLID) {
            visible = true
            break
          }
        }
        if (visible) {
          instances.push([gx, gz])
        }
      }
    }
    const mesh = new THREE.InstancedMesh(art.wallGeo, art.wallMaterials[theme], instances.length)
    const matrix = new THREE.Matrix4()
    instances.forEach(([gx, gz], i) => {
      matrix.setPosition(cellCenter(gx), WALL_HEIGHT_M / 2, cellCenter(gz))
      mesh.setMatrixAt(i, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)

    // Floor and ceiling planes share one geometry and material; the ceiling
    // is unlit because the hemisphere ground light barely reaches a
    // down-facing normal (it rendered as a black void).
    const floor = new THREE.Mesh(art.chunkPlaneGeo, art.floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(
      chunk.cx * CHUNK_SIZE * CELL_M + (CHUNK_SIZE * CELL_M) / 2,
      0,
      chunk.cz * CHUNK_SIZE * CELL_M + (CHUNK_SIZE * CELL_M) / 2
    )
    group.add(floor)
    const ceiling = new THREE.Mesh(art.chunkPlaneGeo, art.ceilingMaterial)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(floor.position.x, WALL_HEIGHT_M, floor.position.z)
    group.add(ceiling)
    return group
  }

  function spawnChunkEntities(chunk: Chunk) {
    const world = worldRef.current as World
    const art = artRef.current as Art
    const three = threeRef.current
    if (!three) {
      return
    }
    for (const spawn of chunk.enemies) {
      addEnemy(spawn.kind, { x: cellCenter(spawn.gx), z: cellCenter(spawn.gz) })
    }
    for (const spawn of chunk.pickups) {
      addPickup(spawn.kind, { x: cellCenter(spawn.gx), z: cellCenter(spawn.gz) })
    }
    for (const crate of chunk.crates) {
      const id = world.nextId++
      const sprite = spriteFor(art.crate[0], 1.1)
      const pos = { x: cellCenter(crate.gx), z: cellCenter(crate.gz) }
      sprite.position.set(pos.x, 0.55, pos.z)
      three.scene.add(sprite)
      world.crates.set(id, { id, pos, sprite, hp: 20 })
    }
    for (const doorSpawn of chunk.doors) {
      const key = doorKey(doorSpawn.gx, doorSpawn.gz)
      if (world.doors.has(key)) {
        continue
      }
      const state = createDoor(doorSpawn.gx, doorSpawn.gz, doorSpawn.locked)
      const geo = new THREE.BoxGeometry(
        doorSpawn.axis === 'x' ? 0.4 : CELL_M,
        WALL_HEIGHT_M,
        doorSpawn.axis === 'x' ? CELL_M : 0.4
      )
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ map: doorSpawn.locked ? art.vaultDoor : art.door })
      )
      mesh.position.set(cellCenter(doorSpawn.gx), WALL_HEIGHT_M / 2, cellCenter(doorSpawn.gz))
      three.scene.add(mesh)
      world.doors.set(key, { state, mesh, pos: { x: cellCenter(doorSpawn.gx), z: cellCenter(doorSpawn.gz) } })
    }
  }

  function addEnemy(kind: EnemyKind, pos: Vec2) {
    const world = worldRef.current as World
    const art = artRef.current as Art
    const three = threeRef.current
    if (!three) {
      return
    }
    const enemy = createEnemy(kind, pos)
    const def = ENEMY_DEFS[kind]
    const sprite = spriteFor(art.enemyTex[kind].walkA[0], def.heightM * 1.15)
    sprite.position.set(enemy.pos.x, def.heightM / 2, enemy.pos.z)
    three.scene.add(sprite)
    world.enemies.set(enemy.id, { logic: enemy, sprite, boilAt: 0, variant: 0, losUntil: 0, losCached: false })
  }

  function addPickup(kind: PickupKind, pos: Vec2) {
    const world = worldRef.current as World
    const art = artRef.current as Art
    const three = threeRef.current
    if (!three) {
      return
    }
    const id = world.nextId++
    const scale = kind === 'stud' ? 0.45 : kind === 'heartBig' || kind === 'studPile' ? 0.8 : 0.65
    const sprite = spriteFor(art.pickupTex[kind][0], scale)
    sprite.position.set(pos.x, scale / 2 + 0.15, pos.z)
    three.scene.add(sprite)
    world.pickups.set(id, { id, kind, pos: { ...pos }, sprite, bob: Math.random() * Math.PI * 2 })
  }

  function addEffect(textures: THREE.Texture[], pos: Vec2, y: number, scale: number, ttl: number) {
    const world = worldRef.current as World
    const three = threeRef.current
    if (!three) {
      return
    }
    const sprite = spriteFor(textures[0], scale)
    sprite.position.set(pos.x, y, pos.z)
    three.scene.add(sprite)
    world.effects.push({ sprite, ttl, total: ttl, frames: textures })
  }

  function addFloorSplat(pos: Vec2) {
    const world = worldRef.current as World
    const art = artRef.current as Art
    const three = threeRef.current
    if (!three) {
      return
    }
    const material = art.splatMaterials[Math.floor(Math.random() * art.splatMaterials.length)]
    const mesh = new THREE.Mesh(art.splatGeo, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = Math.random() * Math.PI * 2
    mesh.position.set(pos.x, 0.02 + world.corpses.length * 0.0004, pos.z)
    three.scene.add(mesh)
    world.corpses.push(mesh)
    if (world.corpses.length > 50) {
      const old = world.corpses.shift()
      if (old) {
        three.scene.remove(old)
      }
    }
  }

  function tryUseDoor() {
    const world = worldRef.current as World
    if (!world) {
      return
    }
    const { pos, yaw } = world.player
    // Check the two cells straight ahead.
    for (const reach of [1, 2]) {
      const gx = worldToCell(pos.x + Math.sin(yaw) * reach)
      const gz = worldToCell(pos.z + Math.cos(yaw) * reach)
      const door = world.doors.get(doorKey(gx, gz))
      if (!door) {
        continue
      }
      const hasKey = world.player.hasVaultKey || world.config.skeletonKey
      const result = operateDoor(door.state, hasKey)
      if (result === 'opened' || result === 'unlocked') {
        if (result === 'unlocked' && !world.config.skeletonKey) {
          // A physical key is spent on the lock it opened.
          world.player.hasVaultKey = false
        }
        sfxRef.current?.doorOpen()
      } else if (result === 'locked') {
        sfxRef.current?.doorLocked()
      }
      return
    }
  }

  function damagePlayer(damage: number, now: number) {
    const world = worldRef.current as World
    if (world.player.dead) {
      return
    }
    world.player.vitals = applyPlayerDamage(world.player.vitals, damage)
    world.player.damageFlash = Math.min(1, world.player.damageFlash + damage / 60)
    world.player.painUntil = now + 700
    sfxRef.current?.playerHurt()
    if (world.player.vitals.hp <= 0) {
      if (world.config.reviveOnce && !world.player.reviveUsed) {
        world.player.reviveUsed = true
        world.player.vitals = { ...world.player.vitals, hp: 50 }
        world.player.pickupFlash = 1
        return
      }
      killPlayer(now)
    }
  }

  function killPlayer(now: number) {
    const world = worldRef.current as World
    if (world.player.dead) {
      return
    }
    world.player.dead = true
    world.player.deathAt = now
    document.exitPointerLock()
    window.setTimeout(() => finishDeathRef.current(), 1600)
  }

  function weaponDamageMult(weapon: WeaponId): number {
    const world = worldRef.current as World
    const tier = world.weaponTiers[weapon] ?? 0
    return world.config.damageMult * (1 + tier * WEAPON_TIER_DAMAGE_PER_TIER)
  }

  function fireHitscanPellet(
    origin: Vec2,
    angle: number,
    damage: number,
    fromPlayer: boolean,
    shooterId: number | null,
    maxRange = HITSCAN_RANGE
  ) {
    const world = worldRef.current as World
    const art = artRef.current as Art
    const wallHit = castRay(solidAt, origin, angle, maxRange)
    const wallDist = wallHit?.distance ?? maxRange

    type Victim = { kind: 'enemy' | 'crate' | 'player'; id: number; along: number; pos: Vec2 }
    let best: Victim | null = null
    const consider = (kind: Victim['kind'], id: number, pos: Vec2, radius: number) => {
      const r = rayPointDistance(origin, angle, pos)
      if (r && r.lateral < radius && r.along < wallDist && (!best || r.along < best.along)) {
        best = { kind, id, along: r.along, pos }
      }
    }
    for (const [, entity] of world.enemies) {
      if (entity.logic.state === 'dead' || entity.logic.state === 'dying') {
        continue
      }
      if (!fromPlayer && shooterId === entity.logic.id) {
        continue
      }
      consider('enemy', entity.logic.id, entity.logic.pos, ENEMY_DEFS[entity.logic.kind].radiusM)
    }
    for (const [, crate] of world.crates) {
      consider('crate', crate.id, crate.pos, 0.55)
    }
    if (!fromPlayer) {
      consider('player', -1, world.player.pos, PLAYER_RADIUS)
    }

    const victim = best as Victim | null
    if (victim) {
      if (victim.kind === 'player') {
        damagePlayer(damage, performance.now())
      } else if (victim.kind === 'enemy') {
        hurtEnemy(victim.id, damage, shooterId)
        addEffect(art.splat, victim.pos, 1.2 + Math.random() * 0.5, 0.5, 0.25)
      } else {
        hurtCrate(victim.id, damage)
      }
    } else if (wallHit) {
      addEffect(art.impact, wallHit.point, 1 + Math.random() * 0.8, 0.4, 0.2)
    }
  }

  function hurtEnemy(id: number, damage: number, attackerId: number | null) {
    const world = worldRef.current as World
    const entity = world.enemies.get(id)
    if (!entity) {
      return
    }
    const result = damageEnemy(entity.logic, damage, world.rng, attackerId)
    if (result === 'pain') {
      sfxRef.current?.enemyPain()
    } else if (result === 'died') {
      sfxRef.current?.enemyDie()
      onEnemyKilled(entity)
    }
  }

  function onEnemyKilled(entity: EnemyEntity) {
    const world = worldRef.current as World
    world.player.kills += 1
    const def = ENEMY_DEFS[entity.logic.kind]
    const coins = rngInt(world.rng, def.coinDrop.min, def.coinDrop.max) * (world.config.doubleCoins ? 2 : 1)
    for (let i = 0; i < coins; i++) {
      const angle = world.rng() * Math.PI * 2
      const r = 0.3 + world.rng() * 0.8
      addPickup('stud', { x: entity.logic.pos.x + Math.sin(angle) * r, z: entity.logic.pos.z + Math.cos(angle) * r })
    }
    // Luck-based supply drops, doom style.
    if (world.rng() < 0.18 + world.config.dropLuck) {
      addPickup(world.rng() < 0.5 ? 'heartSmall' : 'bullets', entity.logic.pos)
    }
    addFloorSplat(entity.logic.pos)
  }

  function hurtCrate(id: number, damage: number) {
    const world = worldRef.current as World
    const crate = world.crates.get(id)
    if (!crate) {
      return
    }
    crate.hp -= damage
    if (crate.hp > 0) {
      return
    }
    world.crates.delete(id)
    threeRef.current?.scene.remove(crate.sprite)
    explodeAt(crate.pos, { maxDamage: 128, radiusM: 4 })
    if (world.rng() < 0.4) {
      addPickup('stud', crate.pos)
    }
  }

  function explodeAt(pos: Vec2, splash: { maxDamage: number; radiusM: number }) {
    const world = worldRef.current as World
    const art = artRef.current as Art
    sfxRef.current?.explosion()
    addEffect(art.explosion, pos, 1.4, 2.8, 0.5)
    const targets: Array<{ id: TargetRef; pos: Vec2 }> = [{ id: { kind: 'player' }, pos: world.player.pos }]
    for (const [, e] of world.enemies) {
      targets.push({ id: { kind: 'enemy', id: e.logic.id }, pos: e.logic.pos })
    }
    for (const [, crate] of world.crates) {
      targets.push({ id: { kind: 'crate', id: crate.id }, pos: crate.pos })
    }
    for (const hit of resolveSplash(pos, splash, targets)) {
      if (hit.targetId.kind === 'player') {
        damagePlayer(hit.damage, performance.now())
      } else if (hit.targetId.kind === 'crate') {
        hurtCrate(hit.targetId.id, hit.damage)
      } else {
        hurtEnemy(hit.targetId.id, hit.damage, null)
      }
    }
  }

  function firePlayerWeapon(now: number) {
    const world = worldRef.current as World
    const art = artRef.current as Art
    const player = world.player
    const def = WEAPONS[player.weapon]
    if (!canFire(def, player.ammo)) {
      player.weapon = bestFallbackWeapon(player.owned, player.ammo)
      return
    }
    if (!def.auto && player.firedWhileHeld) {
      return
    }
    const wasFirstShot = !player.firedWhileHeld
    player.ammo = spendAmmo(def, player.ammo)
    player.cooldown = def.cycleSec / world.config.fireRateMult
    player.firedWhileHeld = true
    player.muzzleUntil = now + 90
    sfxRef.current?.fire(player.weapon)
    // Wake nearby enemies: gunfire is loud.
    for (const [, entity] of world.enemies) {
      if (dist(entity.logic.pos, player.pos) < 20) {
        entity.logic.awake = true
        if (entity.logic.state === 'idle') {
          entity.logic.state = 'chase'
        }
      }
    }
    const mult = weaponDamageMult(player.weapon)
    if (def.melee) {
      // Punches only reach melee range, not the full hitscan distance.
      fireHitscanPellet(
        player.pos,
        player.yaw,
        Math.round(rollDamage(world.rng, def.dice) * mult),
        true,
        null,
        def.melee.rangeM
      )
      return
    }
    if (def.projectile) {
      const damage = Math.round(rollDamage(world.rng, def.dice) * mult)
      const kind: ProjectileArt = player.weapon === 'dynamite' ? 'tnt' : player.weapon === 'megabrick' ? 'megabrick' : 'ray'
      const origin = {
        x: player.pos.x + Math.sin(player.yaw) * 0.6,
        z: player.pos.z + Math.cos(player.yaw) * 0.6
      }
      const projectile = createProjectile(
        kind,
        origin,
        player.yaw,
        def.projectile.speedM,
        def.projectile.radiusM,
        damage,
        true,
        null,
        def.projectile.splash
      )
      const sprite = spriteFor(art.projTex[kind][0], kind === 'megabrick' ? 0.9 : 0.5)
      sprite.position.set(origin.x, 1.2, origin.z)
      threeRef.current?.scene.add(sprite)
      world.projectiles.set(projectile.id, { p: projectile, sprite })
      return
    }
    for (let i = 0; i < def.pellets; i++) {
      // Triangular spread like doom's twin P_Random calls; the pistol and
      // gatling gun fire their first tapped shot perfectly straight.
      const accurate = def.accurateFirstShot && wasFirstShot && def.pellets === 1
      const offset = accurate ? 0 : (world.rng() - world.rng()) * def.spreadRad
      const damage = Math.round(rollDamage(world.rng, def.dice) * mult)
      fireHitscanPellet(player.pos, player.yaw + offset, damage, true, null)
    }
  }

  function stepWorld(dt: number, now: number) {
    const world = worldRef.current
    const three = threeRef.current
    if (!world || !three) {
      return
    }
    world.time += dt
    const player = world.player

    // --- Chunk streaming: only when the player crosses a chunk border ---
    const pcx = cellToChunk(worldToCell(player.pos.x))
    const pcz = cellToChunk(worldToCell(player.pos.z))
    const streamKey = chunkKey(pcx, pcz)
    if (streamKey !== world.lastStreamKey) {
      world.lastStreamKey = streamKey
      for (let dz = -ACTIVE_CHUNK_RADIUS; dz <= ACTIVE_CHUNK_RADIUS; dz++) {
        for (let dx = -ACTIVE_CHUNK_RADIUS; dx <= ACTIVE_CHUNK_RADIUS; dx++) {
          const chunk = getChunk(pcx + dx, pcz + dz)
          ensureChunkMesh(pcx + dx, pcz + dz)
          const key = chunkKey(pcx + dx, pcz + dz)
          if (!world.spawned.has(key)) {
            world.spawned.add(key)
            spawnChunkEntities(chunk)
          }
        }
      }
      // Drop far chunk meshes (chunk data and entities stay; they are cheap).
      for (const [, entry] of world.chunks) {
        const distChunks = Math.max(Math.abs(entry.chunk.cx - pcx), Math.abs(entry.chunk.cz - pcz))
        if (distChunks > KEEP_CHUNK_RADIUS && entry.group) {
          three.scene.remove(entry.group)
          entry.group = null
        }
      }
      player.maxRing = Math.max(player.maxRing, Math.max(Math.abs(pcx), Math.abs(pcz)))
    }

    // --- Player movement ---
    if (!player.dead) {
      // Touch aim: analog stick deflection turns at a fixed rate. Inputs
      // derive from the sticks here, once per frame, whatever the touch
      // event rate was.
      const sticks = touchSticksRef.current
      const touchLook = lookVectorFromStick(sticks.look)
      if (touchLook.x !== 0 || touchLook.y !== 0) {
        player.yaw -= touchLook.x * LOOK_YAW_RATE * dt
        player.pitch = clamp(player.pitch - touchLook.y * LOOK_PITCH_RATE * dt, -0.6, 0.6)
      }
      const keys = keysRef.current
      const touchMove = moveInputFromStick(sticks.move)
      const input = {
        forward: keys.has('KeyW') || keys.has('ArrowUp') || touchMove.forward,
        backward: keys.has('KeyS') || keys.has('ArrowDown') || touchMove.backward,
        left: keys.has('KeyA') || keys.has('ArrowLeft') || touchMove.left,
        right: keys.has('KeyD') || keys.has('ArrowRight') || touchMove.right
      }
      player.momentum = applyThrust(player.momentum, player.yaw, input, dt, world.config.speedMult)
      player.momentum = applyFriction(player.momentum, dt)
      const next = moveWithSliding(solidAt, player.pos, player.momentum.x * dt, player.momentum.z * dt, PLAYER_RADIUS)
      player.pos = next

      // Track explored cells for the automap, once per cell crossed.
      const pgx = worldToCell(player.pos.x)
      const pgz = worldToCell(player.pos.z)
      const visitKey = `${pgx},${pgz}`
      if (visitKey !== world.lastVisitKey) {
        world.lastVisitKey = visitKey
        for (let dz = -3; dz <= 3; dz++) {
          for (let dx = -3; dx <= 3; dx++) {
            world.visited.add(`${pgx + dx},${pgz + dz}`)
          }
        }
      }

      // Fire control. A queued click fires as soon as the cycle allows even
      // if the button was already released; holding keeps autofire going.
      player.cooldown -= dt
      if ((player.fireHeld || player.fireQueued) && player.cooldown <= 0) {
        firePlayerWeapon(now)
        player.fireQueued = false
      }
      if (!player.fireHeld) {
        player.firedWhileHeld = false
      }
    }

    // --- Doors: closed faraway doors are inert, skip them entirely ---
    for (const [, door] of world.doors) {
      const playerDist = dist(door.pos, player.pos)
      if (door.state.phase === 'closed' && playerDist > 3) {
        continue
      }
      let blocked = playerDist < 1.2
      if (!blocked) {
        for (const [, entity] of world.enemies) {
          if (entity.logic.state !== 'dead' && dist(door.pos, entity.logic.pos) < 1.2) {
            blocked = true
            break
          }
        }
      }
      tickDoor(door.state, dt, WALL_HEIGHT_M, blocked)
      door.mesh.position.y = WALL_HEIGHT_M / 2 + door.state.openness * (WALL_HEIGHT_M - 0.15)
      door.mesh.visible = door.state.openness < 0.98
    }

    // --- Enemies ---
    for (const [id, entity] of world.enemies) {
      const enemy = entity.logic
      if (enemy.state === 'dead') {
        world.enemies.delete(id)
        three.scene.remove(entity.sprite)
        continue
      }
      const distToPlayer = dist(enemy.pos, player.pos)
      if (distToPlayer > ENEMY_THINK_RADIUS) {
        continue
      }
      // Infighting: chase the last thing that hurt it, if still alive.
      let target: Vec2 = player.pos
      let targetIsPlayer = true
      if (enemy.infightTargetId !== null) {
        const other = world.enemies.get(enemy.infightTargetId)
        if (other && other.logic.state !== 'dead' && other.logic.state !== 'dying') {
          target = other.logic.pos
          targetIsPlayer = false
        } else {
          enemy.infightTargetId = null
        }
      }
      if (targetIsPlayer && player.dead) {
        continue
      }
      // Staggered LOS: a full grid raycast per enemy per frame is the most
      // expensive AI query; ~150ms staleness is imperceptible.
      if (world.time > entity.losUntil) {
        entity.losUntil = world.time + 0.12 + world.rng() * 0.08
        entity.losCached = distToPlayer < 26 && hasLineOfSight(solidAt, enemy.pos, target)
      }
      const canSee = entity.losCached
      const events = tickEnemy(enemy, { dt, target, canSeeTarget: canSee, rng: world.rng })

      // Movement with door handling: enemies open unlocked doors.
      const speed = enemyMoveSpeed(enemy)
      if (speed > 0 && enemy.awake) {
        const dx = Math.sin(enemy.moveAngle) * speed * dt
        const dz = Math.cos(enemy.moveAngle) * speed * dt
        const before = { ...enemy.pos }
        const moved = moveWithSliding(solidAt, enemy.pos, dx, dz, ENEMY_DEFS[enemy.kind].radiusM)
        enemy.pos.x = moved.x
        enemy.pos.z = moved.z
        if (dist(moved, before) < speed * dt * 0.3) {
          // Blocked: try a door directly ahead, otherwise re-roll direction.
          const gx = worldToCell(enemy.pos.x + Math.sin(enemy.moveAngle) * 1.2)
          const gz = worldToCell(enemy.pos.z + Math.cos(enemy.moveAngle) * 1.2)
          const door = world.doors.get(doorKey(gx, gz))
          if (door && !door.state.locked && door.state.phase === 'closed') {
            operateDoor(door.state, false)
            sfxRef.current?.doorOpen()
          } else {
            enemy.wanderTimer = 0
          }
        }
      }

      // Resolve attack events.
      const def = ENEMY_DEFS[enemy.kind]
      for (const event of events) {
        if (event.type === 'meleeHit') {
          if (targetIsPlayer) {
            if (dist(enemy.pos, player.pos) < (def.melee?.rangeM ?? 1.5) + 0.4) {
              damagePlayer(event.damage, now)
            }
          } else if (enemy.infightTargetId !== null) {
            hurtEnemy(enemy.infightTargetId, event.damage, enemy.id)
          }
        } else if (event.type === 'hitscan') {
          for (let i = 0; i < event.pellets; i++) {
            const offset = (world.rng() - world.rng()) * event.spreadRad
            const damage = rollDamage(world.rng, event.dice)
            fireHitscanPellet(enemy.pos, angleTo(enemy.pos, target) + offset, damage, false, enemy.id)
          }
        } else if (event.type === 'projectile') {
          const art = artRef.current as Art
          const kind: ProjectileArt = enemy.kind === 'golem' ? 'fireball' : 'bolt'
          const damage = rollDamage(world.rng, event.dice)
          const origin = {
            x: enemy.pos.x + Math.sin(event.angle) * (def.radiusM + 0.3),
            z: enemy.pos.z + Math.cos(event.angle) * (def.radiusM + 0.3)
          }
          const projectile = createProjectile(kind, origin, event.angle, event.speedM, event.radiusM, damage, false, enemy.id)
          const sprite = spriteFor(art.projTex[kind][0], 0.5)
          sprite.position.set(origin.x, 1.1, origin.z)
          three.scene.add(sprite)
          world.projectiles.set(projectile.id, { p: projectile, sprite })
        }
      }

      // Sprite frame selection + boil.
      let frame: EnemyFrame
      if (enemy.state === 'dying') {
        frame = enemy.deathTimer < 0.25 ? 'die1' : enemy.deathTimer < 0.5 ? 'die2' : 'die3'
      } else if (enemy.state === 'pain') {
        frame = 'pain'
      } else if (enemy.state === 'windup') {
        frame = 'windup'
      } else if (enemy.state === 'chase') {
        frame = Math.floor(world.time * 4) % 2 === 0 ? 'walkA' : 'walkB'
      } else {
        frame = 'walkA'
      }
      if (world.time > entity.boilAt) {
        entity.boilAt = world.time + 0.1
        entity.variant = (entity.variant + 1) % 2
      }
      const art = artRef.current as Art
      const texture = art.enemyTex[enemy.kind][frame][entity.variant]
      if ((entity.sprite.material as THREE.SpriteMaterial).map !== texture) {
        entity.sprite.material = getSpriteMaterial(texture)
      }
      entity.sprite.position.set(enemy.pos.x, def.heightM / 2, enemy.pos.z)
    }

    // --- Projectiles ---
    for (const [id, entity] of world.projectiles) {
      const targets: Array<{ id: TargetRef; pos: Vec2; radiusM: number }> = []
      if (entity.p.fromPlayer) {
        for (const [, e] of world.enemies) {
          if (e.logic.state !== 'dead' && e.logic.state !== 'dying') {
            targets.push({ id: { kind: 'enemy', id: e.logic.id }, pos: e.logic.pos, radiusM: ENEMY_DEFS[e.logic.kind].radiusM })
          }
        }
        for (const [, crate] of world.crates) {
          targets.push({ id: { kind: 'crate', id: crate.id }, pos: crate.pos, radiusM: 0.55 })
        }
      } else {
        if (!player.dead) {
          targets.push({ id: { kind: 'player' }, pos: player.pos, radiusM: PLAYER_RADIUS })
        }
        for (const [, e] of world.enemies) {
          if (e.logic.id !== entity.p.shooterId && e.logic.state !== 'dead' && e.logic.state !== 'dying') {
            targets.push({ id: { kind: 'enemy', id: e.logic.id }, pos: e.logic.pos, radiusM: ENEMY_DEFS[e.logic.kind].radiusM })
          }
        }
      }
      const hit = tickProjectile(entity.p, dt, solidAt, targets)
      entity.sprite.position.set(entity.p.pos.x, entity.p.kind === 'tnt' ? 1.2 - entity.p.ageSec * 0.3 : 1.1, entity.p.pos.z)
      entity.sprite.material.rotation += dt * (entity.p.kind === 'tnt' ? 6 : 2)
      if (!hit) {
        continue
      }
      world.projectiles.delete(id)
      three.scene.remove(entity.sprite)
      if (hit.type === 'expired') {
        continue
      }
      if (entity.p.splash) {
        explodeAt(hit.pos, entity.p.splash)
        continue
      }
      if (hit.type === 'target') {
        if (hit.targetId.kind === 'player') {
          damagePlayer(entity.p.damage, now)
        } else if (hit.targetId.kind === 'crate') {
          hurtCrate(hit.targetId.id, entity.p.damage)
        } else {
          const victim = world.enemies.get(hit.targetId.id)
          // Doom rule: same-species projectiles never damage each other.
          if (victim && entity.p.shooterId !== null) {
            const shooter = world.enemies.get(entity.p.shooterId)
            if (shooter && projectileHarmless(shooter.logic.kind, victim.logic.kind)) {
              continue
            }
          }
          hurtEnemy(hit.targetId.id, entity.p.damage, entity.p.shooterId)
          const art = artRef.current as Art
          addEffect(art.splat, hit.pos, 1.2, 0.5, 0.25)
        }
      } else {
        const art = artRef.current as Art
        addEffect(art.impact, hit.pos, 1.1, 0.4, 0.2)
      }
    }

    // --- Pickups ---
    if (!player.dead) {
      for (const [id, pickup] of world.pickups) {
        pickup.sprite.position.y = 0.45 + Math.sin(world.time * 3 + pickup.bob) * 0.08
        if (dist(pickup.pos, player.pos) > 0.9) {
          continue
        }
        const pickupState: PickupPlayerState = {
          vitals: player.vitals,
          ammo: player.ammo,
          ammoMax: player.ammoMax,
          studs: player.studsRun,
          hasVaultKey: player.hasVaultKey
        }
        const result = applyPickup(pickup.kind, pickupState, world.config.studsMult)
        if (!result.consumed) {
          continue
        }
        player.vitals = result.state.vitals
        player.ammo = result.state.ammo
        player.studsRun = result.state.studs
        player.hasVaultKey = result.state.hasVaultKey
        player.pickupFlash = Math.min(1, player.pickupFlash + 0.4)
        if (pickup.kind === 'stud' || pickup.kind === 'studPile') {
          sfxRef.current?.coin()
        } else if (pickup.kind === 'vaultKey') {
          sfxRef.current?.keyPickup()
          player.grinUntil = now + 1200
        } else {
          sfxRef.current?.pickup()
          player.grinUntil = now + 800
        }
        world.pickups.delete(id)
        three.scene.remove(pickup.sprite)
      }
    }

    // --- Effects ---
    world.effects = world.effects.filter((effect) => {
      effect.ttl -= dt
      if (effect.ttl <= 0) {
        three.scene.remove(effect.sprite)
        return false
      }
      if (effect.frames && effect.frames.length > 1 && effect.sprite instanceof THREE.Sprite) {
        const idx = Math.min(
          effect.frames.length - 1,
          Math.floor((1 - effect.ttl / effect.total) * effect.frames.length)
        )
        effect.sprite.material = getSpriteMaterial(effect.frames[idx])
      }
      return true
    })

    // Flash decay (doom: damagecount decrements each tic).
    player.damageFlash = Math.max(0, player.damageFlash - dt * 1.4)
    player.pickupFlash = Math.max(0, player.pickupFlash - dt * 2.5)

    // --- Camera ---
    const speed = Math.hypot(player.momentum.x, player.momentum.z)
    const bob = Math.min(0.5, speed * speed * 0.004)
    const bobY = player.dead
      ? Math.max(0.4, EYE_HEIGHT - (now - player.deathAt) / 1000)
      : EYE_HEIGHT + Math.sin(world.time * 11) * bob * 0.12
    three.camera.position.set(player.pos.x, bobY, player.pos.z)
    three.camera.rotation.order = 'YXZ'
    three.camera.rotation.y = player.yaw + Math.PI
    three.camera.rotation.x = player.dead ? -0.5 : player.pitch
    three.camera.rotation.z = player.dead ? 0.4 : 0

    // --- HUD snapshot (throttled) ---
    if (now - lastHudRef.current > 120) {
      lastHudRef.current = now
      const def = WEAPONS[player.weapon]
      setHud({
        hp: Math.max(0, Math.round(player.vitals.hp)),
        armor: Math.round(player.vitals.armor),
        ammoInWeapon: def.ammoType === 'none' ? null : player.ammo[def.ammoType],
        weapon: player.weapon,
        owned: [...player.owned],
        studs: player.studsRun,
        ring: Math.max(Math.abs(pcx), Math.abs(pcz)),
        hasKey: player.hasVaultKey
      })
    }
  }

  function getSpriteMaterial(texture: THREE.Texture): THREE.SpriteMaterial {
    let material = spriteMaterialCache.current.get(texture)
    if (!material) {
      material = new THREE.SpriteMaterial({ map: texture, alphaTest: 0.1, fog: true })
      spriteMaterialCache.current.set(texture, material)
    }
    return material
  }

  // --- 2D overlays: film pass, weapon viewmodel, mugshot, automap ---
  function drawOverlays(now: number) {
    const world = worldRef.current
    const art = artRef.current

    const filmCanvas = filmCanvasRef.current
    const grain = grainRef.current
    if (filmCanvas && grain && now - lastFilmDrawRef.current > 80) {
      lastFilmDrawRef.current = now
      const ctx = filmCanvas.getContext('2d')
      if (ctx) {
        drawPostFrame(ctx, grain, filmCanvas.width, filmCanvas.height, POST_PRESETS[filmRef.current])
      }
    }

    if (screenRef.current !== 'playing' || !world || !art) {
      return
    }

    // Weapon viewmodel with doom bob.
    const weaponCanvas = weaponCanvasRef.current
    if (weaponCanvas) {
      const ctx = weaponCanvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, VIEW_W, VIEW_H)
        if (!world.player.dead) {
          const set = art.viewmodels[world.player.weapon]
          const firing = now < world.player.muzzleUntil
          const variant = Math.floor(now / 100) % 2
          const speed = Math.hypot(world.player.momentum.x, world.player.momentum.z)
          const bobAmt = Math.min(18, speed * speed * 0.18)
          const bobX = firing ? 0 : Math.cos(world.time * 3.4) * bobAmt
          const bobY = firing ? 0 : Math.abs(Math.sin(world.time * 3.4)) * bobAmt * 0.6
          ctx.drawImage(set[firing ? 'fire' : 'idle'][variant], bobX, bobY + 8)
        }
      }
    }

    // Mugshot.
    const mugCanvas = mugCanvasRef.current
    if (mugCanvas) {
      const ctx = mugCanvas.getContext('2d')
      if (ctx) {
        const player = world.player
        const tier = mugTierForHp(player.vitals.hp, player.vitals.maxHp)
        let expression: MugExpression = 'idle'
        if (player.dead) {
          expression = 'dead'
        } else if (now < player.painUntil) {
          expression = 'pain'
        } else if (now < player.grinUntil) {
          expression = 'grin'
        }
        const looker = mugLookRef.current
        if (now > looker.nextAt) {
          looker.look = [-1, 0, 1][Math.floor(Math.random() * 3)]
          looker.nextAt = now + 600 + Math.random() * 900
        }
        const look = expression === 'idle' ? looker.look : 0
        const key = `${tier}-${expression}-${look}`
        let cached = mugCacheRef.current.get(key)
        if (!cached) {
          cached = drawMugshot(tier, expression, look)
          mugCacheRef.current.set(key, cached)
        }
        ctx.clearRect(0, 0, mugCanvas.width, mugCanvas.height)
        ctx.drawImage(cached, 0, 0)
      }
    }

    // Automap, throttled: cell-grid maps do not need 60Hz.
    const automap = automapRef.current
    if (automap) {
      const show = automapHeldRef.current && !world.player.dead
      automap.style.display = show ? 'block' : 'none'
      if (show && now - lastAutomapDrawRef.current > 100) {
        lastAutomapDrawRef.current = now
        drawAutomap(automap, world)
      }
    }
  }

  function drawAutomap(canvas: HTMLCanvasElement, world: World) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    const size = 440
    if (canvas.width !== size) {
      canvas.width = size
      canvas.height = size
    }
    ctx.fillStyle = 'rgba(12, 12, 12, 0.88)'
    ctx.fillRect(0, 0, size, size)
    const radius = world.config.automapRadius
    const scale = size / (radius * 2)
    const pgx = worldToCell(world.player.pos.x)
    const pgz = worldToCell(world.player.pos.z)
    for (let dz = -radius; dz < radius; dz++) {
      for (let dx = -radius; dx < radius; dx++) {
        const gx = pgx + dx
        const gz = pgz + dz
        if (!world.visited.has(`${gx},${gz}`)) {
          continue
        }
        const cell = cellAtGlobal(getChunk, gx, gz)
        if (cell === CELL_SOLID) {
          ctx.fillStyle = '#4a4741'
        } else if (cell === CELL_DOOR) {
          ctx.fillStyle = '#8f8a80'
        } else if (cell === CELL_VAULT_DOOR) {
          ctx.fillStyle = '#f4f1e8'
        } else {
          ctx.fillStyle = '#22211e'
        }
        ctx.fillRect((dx + radius) * scale, (dz + radius) * scale, Math.ceil(scale), Math.ceil(scale))
      }
    }
    if (world.config.bloodhound) {
      ctx.fillStyle = '#f4f1e8'
      for (const [, pickup] of world.pickups) {
        const dx = worldToCell(pickup.pos.x) - pgx
        const dz = worldToCell(pickup.pos.z) - pgz
        if (Math.abs(dx) < radius && Math.abs(dz) < radius) {
          ctx.beginPath()
          ctx.arc((dx + radius) * scale + scale / 2, (dz + radius) * scale + scale / 2, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    // Player arrow.
    ctx.save()
    ctx.translate(size / 2, size / 2)
    ctx.rotate(-world.player.yaw)
    ctx.fillStyle = '#f4f1e8'
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.lineTo(5, 6)
    ctx.lineTo(-5, 6)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // ================= RENDER =================

  const filmSettings = POST_PRESETS[film]
  const world = worldRef.current

  const settingsRow = (
    <div className="title-settings">
      <label>
        Style:{' '}
        <select value={film} onChange={(e) => changeFilm(e.target.value as PostPreset)} data-testid="style-select">
          <option value="clean">Clean</option>
          <option value="playful">Playful</option>
          <option value="retro">Retro</option>
        </select>
      </label>
      <button type="button" className="ghost" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
        {muted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  )

  return (
    <div className="game-shell">
      <div
        ref={mountRef}
        className="render-root"
        data-testid="render-root"
        style={{ filter: plasticFilter(filmSettings) }}
      />
      <canvas ref={filmCanvasRef} className="post-overlay" data-testid="post-overlay" />

      {screen === 'playing' && (
        <>
          <div
            className="damage-flash"
            data-testid="damage-flash"
            style={{ opacity: world ? Math.min(0.75, world.player.damageFlash) : 0 }}
            hidden={!world || world.player.damageFlash <= 0.01}
          />
          <div
            className="pickup-flash"
            style={{ opacity: world ? Math.min(0.25, world.player.pickupFlash * 0.25) : 0 }}
          />
          <div className="crosshair" data-testid="crosshair" />
          <canvas ref={weaponCanvasRef} width={VIEW_W} height={VIEW_H} className="weapon-canvas" data-testid="weapon-canvas" />
          <canvas ref={automapRef} className="automap" data-testid="automap" style={{ display: 'none' }} />
          {isTouch && !paused && (
            <div className="touch-layer" data-testid="touch-controls">
              <TouchStickLayer sticks={touchSticksRef.current} repaintRef={stickRepaintRef} />
              <div className="touch-topbar">
                <button
                  type="button"
                  className="touch-btn touch-small"
                  aria-pressed={mapOn}
                  data-testid="touch-map"
                  onClick={() => setAutomap(!automapHeldRef.current)}
                >
                  MAP
                </button>
                <button
                  type="button"
                  className="touch-btn touch-small"
                  data-testid="touch-pause"
                  aria-label="Pause"
                  onClick={() => setPaused(true)}
                >
                  ||
                </button>
              </div>
              <button type="button" className="touch-btn touch-use" data-testid="touch-use" onClick={() => tryUseDoor()}>
                USE
              </button>
              <button
                type="button"
                className="touch-btn touch-fire"
                data-testid="touch-fire"
                onPointerDown={(e) => {
                  e.preventDefault()
                  startFire()
                }}
                onPointerUp={stopFire}
                onPointerLeave={stopFire}
                onPointerCancel={stopFire}
                onContextMenu={(e) => e.preventDefault()}
              >
                FIRE
              </button>
            </div>
          )}
          {hud && (
            <div className="hud" data-testid="hud">
              <div className="hud-cell hud-ammo">
                <span className="hud-big" data-testid="hud-ammo">
                  {hud.ammoInWeapon === null ? '-' : hud.ammoInWeapon}
                </span>
                <span className="hud-label">AMMO</span>
              </div>
              <div className="hud-cell hud-health">
                <span className="hud-big" data-testid="hud-health">
                  {hud.hp}%
                </span>
                <span className="hud-label">HEALTH</span>
              </div>
              <div className="hud-cell hud-slots">
                <div className="slot-row">
                  {WEAPON_ORDER.map((id) => (
                    <button
                      type="button"
                      key={id}
                      className={`slot ${hud.owned.includes(id) ? 'owned' : ''} ${hud.weapon === id ? 'current' : ''}`}
                      disabled={!hud.owned.includes(id)}
                      data-testid={`slot-${id}`}
                      onClick={() => switchWeapon(id)}
                    >
                      {WEAPONS[id].slot}
                    </button>
                  ))}
                </div>
                <span className="hud-label">{WEAPONS[hud.weapon].name}</span>
              </div>
              <div className="hud-mug">
                <canvas ref={mugCanvasRef} width={96} height={96} data-testid="mugshot" />
              </div>
              <div className="hud-cell hud-armor">
                <span className="hud-big" data-testid="hud-armor">
                  {hud.armor}%
                </span>
                <span className="hud-label">ARMOR</span>
              </div>
              <div className="hud-cell hud-studs">
                <span className="hud-big" data-testid="hud-studs">
                  {hud.studs}
                </span>
                <span className="hud-label">STUDS</span>
              </div>
              <div className="hud-cell hud-depth">
                <span className="hud-big" data-testid="hud-depth">
                  {hud.ring}
                </span>
                <span className="hud-label">DEPTH{hud.hasKey ? ' [KEY]' : ''}</span>
              </div>
            </div>
          )}
        </>
      )}

      {screen === 'title' && (
        <div className="screen title-screen" data-testid="title-screen">
          <div className="title-card">
            <p className="title-over">a box of bricks presents</p>
            <h1 className="title-main">LETGO</h1>
            <p className="title-sub">an endless brick dungeon</p>
            <p className="title-tag">
              The dungeon rebuilds itself around you and everything in it wants you in pieces. Dive in, grab studs,
              get smashed, build back stronger.
            </p>
            <div className="title-buttons">
              <button type="button" className="start-run" onClick={startRun} data-testid="start-run">
                New Run
              </button>
              <button type="button" className="ghost" onClick={() => setScreen('workshop')} data-testid="go-office">
                The Workshop
              </button>
            </div>
            {settingsRow}
            <p className="controls-hint">
              {isTouch
                ? 'Left thumb moves. Right thumb aims, tap to shoot. Hold FIRE to spray. USE opens doors.'
                : 'WASD move. Mouse aim. Click shoot. E opens doors. Tab holds the map. 1-7 swap bricks.'}
            </p>
          </div>
        </div>
      )}

      {screen === 'dead' && summary && (
        <div className="screen death-screen" data-testid="death-screen">
          <div className="title-card">
            <h1 className="death-title">IN PIECES</h1>
            <div className="death-summary" data-testid="run-summary">
              <div>
                <span className="hud-big">{summary.ring}</span>
                <span className="hud-label">depth reached</span>
              </div>
              <div>
                <span className="hud-big">{summary.kills}</span>
                <span className="hud-label">monsters smashed</span>
              </div>
              <div>
                <span className="hud-big">{summary.studs}</span>
                <span className="hud-label">studs collected</span>
              </div>
              <div>
                <span className="hud-big">{summary.seconds}s</span>
                <span className="hud-label">in the dungeon</span>
              </div>
            </div>
            <p className="title-tag">Your studs made it back to the Workshop. You, in a bin of loose parts.</p>
            <button type="button" className="start-run" onClick={() => setScreen('workshop')} data-testid="back-to-office">
              Back to the Workshop
            </button>
          </div>
        </div>
      )}

      {screen === 'workshop' && <WorkshopScreen meta={meta} onMetaChange={saveMeta} onStartRun={startRun} />}

      {screen === 'playing' && paused && (
        <div className="screen pause-screen" data-testid="pause-menu">
          <div className="title-card">
            <h1>PAUSED</h1>
            <div className="title-buttons">
              <button
                type="button"
                className="start-run"
                onClick={(e) => {
                  setPaused(false)
                  // Touch taps resume without pointer lock; mouse and
                  // keyboard activation re-grab it.
                  if ((e.nativeEvent as PointerEvent).pointerType !== 'touch') {
                    mountRef.current?.querySelector('canvas')?.requestPointerLock()
                  }
                }}
              >
                Resume
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setPaused(false)
                  const w = worldRef.current
                  if (w) {
                    w.player.vitals = { ...w.player.vitals, hp: 0 }
                    killPlayer(performance.now())
                  }
                }}
                data-testid="call-it-a-night"
              >
                Pack It Up
              </button>
            </div>
            {settingsRow}
          </div>
        </div>
      )}
    </div>
  )
}

// Renders the live stick visuals in isolation: the touch handlers poke
// repaintRef (rAF-coalesced) so drags re-render these two nodes instead of
// the whole game component.
function TouchStickLayer({
  sticks,
  repaintRef
}: {
  sticks: TouchSticks
  repaintRef: { current: (() => void) | null }
}) {
  const [, repaint] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    repaintRef.current = repaint
    return () => {
      repaintRef.current = null
    }
  }, [repaintRef])
  return (
    <>
      {sticks.move.active && <StickVisual stick={sticks.move} label="MOVE" />}
      {sticks.look.active && <StickVisual stick={sticks.look} label="AIM" />}
    </>
  )
}

function StickVisual({ stick, label }: { stick: JoystickState; label: string }) {
  // Phantom (0, 0) pointerdown guard (pre-reboot F-005): never draw a
  // stick anchored at the exact screen corner.
  if (isPhantomOrigin(stick)) {
    return null
  }
  const v = readJoystick(stick)
  return (
    <>
      <div
        className="touch-stick"
        style={{ left: stick.originX - JOYSTICK_RADIUS, top: stick.originY - JOYSTICK_RADIUS }}
      >
        <span>{label}</span>
      </div>
      <div
        className="touch-knob"
        style={{
          left: stick.originX + v.x * JOYSTICK_RADIUS - 20,
          top: stick.originY + v.y * JOYSTICK_RADIUS - 20
        }}
      />
    </>
  )
}

function setupSceneBasics(scene: THREE.Scene) {
  // A bright toy-box interior: light haze in the distance, punchy fill light
  // so the molded plastic keeps its saturation.
  scene.background = new THREE.Color(0x243247)
  scene.fog = new THREE.Fog(0x243247, 8, 42)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9fb2c9, 1.5)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xfff4d8, 0.75)
  dir.position.set(0.6, 1, 0.35)
  scene.add(dir)
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
}
