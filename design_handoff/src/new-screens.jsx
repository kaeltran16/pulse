// New screens: Weekly Review, Subscriptions, Streak Celebration, Evening Close-Out

// ─── Weekly Review ─────────────────────────────────────────
// A Sunday ritual. Pal-generated narrative recap of the week.
function WeeklyReviewScreen({ theme, onBack, onOpenPal }) {
  const wins = [
    { icon: 'figure.run', color: theme.move, title: '11-day move streak', sub: 'Longest in 3 months' },
    { icon: 'dollarsign.circle.fill', color: theme.money, title: '$160 under budget', sub: '$435 of $595' },
    { icon: 'sparkles', color: theme.rituals, title: 'Morning pages 6/7', sub: 'Missed only Saturday' },
  ];

  const patterns = [
    { text: <>Fridays cost you <b>2.8× an average day</b> — Verve + Tartine + dinner out.</>, color: theme.money },
    { text: <>You moved <b>73 min on ritual days</b> vs 42 min on skipped-ritual days.</>, color: theme.move },
    { text: <>Reading Pachinko averaged <b>28 min</b>, 3 nights this week.</>, color: theme.rituals },
  ];

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 40 }}>
      {/* Nav */}
      <div style={{ padding: '56px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: theme.accent, fontFamily: SF, fontSize: 17, padding: 6,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Icon name="chevron.left" size={18} /> Back
        </button>
        <NavIconButton name="square.and.arrow.up" theme={theme} />
      </div>

      {/* Hero */}
      <div style={{ padding: '4px 20px 16px' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, color: theme.accent, fontWeight: 700,
          letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
        }}>Weekly Review · Apr 17–23</div>
        <div style={{
          fontFamily: SF, fontSize: 30, fontWeight: 700, color: theme.ink,
          letterSpacing: -0.5, lineHeight: 1.15, marginBottom: 8,
        }}>Your steadiest week this month.</div>
        <div style={{
          fontFamily: SF, fontSize: 15, color: theme.ink3,
          letterSpacing: -0.24, lineHeight: 1.4,
        }}>Movement stayed consistent, rituals held together, and you came in under budget. Let's look closer.</div>
      </div>

      {/* Three-ring week summary */}
      <div style={{ margin: '0 16px 18px' }}>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: 18,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
        }}>
          {[
            { label: 'Spent',   value: '$435', sub: 'of $595', color: theme.money },
            { label: 'Moved',   value: '296',  sub: 'of 420 min', color: theme.move },
            { label: 'Rituals', value: '26',   sub: 'of 35',    color: theme.rituals },
          ].map(r => (
            <div key={r.label} style={{
              padding: 10, borderRadius: 12, background: `${r.color}14`,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{
                fontFamily: SF, fontSize: 11, fontWeight: 700,
                color: r.color, letterSpacing: 0.3, textTransform: 'uppercase',
              }}>{r.label}</div>
              <div style={{
                fontFamily: SFR, fontSize: 22, fontWeight: 700,
                color: theme.ink, letterSpacing: -0.3,
                fontVariantNumeric: 'tabular-nums',
              }}>{r.value}</div>
              <div style={{
                fontFamily: SF, fontSize: 11, color: theme.ink3,
                letterSpacing: -0.08,
              }}>{r.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Wins */}
      <div style={{ padding: '0 20px 8px' }}>
        <div style={{
          fontFamily: SF, fontSize: 22, fontWeight: 700,
          color: theme.ink, letterSpacing: 0.35, marginBottom: 10,
        }}>Wins</div>
      </div>
      <div style={{ margin: '0 16px 18px', background: theme.surface, borderRadius: 14, overflow: 'hidden' }}>
        {wins.map((w, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            borderBottom: i < wins.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: w.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={w.icon} size={16} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: SF, fontSize: 15, fontWeight: 600,
                color: theme.ink, letterSpacing: -0.24,
              }}>{w.title}</div>
              <div style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3,
                letterSpacing: -0.08, marginTop: 1,
              }}>{w.sub}</div>
            </div>
            <Icon name="checkmark" size={14} color={w.color} />
          </div>
        ))}
      </div>

      {/* Patterns */}
      <div style={{ padding: '0 20px 8px' }}>
        <div style={{
          fontFamily: SF, fontSize: 22, fontWeight: 700,
          color: theme.ink, letterSpacing: 0.35, marginBottom: 10,
        }}>Patterns</div>
      </div>
      <div style={{ margin: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {patterns.map((p, i) => (
          <div key={i} style={{
            background: theme.surface, borderRadius: 14,
            padding: '13px 14px', display: 'flex', gap: 12,
          }}>
            <div style={{
              width: 3, borderRadius: 2, background: p.color, flexShrink: 0,
            }} />
            <div style={{
              fontFamily: SF, fontSize: 15, color: theme.ink,
              letterSpacing: -0.24, lineHeight: 1.4,
            }}>{p.text}</div>
          </div>
        ))}
      </div>

      {/* One thing to try */}
      <div style={{ margin: '0 16px 18px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${theme.accent}12 0%, ${theme.rituals}12 100%)`,
          border: `0.5px solid ${theme.accent}33`,
          borderRadius: 18, padding: 18,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.rituals} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="sparkles" size={11} color="#fff" />
            </div>
            <span style={{
              fontFamily: SF, fontSize: 12, color: theme.ink3, fontWeight: 700,
              letterSpacing: 0.3, textTransform: 'uppercase',
            }}>One thing to try</span>
          </div>
          <div style={{
            fontFamily: SF, fontSize: 17, color: theme.ink,
            letterSpacing: -0.43, lineHeight: 1.4, marginBottom: 12,
          }}>
            Plan a grocery trip <b>Thursday evening</b> — your Friday splurges drop 60% the weeks you do.
          </div>
          <button onClick={() => onOpenPal && onOpenPal('Tell me more about my Friday spending')} style={{
            padding: '9px 14px', background: theme.accent,
            border: 'none', borderRadius: 100, cursor: 'pointer',
            fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#fff',
            letterSpacing: -0.15,
          }}>Ask Pal more</button>
        </div>
      </div>

      {/* Next week */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{
          fontFamily: SF, fontSize: 13, color: theme.ink3,
          letterSpacing: -0.08, textAlign: 'center',
        }}>Next review · Sunday, Apr 30</div>
      </div>
    </div>
  );
}

// ─── Subscriptions ─────────────────────────────────────────
const SUBSCRIPTIONS = [
  { name: 'Spotify',   cat: 'Music',   amount: 10.99, days: 2, icon: 'music.note', color: '#1DB954' },
  { name: 'Netflix',   cat: 'Video',   amount: 15.49, days: 5, icon: 'play.fill',  color: '#E50914' },
  { name: 'iCloud+',   cat: 'Storage', amount: 2.99,  days: 8, icon: 'tray.fill',  color: '#007AFF' },
  { name: 'NYT',       cat: 'News',    amount: 17.00, days: 12, icon: 'book.closed.fill', color: '#000000' },
  { name: 'Figma',     cat: 'Work',    amount: 15.00, days: 14, icon: 'square.grid.2x2.fill', color: '#F24E1E' },
  { name: 'Gym',       cat: 'Fitness', amount: 89.00, days: 19, icon: 'dumbbell.fill', color: '#FF6B35' },
  { name: 'ChatGPT',   cat: 'AI',      amount: 20.00, days: 23, icon: 'sparkles',   color: '#10A37F' },
];

function SubscriptionsScreen({ theme, onBack }) {
  const monthly = SUBSCRIPTIONS.reduce((s, x) => s + x.amount, 0);
  const yearly = monthly * 12;
  const nextUp = SUBSCRIPTIONS.slice().sort((a, b) => a.days - b.days)[0];

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      {/* Nav */}
      <div style={{ padding: '56px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: theme.accent, fontFamily: SF, fontSize: 17, padding: 6,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Icon name="chevron.left" size={18} /> Back
        </button>
        <NavIconButton name="plus" theme={theme} />
      </div>

      {/* Title */}
      <div style={{ padding: '4px 20px 14px' }}>
        <div style={{
          fontFamily: SF, fontWeight: 700, fontSize: 34,
          color: theme.ink, letterSpacing: 0.37, lineHeight: '41px',
        }}>Subscriptions</div>
        <div style={{
          fontFamily: SF, fontSize: 15, color: theme.ink3,
          marginTop: 2, letterSpacing: -0.24,
        }}>Auto-detected from your email</div>
      </div>

      {/* Monthly total card */}
      <div style={{ margin: '0 16px 18px' }}>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: 18,
        }}>
          <div style={{
            fontFamily: SF, fontSize: 12, color: theme.money, fontWeight: 700,
            letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 4,
          }}>Monthly</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: SFR, fontSize: 40, fontWeight: 700,
              color: theme.ink, letterSpacing: -0.8,
              fontVariantNumeric: 'tabular-nums',
            }}>${monthly.toFixed(2)}</span>
            <span style={{
              fontFamily: SF, fontSize: 14, color: theme.ink3,
              letterSpacing: -0.15,
            }}>· ${yearly.toFixed(0)}/yr</span>
          </div>
          {/* Stacked bar by category */}
          <div style={{
            marginTop: 14, height: 8, borderRadius: 4, overflow: 'hidden',
            display: 'flex', background: theme.fill,
          }}>
            {SUBSCRIPTIONS.map((s, i) => (
              <div key={i} style={{
                width: `${(s.amount / monthly) * 100}%`,
                background: s.color,
                borderRight: i < SUBSCRIPTIONS.length - 1 ? '1px solid white' : 'none',
              }} />
            ))}
          </div>
          <div style={{
            marginTop: 10, fontFamily: SF, fontSize: 13, color: theme.ink2,
            letterSpacing: -0.15, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="sparkles" size={13} color={theme.accent} />
            Next up: <b>{nextUp.name}</b> in {nextUp.days} days · ${nextUp.amount.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Upcoming list */}
      <div style={{ padding: '0 20px 8px' }}>
        <div style={{
          fontFamily: SF, fontSize: 22, fontWeight: 700,
          color: theme.ink, letterSpacing: 0.35, marginBottom: 10,
        }}>Upcoming</div>
      </div>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, overflow: 'hidden' }}>
        {SUBSCRIPTIONS.sort((a, b) => a.days - b.days).map((s, i, arr) => (
          <div key={s.name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', cursor: 'pointer',
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon name={s.icon} size={16} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: SF, fontSize: 15, fontWeight: 600,
                color: theme.ink, letterSpacing: -0.24,
              }}>{s.name}</div>
              <div style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3,
                letterSpacing: -0.08, marginTop: 1,
              }}>{s.cat} · in {s.days} {s.days === 1 ? 'day' : 'days'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink,
                letterSpacing: -0.15, fontVariantNumeric: 'tabular-nums',
              }}>${s.amount.toFixed(2)}</div>
              <div style={{
                fontFamily: SF, fontSize: 11, color: theme.ink4,
                letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 1,
              }}>/mo</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 20px', textAlign: 'center' }}>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: SF, fontSize: 14, color: theme.accent, letterSpacing: -0.15,
        }}>Scan email again</button>
      </div>
    </div>
  );
}

