// Move tab landing, Rituals tab landing, Quick action sheet
// These are the tab-bar destinations; deeper screens push from here.

function MoveTabScreen({ theme, onStart, onHistory, onRoutines, onLibrary, onDetail, onWeeklyPlan }) {
  const sessions = (window.PAST_SESSIONS || []).slice(0, 3);
  const allEx = window.EXERCISES || [];

  const thisWeek = { workouts: 3, goal: 4, volume: 12400, minutes: 148 };
  const weekDays = [
    { d: 'M', done: true, t: 'Push' },
    { d: 'T', done: true, t: 'Legs' },
    { d: 'W', done: false },
    { d: 'T', done: true, t: 'Cardio' },
    { d: 'F', done: false, today: true },
    { d: 'S', done: false },
    { d: 'S', done: false },
  ];
  // balance: weekly muscle group split
  const balance = [
    { l: 'Push', p: 38, c: theme.move },
    { l: 'Pull', p: 12, c: theme.rituals },
    { l: 'Legs', p: 35, c: theme.money },
    { l: 'Cardio', p: 15, c: theme.accent },
  ];

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Move" subtitle="Gym, cardio, daily movement"
        trailing={<NavIconButton name="ellipsis" theme={theme} />} />

      {/* This week hero — richer layout w/ day calendar */}
      <div style={{ padding: '0 16px 18px' }}>
        <div style={{
          background: `linear-gradient(155deg, ${theme.move} 0%, ${theme.move}ee 60%, ${theme.accent}dd 100%)`,
          borderRadius: 22, padding: 18, color: '#fff',
          boxShadow: `0 10px 30px ${theme.move}33`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -50, width: 180, height: 180,
            borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: `repeating-linear-gradient(135deg, transparent 0 22px, rgba(255,255,255,0.04) 22px 23px)`,
          }} />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{
                  fontFamily: SF, fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
                  textTransform: 'uppercase', opacity: 0.82, marginBottom: 6,
                }}>This week</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{
                    fontFamily: SFR, fontSize: 48, fontWeight: 700, letterSpacing: -1.2,
                    fontVariantNumeric: 'tabular-nums', lineHeight: 0.95,
                  }}>{thisWeek.workouts}</span>
                  <span style={{ fontFamily: SF, fontSize: 15, opacity: 0.82, letterSpacing: -0.1 }}>
                    / {thisWeek.goal} workouts
                  </span>
                </div>
              </div>
              {/* mini ring */}
              <div style={{ position: 'relative', width: 56, height: 56 }}>
                <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="5" />
                  <circle cx="28" cy="28" r="23" fill="none" stroke="#fff" strokeWidth="5"
                    strokeDasharray={`${(thisWeek.workouts / thisWeek.goal) * 144} 144`}
                    strokeLinecap="round" />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: SFR, fontSize: 14, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
                }}>{Math.round((thisWeek.workouts / thisWeek.goal) * 100)}%</div>
              </div>
            </div>

            {/* Day calendar */}
            <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
              {weekDays.map((d, i) => (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}>
                  <div style={{
                    width: '100%', paddingBottom: '100%', position: 'relative',
                    background: d.done ? '#fff' : d.today ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: d.today && !d.done ? '1.5px dashed rgba(255,255,255,0.7)' : 'none',
                    borderRadius: 9,
                  }}>
                    {d.done && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name="checkmark" size={13} color={theme.move} />
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontFamily: SF, fontSize: 10, fontWeight: 700, opacity: d.today ? 1 : 0.75, letterSpacing: 0.3,
                  }}>{d.d}</div>
                </div>
              ))}
            </div>

            {/* stat row */}
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: '0.5px solid rgba(255,255,255,0.2)',
              display: 'flex', gap: 14,
            }}>
              <div>
                <div style={{ fontFamily: SFR, fontSize: 18, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3, lineHeight: 1 }}>
                  {(thisWeek.volume / 1000).toFixed(1)}t
                </div>
                <div style={{ fontFamily: SF, fontSize: 10, opacity: 0.75, letterSpacing: 0.5,
                  textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>Volume</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <div style={{ fontFamily: SFR, fontSize: 18, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3, lineHeight: 1 }}>
                  {thisWeek.minutes}<span style={{ fontSize: 11, opacity: 0.75, marginLeft: 1 }}>m</span>
                </div>
                <div style={{ fontFamily: SF, fontSize: 10, opacity: 0.75, letterSpacing: 0.5,
                  textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>Training</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <div style={{ fontFamily: SFR, fontSize: 18, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3, lineHeight: 1 }}>
                  2 PR
                </div>
                <div style={{ fontFamily: SF, fontSize: 10, opacity: 0.75, letterSpacing: 0.5,
                  textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>Records</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start workout CTA — more dramatic */}
      <div style={{ padding: '0 16px 18px' }}>
        <button onClick={onStart} style={{
          width: '100%', padding: 0, background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          <div style={{
            background: theme.surface, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${theme.move} 0%, ${theme.move}cc 80%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 14px ${theme.move}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
              flexShrink: 0,
            }}>
              <Icon name="play.fill" size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: SF, fontSize: 10, fontWeight: 700, color: theme.move,
                letterSpacing: 1, textTransform: 'uppercase',
              }}>● Pal's pick for today</div>
              <div style={{
                fontFamily: SFR, fontSize: 18, fontWeight: 700, color: theme.ink,
                letterSpacing: -0.3, marginTop: 1,
              }}>Pull Day A</div>
              <div style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1,
              }}>5 exercises · 58 min · last done 5d ago</div>
            </div>
            <div style={{
              padding: '10px 14px', background: theme.move, borderRadius: 100,
              fontFamily: SF, fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: -0.1,
              flexShrink: 0,
            }}>Start</div>
          </div>
        </button>
      </div>

      {/* Weekly balance viz */}
      <div style={{ padding: '0 16px 18px' }}>
        <div style={{
          background: theme.surface, borderRadius: 16, padding: 16,
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{
              fontFamily: SF, fontSize: 14, fontWeight: 700, color: theme.ink, letterSpacing: -0.2,
            }}>Weekly balance</div>
            <div style={{ flex: 1 }} />
            <div style={{
              fontFamily: SF, fontSize: 11, fontWeight: 600, color: theme.move, letterSpacing: -0.08,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Icon name="sparkles" size={10} color={theme.move} />
              Pal says pull more
            </div>
          </div>

          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 12, borderRadius: 100, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
            {balance.map(b => (
              <div key={b.l} style={{
                width: `${b.p}%`, background: b.c, height: '100%',
              }} />
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {balance.map(b => (
              <div key={b.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: b.c }} />
                <span style={{ fontFamily: SF, fontSize: 12, color: theme.ink2, letterSpacing: -0.08 }}>{b.l}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: SFR, fontSize: 12, fontWeight: 600, color: theme.ink,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.08 }}>{b.p}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <Section theme={theme}>
        <ListRow icon="calendar" iconBg={theme.move} title="Weekly plan"
          value="4 of 5 · Thu" onClick={onWeeklyPlan} theme={theme} />
        <ListRow icon="books.vertical.fill" iconBg={theme.move} title="My routines"
          value={`${(window.ROUTINES || []).length}`} onClick={onRoutines} theme={theme} />
        <ListRow icon="dumbbell.fill" iconBg={theme.accent} title="Exercise library"
          value={`${allEx.length}`} onClick={onLibrary} theme={theme} />
        <ListRow icon="chart.bar.fill" iconBg={theme.rituals} title="History & trends"
          value="All time" onClick={onHistory} theme={theme} last />
      </Section>

      {/* Recent sessions — rich cards */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, fontWeight: 700, color: theme.ink3,
          letterSpacing: 0.8, textTransform: 'uppercase', padding: '12px 4px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Recent sessions</span>
          <span onClick={onHistory} style={{ color: theme.accent, fontWeight: 600, textTransform: 'none',
            fontSize: 13, letterSpacing: -0.08, cursor: 'pointer' }}>See all</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map((s, i) => {
            const isCardio = s.type === 'cardio';
            const c = isCardio ? theme.accent : theme.move;
            return (
              <div key={i} onClick={onDetail} style={{
                background: theme.surface, borderRadius: 14, padding: 0, cursor: 'pointer',
                boxShadow: `0 0 0 0.5px ${theme.hair}`,
                display: 'flex', alignItems: 'stretch', overflow: 'hidden',
              }}>
                {/* Left accent strip */}
                <div style={{ width: 4, background: c, flexShrink: 0 }} />
                <div style={{ flex: 1, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: `${c}1a`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={isCardio ? 'figure.run' : 'dumbbell.fill'} size={16} color={c} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink, letterSpacing: -0.24 }}>
                        {s.routineName}
                      </div>
                      <div style={{ fontFamily: SF, fontSize: 11, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                        {s.date}
                      </div>
                    </div>
                    {s.prs > 0 && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '3px 8px', background: theme.money, color: '#fff',
                        borderRadius: 100,
                        fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                      }}>
                        <Icon name="star.fill" size={8} color="#fff" />
                        {s.prs} PR
                      </div>
                    )}
                  </div>
                  {/* stats row */}
                  <div style={{ display: 'flex', gap: 14, paddingLeft: 42 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontFamily: SFR, fontSize: 14, fontWeight: 700, color: theme.ink,
                        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2 }}>{s.duration}</span>
                      <span style={{ fontFamily: SF, fontSize: 10, color: theme.ink3, letterSpacing: -0.08 }}>min</span>
                    </div>
                    {s.volume > 0 && (
                      <>
                        <div style={{ width: 1, background: theme.hair }} />
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{ fontFamily: SFR, fontSize: 14, fontWeight: 700, color: theme.ink,
                            fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2 }}>
                            {(s.volume / 1000).toFixed(1)}t
                          </span>
                          <span style={{ fontFamily: SF, fontSize: 10, color: theme.ink3, letterSpacing: -0.08 }}>volume</span>
                        </div>
                      </>
                    )}
                    {/* mini sparkline */}
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 18 }}>
                      {[3, 5, 4, 6, 8, 7].map((h, j) => (
                        <div key={j} style={{
                          width: 3, height: `${(h / 8) * 100}%`,
                          background: c, borderRadius: 1, opacity: 0.4 + j * 0.1,
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RitualsTabScreen({ theme, onBuilder }) {
  const rituals = [
    { id: 'med', name: 'Meditate 10m', icon: 'sparkles', color: theme.rituals, streak: 12, done: true, time: 'Morning' },
    { id: 'read', name: 'Read 20 pages', icon: 'book.closed.fill', color: theme.money, streak: 7, done: true, time: 'Evening' },
    { id: 'write', name: 'Journal', icon: 'character.book.closed.fill', color: theme.accent, streak: 4, done: false, time: 'Evening' },
    { id: 'water', name: '8 glasses water', icon: 'cup.and.saucer.fill', color: '#5AC8FA', streak: 23, done: true, time: 'All day' },
  ];
  const done = rituals.filter(r => r.done).length;

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Rituals" subtitle={`${done} of ${rituals.length} done today`}
        trailing={<NavIconButton name="plus" theme={theme} onClick={onBuilder} />} />

      {/* Today progress ring */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: 18,
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          <div style={{ position: 'relative', width: 72, height: 72 }}>
            <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="36" cy="36" r="30" fill="none" stroke={`${theme.rituals}33`} strokeWidth="8" />
              <circle cx="36" cy="36" r="30" fill="none" stroke={theme.rituals} strokeWidth="8"
                strokeDasharray={`${(done/rituals.length) * 188} 188`} strokeLinecap="round" />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: SFR, fontSize: 22, fontWeight: 700, color: theme.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3,
            }}>{done}/{rituals.length}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: theme.ink, letterSpacing: -0.3 }}>
              One to close the day
            </div>
            <div style={{ fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08, marginTop: 3 }}>
              Your evening journal is waiting. 23-day water streak 💧
            </div>
          </div>
        </div>
      </div>

      <Section theme={theme} header="Today">
        {rituals.map((r, i, arr) => (
          <div key={r.id} style={{
            padding: '14px', display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: `${r.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={r.icon} size={17} color={r.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink, letterSpacing: -0.24 }}>
                {r.name}
              </div>
              <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                {r.time} · {r.streak}-day streak 🔥
              </div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: r.done ? theme.rituals : 'transparent',
              border: r.done ? 'none' : `1.5px solid ${theme.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {r.done && <Icon name="checkmark" size={14} color="#fff" />}
            </div>
          </div>
        ))}
      </Section>

      <div style={{ padding: '0 16px' }}>
        <button onClick={onBuilder} style={{
          width: '100%', padding: '14px', background: theme.surface,
          border: `0.5px solid ${theme.hair}`, borderRadius: 12, cursor: 'pointer',
          fontFamily: SF, fontSize: 15, color: theme.accent, fontWeight: 600,
          letterSpacing: -0.24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="plus" size={14} color={theme.accent} />
          New ritual
        </button>
      </div>
    </div>
  );
}

function YouTabScreen({ theme, onWeek, onMonthly, onStats, onEmailSync, onSubs, onBills, onInbox }) {
  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="You" subtitle="Reviews, patterns, settings"
        trailing={<NavIconButton name="gearshape.fill" theme={theme} />} />

      {/* Profile card */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: 16,
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.move})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: SF, fontSize: 22, fontWeight: 700,
          }}>A</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 600, color: theme.ink, letterSpacing: -0.3 }}>
              Alex Chen
            </div>
            <div style={{ fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08, marginTop: 2 }}>
              92-day streak · Member since March
            </div>
          </div>
        </div>
      </div>

      <Section theme={theme} header="Reviews">
        <ListRow icon="calendar" iconBg={theme.rituals} title="Weekly review"
          value="Apr 17–23" onClick={onWeek} theme={theme} />
        <ListRow icon="chart.bar.fill" iconBg={theme.accent} title="Monthly review"
          value="October" onClick={onMonthly} theme={theme} />
        <ListRow icon="sparkles" iconBg={theme.money} title="Yearly rewind"
          value="Preview" theme={theme} last />
      </Section>

      <Section theme={theme} header="Money">
        <ListRow icon="house.fill" iconBg={theme.accent} title="Bills"
          value="$2,400 · Mon" onClick={onBills} theme={theme} />
        <ListRow icon="repeat" iconBg={theme.rituals} title="Subscriptions"
          value="$170/mo" onClick={onSubs} theme={theme} last />
      </Section>

      <Section theme={theme} header="Integrations">
        <ListRow icon="tray.fill" iconBg={theme.accent} title="Email sync"
          value="Gmail · On" onClick={onEmailSync} theme={theme} last />
      </Section>

      <Section theme={theme} header="Data">
        <ListRow icon="chart.bar.fill" iconBg={theme.move} title="All stats"
          onClick={onStats} theme={theme} />
        <ListRow icon="tray.fill" iconBg="#8E8E93" title="Export data" theme={theme} />
        <ListRow icon="bell.fill" iconBg="#FF9500" title="Notifications"
          value="3 new" onClick={onInbox} theme={theme} last />
      </Section>

      <Section theme={theme} header="Account">
        <ListRow icon="gearshape.fill" iconBg="#8E8E93" title="Settings" theme={theme} />
        <ListRow icon="heart.fill" iconBg={theme.red || '#FF3B30'} title="Help & feedback" theme={theme} last />
      </Section>
    </div>
  );
}

// Quick action sheet (opens from center FAB)
function QuickActionSheet({ theme, onClose, onLog, onWorkout, onAsk }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: theme.surface,
        borderRadius: '18px 18px 0 0', padding: '10px 12px 28px',
        animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{
          width: 36, height: 5, borderRadius: 3, background: theme.hair,
          margin: '6px auto 14px',
        }} />
        <div style={{
          fontFamily: SF, fontSize: 11, fontWeight: 700, color: theme.ink3,
          letterSpacing: 0.5, textTransform: 'uppercase',
          padding: '0 6px 8px',
        }}>Quick actions</div>
        {[
          { icon: 'plus.circle.fill', color: theme.accent, title: 'Log entry', sub: 'Money, meal, or movement — natural language', onClick: onLog },
          { icon: 'play.fill', color: theme.move, title: 'Start workout', sub: 'Pick a routine or freestyle', onClick: onWorkout },
          { icon: 'sparkles', color: theme.rituals, title: 'Ask Pal', sub: 'Chat about your patterns', onClick: onAsk },
        ].map((a, i, arr) => (
          <button key={i} onClick={a.onClick} style={{
            width: '100%', padding: '12px 10px', background: 'transparent',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            textAlign: 'left',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: `${a.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={a.icon} size={20} color={a.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: theme.ink, letterSpacing: -0.3 }}>
                {a.title}
              </div>
              <div style={{ fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                {a.sub}
              </div>
            </div>
            <Icon name="chevron.right" size={14} color={theme.ink4} />
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MoveTabScreen, RitualsTabScreen, YouTabScreen, QuickActionSheet });
