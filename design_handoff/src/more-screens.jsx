// New screens: Bills/Recurring, Weekly Plan (workout), Pal Inbox (notifications)

// ─── Bills / Recurring reminders ───────────────────────────
// The upcoming obligations view — rent, utilities, etc.
// Hero = the next big one ("Rent due in 3 days · $2,400")
const BILLS = [
  { id: 'rent',     name: 'Rent',              payee: 'Greenwood Property Co.', cat: 'Housing',  amount: 2400.00, dueIn: 3,  day: 'Mon, Apr 28', icon: 'house.fill',              color: '#0A84FF', auto: true  },
  { id: 'electric', name: 'PG&E',              payee: 'Electric + gas',          cat: 'Utility',  amount: 94.20,   dueIn: 6,  day: 'Thu, May 1',  icon: 'bolt.fill',               color: '#FF9500', auto: true  },
  { id: 'internet', name: 'Sonic Fiber',       payee: '1 Gbps internet',         cat: 'Utility',  amount: 50.00,   dueIn: 9,  day: 'Sun, May 4',  icon: 'bolt.fill',               color: '#5856D6', auto: false },
  { id: 'health',   name: 'Blue Shield',       payee: 'Health premium',          cat: 'Insurance',amount: 312.00,  dueIn: 13, day: 'Thu, May 8',  icon: 'heart.fill',              color: '#FF2D55', auto: true  },
  { id: 'card',     name: 'Chase Sapphire',    payee: 'Credit card · min $75',   cat: 'Credit',   amount: 1240.16, dueIn: 17, day: 'Mon, May 12', icon: 'dollarsign.circle.fill',  color: '#1C1C1E', auto: false },
  { id: 'phone',    name: 'T-Mobile',          payee: 'Phone plan',              cat: 'Utility',  amount: 70.00,   dueIn: 22, day: 'Sat, May 17', icon: 'bell.fill',               color: '#E50914', auto: true  },
];

