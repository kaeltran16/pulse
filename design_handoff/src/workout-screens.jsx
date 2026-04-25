// Pre-workout + Active session + Post-workout summary

// ─── Pre-workout: routine picker + Pal suggestion ─────────────
function PreWorkoutScreen({ theme, onStart, onEdit, onOpenLibrary, onGenerate }) {
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
  const allEx = window.EXERCISES || [];
  const strength = routines.filter(r => r.tag !== 'Cardio');
  const cardio = routines.filter(r => r.tag === 'Cardio');

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Start workout" subtitle="Pick a routine or freestyle"
        trailing={<NavIconButton name="ellipsis" theme={theme} />}
      />

      {/* Pal suggestion — richer with exercise stack preview */}
      <div style={{ margin: '8px 16px 22px' }}>
        <div style={{
          background: theme.ink, color: '#fff',
          borderRadius: 20, padding: 18, position: 'relative', overflow: 'hidden',
        }}>
          {/* decorative blobs */}
          <div style={{
            position: 'absolute', top: -40, right: -30, width: 160, height: 160,
            borderRadius: '50%', background: `radial-gradient(circle, ${theme.move}55, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, left: 40, width: 100, height: 100,
            borderRadius: '50%', background: `radial-gradient(circle, ${theme.accent}33, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: theme.move,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="sparkles" size={11} color="#fff" />
              </div>
              <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#fff',
                letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 }}>Pal's pick for today</span>
            </div>

            <div style={{
              fontFamily: SFR, fontSize: 26, fontWeight: 700, color: '#fff',
              letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 4,
            }}>Pull Day A</div>
            <div style={{
              fontFamily: SF, fontSize: 13, color: '#fff', opacity: 0.7,
              letterSpacing: -0.08, marginBottom: 14,
            }}>5 exercises · 58 min · last done 5 days ago</div>

            <div style={{
              fontFamily: SF, fontSize: 14, color: '#fff', opacity: 0.88,
              letterSpacing: -0.2, lineHeight: 1.45, minHeight: 60,
              opacity: loadingSugg ? 0.3 : 0.88, transition: 'opacity 200ms',
            }}>
              {suggestion}
            </div>

            {/* exercise preview strip */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14, marginBottom: 16, flexWrap: 'wrap' }}>
              {['Deadlift', 'Pull-up', 'Barbell Row', 'Face Pull', 'Bicep Curl'].map((ex, i) => (
                <span key={ex} style={{
                  padding: '4px 9px', background: 'rgba(255,255,255,0.12)',
                  border: '0.5px solid rgba(255,255,255,0.15)',
                  color: '#fff', borderRadius: 100,
                  fontFamily: SF, fontSize: 11, fontWeight: 500, letterSpacing: -0.08,
                }}>{ex}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onStart('pull-a')} style={{
                flex: 1, padding: '12px 16px', background: theme.move, color: '#fff',
                border: 'none', borderRadius: 100, cursor: 'pointer',
                fontFamily: SF, fontSize: 15, fontWeight: 700, letterSpacing: -0.2,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: `0 6px 20px ${theme.move}55`,
              }}>
                <Icon name="play.fill" size={12} color="#fff" />
                Start Pull Day A
              </button>
              <button onClick={regen} disabled={loadingSugg} style={{
                padding: '12px 14px', background: 'rgba(255,255,255,0.1)',
                border: '0.5px solid rgba(255,255,255,0.2)',
                borderRadius: 100, cursor: 'pointer', color: '#fff',
                fontFamily: SF, fontSize: 13, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Icon name="arrow.clockwise" size={11} color="#fff" />
                {loadingSugg ? 'Thinking…' : 'Other'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Strength routines — larger illustrated cards */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, fontWeight: 700, color: theme.ink3,
          letterSpacing: 0.8, textTransform: 'uppercase', padding: '0 4px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Strength · {strength.length}</span>
          <span style={{ color: theme.accent, fontWeight: 600, letterSpacing: -0.08, textTransform: 'none', fontSize: 13 }}>See all</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {strength.map(r => (
            <RoutineCard key={r.id} routine={r} theme={theme} allEx={allEx} onTap={() => onStart(r.id)} />
          ))}
        </div>
      </div>

      {/* Cardio — wider richer rows */}
      <div style={{ padding: '22px 16px 0' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, fontWeight: 700, color: theme.ink3,
          letterSpacing: 0.8, textTransform: 'uppercase', padding: '0 4px 12px',
        }}>Cardio · {cardio.length}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cardio.map(r => (
            <CardioRow key={r.id} routine={r} theme={theme} onTap={() => onStart(r.id)} />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '22px 16px 0' }}>
        <Section theme={theme}>
          <ListRow icon="sparkles" iconBg={theme.move} title="Generate with AI"
            subtitle="Describe the workout you want" onClick={onGenerate} theme={theme} />
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

function RoutineCard({ routine, theme, allEx, onTap }) {
  const c = theme[routine.color] || theme.accent;
  // top exercises for preview
  const topEx = routine.exercises.slice(0, 3).map(re => allEx.find(e => e.id === re.id)).filter(Boolean);
  const totalSets = routine.exercises.reduce((s, re) => s + re.sets.length, 0);

  return (
    <button onClick={onTap} style={{
      background: theme.surface, border: 'none', borderRadius: 16,
      padding: 0, textAlign: 'left', cursor: 'pointer',
      display: 'flex', flexDirection: 'column',
      boxShadow: `0 0 0 0.5px ${theme.hair}, 0 1px 2px rgba(0,0,0,0.03)`,
      overflow: 'hidden',
    }}>
      {/* Colored header band */}
      <div style={{
        background: `linear-gradient(135deg, ${c} 0%, ${c}dd 100%)`,
        padding: '12px 14px 14px', position: 'relative', overflow: 'hidden',
      }}>
        {/* diagonal stripes decoration */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(135deg, transparent 0 16px, rgba(255,255,255,0.06) 16px 17px)`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#fff', opacity: 0.8,
              letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3,
            }}>{routine.tag}</div>
            <div style={{
              fontFamily: SF, fontSize: 15, fontWeight: 700, color: '#fff',
              letterSpacing: -0.3, lineHeight: 1.15,
            }}>{routine.name}</div>
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="play.fill" size={11} color="#fff" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* exercise mini-stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
          {topEx.map(ex => (
            <div key={ex.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: SF, fontSize: 11, color: theme.ink2, letterSpacing: -0.08,
            }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
            </div>
          ))}
          {routine.exercises.length > 3 && (
            <div style={{
              fontFamily: SF, fontSize: 10, color: theme.ink4, letterSpacing: -0.08,
              paddingLeft: 9,
            }}>+ {routine.exercises.length - 3} more</div>
          )}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10,
          paddingTop: 8, borderTop: `0.5px solid ${theme.hair}` }}>
          <div>
            <div style={{
              fontFamily: SFR, fontSize: 15, fontWeight: 700, color: theme.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2, lineHeight: 1,
            }}>{routine.estMin}<span style={{ fontSize: 10, fontWeight: 500, color: theme.ink3, marginLeft: 1 }}>m</span></div>
            <div style={{ fontFamily: SF, fontSize: 9, color: theme.ink3, letterSpacing: 0.3,
              textTransform: 'uppercase', fontWeight: 600, marginTop: 1 }}>est</div>
          </div>
          <div style={{ width: 1, height: 20, background: theme.hair }} />
          <div>
            <div style={{
              fontFamily: SFR, fontSize: 15, fontWeight: 700, color: theme.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2, lineHeight: 1,
            }}>{totalSets}</div>
            <div style={{ fontFamily: SF, fontSize: 9, color: theme.ink3, letterSpacing: 0.3,
              textTransform: 'uppercase', fontWeight: 600, marginTop: 1 }}>sets</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: SF, fontSize: 10, color: theme.ink4, letterSpacing: -0.08,
            textAlign: 'right' }}>{routine.lastDone}</div>
        </div>
      </div>
    </button>
  );
}

function CardioRow({ routine, theme, onTap }) {
  const c = theme.move;
  const ex = routine.exercises[0];
  const firstSet = ex?.sets[0] || {};
  const exMeta = (window.EXERCISES || []).find(e => e.id === ex?.id) || {};

  return (
    <button onClick={onTap} style={{
      background: theme.surface, border: 'none', borderRadius: 16,
      padding: 0, cursor: 'pointer', overflow: 'hidden',
      boxShadow: `0 0 0 0.5px ${theme.hair}`,
      display: 'flex', alignItems: 'stretch',
    }}>
      {/* Left colored panel */}
      <div style={{
        width: 78, flexShrink: 0,
        background: `linear-gradient(160deg, ${c} 0%, ${c}cc 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(45deg, transparent 0 8px, rgba(255,255,255,0.08) 8px 9px)`,
        }} />
        <Icon name={exMeta.sf || 'figure.run'} size={32} color="#fff" />
      </div>

      <div style={{ flex: 1, padding: '12px 14px', textAlign: 'left' }}>
        <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: theme.ink, letterSpacing: -0.3 }}>
          {routine.name}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'baseline' }}>
          <div>
            <span style={{ fontFamily: SFR, fontSize: 16, fontWeight: 700, color: theme.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2 }}>{firstSet.distance || routine.estMin}</span>
            <span style={{ fontFamily: SF, fontSize: 11, color: theme.ink3, letterSpacing: -0.08, marginLeft: 2 }}>
              {firstSet.distance ? 'km' : 'min'}
            </span>
          </div>
          {firstSet.pace && (
            <>
              <div style={{ width: 1, height: 12, background: theme.hair }} />
              <div>
                <span style={{ fontFamily: SFR, fontSize: 13, fontWeight: 600, color: theme.ink2,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.08 }}>{firstSet.pace}</span>
                <span style={{ fontFamily: SF, fontSize: 10, color: theme.ink3, letterSpacing: -0.08, marginLeft: 3 }}>pace</span>
              </div>
            </>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: SF, fontSize: 11, color: theme.ink4, letterSpacing: -0.08 }}>{routine.lastDone}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 14 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: `${c}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="play.fill" size={11} color={c} />
        </div>
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

  const [exIdx] = React.useState(1); // Overhead Press
  const [sessionTime] = React.useState('28:14');
  const [restSeconds] = React.useState(47);

  const cur = exercises[exIdx];
  const next = exercises[exIdx + 1];

  const setStates = [
    { ...cur.sets[0], state: 'done', actualReps: 6, actualWeight: 50 },
    { ...cur.sets[1], state: 'done', actualReps: 6, actualWeight: 52.5 },
    { ...cur.sets[2], state: 'active' },
  ];

  const completedSets = setStates.filter(s => s.state === 'done').length;
  const totalVolume = setStates
    .filter(s => s.state === 'done')
    .reduce((sum, s) => sum + s.actualWeight * s.actualReps, 0);

  return (
    <div style={{ background: theme.bg, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Custom header with timer */}
      <div style={{
        background: `linear-gradient(175deg, ${theme.move} 0%, ${theme.move}ee 100%)`,
        color: '#fff', padding: '54px 16px 18px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(135deg, transparent 0 20px, rgba(255,255,255,0.04) 20px 21px)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', opacity: 0.75,
            }}>● {routine.name.toUpperCase()}</div>
            <div style={{
              fontFamily: SFR, fontSize: 32, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.6, marginTop: 2,
            }}>{sessionTime}</div>
          </div>
          <button onClick={onFinish} style={{
            background: '#fff', border: 'none', borderRadius: 100,
            padding: '9px 16px', cursor: 'pointer', color: theme.move,
            fontFamily: SF, fontSize: 13, fontWeight: 700, letterSpacing: -0.1,
          }}>Finish</button>
        </div>

        {/* Exercise progress dots */}
        <div style={{ display: 'flex', gap: 5, marginTop: 16, justifyContent: 'center' }}>
          {exercises.map((_, i) => (
            <div key={i} style={{
              width: i === exIdx ? 24 : 6, height: 4, borderRadius: 100,
              background: i <= exIdx ? '#fff' : 'rgba(255,255,255,0.3)',
              transition: 'width 200ms',
            }} />
          ))}
        </div>

        {/* Session quick stats */}
        <div style={{
          position: 'relative', marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 1, background: 'rgba(255,255,255,0.18)', padding: 1, borderRadius: 12, overflow: 'hidden',
        }}>
          {[
            { l: 'Exercise', v: `${exIdx + 1}/${exercises.length}` },
            { l: 'Sets', v: `${completedSets}/${setStates.length}` },
            { l: 'Volume', v: `${totalVolume.toLocaleString()}` },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.12)', padding: '8px 10px',
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: SFR, fontSize: 16, fontWeight: 700, color: '#fff',
                fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontFamily: SF, fontSize: 9, color: '#fff', opacity: 0.75,
                letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rest timer banner — more prominent */}
      <div style={{
        background: theme.accent, color: '#fff',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* progress fill */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${((120 - restSeconds) / 120) * 100}%`,
          background: 'rgba(255,255,255,0.12)',
        }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            animation: 'spin 1s linear infinite',
          }} />
          <div>
            <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: 1, opacity: 0.85, textTransform: 'uppercase' }}>Rest</div>
            <div style={{ fontFamily: SFR, fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3, marginTop: -3 }}>
              0:{String(restSeconds).padStart(2, '0')}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', display: 'flex', gap: 6 }}>
          <button style={{
            background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 100,
            padding: '7px 12px', color: '#fff', cursor: 'pointer',
            fontFamily: SF, fontSize: 12, fontWeight: 600, letterSpacing: -0.08,
          }}>+30s</button>
          <button style={{
            background: '#fff', border: 'none', borderRadius: 100,
            padding: '7px 14px', color: theme.accent, cursor: 'pointer',
            fontFamily: SF, fontSize: 12, fontWeight: 700, letterSpacing: -0.08,
          }}>Skip</button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Current exercise — hero card */}
      <div style={{ padding: '18px 16px 0', flex: 1 }}>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: 18,
          boxShadow: `0 0 0 0.5px ${theme.hair}, 0 2px 8px rgba(0,0,0,0.04)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 13,
              background: `linear-gradient(135deg, ${theme.move} 0%, ${theme.move}cc 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${theme.move}33`,
              flexShrink: 0,
            }}>
              <Icon name={cur.sf} size={26} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: SF, fontSize: 10, fontWeight: 700, color: theme.move,
                letterSpacing: 1.2, textTransform: 'uppercase',
              }}>● Now · exercise {exIdx + 1}</div>
              <div style={{
                fontFamily: SFR, fontSize: 22, fontWeight: 700, color: theme.ink,
                letterSpacing: -0.4, marginTop: 2, lineHeight: 1.1,
              }}>{cur.name}</div>
              <div style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 5,
              }}>
                {cur.muscle} · {cur.equipment}
              </div>
            </div>
            <button style={{
              background: theme.fill, border: 'none', borderRadius: '50%',
              width: 32, height: 32, cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="ellipsis" size={13} color={theme.ink2} />
            </button>
          </div>

          {/* PR highlight chip */}
          {cur.pr && (
            <div style={{
              background: `${theme.money}12`,
              border: `0.5px solid ${theme.money}33`,
              borderRadius: 10, padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
            }}>
              <Icon name="star.fill" size={12} color={theme.money} />
              <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 600, color: theme.ink2, letterSpacing: -0.08 }}>
                Your PR:
              </span>
              <span style={{ fontFamily: SFR, fontSize: 13, fontWeight: 700, color: theme.ink,
                fontVariantNumeric: 'tabular-nums', letterSpacing: -0.1 }}>
                {cur.pr.weight}kg × {cur.pr.reps}
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: SF, fontSize: 11, color: theme.ink3, letterSpacing: -0.08 }}>
                Beat it today?
              </span>
            </div>
          )}

          {/* Set cards — vertical with BIG weight */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {setStates.map((s, i) => (
              <SetCard key={i} num={i + 1} set={s} theme={theme} />
            ))}
          </div>

          <button style={{
            width: '100%', background: 'transparent', border: `1.5px dashed ${theme.hair}`,
            borderRadius: 12, padding: '12px', marginTop: 10, cursor: 'pointer',
            fontFamily: SF, fontSize: 14, color: theme.ink3, fontWeight: 600,
            letterSpacing: -0.1, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
          }}>
            <Icon name="plus" size={12} color={theme.ink3} />
            Add set
          </button>
        </div>

        {/* Up next */}
        {next && (
          <div style={{ marginTop: 16, padding: '14px', background: theme.surface,
            borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: `0 0 0 0.5px ${theme.hair}`,
          }}>
            <div style={{
              fontFamily: SF, fontSize: 9, fontWeight: 700, color: theme.ink3,
              letterSpacing: 1, textTransform: 'uppercase',
              padding: '3px 6px', background: theme.fill, borderRadius: 4,
            }}>NEXT</div>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: `${theme.move}1a`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={next.sf} size={18} color={theme.move} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink, letterSpacing: -0.24 }}>
                {next.name}
              </div>
              <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                {next.sets.length} sets · {next.sets[0].weight}kg × {next.sets[0].reps}
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

function SetCard({ num, set, theme }) {
  const active = set.state === 'active';
  const done = set.state === 'done';

  // done set — compact horizontal
  if (done) {
    const volume = set.actualWeight * set.actualReps;
    return (
      <div style={{
        background: `${theme.move}0e`,
        border: `0.5px solid ${theme.move}22`,
        borderRadius: 12, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: theme.move,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="checkmark" size={12} color="#fff" />
        </div>
        <div style={{
          fontFamily: SF, fontSize: 13, fontWeight: 700, color: theme.ink3,
          letterSpacing: 0.3,
        }}>SET {num}</div>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: SFR, fontSize: 17, fontWeight: 700, color: theme.ink,
          fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
        }}>
          {set.actualWeight}
          <span style={{ fontSize: 11, fontWeight: 500, color: theme.ink3, marginLeft: 2 }}>kg</span>
          <span style={{ color: theme.ink4, fontWeight: 400, margin: '0 6px' }}>×</span>
          {set.actualReps}
        </div>
        <div style={{
          fontFamily: SF, fontSize: 11, color: theme.ink3, letterSpacing: -0.08,
          textAlign: 'right', minWidth: 42,
        }}>{volume} kg</div>
      </div>
    );
  }

  // active set — large, input-ready
  if (active) {
    return (
      <div style={{
        background: `linear-gradient(135deg, ${theme.accentTint} 0%, ${theme.accent}15 100%)`,
        border: `1.5px solid ${theme.accent}`,
        borderRadius: 14, padding: '14px 14px',
        boxShadow: `0 0 0 3px ${theme.accent}15, 0 2px 8px ${theme.accent}22`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            padding: '3px 10px', borderRadius: 100, background: theme.accent,
            fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#fff',
            letterSpacing: 0.5,
          }}>SET {num}</div>
          <div style={{
            fontFamily: SF, fontSize: 11, color: theme.ink3, letterSpacing: -0.08,
          }}>Target: {set.weight}kg × {set.reps} reps</div>
          <div style={{ flex: 1 }} />
          <div style={{
            fontFamily: SF, fontSize: 10, fontWeight: 700, color: theme.accent,
            letterSpacing: 0.8, textTransform: 'uppercase',
          }}>Active</div>
        </div>

        {/* Weight + reps inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={{
            background: theme.surface, borderRadius: 10, padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: SF, fontSize: 9, fontWeight: 700, color: theme.ink3,
              letterSpacing: 0.8, textTransform: 'uppercase' }}>Weight</div>
            <div style={{ fontFamily: SFR, fontSize: 28, fontWeight: 700, color: theme.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, lineHeight: 1.1, marginTop: 2 }}>
              {set.weight}<span style={{ fontSize: 13, color: theme.ink3, fontWeight: 500, marginLeft: 1 }}>kg</span>
            </div>
          </div>
          <div style={{
            background: theme.surface, borderRadius: 10, padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: SF, fontSize: 9, fontWeight: 700, color: theme.ink3,
              letterSpacing: 0.8, textTransform: 'uppercase' }}>Reps</div>
            <div style={{ fontFamily: SFR, fontSize: 28, fontWeight: 700, color: theme.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, lineHeight: 1.1, marginTop: 2 }}>
              {set.reps}
            </div>
          </div>
        </div>

        <button style={{
          width: '100%', padding: '11px', background: theme.accent, border: 'none',
          borderRadius: 10, cursor: 'pointer',
          fontFamily: SF, fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: -0.1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: `0 2px 8px ${theme.accent}55`,
        }}>
          <Icon name="checkmark" size={13} color="#fff" />
          Complete set
        </button>
      </div>
    );
  }

  // upcoming
  return (
    <div style={{
      background: theme.fill, border: `0.5px solid ${theme.hair}`,
      borderRadius: 12, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 12, opacity: 0.85,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: `1.5px solid ${theme.ink4}`, background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: SF, fontSize: 12, fontWeight: 700, color: theme.ink3,
      }}>{num}</div>
      <div style={{
        fontFamily: SF, fontSize: 13, fontWeight: 700, color: theme.ink3,
        letterSpacing: 0.3,
      }}>SET {num}</div>
      <div style={{ flex: 1 }} />
      <div style={{
        fontFamily: SFR, fontSize: 15, fontWeight: 500, color: theme.ink3,
        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
      }}>
        {set.weight}<span style={{ fontSize: 10, color: theme.ink4, marginLeft: 1 }}>kg</span>
        <span style={{ color: theme.ink4, fontWeight: 400, margin: '0 6px' }}>×</span>
        {set.reps}
      </div>
    </div>
  );
}

// ─── Post-workout summary ────────────────────────────────────
function PostWorkoutScreen({ theme, onDone }) {
  const session = (window.PAST_SESSIONS || [])[0];
  const totalSets = session.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const totalReps = session.exercises.reduce((s, ex) => s + ex.sets.reduce((a, b) => a + b.reps, 0), 0);

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(160deg, ${theme.move} 0%, ${theme.accent} 100%)`,
        color: '#fff', padding: '56px 20px 28px', position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative */}
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 220, height: 220,
          borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -30, width: 180, height: 180,
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(135deg, transparent 0 24px, rgba(255,255,255,0.03) 24px 25px)`,
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', background: 'rgba(255,255,255,0.18)',
            borderRadius: 100,
            fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            <Icon name="checkmark" size={10} color="#fff" />
            Complete
          </div>
          <div style={{
            fontFamily: SFR, fontSize: 34, fontWeight: 700, marginTop: 10, letterSpacing: -0.7,
            lineHeight: 1.05,
          }}>Nice session.</div>
          <div style={{
            fontFamily: SF, fontSize: 15, opacity: 0.9, marginTop: 4, letterSpacing: -0.24,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="star.fill" size={12} color="#fff" />
            You hit a new PR on bench · {session.routineName}
          </div>

          {/* Stat grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
            marginTop: 22, background: 'rgba(255,255,255,0.18)',
            padding: 1, borderRadius: 14, overflow: 'hidden',
          }}>
            {[
              { l: 'Time', v: session.duration, u: 'min' },
              { l: 'Volume', v: (session.volume / 1000).toFixed(1), u: 'tonnes' },
              { l: 'Sets', v: totalSets, u: `${totalReps} reps` },
              { l: 'PRs', v: session.prs, u: 'records' },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'rgba(0,0,0,0.14)', padding: '12px 8px', textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: SFR, fontSize: 24, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.4, lineHeight: 1,
                }}>{s.v}</div>
                <div style={{ fontFamily: SF, fontSize: 9, opacity: 0.85, letterSpacing: 0.5,
                  marginTop: 4, textTransform: 'uppercase', fontWeight: 700 }}>{s.l}</div>
                <div style={{ fontFamily: SF, fontSize: 10, opacity: 0.7, letterSpacing: -0.08, marginTop: 1 }}>{s.u}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PR highlight card */}
      <div style={{ padding: '18px 16px 0' }}>
        <div style={{
          background: `linear-gradient(135deg, ${theme.money}15 0%, ${theme.money}08 100%)`,
          border: `0.5px solid ${theme.money}33`,
          borderRadius: 16, padding: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `linear-gradient(135deg, ${theme.money} 0%, ${theme.money}cc 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${theme.money}55`,
          }}>
            <Icon name="star.fill" size={22} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: SF, fontSize: 10, fontWeight: 700, color: theme.money,
              letterSpacing: 0.8, textTransform: 'uppercase',
            }}>Personal record</div>
            <div style={{
              fontFamily: SFR, fontSize: 17, fontWeight: 700, color: theme.ink,
              letterSpacing: -0.3, marginTop: 2,
            }}>Bench Press · 90kg × 5</div>
            <div style={{
              fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 2,
            }}>+5kg from previous best · Oct 14</div>
          </div>
        </div>
      </div>

      {/* Muscle distribution */}
      <div style={{ padding: '18px 16px 0' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, fontWeight: 700, color: theme.ink3,
          letterSpacing: 0.8, textTransform: 'uppercase', padding: '0 4px 10px',
        }}>Muscles worked</div>
        <div style={{
          background: theme.surface, borderRadius: 14, padding: 16,
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          {[
            { l: 'Chest', p: 45, v: '1,910 kg', c: theme.move },
            { l: 'Shoulders', p: 30, v: '1,275 kg', c: theme.accent },
            { l: 'Triceps', p: 25, v: '1,065 kg', c: theme.rituals },
          ].map((m, i) => (
            <div key={m.l} style={{ marginBottom: i < 2 ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 5 }}>
                <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: theme.ink, letterSpacing: -0.1 }}>
                  {m.l}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: SFR, fontSize: 12, color: theme.ink3,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.08, marginRight: 8 }}>{m.v}</span>
                <span style={{ fontFamily: SFR, fontSize: 13, fontWeight: 700, color: m.c,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.1, minWidth: 32, textAlign: 'right' }}>{m.p}%</span>
              </div>
              <div style={{ height: 8, background: theme.fill, borderRadius: 100, overflow: 'hidden' }}>
                <div style={{
                  width: `${m.p}%`, height: '100%',
                  background: `linear-gradient(90deg, ${m.c} 0%, ${m.c}dd 100%)`,
                  borderRadius: 100,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise list recap — richer */}
      <div style={{ padding: '18px 16px 0' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, fontWeight: 700, color: theme.ink3,
          letterSpacing: 0.8, textTransform: 'uppercase', padding: '0 4px 10px',
        }}>Exercises · {session.exercises.length}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {session.exercises.map((ex, i) => {
            const vol = ex.sets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0);
            const maxVol = Math.max(...ex.sets.map(x => (x.weight || 0) * (x.reps || 0)));
            const pr = ex.sets.find(s => s.pr);
            return (
              <div key={i} style={{
                background: theme.surface, borderRadius: 12, padding: '12px 14px',
                boxShadow: `0 0 0 0.5px ${theme.hair}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  {pr && (
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: theme.money,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon name="star.fill" size={8} color="#fff" />
                    </div>
                  )}
                  <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink, letterSpacing: -0.24 }}>
                    {ex.name}
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ fontFamily: SFR, fontSize: 13, fontWeight: 600, color: theme.ink2,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: -0.08 }}>
                    {vol.toLocaleString()} <span style={{ fontSize: 10, color: theme.ink3 }}>kg</span>
                  </div>
                </div>

                {/* set bars — show progression visually */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 44 }}>
                  {ex.sets.map((s, j) => {
                    const setVol = (s.weight || 0) * (s.reps || 0);
                    const h = maxVol > 0 ? (setVol / maxVol) * 100 : 0;
                    return (
                      <div key={j} style={{ flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 3 }}>
                        <div style={{
                          width: '100%', height: `${Math.max(h, 15)}%`,
                          background: s.pr ? theme.money : `${theme.move}88`,
                          borderRadius: '4px 4px 2px 2px',
                          position: 'relative',
                        }}>
                          {s.pr && (
                            <div style={{
                              position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
                              width: 6, height: 6, borderRadius: '50%', background: theme.money,
                              boxShadow: `0 0 0 2px ${theme.bg}`,
                            }} />
                          )}
                        </div>
                        <div style={{
                          fontFamily: SFR, fontSize: 10, fontWeight: 600,
                          color: s.pr ? theme.money : theme.ink3,
                          fontVariantNumeric: 'tabular-nums', letterSpacing: -0.08,
                        }}>{s.weight}×{s.reps}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer CTAs */}
      <div style={{ padding: '18px 16px 0', display: 'flex', gap: 10 }}>
        <button style={{
          flex: 1, padding: '14px', background: theme.surface, border: `0.5px solid ${theme.hair}`,
          borderRadius: 12, cursor: 'pointer', fontFamily: SF, fontSize: 15, fontWeight: 500,
          color: theme.ink, letterSpacing: -0.24,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="square.and.arrow.up" size={14} color={theme.ink} />
          Share
        </button>
        <button onClick={onDone} style={{
          flex: 2, padding: '14px', background: theme.move, border: 'none',
          borderRadius: 12, cursor: 'pointer', fontFamily: SF, fontSize: 15, fontWeight: 700,
          color: '#fff', letterSpacing: -0.24,
          boxShadow: `0 4px 12px ${theme.move}44`,
        }}>Save to timeline</button>
      </div>
    </div>
  );
}

Object.assign(window, { PreWorkoutScreen, ActiveSessionScreen, PostWorkoutScreen });
