'use client'

// The Workshop: the between-runs hub. Three counters, Rogue Legacy style:
// the Build Plan (permanent stat tree with fog of war), the Armory (weapon
// unlocks and tiers), and the Tinkerer (one-run gadgets).

import { useMemo, useState } from 'react'
import {
  BOARD_NODES,
  RELICS,
  WEAPON_TIER_DAMAGE_PER_TIER,
  WEAPON_TIER_MAX,
  armoryUnlocked,
  fenceUnlocked,
  keepFraction,
  nodeCost,
  nodeNeighbors,
  nodeRank,
  purchaseNode,
  purchaseRelic,
  purchaseWeapon,
  purchaseWeaponTier,
  visibleNodes,
  weaponTierCost,
  weaponUnlockCost,
  type ArmoryWeapon,
  type MetaState,
  type RelicId
} from '@/game/meta'
import { WEAPONS, WEAPON_ORDER } from '@/game/weapons'

type Tab = 'board' | 'armory' | 'fence'

export type WorkshopScreenProps = {
  meta: MetaState
  onMetaChange: (meta: MetaState) => void
  onStartRun: () => void
}

const CELL = 132
const GAP = 18

export function WorkshopScreen({ meta, onMetaChange, onStartRun }: WorkshopScreenProps) {
  const [tab, setTab] = useState<Tab>('board')
  const visible = useMemo(() => visibleNodes(meta), [meta])
  const keep = keepFraction(meta)

  // Apply a purchase result; null means refused (hidden or unaffordable).
  const apply = (next: MetaState | null) => {
    if (next) {
      onMetaChange(next)
    }
  }

  return (
    <div className="office" data-testid="workshop-screen">
      <header className="office-header">
        <div>
          <h1>The Workshop</h1>
          <p className="office-sub">Build #{meta.totalDeaths + 1}. Snap on some upgrades and dive back in.</p>
        </div>
        <div className="office-wallet" data-testid="workshop-studs">
          <span className="wallet-amount">{meta.studs}</span>
          <span className="wallet-label">studs</span>
        </div>
      </header>

      <nav className="office-tabs">
        <button type="button" className={tab === 'board' ? 'tab active' : 'tab'} onClick={() => setTab('board')}>
          Build Plan
        </button>
        <button
          type="button"
          className={tab === 'armory' ? 'tab active' : 'tab'}
          onClick={() => setTab('armory')}
          data-testid="tab-armory"
        >
          Armory {armoryUnlocked(meta) ? '' : '(locked)'}
        </button>
        <button
          type="button"
          className={tab === 'fence' ? 'tab active' : 'tab'}
          onClick={() => setTab('fence')}
          data-testid="tab-fence"
        >
          The Tinkerer {fenceUnlocked(meta) ? '' : '(locked)'}
        </button>
      </nav>

      <div className="office-body">
        {tab === 'board' && (
          <div className="case-board" data-testid="build-plan">
            <svg className="board-strings" width={5 * (CELL + GAP)} height={4 * (CELL + GAP)}>
              {BOARD_NODES.flatMap((node) =>
                nodeNeighbors(node)
                  .filter(
                    (other) =>
                      (other.x > node.x || other.y > node.y) && visible.has(node.id) && visible.has(other.id)
                  )
                  .map((other) => (
                  <line
                    key={`${node.id}-${other.id}`}
                    x1={node.x * (CELL + GAP) + CELL / 2}
                    y1={node.y * (CELL + GAP) + CELL / 2}
                    x2={other.x * (CELL + GAP) + CELL / 2}
                    y2={other.y * (CELL + GAP) + CELL / 2}
                    className="board-string"
                  />
                  ))
              )}
            </svg>
            {BOARD_NODES.map((node) => {
              if (!visible.has(node.id)) {
                return (
                  <div
                    key={node.id}
                    className="board-node hidden-node"
                    style={{ left: node.x * (CELL + GAP), top: node.y * (CELL + GAP) }}
                  >
                    <span>?</span>
                  </div>
                )
              }
              const rank = nodeRank(meta, node.id)
              const cost = nodeCost(meta, node.id)
              const maxed = cost === null
              const affordable = cost !== null && meta.studs >= cost
              return (
                <div
                  key={node.id}
                  className={`board-node ${rank > 0 ? 'owned' : ''}`}
                  style={{ left: node.x * (CELL + GAP), top: node.y * (CELL + GAP) }}
                >
                  <h3>{node.name}</h3>
                  <p>{node.flavor}</p>
                  <div className="node-rank">
                    {rank}/{node.maxRank}
                  </div>
                  {!maxed && (
                    <button
                      type="button"
                      className="buy"
                      disabled={!affordable}
                      onClick={() => apply(purchaseNode(meta, node.id))}
                      data-testid={`buy-${node.id}`}
                    >
                      {cost}
                    </button>
                  )}
                  {maxed && <div className="node-maxed">MAX</div>}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'armory' &&
          (armoryUnlocked(meta) ? (
            <div className="shop-grid" data-testid="armory">
              {WEAPON_ORDER.filter((id) => id !== 'claws').map((id) => {
                const def = WEAPONS[id]
                const owned = meta.weaponsUnlocked.includes(id)
                const tier = meta.weaponTiers[id] ?? 0
                const unlockCost = id === 'studgun' ? null : weaponUnlockCost(meta, id as ArmoryWeapon)
                const tCost = tier < WEAPON_TIER_MAX ? weaponTierCost(meta, id, tier) : null
                return (
                  <div key={id} className={`shop-card ${owned ? 'owned' : ''}`}>
                    <h3>{def.name}</h3>
                    <p className="card-sub">Slot {def.slot}</p>
                    {!owned && unlockCost !== null && (
                      <button
                        type="button"
                        className="buy"
                        disabled={meta.studs < unlockCost}
                        onClick={() => apply(purchaseWeapon(meta, id as ArmoryWeapon))}
                        data-testid={`unlock-${id}`}
                      >
                        Unlock {unlockCost}
                      </button>
                    )}
                    {owned && (
                      <>
                        <div className="node-rank">Tier {tier}/{WEAPON_TIER_MAX}</div>
                        {tCost !== null ? (
                          <button
                            type="button"
                            className="buy"
                            disabled={meta.studs < tCost}
                            onClick={() => apply(purchaseWeaponTier(meta, id))}
                          >
                            +{Math.round(WEAPON_TIER_DAMAGE_PER_TIER * 100)}% damage: {tCost}
                          </button>
                        ) : (
                          <div className="node-maxed">MAX</div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="locked-note">Buy the Parts Bin on the Build Plan to open the Armory.</p>
          ))}

        {tab === 'fence' &&
          (fenceUnlocked(meta) ? (
            <div className="shop-grid" data-testid="fence">
              {RELICS.map((relic) => {
                const owned = meta.relics.includes(relic.id)
                return (
                  <div key={relic.id} className={`shop-card ${owned ? 'owned' : ''}`}>
                    <h3>{relic.name}</h3>
                    <p className="card-sub">{relic.flavor}</p>
                    {owned ? (
                      <div className="node-maxed">PACKED</div>
                    ) : (
                      <button
                        type="button"
                        className="buy"
                        disabled={meta.studs < relic.cost}
                        onClick={() => apply(purchaseRelic(meta, relic.id as RelicId))}
                        data-testid={`relic-${relic.id}`}
                      >
                        {relic.cost}
                      </button>
                    )}
                  </div>
                )
              })}
              <p className="fence-note">Gadgets are next-run only. Once you dive in, they snap into place.</p>
            </div>
          ) : (
            <p className="locked-note">Buy The Tinkerer on the Build Plan to see the gadgets.</p>
          ))}
      </div>

      <footer className="office-footer">
        <div className="rent-warning" data-testid="rent-warning">
          {keep >= 1
            ? 'Your storage is airtight. Every last stud comes along.'
            : keep > 0
              ? `The cleanup crew is waiting. You keep ${Math.round(keep * 100)}% of unspent studs when you dive in.`
              : 'The cleanup crew is waiting. Unspent studs get swept up when you dive in. Spend them.'}
        </div>
        <button type="button" className="start-run" onClick={onStartRun} data-testid="hit-the-streets">
          Dive In
        </button>
      </footer>
    </div>
  )
}
