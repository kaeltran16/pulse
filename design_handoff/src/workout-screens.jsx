// Pre-workout + Active session + Post-workout summary

// ─── Pre-workout: routine picker + Pal suggestion ─────────────
function PreWorkoutScreen({ theme, onStart, onEdit, onOpenLibrary }) {
  const [suggestion, setSuggestion] = React.useState(
    "You hit push and cardio this week — pull is overdue. Try Pull Day A: deadlifts, rows, pull-ups. Should take 55 min."
  );
  const [loadingSugg, setLoadingSugg] = React.useState(false);

  const regen = async () => {
    setLoadingSugg(true);
    try {
      const resp = await window.claude.complete({
        messages: [{
          role: 'user',
          content: `In 2 sentences, suggest today's gym workout for a lifter. Context: last 7 days they did Push Day A (3d ago), Leg Day (2d ago), Treadmill Intervals (yesterday). They haven't pulled in 5 days. Available routines: Push Day A, Pull Day A, Leg Day, Upper Power, Treadmill Intervals, Row 5k. Be specific, warm, no hype.`
        }],
      });
      setSuggestion(resp.trim());
    } catch (e) {}
    setLoadingSugg(false);
  };

  const routines = window.ROUTINES || [];
  const strength = routines.filter(r => r.tag !== 'Cardio');
  const cardio = routines.filter(r => r.tag === 'Cardio');

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Start workout" subtitle="Pick a routine or freestyle"
        trailing={<NavIconButton name="ellipsis" theme={theme} />}
      />

      {/* Pal suggestion */}
      <div style={{ margin: '8px 16px 20px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${theme.move}1A 0%, ${theme.accent}14 100%)`,
          border: `0.5px solid ${theme.move}33`,
          borderRadius: 16, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="sparkles" size={14} color={theme.move} />
            <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: theme.move,
              letterSpacing: 0.8, textTransform: 'uppercase' }}>Pal's pick</span>
          </div>
          <div style={{ fontFamily: SF, fontSize: 15, color: theme.ink, letterSpacing: -0.24,
            lineHeight: 1.42, minHeight: 60, opacity: loadingSugg ? 0.4 : 1, transition: 'opacity 200ms' }}>
            {suggestion}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => onStart('pull-a')} style={{
              padding: '9px 16px', background: theme.move, color: '#fff',
              border: 'none', borderRadius: 100, cursor: 'pointer',
              fontFamily: SF, fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
            }}>Start Pull Day A</button>
            <button onClick={regen} disabled={loadingSugg} style={{
              padding: '9px 14px', background: theme.surface, border: `0.5px solid ${theme.hair}`,
              borderRadius: 100, cursor: 'pointer',
              fontFamily: SF, fontSize: 13, color: theme.ink2, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Icon name="sparkles" size={11} color={theme.ink2} />
              {loadingSugg ? 'Thinking…' : 'Another'}
            </button>
          </div>
        </div>
      </div>

      {/* Strength routines — grid cards */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          fontFamily: SF, fontSize: 13, fontWeight: 600, color: theme.ink3,
          letterSpacing: -0.08, textTransform: 'uppercase', padding: '0 4px 10px',
        }}>Strength · {strength.length} routines</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {strength.map(r => (
            <RoutineCard key={r.id} routine={r} theme={theme} onTap={() => onStart(r.id)} />
          ))}
        </div>
      </div>

      {/* Cardio */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          fontFamily: SF, fontSize: 13, fontWeight: 600, color: theme.ink3,
          letterSpacing: -0.08, textTransform: 'uppercase', padding: '0 4px 10px',
        }}>Cardio · {cardio.length} routines</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cardio.map(r => (
            <CardioRow key={r.id} routine={r} theme={theme} onTap={() => onStart(r.id)} />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '20px 16px 0' }}>
        <Section theme={theme}>
          <ListRow icon="plus" iconBg={theme.accent} title="New routine"
            subtitle="Build from scratch" theme={theme} />
          <ListRow icon="books.vertical.fill" iconBg={theme.ink3} title="Exercise library"
            subtitle={`${(window.EXERCISES||[]).length} exercises`} theme={theme} />
          <ListRow icon="bolt.fill" iconBg={theme.money} title="Freestyle session"
            subtitle="Log as you go" theme={theme} last />
        </Section>
      </div>
    </div>
  );
}