// ─── Streak Celebration ─────────────────────────────────────────
function StreakCelebrationScreen({ theme, onClose, onShare }) {
  // Radiating rays behind the big number
  return (
    <div style={{
      position: 'relative', minHeight: '100%',
      background: `radial-gradient(ellipse at 50% 38%, ${theme.move}33 0%, ${theme.bg} 60%)`,
      display: 'flex', flexDirection: 'column',
      paddingBottom: 40, overflow: 'hidden',
    }}>
      {/* Animated rays SVG */}
      <svg viewBox="0 0 390 500" style={{
        position: 'absolute', top: 80, left: 0, right: 0,
        width: '100%', height: 500, pointerEvents: 'none', opacity: 0.35,
      }}>
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30) * Math.PI / 180;
          const x2 = 195 + Math.cos(angle - Math.PI/2) * 280;
          const y2 = 250 + Math.sin(angle - Math.PI/2) * 280;
          return <line key={i} x1={195} y1={250} x2={x2} y2={y2}
            stroke={theme.move} strokeWidth={2} strokeLinecap="round" />;
        })}
      </svg>

      {/* Close */}
      <div style={{ padding: '56px 16px 0', position: 'relative', zIndex: 2 }}>
        <button onClick={onClose} style={{
          background: theme.fill, border: 'none', borderRadius: '50%',
          width: 32, height: 32, cursor: 'pointer', color: theme.ink3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="xmark" size={13} color={theme.ink3} />
        </button>
      </div>

      {/* Hero */}
      <div style={{ flex: 1, padding: '20px 24px 8px', position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, color: theme.move, fontWeight: 700,
          letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 24,
        }}>Streak unlocked</div>

        <div style={{
          fontFamily: SFR, fontSize: 140, fontWeight: 800,
          color: theme.move, letterSpacing: -4, lineHeight: 1,
          marginTop: 16,
          fontVariantNumeric: 'tabular-nums',
          textShadow: `0 4px 24px ${theme.move}44`,
        }}>11</div>
        <div style={{
          fontFamily: SFR, fontSize: 28, fontWeight: 700,
          color: theme.ink, letterSpacing: -0.5, marginTop: 4,
        }}>days moving</div>

        <div style={{
          fontFamily: SF, fontSize: 15, color: theme.ink2,
          letterSpacing: -0.24, lineHeight: 1.5, marginTop: 14,
          maxWidth: 300, margin: '14px auto 0',
        }}>You haven't missed a day since Apr 12.<br/>Your longest streak this year.</div>

        {/* Stats pills */}
        <div style={{
          marginTop: 22, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          {[
            { label: 'Total', value: '486 min' },
            { label: 'Best day', value: 'Sat · 75m' },
            { label: 'Next milestone', value: '14 days' },
          ].map(p => (
            <div key={p.label} style={{
              padding: '8px 12px', background: theme.surface,
              border: `0.5px solid ${theme.hair}`, borderRadius: 100,
              fontFamily: SF, fontSize: 12, color: theme.ink2,
              letterSpacing: -0.08,
            }}>
              <span style={{ color: theme.ink4, fontWeight: 500 }}>{p.label} · </span>
              <b style={{ color: theme.ink }}>{p.value}</b>
            </div>
          ))}
        </div>
      </div>

      {/* Shareable card preview */}
      <div style={{ padding: '20px 24px 0', position: 'relative', zIndex: 2 }}>
        <div style={{
          background: theme.surface, borderRadius: 20, padding: 18,
          boxShadow: `0 12px 40px rgba(0,0,0,0.08), 0 0 0 0.5px ${theme.hair}`,
          transform: 'rotate(-1.5deg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontFamily: SF, fontSize: 11, color: theme.move, fontWeight: 700,
                letterSpacing: 0.3, textTransform: 'uppercase',
              }}>Move streak</div>
              <div style={{
                fontFamily: SFR, fontSize: 44, fontWeight: 700, color: theme.ink,
                letterSpacing: -0.8, lineHeight: 1,
              }}>11 days</div>
              <div style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3,
                letterSpacing: -0.08, marginTop: 4,
              }}>@mira · ExpensePal</div>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 8px)', gridGap: 4,
            }}>
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: i < 11 ? theme.move : theme.fill,
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div style={{
        padding: '28px 20px 8px', position: 'relative', zIndex: 2,
        display: 'flex', gap: 10,
      }}>
        <button onClick={onShare} style={{
          flex: 1, padding: '14px 16px', background: theme.move,
          border: 'none', borderRadius: 14, cursor: 'pointer',
          fontFamily: SF, fontSize: 16, fontWeight: 600, color: '#fff',
          letterSpacing: -0.24,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icon name="square.and.arrow.up" size={16} color="#fff" /> Share
        </button>
        <button onClick={onClose} style={{
          flex: 1, padding: '14px 16px', background: theme.surface,
          border: `0.5px solid ${theme.hair}`, borderRadius: 14, cursor: 'pointer',
          fontFamily: SF, fontSize: 16, fontWeight: 600, color: theme.ink,
          letterSpacing: -0.24,
        }}>Keep going</button>
      </div>
    </div>
  );
}