function BillsScreen({ theme, onBack }) {
  const next = BILLS[0];
  const total = BILLS.reduce((s, b) => s + b.amount, 0);
  const autoCount = BILLS.filter(b => b.auto).length;

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
        }}>Bills</div>
        <div style={{
          fontFamily: SF, fontSize: 15, color: theme.ink3,
          marginTop: 2, letterSpacing: -0.24,
        }}>{BILLS.length} recurring · {autoCount} on auto-pay</div>
      </div>

      {/* Hero — next bill due */}
      <div style={{ margin: '0 16px 16px' }}>
        <div style={{
          background: theme.surface, borderRadius: 20, padding: 18,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* soft tint wash */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(120% 60% at 100% 0%, ${theme.money}22 0%, transparent 60%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: theme.money,
              boxShadow: `0 0 0 4px ${theme.money}33`,
              animation: 'pulse 1.8s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: SF, fontSize: 12, fontWeight: 700,
              color: theme.money, letterSpacing: 0.4, textTransform: 'uppercase',
            }}>Next bill · due in {next.dueIn} days</span>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: next.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: `0 6px 18px ${next.color}55`,
            }}>
              <Icon name={next.icon} size={26} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: SFR, fontSize: 34, fontWeight: 700,
                color: theme.ink, letterSpacing: -0.6, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>${next.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style={{
                fontFamily: SF, fontSize: 15, color: theme.ink, fontWeight: 600,
                letterSpacing: -0.24, marginTop: 6,
              }}>{next.name}</div>
              <div style={{
                fontFamily: SF, fontSize: 13, color: theme.ink3,
                letterSpacing: -0.08, marginTop: 1,
              }}>{next.payee}</div>
            </div>
          </div>

          {/* Countdown strip */}
          <div style={{
            position: 'relative',
            padding: '10px 12px', borderRadius: 12,
            background: theme.fill, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Icon name="calendar" size={16} color={theme.ink2} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: SF, fontSize: 13, color: theme.ink, fontWeight: 600,
                letterSpacing: -0.15,
              }}>{next.day}</div>
              <div style={{
                fontFamily: SF, fontSize: 11, color: theme.ink3,
                letterSpacing: -0.08,
              }}>Auto-pays from Chase ··0427</div>
            </div>
            <span style={{
              padding: '4px 9px', background: theme.move, borderRadius: 100,
              fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#fff',
              letterSpacing: 0.2, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Icon name="checkmark" size={10} color="#fff" /> On
            </span>
          </div>

          {/* CTAs */}
          <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{
              flex: 1, padding: '11px 14px', background: theme.ink,
              border: 'none', borderRadius: 12, cursor: 'pointer',
              fontFamily: SF, fontSize: 14, fontWeight: 600,
              color: theme.bg, letterSpacing: -0.15,
            }}>Pay now</button>
            <button style={{
              padding: '11px 14px', background: 'transparent',
              border: `0.5px solid ${theme.hair}`, borderRadius: 12, cursor: 'pointer',
              fontFamily: SF, fontSize: 14, fontWeight: 600,
              color: theme.ink, letterSpacing: -0.15,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="bell.fill" size={13} color={theme.ink2} /> Remind
            </button>
          </div>
        </div>
      </div>

      {/* Month total card */}
      <div style={{ margin: '0 16px 18px' }}>
        <div style={{
          background: theme.surface, borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: SF, fontSize: 11, fontWeight: 700,
              color: theme.ink3, letterSpacing: 0.3, textTransform: 'uppercase',
            }}>Due this month</div>
            <div style={{
              fontFamily: SFR, fontSize: 22, fontWeight: 700,
              color: theme.ink, letterSpacing: -0.3, marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          {/* tiny timeline */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
            {BILLS.map(b => (
              <div key={b.id} title={b.name} style={{
                width: 6, borderRadius: 2, background: b.color,
                height: Math.max(8, Math.min(36, (b.amount / next.amount) * 36)),
              }} />
            ))}
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
        {BILLS.map((b, i) => {
          const urgent = b.dueIn <= 3;
          return (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              borderBottom: i < BILLS.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: b.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={b.icon} size={16} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 600,
                  color: theme.ink, letterSpacing: -0.24,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {b.name}
                  {b.auto && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 4,
                      background: theme.fill,
                      fontFamily: SF, fontSize: 10, fontWeight: 700,
                      color: theme.ink3, letterSpacing: 0.3, textTransform: 'uppercase',
                    }}>Auto</span>
                  )}
                </div>
                <div style={{
                  fontFamily: SF, fontSize: 12, color: theme.ink3,
                  letterSpacing: -0.08, marginTop: 1,
                }}>
                  {b.cat} ·{' '}
                  <span style={{ color: urgent ? theme.money : theme.ink3, fontWeight: urgent ? 600 : 400 }}>
                    in {b.dueIn} {b.dueIn === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink,
                  letterSpacing: -0.15, fontVariantNumeric: 'tabular-nums',
                }}>${b.amount.toLocaleString('en-US', { minimumFractionDigits: b.amount % 1 === 0 ? 0 : 2 })}</div>
                <div style={{
                  fontFamily: SF, fontSize: 11, color: theme.ink4,
                  letterSpacing: -0.08, marginTop: 1,
                }}>{b.day.split(',')[0]}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '12px 20px', textAlign: 'center' }}>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: SF, fontSize: 14, color: theme.accent, letterSpacing: -0.15,
        }}>+ Add a bill</button>
      </div>
    </div>
  );
}


// ─── Weekly Plan ───────────────────────────────────────────
// The 7-day workout schedule — push/pull/legs/rest/cardio
const WEEK_PLAN = [
  { day: 'Mon', date: 21, type: 'Push',   routine: 'Push Day A',  est: 55, color: 'move',    icon: 'dumbbell.fill',     done: true,  today: false, skipped: false, muscles: ['Chest', 'Shoulders', 'Triceps'] },
  { day: 'Tue', date: 22, type: 'Pull',   routine: 'Pull Day A',  est: 58, color: 'rituals', icon: 'dumbbell.fill',     done: true,  today: false, skipped: false, muscles: ['Back', 'Biceps'] },
  { day: 'Wed', date: 23, type: 'Rest',   routine: null,           est: null, color: 'rest', icon: 'moon.stars.fill',   done: true,  today: false, skipped: false, muscles: [] },
  { day: 'Thu', date: 24, type: 'Legs',   routine: 'Leg Day',      est: 62, color: 'money',   icon: 'figure.run',        done: false, today: true,  skipped: false, muscles: ['Quads', 'Hamstrings', 'Calves'] },
  { day: 'Fri', date: 25, type: 'Cardio', routine: 'Treadmill Intervals', est: 30, color: 'move', icon: 'figure.run', done: false, today: false, skipped: false, muscles: ['Cardio'] },
  { day: 'Sat', date: 26, type: 'Upper',  routine: 'Upper Power',  est: 45, color: 'accent', icon: 'dumbbell.fill',     done: false, today: false, skipped: false, muscles: ['Chest', 'Back'] },
  { day: 'Sun', date: 27, type: 'Rest',   routine: null,           est: null, color: 'rest', icon: 'moon.stars.fill',    done: false, today: false, skipped: false, muscles: [] },
];

function WeeklyPlanScreen({ theme, onBack, onStartWorkout }) {
  const colorFor = c => c === 'rest' ? theme.ink3 : (theme[c] || theme.accent);
  const done = WEEK_PLAN.filter(d => d.done && d.type !== 'Rest').length;
  const total = WEEK_PLAN.filter(d => d.type !== 'Rest').length;
  const totalMin = WEEK_PLAN.reduce((s, d) => s + (d.est || 0), 0);
  const todayIdx = WEEK_PLAN.findIndex(d => d.today);

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
        <NavIconButton name="ellipsis" theme={theme} />
      </div>

      {/* Title */}
      <div style={{ padding: '4px 20px 14px' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, color: theme.move, fontWeight: 700,
          letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
        }}>Week of Apr 21</div>
        <div style={{
          fontFamily: SF, fontWeight: 700, fontSize: 34,
          color: theme.ink, letterSpacing: 0.37, lineHeight: '41px',
        }}>Your plan.</div>
        <div style={{
          fontFamily: SF, fontSize: 15, color: theme.ink3,
          marginTop: 2, letterSpacing: -0.24,
        }}>{done} of {total} done · {totalMin} min planned</div>
      </div>

      {/* Week strip */}
      <div style={{ padding: '0 12px 18px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {WEEK_PLAN.map((d, i) => {
            const c = colorFor(d.color);
            const isRest = d.type === 'Rest';
            return (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, paddingTop: 8,
              }}>
                <div style={{
                  fontFamily: SF, fontSize: 11, fontWeight: 600,
                  color: d.today ? theme.move : theme.ink3, letterSpacing: 0.3,
                  textTransform: 'uppercase',
                }}>{d.day[0]}</div>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: d.today ? theme.move
                    : d.done ? `${c}22`
                    : isRest ? theme.fill
                    : theme.surface,
                  border: d.today ? 'none'
                    : d.done ? 'none'
                    : `1.5px dashed ${isRest ? theme.ink4 : c + '55'}`,
                  fontFamily: SFR, fontSize: 14, fontWeight: 700,
                  color: d.today ? '#fff'
                    : d.done ? c
                    : isRest ? theme.ink3
                    : theme.ink,
                }}>{d.date}</div>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: d.done ? c : isRest ? 'transparent' : 'transparent',
                  border: d.done ? 'none' : `1px solid ${isRest ? 'transparent' : c}`,
                }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Today spotlight */}
      {todayIdx >= 0 && (() => {
        const t = WEEK_PLAN[todayIdx];
        const c = colorFor(t.color);
        return (
          <div style={{ margin: '0 16px 18px' }}>
            <div style={{
              background: theme.surface, borderRadius: 18,
              padding: 16, position: 'relative', overflow: 'hidden',
              border: `0.5px solid ${c}44`,
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(120% 60% at 0% 0%, ${c}1f 0%, transparent 60%)`,
                pointerEvents: 'none',
              }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  fontFamily: SF, fontSize: 11, fontWeight: 700, color: c,
                  padding: '3px 8px', borderRadius: 100, background: `${c}22`,
                  letterSpacing: 0.4, textTransform: 'uppercase',
                }}>Today · {t.day}</div>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 13, background: c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={t.icon} size={24} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: SFR, fontSize: 22, fontWeight: 700,
                    color: theme.ink, letterSpacing: -0.3, lineHeight: 1.15,
                  }}>{t.type} · {t.routine}</div>
                  <div style={{
                    fontFamily: SF, fontSize: 13, color: theme.ink3,
                    letterSpacing: -0.08, marginTop: 3, lineHeight: 1.4,
                  }}>{t.muscles.join(' · ')} · {t.est} min</div>
                </div>
              </div>
              <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={onStartWorkout} style={{
                  flex: 1, padding: '12px 14px', background: c,
                  border: 'none', borderRadius: 12, cursor: 'pointer',
                  fontFamily: SF, fontSize: 15, fontWeight: 600, color: '#fff',
                  letterSpacing: -0.24,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <Icon name="play.fill" size={13} color="#fff" /> Start workout
                </button>
                <button style={{
                  padding: '12px 14px', background: 'transparent',
                  border: `0.5px solid ${theme.hair}`, borderRadius: 12, cursor: 'pointer',
                  fontFamily: SF, fontSize: 14, fontWeight: 500,
                  color: theme.ink2, letterSpacing: -0.15,
                }}>Swap</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full schedule list */}
      <div style={{ padding: '0 20px 8px' }}>
        <div style={{
          fontFamily: SF, fontSize: 22, fontWeight: 700,
          color: theme.ink, letterSpacing: 0.35, marginBottom: 10,
        }}>Schedule</div>
      </div>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, overflow: 'hidden' }}>
        {WEEK_PLAN.map((d, i) => {
          const c = colorFor(d.color);
          const isRest = d.type === 'Rest';
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              borderBottom: i < WEEK_PLAN.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
              background: d.today ? `${c}0f` : 'transparent',
              position: 'relative',
            }}>
              {d.today && (
                <div style={{
                  position: 'absolute', left: 0, top: 8, bottom: 8,
                  width: 3, borderRadius: '0 2px 2px 0', background: c,
                }} />
              )}
              {/* Day chip */}
              <div style={{
                width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center',
                flexShrink: 0,
              }}>
                <div style={{
                  fontFamily: SF, fontSize: 10, fontWeight: 700,
                  color: theme.ink3, letterSpacing: 0.5, textTransform: 'uppercase',
                }}>{d.day}</div>
                <div style={{
                  fontFamily: SFR, fontSize: 20, fontWeight: 700,
                  color: theme.ink, letterSpacing: -0.3, lineHeight: 1.1,
                  fontVariantNumeric: 'tabular-nums',
                }}>{d.date}</div>
              </div>

              {/* Icon */}
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: isRest ? theme.fill : c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={d.icon} size={15} color={isRest ? theme.ink3 : '#fff'} />
              </div>

              {/* Title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 600,
                  color: isRest ? theme.ink2 : theme.ink, letterSpacing: -0.24,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {isRest ? 'Rest day' : d.type}
                  {d.done && (
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: theme.move,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="checkmark" size={8} color="#fff" />
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: SF, fontSize: 12, color: theme.ink3,
                  letterSpacing: -0.08, marginTop: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {isRest ? 'Recovery · stretch optional' : `${d.routine} · ${d.est} min`}
                </div>
              </div>

              {/* Right */}
              {!isRest && !d.done && (
                <Icon name="chevron.right" size={14} color={theme.ink4} />
              )}
            </div>
          );
        })}
      </div>

      {/* Pal weekly coach note */}
      <div style={{ margin: '18px 16px 0' }}>
        <div style={{
          background: `linear-gradient(135deg, ${theme.accent}12 0%, ${theme.move}12 100%)`,
          border: `0.5px solid ${theme.accent}33`,
          borderRadius: 16, padding: 14,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.move} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="sparkles" size={13} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: SF, fontSize: 11, color: theme.ink3, fontWeight: 700,
              letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 3,
            }}>Pal · Weekly coach</div>
            <div style={{
              fontFamily: SF, fontSize: 14, color: theme.ink,
              letterSpacing: -0.15, lineHeight: 1.45,
            }}>You're on a <b>2-week 5/7 streak</b>. Legs day usually slips — want me to shorten it to 45 min?</div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Notifications / Pal Inbox ─────────────────────────────
// A timeline of passive observations Pal has made.
const INBOX_ITEMS = [
  {
    id: 'n1', when: '2m ago', kind: 'nudge', category: 'rituals',
    icon: 'moon.stars.fill', unread: true,
    title: 'Evening close-out is open',
    body: "4 of 5 rituals done. 5 min of reflection and you'll close the ring tonight.",
    action: 'Close out →',
  },
  {
    id: 'n2', when: '2h ago', kind: 'spotted', category: 'money',
    icon: 'cup.and.saucer.fill', unread: true,
    title: 'Fourth Verve this week',
    body: "You've spent $23 at Verve since Monday — 1.7× your usual pace. Dial back, or re-budget?",
    action: 'Ask Pal',
  },
  {
    id: 'n3', when: 'Yesterday', kind: 'spotted', category: 'move',
    icon: 'fork.knife', unread: false,
    title: 'You skipped lunch Tuesday',
    body: 'No food logged between breakfast and 6pm — and you still ran 4.8km after. Just noticed.',
    action: 'Log it',
  },
  {
    id: 'n4', when: 'Yesterday', kind: 'win', category: 'move',
    icon: 'flame.fill', unread: false,
    title: '11-day move streak',
    body: "Longest you've gone this year. Want to share or just keep it going quietly?",
    action: 'See streak',
  },
  {
    id: 'n5', when: 'Tue', kind: 'pattern', category: 'rituals',
    icon: 'sparkles', unread: false,
    title: 'Morning pages → better days',
    body: 'Your move score averages 73 min on days you write, 42 min on days you skip. Pattern over 6 weeks.',
    action: 'See pattern',
  },
  {
    id: 'n6', when: 'Mon', kind: 'reminder', category: 'money',
    icon: 'bell.fill', unread: false,
    title: 'Rent auto-pays Monday',
    body: '$2,400 from Chase ··0427 on Apr 28. Balance looks fine — $4,192 after.',
    action: 'View bill',
  },
  {
    id: 'n7', when: 'Sun', kind: 'recap', category: 'rituals',
    icon: 'chart.bar.fill', unread: false,
    title: 'Your weekly review is ready',
    body: "A steady week — under budget, 11-day streak, 6/7 morning pages. Let's look closer.",
    action: 'Open review →',
  },
  {
    id: 'n8', when: 'Apr 18', kind: 'spotted', category: 'move',
    icon: 'figure.run', unread: false,
    title: 'Shorter runs after 9pm',
    body: "Your last 3 late runs averaged 18 min vs your morning 28. Evening you is tireder than morning you.",
    action: null,
  },
];

const KIND_META = {
  nudge:    { label: 'Nudge',    dot: 'accent' },
  spotted:  { label: 'Spotted',  dot: 'rituals' },
  pattern:  { label: 'Pattern',  dot: 'rituals' },
  win:      { label: 'Win',      dot: 'move' },
  reminder: { label: 'Reminder', dot: 'money' },
  recap:    { label: 'Recap',    dot: 'accent' },
};

function PalInboxScreen({ theme, onBack, onOpenPal }) {
  const [filter, setFilter] = React.useState('all');
  const items = filter === 'all' ? INBOX_ITEMS
    : filter === 'unread' ? INBOX_ITEMS.filter(x => x.unread)
    : INBOX_ITEMS.filter(x => x.category === filter);
  const unread = INBOX_ITEMS.filter(x => x.unread).length;

  const catColor = c => c === 'money' ? theme.money
    : c === 'move' ? theme.move
    : c === 'rituals' ? theme.rituals
    : theme.accent;

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
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: theme.accent, fontFamily: SF, fontSize: 15, padding: 6,
          letterSpacing: -0.15,
        }}>Mark all read</button>
      </div>

      {/* Title */}
      <div style={{ padding: '4px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.rituals} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 14px ${theme.accent}55`,
          }}>
            <Icon name="sparkles" size={16} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: SF, fontWeight: 700, fontSize: 28,
              color: theme.ink, letterSpacing: -0.3, lineHeight: 1,
            }}>Pal noticed</div>
          </div>
        </div>
        <div style={{
          fontFamily: SF, fontSize: 15, color: theme.ink3,
          marginTop: 8, letterSpacing: -0.24,
        }}>
          {unread > 0 ? <><b style={{ color: theme.ink }}>{unread} new</b> · a quiet inbox, not an anxious one</> : 'All caught up · a quiet inbox, not an anxious one'}
        </div>
      </div>

      {/* Filter chips */}
      <div style={{
        padding: '0 16px 16px', display: 'flex', gap: 6, overflowX: 'auto',
      }}>
        {[
          { id: 'all', label: 'All', n: INBOX_ITEMS.length },
          { id: 'unread', label: 'Unread', n: unread },
          { id: 'money', label: 'Money', color: theme.money },
          { id: 'move', label: 'Move', color: theme.move },
          { id: 'rituals', label: 'Rituals', color: theme.rituals },
        ].map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '7px 12px', borderRadius: 100,
              background: active ? theme.ink : theme.surface,
              border: `0.5px solid ${active ? theme.ink : theme.hair}`,
              cursor: 'pointer', flexShrink: 0,
              fontFamily: SF, fontSize: 13, fontWeight: 500,
              color: active ? theme.bg : theme.ink2, letterSpacing: -0.08,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {f.color && !active && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color }} />
              )}
              {f.label}
              {f.n !== undefined && (
                <span style={{
                  fontFamily: SF, fontSize: 11, fontWeight: 600,
                  color: active ? 'rgba(255,255,255,0.6)' : theme.ink4,
                  marginLeft: 2,
                }}>{f.n}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(it => {
          const c = catColor(it.category);
          const meta = KIND_META[it.kind];
          return (
            <div key={it.id} style={{
              background: theme.surface, borderRadius: 16,
              padding: 14, position: 'relative',
              display: 'flex', gap: 12,
              opacity: it.unread ? 1 : 0.95,
            }}>
              {/* unread indicator */}
              {it.unread && (
                <div style={{
                  position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 6, height: 6, borderRadius: '50%', background: theme.accent,
                }} />
              )}
              {/* Icon */}
              <div style={{
                width: 38, height: 38, borderRadius: 11, background: c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={it.icon} size={16} color="#fff" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Meta row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
                }}>
                  <span style={{
                    fontFamily: SF, fontSize: 11, fontWeight: 700, color: c,
                    letterSpacing: 0.3, textTransform: 'uppercase',
                  }}>{meta.label}</span>
                  <span style={{
                    width: 3, height: 3, borderRadius: '50%', background: theme.ink4,
                  }} />
                  <span style={{
                    fontFamily: SF, fontSize: 11, color: theme.ink3,
                    letterSpacing: -0.08,
                  }}>{it.when}</span>
                </div>
                {/* Title */}
                <div style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 600,
                  color: theme.ink, letterSpacing: -0.24, lineHeight: 1.3,
                }}>{it.title}</div>
                {/* Body */}
                <div style={{
                  fontFamily: SF, fontSize: 13, color: theme.ink2,
                  letterSpacing: -0.08, marginTop: 4, lineHeight: 1.45,
                }}>{it.body}</div>
                {/* Action */}
                {it.action && (
                  <button onClick={() => onOpenPal && onOpenPal(it.title)} style={{
                    marginTop: 10, padding: '6px 10px',
                    background: theme.fill, border: 'none', borderRadius: 100,
                    cursor: 'pointer',
                    fontFamily: SF, fontSize: 12, fontWeight: 600, color: theme.ink,
                    letterSpacing: -0.08,
                  }}>{it.action}</button>
                )}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            fontFamily: SF, fontSize: 14, color: theme.ink3,
            letterSpacing: -0.15,
          }}>Nothing here. A quiet Pal is a happy Pal.</div>
        )}
      </div>

      {/* Footer settings hint */}
      <div style={{ padding: '18px 20px 8px', textAlign: 'center' }}>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="gearshape.fill" size={12} color={theme.ink3} />
          Tune what Pal notices
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  BillsScreen, WeeklyPlanScreen, PalInboxScreen,
  BILLS, WEEK_PLAN, INBOX_ITEMS,
});
