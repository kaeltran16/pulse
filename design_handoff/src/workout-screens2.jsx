// Routine editor + Exercise library + Workout detail (past session)

// ─── Routine editor ──────────────────────────────────────────
function RoutineEditorScreen({ theme, routineId = 'push-a', onBack }) {
  const routine = (window.ROUTINES || []).find(r => r.id === routineId) || window.ROUTINES[0];
  const allEx = window.EXERCISES || [];
  const exercises = routine.exercises.map(re => {
    const meta = allEx.find(e => e.id === re.id) || {};
    return { ...meta, sets: re.sets };
  });

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Edit routine"
        leading={
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.accent, fontFamily: SF, fontSize: 17,
            letterSpacing: -0.43, padding: '4px 4px 4px 0',
          }}>
            <Icon name="chevron.left" size={20} color={theme.accent} />
            Cancel
          </button>
        }
        trailing={
          <button style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.accent, fontFamily: SF, fontSize: 17, fontWeight: 600,
            letterSpacing: -0.43, padding: '4px 0 4px 4px',
          }}>Save</button>
        }
      />

      {/* Name + tag */}
      <div style={{ padding: '0 16px' }}>
        <Section theme={theme}>
          <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${theme.hair}` }}>
            <div style={{
              fontFamily: SF, fontSize: 11, fontWeight: 700, color: theme.ink3,
              letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
            }}>Name</div>
            <div style={{ fontFamily: SF, fontSize: 17, color: theme.ink, letterSpacing: -0.43, fontWeight: 500 }}>
              {routine.name}
            </div>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              fontFamily: SF, fontSize: 15, color: theme.ink2, letterSpacing: -0.24, flex: 1,
            }}>Tag</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Upper', 'Lower', 'Full', 'Cardio', 'Custom'].map(t => (
                <div key={t} style={{
                  padding: '4px 10px', borderRadius: 100,
                  background: t === routine.tag ? theme.accent : theme.fill,
                  color: t === routine.tag ? '#fff' : theme.ink2,
                  fontFamily: SF, fontSize: 12, fontWeight: 600, letterSpacing: -0.08,
                }}>{t}</div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Exercises with sets */}
      <Section theme={theme} header={`Exercises · ${exercises.length}`}
        footer="Drag ≡ to reorder · swipe left to remove · tap a set to edit targets">
        {exercises.map((ex, i, arr) => (
          <div key={i} style={{
            padding: '12px 14px',
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: theme.ink4, fontSize: 16, cursor: 'grab' }}>≡</div>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: `${theme.move}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={ex.sf || 'dumbbell.fill'} size={16} color={theme.move} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink, letterSpacing: -0.24 }}>
                  {ex.name}
                </div>
                <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                  {ex.muscle} · {ex.sets.length} sets
                </div>
              </div>
              <Icon name="chevron.right" size={13} color={theme.ink4} />
            </div>
            {/* Set chips */}
            <div style={{ display: 'flex', gap: 5, marginTop: 8, marginLeft: 52, flexWrap: 'wrap' }}>
              {ex.sets.map((s, j) => (
                <div key={j} style={{
                  padding: '4px 9px', borderRadius: 6, background: theme.fill,
                  fontFamily: SFR, fontSize: 11, fontWeight: 600, color: theme.ink2,
                  letterSpacing: -0.08, fontVariantNumeric: 'tabular-nums',
                }}>
                  {s.weight ? `${s.weight}×${s.reps}` : `${s.reps} reps`}
                </div>
              ))}
              <div style={{
                padding: '4px 9px', borderRadius: 6, background: 'transparent',
                border: `1px dashed ${theme.hair}`,
                fontFamily: SF, fontSize: 11, fontWeight: 500, color: theme.ink3,
                letterSpacing: -0.08, cursor: 'pointer',
              }}>+ set</div>
            </div>
          </div>
        ))}
      </Section>

      {/* Add exercise */}
      <div style={{ padding: '0 16px' }}>
        <button style={{
          width: '100%', padding: '14px', background: theme.surface,
          border: `0.5px solid ${theme.hair}`, borderRadius: 12, cursor: 'pointer',
          fontFamily: SF, fontSize: 15, color: theme.accent, fontWeight: 600,
          letterSpacing: -0.24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="plus" size={14} color={theme.accent} />
          Add exercise from library
        </button>
      </div>

      {/* Settings */}
      <Section theme={theme} header="Session settings">
        <ListRow icon="timer" iconBg={theme.accent} title="Rest timer default" value="2:00" theme={theme} />
        <ListRow icon="bell.fill" iconBg="#FF9500" title="Warm-up reminder" value="Off" theme={theme} />
        <ListRow icon="arrow.triangle.2.circlepath" iconBg={theme.move} title="Auto-progress weights" value="On" theme={theme} last />
      </Section>

      <div style={{ padding: '8px 16px 0' }}>
        <button style={{
          width: '100%', padding: '13px', background: 'transparent',
          border: 'none', cursor: 'pointer',
          fontFamily: SF, fontSize: 15, color: theme.red, fontWeight: 500,
          letterSpacing: -0.24,
        }}>Delete routine</button>
      </div>
    </div>
  );
}