// ─── Evening Close-Out ─────────────────────────────────────────
function EveningCloseOutScreen({ theme, onBack, onDone, onOpenPal }) {
  const [checked, setChecked] = React.useState({
    pages: true, inbox: true, spanish: true, read: true, reflect: false,
  });

  const items = [
    { id: 'pages',   icon: 'book.closed.fill',    title: 'Morning pages',    sub: '06:42 · 15 min', done: true },
    { id: 'inbox',   icon: 'tray.fill',           title: 'Inbox zero',       sub: '09:10 · 22 min', done: true },
    { id: 'spanish', icon: 'character.book.closed.fill', title: 'Spanish practice', sub: '14:20 · 18 min', done: true },
    { id: 'read',    icon: 'books.vertical.fill', title: 'Read · Pachinko',  sub: '21:30 · 28 min', done: true },
    { id: 'reflect', icon: 'moon.stars.fill',     title: 'Reflect on the day', sub: '5 min · tonight', done: false, active: true },
  ];

  const doneCount = Object.values(checked).filter(Boolean).length;
  const total = items.length;
  const toggle = id => setChecked(c => ({ ...c, [id]: !c[id] }));

  return (
    <div style={{
      background: `linear-gradient(180deg, #1a1340 0%, #2d1f5c 45%, #3d2a73 100%)`,
      minHeight: '100%', paddingBottom: 40, color: '#fff',
    }}>
      {/* Nav */}
      <div style={{ padding: '56px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
          width: 32, height: 32, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <Icon name="chevron.left" size={16} color="#fff" />
        </button>
        <div style={{
          fontFamily: SF, fontSize: 14, color: 'rgba(255,255,255,0.65)',
          letterSpacing: -0.15,
        }}>21:30 · Thursday</div>
        <div style={{ width: 32 }} />
      </div>

      {/* Hero */}
      <div style={{ padding: '28px 24px 18px' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
        <div style={{
          fontFamily: SFR, fontSize: 32, fontWeight: 700,
          color: '#fff', letterSpacing: -0.5, lineHeight: 1.15,
        }}>Close out<br/>your day.</div>
        <div style={{
          fontFamily: SF, fontSize: 15,
          color: 'rgba(255,255,255,0.65)', letterSpacing: -0.24,
          lineHeight: 1.5, marginTop: 10,
        }}>{doneCount} of {total} rituals done. One more to close the ring.</div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{
          height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.14)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${(doneCount / total) * 100}%`,
            background: '#BF5AF2',
            borderRadius: 3, transition: 'width 300ms ease',
          }} />
        </div>
      </div>

      {/* Checklist */}
      <div style={{ padding: '0 16px' }}>
        {items.map(it => {
          const isChecked = checked[it.id];
          const isActive = it.active && !isChecked;
          return (
            <button key={it.id} onClick={() => toggle(it.id)} style={{
              width: '100%', padding: '14px 16px', marginBottom: 8,
              background: isActive ? 'rgba(191,90,242,0.22)' : 'rgba(255,255,255,0.08)',
              border: isActive ? `0.5px solid rgba(191,90,242,0.5)` : `0.5px solid rgba(255,255,255,0.08)`,
              borderRadius: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
            }}>
              {/* Checkbox */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                border: isChecked ? 'none' : '1.5px solid rgba(255,255,255,0.4)',
                background: isChecked ? '#BF5AF2' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {isChecked && <Icon name="checkmark" size={12} color="#fff" />}
              </div>
              {/* Icon */}
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={it.icon} size={15} color="rgba(255,255,255,0.8)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 600,
                  color: isChecked ? 'rgba(255,255,255,0.55)' : '#fff',
                  letterSpacing: -0.24,
                  textDecoration: isChecked ? 'line-through' : 'none',
                }}>{it.title}</div>
                <div style={{
                  fontFamily: SF, fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: -0.08, marginTop: 1,
                }}>{it.sub}</div>
              </div>
              {isActive && (
                <span style={{
                  padding: '4px 9px', background: '#BF5AF2',
                  borderRadius: 100, fontFamily: SF, fontSize: 11, fontWeight: 600,
                  color: '#fff', letterSpacing: 0.1,
                }}>Now</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Pal nudge */}
      <div style={{ padding: '14px 16px 8px' }}>
        <button onClick={() => onOpenPal && onOpenPal('Give me a reflection prompt for tonight')} style={{
          width: '100%', padding: '13px 16px',
          background: 'rgba(255,255,255,0.06)',
          border: '0.5px dashed rgba(255,255,255,0.25)',
          borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}>
          <Icon name="sparkles" size={14} color="#BF5AF2" />
          <span style={{
            fontFamily: SF, fontSize: 14,
            color: 'rgba(255,255,255,0.85)', letterSpacing: -0.15,
          }}>Ask Pal for a reflection prompt</span>
          <span style={{ flex: 1 }} />
          <Icon name="chevron.right" size={12} color="rgba(255,255,255,0.4)" />
        </button>
      </div>

      {/* CTA */}
      <div style={{ padding: '16px 20px 0' }}>
        <button onClick={onDone} disabled={doneCount < total}
          style={{
            width: '100%', padding: '15px 16px',
            background: doneCount === total ? '#BF5AF2' : 'rgba(255,255,255,0.12)',
            border: 'none', borderRadius: 14,
            cursor: doneCount === total ? 'pointer' : 'default',
            fontFamily: SF, fontSize: 16, fontWeight: 600,
            color: doneCount === total ? '#fff' : 'rgba(255,255,255,0.4)',
            letterSpacing: -0.24,
          }}>
          {doneCount === total ? 'Good night' : `${total - doneCount} to go`}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  WeeklyReviewScreen, SubscriptionsScreen, StreakCelebrationScreen, EveningCloseOutScreen,
});