function RoutineCard({ routine, theme, onTap }) {
  const c = theme[routine.color] || theme.accent;
  return (
    <button onClick={onTap} style={{
      background: theme.surface, border: 'none', borderRadius: 14,
      padding: '14px 12px 12px', textAlign: 'left', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 118,
      boxShadow: `0 0 0 0.5px ${theme.hair}`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: `${c}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="figure.strengthtraining.traditional" size={18} color={c} />
      </div>
      <div style={{
        fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink,
        letterSpacing: -0.24, lineHeight: 1.2,
      }}>{routine.name}</div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08 }}>
          {routine.exerciseCount} ex · ~{routine.estMin}m
        </span>
      </div>
      <div style={{ fontFamily: SF, fontSize: 11, color: theme.ink4, letterSpacing: -0.08 }}>
        {routine.lastDone}
      </div>
    </button>
  );
}

function CardioRow({ routine, theme, onTap }) {
  const c = theme.move;
  return (
    <button onClick={onTap} style={{
      background: theme.surface, border: 'none', borderRadius: 14,
      padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center',
      gap: 12, boxShadow: `0 0 0 0.5px ${theme.hair}`, textAlign: 'left',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: c,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={routine.exercises[0] && (window.EXERCISES||[]).find(e => e.id === routine.exercises[0].id)?.sf || 'figure.run'}
          size={19} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 500, color: theme.ink, letterSpacing: -0.3 }}>
          {routine.name}
        </div>
        <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 2 }}>
          ~{routine.estMin} min · {routine.lastDone}
        </div>
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: c,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="play.fill" size={13} color="#fff" />
      </div>
    </button>
  );
}

// ─── Active session ──────────────────────────────────────────
function ActiveSessionScreen({ theme, routineId = 'push-a', onFinish, onBack }) {
  const routine = (window.ROUTINES || []).find(r => r.id === routineId) || window.ROUTINES[0];
  const allEx = window.EXERCISES || [];
  const exercises = routine.exercises.map(re => {
    const meta = allEx.find(e => e.id === re.id) || {};
    return { ...meta, sets: re.sets };
  });

  // Start at exercise 1 (not 0) to showcase progress — 1st ex has sets completed
  const [exIdx] = React.useState(1); // Overhead Press
  const [sessionTime] = React.useState('28:14');
  const [restSeconds] = React.useState(47); // rest timer currently running

  const cur = exercises[exIdx];
  const prev = exercises[exIdx - 1];
  const next = exercises[exIdx + 1];

  // Set state: first set done, second active, rest upcoming
  const setStates = [
    { ...cur.sets[0], state: 'done', actualReps: 6, actualWeight: 50 },
    { ...cur.sets[1], state: 'done', actualReps: 6, actualWeight: 52.5 },
    { ...cur.sets[2], state: 'active' },
  ];

  return (
    <div style={{ background: theme.bg, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Custom header with timer */}
      <div style={{
        background: theme.move, color: '#fff',
        padding: '54px 16px 14px', position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="chevron.down" size={14} color="#fff" />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase', opacity: 0.85,
            }}>ACTIVE · {routine.name.toUpperCase()}</div>
            <div style={{
              fontFamily: SFR, fontSize: 28, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, marginTop: 1,
            }}>{sessionTime}</div>
          </div>
          <button onClick={onFinish} style={{
            background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: 100,
            padding: '8px 14px', cursor: 'pointer', color: theme.move,
            fontFamily: SF, fontSize: 13, fontWeight: 700, letterSpacing: -0.1,
          }}>Finish</button>
        </div>

        {/* Progress dots per exercise */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'center' }}>
          {exercises.map((_, i) => (
            <div key={i} style={{
              width: i === exIdx ? 20 : 6, height: 4, borderRadius: 100,
              background: i < exIdx ? '#fff' : i === exIdx ? '#fff' : 'rgba(255,255,255,0.35)',
              transition: 'width 200ms',
            }} />
          ))}
        </div>
      </div>

      {/* Rest timer banner */}
      <div style={{
        background: theme.accent, color: '#fff',
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.4)',
          borderTopColor: '#fff',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, opacity: 0.85, textTransform: 'uppercase' }}>Rest</div>
          <div style={{ fontFamily: SFR, fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3, marginTop: -2 }}>
            0:{String(restSeconds).padStart(2, '0')}
          </div>
        </div>
        <button style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 100,
          padding: '6px 12px', color: '#fff', cursor: 'pointer',
          fontFamily: SF, fontSize: 12, fontWeight: 600,
        }}>+30s</button>
        <button style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 100,
          padding: '6px 12px', color: '#fff', cursor: 'pointer',
          fontFamily: SF, fontSize: 12, fontWeight: 600,
        }}>Skip</button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Current exercise */}
      <div style={{ padding: '20px 16px 0', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11, background: theme.move,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={cur.sf} size={22} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: SF, fontSize: 11, fontWeight: 700, color: theme.ink3,
              letterSpacing: 0.8, textTransform: 'uppercase',
            }}>Exercise {exIdx + 1} of {exercises.length}</div>
            <div style={{
              fontFamily: SF, fontSize: 22, fontWeight: 700, color: theme.ink,
              letterSpacing: -0.4, marginTop: -2,
            }}>{cur.name}</div>
          </div>
          <button style={{
            background: theme.fill, border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="ellipsis" size={14} color={theme.ink2} />
          </button>
        </div>

        <div style={{
          fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08,
          marginBottom: 14, paddingLeft: 56,
        }}>
          {cur.muscle} · {cur.equipment} · PR {cur.pr?.weight}kg × {cur.pr?.reps}
        </div>

        {/* Set table */}
        <div style={{
          background: theme.surface, borderRadius: 14, padding: '4px 0',
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '44px 1fr 1fr 1fr 40px',
            padding: '10px 14px',
            fontFamily: SF, fontSize: 11, fontWeight: 700, color: theme.ink3,
            letterSpacing: 0.5, textTransform: 'uppercase',
            borderBottom: `0.5px solid ${theme.hair}`,
          }}>
            <div>SET</div>
            <div>TARGET</div>
            <div>KG</div>
            <div>REPS</div>
            <div></div>
          </div>
          {setStates.map((s, i) => (
            <SetRow key={i} num={i + 1} set={s} theme={theme} />
          ))}
        </div>

        <button style={{
          width: '100%', background: 'transparent', border: `1px dashed ${theme.hair}`,
          borderRadius: 12, padding: '10px 14px', marginTop: 10, cursor: 'pointer',
          fontFamily: SF, fontSize: 14, color: theme.ink3, fontWeight: 500,
          letterSpacing: -0.1,
        }}>+ Add set</button>

        {/* Up next */}
        {next && (
          <div style={{ marginTop: 20, padding: '12px 14px', background: theme.surface,
            borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: `0 0 0 0.5px ${theme.hair}`,
          }}>
            <div style={{
              fontFamily: SF, fontSize: 10, fontWeight: 700, color: theme.ink3,
              letterSpacing: 0.8, textTransform: 'uppercase',
              writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            }}>UP NEXT</div>
            <div style={{
              width: 32, height: 32, borderRadius: 9, background: `${theme.move}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={next.sf} size={16} color={theme.move} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink, letterSpacing: -0.24 }}>
                {next.name}
              </div>
              <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08 }}>
                {next.sets.length} sets · target {next.sets[0].weight}kg × {next.sets[0].reps}
              </div>
            </div>
            <Icon name="chevron.right" size={13} color={theme.ink4} />
          </div>
        )}
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}

