import { useEffect, useMemo, useState } from 'react';

const SAVE_KEY = 'cyberpunk_syndicate_wars_v1';

const missionDefs = [
  {
    id: 'ghostScan',
    name: 'Ghost Scan',
    description: 'Sweep abandoned districts for forgotten caches of stolen data.',
    reward: 45,
    heat: 8,
    risk: 6,
    cooldown: 12,
    tag: 'Fast'
  },
  {
    id: 'relayHijack',
    name: 'Relay Hijack',
    description: 'Redirect encrypted traffic through compromised relay nodes.',
    reward: 90,
    heat: 16,
    risk: 12,
    cooldown: 18,
    tag: 'Risk'
  },
  {
    id: 'vaultDrill',
    name: 'Vault Drill',
    description: 'Break into a blacksite vault and extract encrypted funding records.',
    reward: 180,
    heat: 24,
    risk: 18,
    cooldown: 28,
    tag: 'High'
  },
  {
    id: 'droneRaid',
    name: 'Drone Raid',
    description: 'Deploy strike drones to sabotage hostile infrastructure.',
    reward: 260,
    heat: 30,
    risk: 24,
    cooldown: 40,
    tag: 'Heavy'
  }
];

const upgradeDefs = [
  {
    id: 'relay',
    name: 'Relay Mesh',
    description: 'Build a passive network of rogue relays that collect traffic.',
    baseCost: 70,
    scale: 1.55,
    income: 6,
    heatOffset: -1
  },
  {
    id: 'cloak',
    name: 'Ghost Cloak',
    description: 'Mask your node signature and reduce incoming threat pressure.',
    baseCost: 95,
    scale: 1.6,
    signal: 12,
    heatOffset: -4
  },
  {
    id: 'firewall',
    name: 'Adaptive Firewall',
    description: 'Hardens the node against breaches and keeps integrity stable.',
    baseCost: 140,
    scale: 1.7,
    integrity: 12,
    heatOffset: -2
  },
  {
    id: 'drones',
    name: 'Strike Drones',
    description: 'Launch autonomous units that harvest data and strike intruders.',
    baseCost: 220,
    scale: 1.8,
    income: 18,
    heatOffset: 2
  },
  {
    id: 'core',
    name: 'Blacksite Core',
    description: 'Upgrade your central node into a premium extraction engine.',
    baseCost: 360,
    scale: 1.92,
    income: 30,
    signal: 16,
    integrity: 20
  }
];