// ─── Exercise library ────────────────────────────────────────
function ExerciseLibraryScreen({ theme, onBack }) {
  const all = window.EXERCISES || [];
  const [filter, setFilter] = React.useState('All');
  const groups = ['All', 'Push', 'Pull', 'Legs', 'Core', 'Cardio'];
  const filtered = filter === 'All' ? all : all.filter(e => e.group === filter);
  const byGroup = {};
  filtered.forEach(e => { (byGroup[e.group] = byGroup[e.group] || []).push(e); });

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Exercises" subtitle={`${all.length} in library`}
        leading={
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.accent, fontFamily: SF, fontSize: 17,
            letterSpacing: -0.43, padding: '4px 4px 4px 0',
          }}>
            <Icon name="chevron.left" size={20} color={theme.accent} />
            Back
          </button>
        }
        trailing={<NavIconButton name="plus" theme={theme} />}
      />

      {/* Search */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{
          background: theme.fill, borderRadius: 10, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="magnifyingglass" size={14} color={theme.ink3} />
          <span style={{
            fontFamily: SF, fontSize: 15, color: theme.ink3, letterSpacing: -0.24,
          }}>Search exercises</span>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{
        padding: '0 16px 14px', display: 'flex', gap: 6, overflowX: 'auto',
      }}>
        {groups.map(g => (
          <button key={g} onClick={() => setFilter(g)} style={{
            padding: '7px 13px', background: filter === g ? theme.ink : theme.surface,
            color: filter === g ? theme.bg : theme.ink, border: 'none',
            boxShadow: filter === g ? 'none' : `0 0 0 0.5px ${theme.hair}`,
            borderRadius: 100, cursor: 'pointer',
            fontFamily: SF, fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
            whiteSpace: 'nowrap',
          }}>{g}</button>
        ))}
      </div>

      {Object.keys(byGroup).map(g => (
        <Section key={g} theme={theme} header={g}>
          {byGroup[g].map((ex, i, arr) => (
            <div key={ex.id} style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 11,
              borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
              minHeight: 56,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: g === 'Cardio' ? theme.move : g === 'Push' ? `${theme.move}22` : g === 'Pull' ? `${theme.rituals}22` : g === 'Legs' ? `${theme.money}22` : `${theme.accent}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={ex.sf || 'dumbbell.fill'} size={17}
                  color={g === 'Cardio' ? '#fff' : g === 'Push' ? theme.move : g === 'Pull' ? theme.rituals : g === 'Legs' ? theme.money : theme.accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink, letterSpacing: -0.24 }}>
                  {ex.name}
                </div>
                <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                  {ex.muscle} · {ex.equipment}
                </div>
              </div>
              {ex.pr && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontFamily: SFR, fontSize: 13, fontWeight: 600, color: theme.ink,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: -0.1,
                  }}>
                    {ex.pr.weight ? `${ex.pr.weight}kg` : `${ex.pr.reps} reps`}
                  </div>
                  <div style={{
                    fontFamily: SF, fontSize: 10, fontWeight: 700, color: theme.money,
                    letterSpacing: 0.5, textTransform: 'uppercase', marginTop: -1,
                  }}>PR</div>
                </div>
              )}
              <Icon name="chevron.right" size={13} color={theme.ink4} />
            </div>
          ))}
        </Section>
      ))}
    </div>
  );
}

// ─── Workout detail (past session) ───────────────────────────
function WorkoutDetailScreen({ theme, onBack }) {
  const s = (window.PAST_SESSIONS || [])[0];
  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title={s.routineName} subtitle={s.date}
        leading={
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.accent, fontFamily: SF, fontSize: 17,
            letterSpacing: -0.43, padding: '4px 4px 4px 0',
          }}>
            <Icon name="chevron.left" size={20} color={theme.accent} />
            Today
          </button>
        }
        trailing={<NavIconButton name="ellipsis" theme={theme} />}
      />

      {/* Summary stats */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10,
          background: theme.surface, borderRadius: 14, padding: '16px 12px',
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          {[
            { l: 'Duration', v: `${s.duration}m`, c: theme.move },
            { l: 'Volume', v: `${(s.volume/1000).toFixed(1)}t`, c: theme.accent },
            { l: 'Sets', v: '17', c: theme.rituals },
            { l: 'PRs', v: s.prs, c: theme.money },
          ].map((x, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: SFR, fontSize: 20, fontWeight: 700, color: x.c,
                fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3,
              }}>{x.v}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                {x.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Volume chart placeholder */}
      <Section theme={theme} header="Volume over 8 weeks">
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {[30, 42, 38, 45, 52, 48, 58, 68].map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', height: `${(h/68)*100}%`,
                  background: i === 7 ? theme.move : `${theme.move}55`,
                  borderRadius: '4px 4px 2px 2px',
                }} />
                <div style={{
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  fontSize: 9, color: theme.ink3, letterSpacing: 0.3,
                }}>W{i+1}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 10, fontFamily: SF, fontSize: 12, color: theme.ink3,
            letterSpacing: -0.08, display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Trend: <span style={{ color: theme.move, fontWeight: 600 }}>↑ 15% over 4 wks</span></span>
            <span>Total 34.2t</span>
          </div>
        </div>
      </Section>

      {/* Exercises with per-set detail */}
      <Section theme={theme} header={`Exercises · ${s.exercises.length}`}>
        {s.exercises.map((ex, i, arr) => {
          const vol = ex.sets.reduce((sum, x) => sum + (x.weight || 0) * (x.reps || 0), 0);
          return (
            <div key={i} style={{
              padding: '14px 16px',
              borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: theme.ink, letterSpacing: -0.3 }}>
                  {ex.name}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{
                  fontFamily: SFR, fontSize: 12, color: theme.ink3,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: -0.08,
                }}>{ex.sets.length} × {vol.toLocaleString()}kg</div>
              </div>

              {/* Set table */}
              <div style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 1fr 40px',
                fontFamily: SF, fontSize: 10, fontWeight: 700, color: theme.ink3,
                letterSpacing: 0.5, textTransform: 'uppercase',
                padding: '4px 0', borderBottom: `0.5px solid ${theme.hair}`,
              }}>
                <div>SET</div><div>KG</div><div>REPS</div><div></div>
              </div>
              {ex.sets.map((set, j) => (
                <div key={j} style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 1fr 40px',
                  padding: '8px 0', alignItems: 'center',
                  borderBottom: j < ex.sets.length - 1 ? `0.5px solid ${theme.hair}22` : 'none',
                }}>
                  <div style={{
                    fontFamily: SFR, fontSize: 13, color: theme.ink3, fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}>{j + 1}</div>
                  <div style={{
                    fontFamily: SFR, fontSize: 15, color: theme.ink, fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: -0.1,
                  }}>{set.weight}</div>
                  <div style={{
                    fontFamily: SFR, fontSize: 15, color: theme.ink, fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: -0.1,
                  }}>{set.reps}</div>
                  <div>
                    {set.pr && (
                      <span style={{
                        padding: '2px 6px', background: theme.money, color: '#fff',
                        borderRadius: 5, fontFamily: SF, fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                      }}>PR</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </Section>

      {/* Pal note */}
      <div style={{ margin: '16px 16px 0' }}>
        <div style={{
          background: theme.accentTint, borderRadius: 14, padding: 14,
          border: `0.5px solid ${theme.accent}22`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Icon name="sparkles" size={12} color={theme.accent} />
            <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: theme.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Pal's note
            </span>
          </div>
          <div style={{ fontFamily: SF, fontSize: 14, color: theme.ink, letterSpacing: -0.2, lineHeight: 1.45 }}>
            New PR on bench at 90kg × 5 — that's 5kg up from last month. Next push day, try 92.5kg top set.
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RoutineEditorScreen, ExerciseLibraryScreen, WorkoutDetailScreen });
