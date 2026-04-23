// Move tab landing, Rituals tab landing, Quick action sheet
// These are the tab-bar destinations; deeper screens push from here.

function MoveTabScreen({ theme, onStart, onHistory, onRoutines, onLibrary, onDetail }) {
  const sessions = (window.PAST_SESSIONS || []).slice(0, 4);
  const routines = (window.ROUTINES || []).slice(0, 3);
  const allEx = window.EXERCISES || [];

  // this week totals
  const thisWeek = { workouts: 3, volume: 12400, minutes: 148, cardio: 2 };

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} largeTitle="Move" subtitle="Gym, cardio, daily movement"
        trailing={<NavIconButton name="ellipsis" theme={theme} />} />

      {/* This week hero */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${theme.move} 0%, ${theme.move}dd 100%)`,
          borderRadius: 18, padding: 18, color: '#fff',
          boxShadow: `0 8px 24px ${theme.move}33`,
        }}>
          <div style={{
            fontFamily: SF, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            textTransform: 'uppercase', opacity: 0.85, marginBottom: 4,
          }}>This week</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontFamily: SFR, fontSize: 42, fontWeight: 700, letterSpacing: -1,
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>{thisWeek.workouts}</span>
            <span style={{ fontFamily: SF, fontSize: 15, opacity: 0.9 }}>workouts · {thisWeek.minutes} min</span>
          </div>
          <div style={{
            marginTop: 10, display: 'flex', gap: 6,
          }}>
            {[1,1,0,1,0,0,0].map((d, i) => (
              <div key={i} style={{
                flex: 1, height: 6, borderRadius: 3,
                background: d ? '#fff' : 'rgba(255,255,255,0.28)',
              }} />
            ))}
          </div>
          <div style={{
            marginTop: 8, fontFamily: SF, fontSize: 12, opacity: 0.85,
            letterSpacing: -0.08,
          }}>Mon · Tue · <b style={{ opacity: 1 }}>Thu</b> · on track for 4</div>
        </div>
      </div>

      {/* Start workout CTA */}
      <div style={{ padding: '0 16px 18px' }}>
        <button onClick={onStart} style={{
          width: '100%', padding: '16px 18px',
          background: theme.surface, border: 'none', borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: theme.move,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${theme.move}55`,
          }}>
            <Icon name="play.fill" size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: SF, fontSize: 16, fontWeight: 600, color: theme.ink,
              letterSpacing: -0.3,
            }}>Start workout</div>
            <div style={{
              fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08,
              marginTop: 1,
            }}>Pal suggests Pull Day A · 55 min</div>
          </div>
          <Icon name="chevron.right" size={14} color={theme.ink4} />
        </button>
      </div>

      {/* Quick links */}
      <Section theme={theme}>
        <ListRow icon="books.vertical.fill" iconBg={theme.move} title="My routines"
          value={`${(window.ROUTINES || []).length}`} onClick={onRoutines} theme={theme} />
        <ListRow icon="dumbbell.fill" iconBg={theme.accent} title="Exercise library"
          value={`${allEx.length}`} onClick={onLibrary} theme={theme} />
        <ListRow icon="chart.bar.fill" iconBg={theme.rituals} title="History & trends"
          value="All time" onClick={onHistory} theme={theme} last />
      </Section>

      {/* Recent sessions */}
      <Section theme={theme} header="Recent sessions">
        {sessions.map((s, i, arr) => (
          <div key={i} onClick={onDetail} style={{
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 11,
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            cursor: 'pointer',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: s.type === 'cardio' ? `${theme.accent}22` : `${theme.move}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={s.type === 'cardio' ? 'figure.run' : 'dumbbell.fill'} size={18}
                color={s.type === 'cardio' ? theme.accent : theme.move} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink, letterSpacing: -0.24 }}>
                {s.routineName}
              </div>
              <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                {s.date} · {s.duration} min{s.volume ? ` · ${(s.volume/1000).toFixed(1)}t` : ''}
              </div>
            </div>
            {s.prs > 0 && (
              <div style={{
                padding: '2px 7px', background: theme.money, color: '#fff',
                borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
              }}>{s.prs} PR</div>
            )}
            <Icon name="chevron.right" size={13} color={theme.ink4} />
          </div>
        ))}
      </Section>
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
      <NavBar theme={theme} largeTitle="Rituals" subtitle={`${done} of ${rituals.length} done today`}
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

function YouTabScreen({ theme, onWeek, onMonthly, onStats, onEmailSync }) {
  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} largeTitle="You" subtitle="Reviews, patterns, settings"
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
        <ListRow icon="calendar" iconBg={theme.rituals} title="This week"
          value="Thu Oct 23" onClick={onWeek} theme={theme} />
        <ListRow icon="chart.bar.fill" iconBg={theme.accent} title="Monthly review"
          value="October" onClick={onMonthly} theme={theme} />
        <ListRow icon="sparkles" iconBg={theme.money} title="Yearly rewind"
          value="Preview" theme={theme} last />
      </Section>

      <Section theme={theme} header="Integrations">
        <ListRow icon="tray.fill" iconBg={theme.accent} title="Email sync"
          value="Gmail · On" onClick={onEmailSync} theme={theme} last />
      </Section>

      <Section theme={theme} header="Data">
        <ListRow icon="chart.bar.fill" iconBg={theme.move} title="All stats"
          onClick={onStats} theme={theme} />
        <ListRow icon="tray.fill" iconBg="#8E8E93" title="Export data" theme={theme} />
        <ListRow icon="bell.fill" iconBg="#FF9500" title="Notifications" theme={theme} last />
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