const defaultState = {
  balance: 120,
  incomeRate: 6,
  signal: 100,
  heat: 12,
  integrity: 100,
  reputation: 0,
  wave: 1,
  lastTick: Date.now(),
  cooldowns: {},
  upgrades: {
    relay: 0,
    cloak: 0,
    firewall: 0,
    drones: 0,
    core: 0
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatMoney(value) {
  const num = Math.floor(value);
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
  return `$${num}`;
}

function getUpgradeCost(def, upgrades) {
  return Math.round(def.baseCost * Math.pow(def.scale, upgrades[def.id] || 0));
}

function getIncomeRate(state) {
  let rate = state.incomeRate || 0;

  for (const def of upgradeDefs) {
    const level = state.upgrades[def.id] || 0;
    if (def.income) rate += def.income * level;
  }

  return rate;
}

function getThreatLevel(heat, wave) {
  const threat = heat + wave * 8;
  if (threat < 30) return 'Stable';
  if (threat < 55) return 'Pressed';
  if (threat < 75) return 'Critical';
  return 'Overrun';
}

function loadState() {
  try {
    const stored = localStorage.getItem(SAVE_KEY);
    if (!stored) return { ...defaultState };

    const parsed = JSON.parse(stored);
    return {
      ...defaultState,
      ...parsed,
      upgrades: {
        ...defaultState.upgrades,
        ...(parsed.upgrades || {})
      },
      cooldowns: parsed.cooldowns || {}
    };
  } catch (error) {
    return { ...defaultState };
  }
}

function App() {
  const [state, setState] = useState(loadState);
  const [activeTab, setActiveTab] = useState('node');

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setHeaderColor('#080b14');
    tg.setBackgroundColor('#080b14');
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const now = Date.now();
        const dt = (now - (prev.lastTick || now)) / 1000 || 0.25;

        const currentIncome = getIncomeRate(prev);
        let balance = prev.balance + currentIncome * dt;
        let heat = clamp(
          prev.heat + (prev.wave * 0.15 * dt) - (prev.upgrades.cloak || 0) * 0.35 * dt,
          0,
          100
        );

        let signal = prev.signal;
        let integrity = prev.integrity;

        if (heat > 60) {
          signal = clamp(signal - ((heat - 60) * 0.08 * dt), 0, 100);
          integrity = clamp(integrity - ((heat - 55) * 0.09 * dt), 0, 100);
        } else {
          signal = clamp(signal + 0.35 * dt, 0, 100);
          if (integrity < 100) {
            integrity = clamp(integrity + 0.8 * dt, 0, 100);
          }
        }

        if (integrity <= 0) {
          balance = Math.max(0, balance * 0.7);
          heat = Math.max(15, heat - 25);
          signal = 70;
          integrity = 100;
        }

        if (Math.random() < 0.012 * dt * prev.wave) {
          heat = clamp(heat + 2.4, 0, 100);
        }

        return {
          ...prev,
          balance,
          heat,
          signal,
          integrity,
          incomeRate: currentIncome,
          lastTick: now
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const missions = useMemo(() => missionDefs, []);
  const upgrades = useMemo(() => upgradeDefs, []);

  const threat = getThreatLevel(state.heat, state.wave);

  const runMission = (missionId) => {
    const mission = missionDefs.find((item) => item.id === missionId);
    if (!mission) return;

    const now = Date.now();
    const cooldownEnd = state.cooldowns[missionId] || 0;
    if (cooldownEnd > now) return;

    setState((prev) => {
      const reward = mission.reward + prev.wave * 8 + prev.reputation * 0.25;
      const nextCooldowns = { ...prev.cooldowns, [missionId]: now + mission.cooldown * 1000 };
      const nextHeat = clamp(prev.heat + mission.heat, 0, 100);
      const nextIntegrity = clamp(prev.integrity - mission.risk, 0, 100);
      const nextSignal = clamp(prev.signal - Math.floor(mission.risk / 3), 0, 100);

      return {
        ...prev,
        balance: prev.balance + reward,
        heat: nextHeat,
        integrity: nextIntegrity,
        signal: nextSignal,
        wave: prev.wave + 1,
        reputation: prev.reputation + 2 + Math.floor(mission.reward / 35),
        cooldowns: nextCooldowns
      };
    });
  };

  const buyUpgrade = (upgradeId) => {
    const def = upgradeDefs.find((item) => item.id === upgradeId);
    if (!def) return;

    const cost = getUpgradeCost(def, state.upgrades);
    if (state.balance < cost) return;

    setState((prev) => {
      const nextUpgrades = {
        ...prev.upgrades,
        [upgradeId]: (prev.upgrades[upgradeId] || 0) + 1
      };

      let nextSignal = prev.signal;
      let nextIntegrity = prev.integrity;
      let nextHeat = prev.heat;

      if (def.signal) nextSignal = clamp(prev.signal + def.signal, 0, 100);
      if (def.integrity) nextIntegrity = clamp(prev.integrity + def.integrity, 0, 100);
      if (def.heatOffset) nextHeat = clamp(prev.heat + def.heatOffset, 0, 100);

      return {
        ...prev,
        balance: prev.balance - cost,
        signal: nextSignal,
        integrity: nextIntegrity,
        heat: nextHeat,
        incomeRate: getIncomeRate({ ...prev, upgrades: nextUpgrades }),
        upgrades: nextUpgrades
      };
    });
  };

  const threatBadgeClass = (() => {
    switch (threat) {
      case 'Stable':
        return 'badge stable';
      case 'Pressed':
        return 'badge warn';
      case 'Critical':
        return 'badge critical';
      default:
        return 'badge danger';
    }
  })();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand">Syndicate Wars</div>
          <div className={threatBadgeClass}>{threat}</div>
        </div>

        <div className="top-stats">
          <div className="stat-card">
            <span className="label">Credits</span>
            <strong className="value green">{formatMoney(state.balance)}</strong>
          </div>
          <div className="stat-card">
            <span className="label">Income/sec</span>
            <strong className="value blue">{getIncomeRate(state).toFixed(1)}</strong>
          </div>
          <div className="stat-card">
            <span className="label">Heat</span>
            <strong className="value yellow">{Math.round(state.heat)}%</strong>
          </div>
          <div className="stat-card">
            <span className="label">Integrity</span>
            <strong className="value pink">{Math.round(state.integrity)}%</strong>
          </div>
        </div>
      </header>

      <main className="content">
        <section className={activeTab === 'node' ? 'panel active' : 'panel'}>
          <div className="section-title">Node Status</div>

          <div className="core-wrap">
            <div className="core-ring">
              <div className="core-inner">CPU</div>
            </div>
          </div>

          <div className="meters">
            <div className="meter">
              <div className="meter-head">
                <span>Signal</span>
                <span>{Math.round(state.signal)}%</span>
              </div>
              <div className="meter-bar">
                <div className="meter-fill" style={{ width: `${state.signal}%` }} />
              </div>
            </div>

            <div className="meter">
              <div className="meter-head">
                <span>Heat</span>
                <span>{Math.round(state.heat)}%</span>
              </div>
              <div className="meter-bar">
                <div className="meter-fill warn" style={{ width: `${state.heat}%` }} />
              </div>
            </div>

            <div className="meter">
              <div className="meter-head">
                <span>Integrity</span>
                <span>{Math.round(state.integrity)}%</span>
              </div>
              <div className="meter-bar">
                <div className="meter-fill accent" style={{ width: `${state.integrity}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className={activeTab === 'ops' ? 'panel active' : 'panel'}>
          <div className="section-title">Operations</div>
          <div className="card-list">
            {missions.map((mission) => {
              const cooldownMs = (state.cooldowns[mission.id] || 0) - Date.now();
              const ready = cooldownMs <= 0;

              return (
                <div className="card" key={mission.id}>
                  <div className="card-head">
                    <div className="card-name">{mission.name}</div>
                    <span className={`tag ${mission.tag === 'Fast' ? '' : 'warn'}`}>{mission.tag}</span>
                  </div>
                  <div className="card-copy">{mission.description}</div>
                  <div className="card-foot">
                    <span className="reward">Reward: {formatMoney(mission.reward)}</span>
                    <button
                      className="action-btn secondary"
                      onClick={() => runMission(mission.id)}
                      disabled={!ready}
                    >
                      {ready ? 'Run' : `${Math.ceil(cooldownMs / 1000)}s`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={activeTab === 'arsenal' ? 'panel active' : 'panel'}>
          <div className="section-title">Arsenal / Upgrades</div>
          <div className="card-list">
            {upgrades.map((upgrade) => {
              const level = state.upgrades[upgrade.id] || 0;
              const cost = getUpgradeCost(upgrade, state.upgrades);
              const canAfford = state.balance >= cost;

              return (
                <div className="card" key={upgrade.id}>
                  <div className="card-head">
                    <div className="card-name">{upgrade.name}</div>
                    <span className="tag pink">Lv {level}</span>
                  </div>
                  <div className="card-copy">{upgrade.description}</div>
                  <div className="card-foot">
                    <span className="reward">Cost: {formatMoney(cost)}</span>
                    <button
                      className="action-btn"
                      onClick={() => buyUpgrade(upgrade.id)}
                      disabled={!canAfford}
                    >
                      Upgrade
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <nav className="bottom-nav">
        <button className={activeTab === 'node' ? 'nav-btn active' : 'nav-btn'} onClick={() => setActiveTab('node')}>
          <span className="nav-icon">◉</span>
          <span>Node</span>
        </button>
        <button className={activeTab === 'ops' ? 'nav-btn active' : 'nav-btn'} onClick={() => setActiveTab('ops')}>
          <span className="nav-icon">✦</span>
          <span>Ops</span>
        </button>
        <button className={activeTab === 'arsenal' ? 'nav-btn active' : 'nav-btn'} onClick={() => setActiveTab('arsenal')}>
          <span className="nav-icon">▣</span>
          <span>Arsenal</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