function SetRow({ num, set, theme }) {
  const active = set.state === 'active';
  const done = set.state === 'done';
  const bg = done ? `${theme.move}14` : active ? theme.accentTint : 'transparent';
  const kg = done ? set.actualWeight : set.weight;
  const reps = done ? set.actualReps : set.reps;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '44px 1fr 1fr 1fr 40px',
      padding: '12px 14px', alignItems: 'center',
      background: bg, transition: 'background 200ms',
      borderBottom: `0.5px solid ${theme.hair}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: done ? theme.move : active ? theme.accent : theme.fill,
        color: done || active ? '#fff' : theme.ink2,
        fontFamily: SF, fontSize: 14, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{num}</div>
      <div style={{
        fontFamily: SFR, fontSize: 13, color: theme.ink3,
        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.1,
      }}>{set.weight || 0}kg × {set.reps}</div>
      <div style={{
        fontFamily: SFR, fontSize: 18, fontWeight: 600,
        color: done ? theme.move : active ? theme.ink : theme.ink4,
        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
      }}>{kg || '—'}</div>
      <div style={{
        fontFamily: SFR, fontSize: 18, fontWeight: 600,
        color: done ? theme.move : active ? theme.ink : theme.ink4,
        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
      }}>{reps || '—'}</div>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: done ? theme.move : active ? `${theme.accent}22` : theme.fill,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <Icon name={done ? 'checkmark' : 'plus'} size={12} color={done ? '#fff' : active ? theme.accent : theme.ink4} />
      </div>
    </div>
  );
}

// ─── Post-workout summary ────────────────────────────────────
function PostWorkoutScreen({ theme, onDone }) {
  const session = (window.PAST_SESSIONS || [])[0];
  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(160deg, ${theme.move} 0%, ${theme.accent} 100%)`,
        color: '#fff', padding: '56px 20px 24px', position: 'relative',
      }}>
        <div style={{
          fontFamily: SF, fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
          textTransform: 'uppercase', opacity: 0.8,
        }}>COMPLETE · {session.routineName.toUpperCase()}</div>
        <div style={{
          fontFamily: SF, fontSize: 32, fontWeight: 700, marginTop: 4, letterSpacing: -0.6,
        }}>Nice session.</div>
        <div style={{
          fontFamily: SF, fontSize: 15, opacity: 0.85, marginTop: 4, letterSpacing: -0.24,
        }}>You hit a new PR on bench.</div>

        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 22 }}>
          {[
            { l: 'Time', v: `${session.duration}`, u: 'min' },
            { l: 'Volume', v: `${session.volume.toLocaleString()}`, u: 'kg' },
            { l: 'PRs', v: `${session.prs}`, u: session.prs === 1 ? 'record' : 'records' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{
                fontFamily: SFR, fontSize: 32, fontWeight: 700,
                fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5,
              }}>{s.v}</div>
              <div style={{ fontFamily: SF, fontSize: 12, opacity: 0.8, letterSpacing: -0.08, marginTop: -2 }}>{s.u} · {s.l.toLowerCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Muscle groups hit */}
      <div style={{ padding: '20px 16px 0' }}>
        <Section theme={theme} header="Muscles worked">
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Chest', 'Shoulders', 'Triceps'].map(m => (
                <span key={m} style={{
                  padding: '5px 11px', background: theme.moveTint, color: theme.move,
                  fontFamily: SF, fontSize: 12, fontWeight: 600, letterSpacing: -0.08,
                  borderRadius: 100,
                }}>{m}</span>
              ))}
            </div>
            <div style={{
              marginTop: 12, height: 8, background: theme.fill, borderRadius: 100, overflow: 'hidden',
              display: 'flex',
            }}>
              <div style={{ width: '45%', background: theme.move }} />
              <div style={{ width: '30%', background: theme.accent }} />
              <div style={{ width: '25%', background: theme.rituals }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {[
                { l: 'Chest', p: '45%', c: theme.move },
                { l: 'Shoulders', p: '30%', c: theme.accent },
                { l: 'Triceps', p: '25%', c: theme.rituals },
              ].map(x => (
                <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: x.c }} />
                  <span style={{ fontFamily: SF, fontSize: 11, color: theme.ink3, letterSpacing: -0.08 }}>
                    {x.l} {x.p}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Exercise list recap */}
      <Section theme={theme} header="Exercises" footer="Swipe right on any set to annotate">
        {session.exercises.map((ex, i, arr) => {
          const vol = ex.sets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0);
          const pr = ex.sets.find(s => s.pr);
          return (
            <div key={i} style={{
              padding: '12px 16px',
              borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink, letterSpacing: -0.24 }}>
                  {ex.name}
                </div>
                {pr && (
                  <span style={{
                    padding: '2px 7px', background: theme.money, color: '#fff',
                    borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                  }}>PR</span>
                )}
                <div style={{ flex: 1 }} />
                <div style={{ fontFamily: SFR, fontSize: 13, color: theme.ink3, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.08 }}>
                  {vol.toLocaleString()} kg
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                {ex.sets.map((s, j) => (
                  <span key={j} style={{
                    padding: '4px 8px', borderRadius: 6,
                    background: s.pr ? theme.money : theme.fill,
                    color: s.pr ? '#fff' : theme.ink2,
                    fontFamily: SFR, fontSize: 11, fontWeight: 600,
                    letterSpacing: -0.08, fontVariantNumeric: 'tabular-nums',
                  }}>{s.weight}×{s.reps}</span>
                ))}
              </div>
            </div>
          );
        })}
      </Section>

      <div style={{ padding: '8px 16px 0', display: 'flex', gap: 10 }}>
        <button style={{
          flex: 1, padding: '13px', background: theme.surface, border: `0.5px solid ${theme.hair}`,
          borderRadius: 12, cursor: 'pointer', fontFamily: SF, fontSize: 15, fontWeight: 500,
          color: theme.ink, letterSpacing: -0.24,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="square.and.arrow.up" size={14} color={theme.ink} />
          Share
        </button>
        <button onClick={onDone} style={{
          flex: 2, padding: '13px', background: theme.move, border: 'none',
          borderRadius: 12, cursor: 'pointer', fontFamily: SF, fontSize: 15, fontWeight: 700,
          color: '#fff', letterSpacing: -0.24,
        }}>Save to timeline</button>
      </div>
    </div>
  );
}

Object.assign(window, { PreWorkoutScreen, ActiveSessionScreen, PostWorkoutScreen });
