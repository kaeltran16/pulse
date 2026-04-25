// AI-powered routine generator — user describes a goal, Claude builds a routine

function RoutineGeneratorScreen({ theme, onBack, onSave }) {
  const allEx = window.EXERCISES || [];
  const [prompt, setPrompt] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  // Quick-pick goals
  const goals = [
    { id: 'push-strength', label: '45-min push for strength', icon: 'flame.fill', c: theme.move },
    { id: 'full-body', label: 'Quick full-body, no barbell', icon: 'figure.mixed.cardio', c: theme.accent },
    { id: 'pull-hypertrophy', label: 'Pull day focused on back', icon: 'figure.pullup', c: theme.rituals },
    { id: 'cardio-hiit', label: 'Short HIIT cardio', icon: 'bolt.fill', c: theme.money },
    { id: 'legs-posterior', label: 'Legs — glutes and hams', icon: 'figure.walk', c: '#FF9500' },
    { id: 'home-nothing', label: 'Home workout, no gear', icon: 'house.fill', c: theme.red },
  ];

  const generate = async (goalText) => {
    const askFor = goalText || prompt;
    if (!askFor.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    // Provide exercise IDs so Claude returns ones that exist in the library
    const exerciseList = allEx.map(e => `${e.id} (${e.name}, ${e.group}, ${e.muscle})`).join('; ');

    try {
      const resp = await window.claude.complete({
        messages: [{
          role: 'user',
          content: `You are a strength coach building a workout routine. The user wants: "${askFor}"

Available exercises (use these EXACT ids): ${exerciseList}

Return ONLY valid JSON, no markdown or prose, with this shape:
{
  "name": "Short routine name (3-5 words)",
  "tag": "Upper | Lower | Full | Cardio | Custom",
  "estMin": 45,
  "rationale": "One sentence explaining the design.",
  "exercises": [
    { "id": "bench", "sets": [{ "reps": 5, "weight": 80 }, { "reps": 5, "weight": 80 }, { "reps": 5, "weight": 80 }] }
  ]
}

Rules:
- 3-6 exercises for strength, 1 for pure cardio
- Each strength exercise: 3-4 sets
- Use realistic weights in kg (intermediate lifter)
- For bodyweight exercises use weight: 0
- For cardio: sets with { duration: 30, distance: 5, pace: "6:00" }
- Only use exercise ids from the list above`
        }],
      });

      // Strip code fences if present
      let clean = resp.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(json)?\n?/, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(clean);

      // Hydrate with exercise metadata
      const hydrated = parsed.exercises
        .map(re => {
          const meta = allEx.find(e => e.id === re.id);
          return meta ? { ...meta, sets: re.sets } : null;
        })
        .filter(Boolean);

      setResult({ ...parsed, hydrated });
    } catch (e) {
      setError(e.message || 'Could not generate routine. Try again?');
    }
    setLoading(false);
  };

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Generate with AI"
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
      />

      {/* Hero — the pitch */}
      {!result && (
        <div style={{ padding: '0 16px 18px' }}>
          <div style={{
            background: theme.ink, color: '#fff',
            borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -50, right: -30, width: 160, height: 160,
              borderRadius: '50%', background: `radial-gradient(circle, ${theme.move}44, transparent 70%)`,
            }} />
            <div style={{
              position: 'absolute', bottom: -40, left: 40, width: 120, height: 120,
              borderRadius: '50%', background: `radial-gradient(circle, ${theme.accent}33, transparent 70%)`,
            }} />

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: theme.move,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="sparkles" size={12} color="#fff" />
                </div>
                <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700,
                  letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 }}>Pal builds your routine</span>
              </div>
              <div style={{
                fontFamily: SFR, fontSize: 22, fontWeight: 700, letterSpacing: -0.4,
                lineHeight: 1.15, marginBottom: 6,
              }}>Describe what you want.<br />Pal picks the exercises.</div>
              <div style={{
                fontFamily: SF, fontSize: 13, opacity: 0.75, letterSpacing: -0.1, lineHeight: 1.45,
              }}>"A 30-min pull day I can do at the gym" or "legs at home with dumbbells."</div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt input */}
      {!result && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{
            background: theme.surface, borderRadius: 16, padding: 14,
            boxShadow: `0 0 0 0.5px ${theme.hair}`,
          }}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="What kind of workout do you want? Goal, duration, equipment…"
              style={{
                width: '100%', minHeight: 76, border: 'none', outline: 'none',
                background: 'transparent', resize: 'none',
                fontFamily: SF, fontSize: 15, color: theme.ink, letterSpacing: -0.2,
                lineHeight: 1.4,
              }}
            />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              paddingTop: 10, borderTop: `0.5px solid ${theme.hair}`,
            }}>
              <div style={{
                fontFamily: SF, fontSize: 11, color: theme.ink4, letterSpacing: -0.08, flex: 1,
              }}>Pal uses your exercise library & recent sessions</div>
              <button onClick={() => generate()} disabled={!prompt.trim() || loading}
                style={{
                  padding: '9px 16px',
                  background: prompt.trim() && !loading ? theme.move : theme.fill,
                  color: prompt.trim() && !loading ? '#fff' : theme.ink4,
                  border: 'none', borderRadius: 100, cursor: prompt.trim() ? 'pointer' : 'default',
                  fontFamily: SF, fontSize: 13, fontWeight: 700, letterSpacing: -0.1,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  boxShadow: prompt.trim() && !loading ? `0 3px 10px ${theme.move}44` : 'none',
                }}>
                <Icon name="sparkles" size={11} color={prompt.trim() && !loading ? '#fff' : theme.ink4} />
                {loading ? 'Thinking…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick-pick goals */}
      {!result && (
        <div style={{ padding: '0 16px' }}>
          <div style={{
            fontFamily: SF, fontSize: 12, fontWeight: 700, color: theme.ink3,
            letterSpacing: 0.8, textTransform: 'uppercase', padding: '0 4px 10px',
          }}>Or try one of these</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {goals.map(g => (
              <button key={g.id}
                onClick={() => { setPrompt(g.label); generate(g.label); }}
                disabled={loading}
                style={{
                  background: theme.surface, border: 'none',
                  borderRadius: 14, padding: '12px 12px',
                  textAlign: 'left', cursor: 'pointer',
                  boxShadow: `0 0 0 0.5px ${theme.hair}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  opacity: loading ? 0.4 : 1,
                }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, background: `${g.c}1a`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name={g.icon} size={15} color={g.c} />
                </div>
                <span style={{
                  fontFamily: SF, fontSize: 13, fontWeight: 500, color: theme.ink,
                  letterSpacing: -0.1, lineHeight: 1.2,
                }}>{g.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '24px 16px 0', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', background: theme.surface, borderRadius: 100,
            boxShadow: `0 0 0 0.5px ${theme.hair}`,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: `2px solid ${theme.move}33`, borderTopColor: theme.move,
              animation: 'spin 0.9s linear infinite',
            }} />
            <span style={{ fontFamily: SF, fontSize: 13, color: theme.ink2, letterSpacing: -0.1 }}>
              Pal is building your routine…
            </span>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '0 16px' }}>
          <div style={{
            background: `${theme.red}12`, border: `0.5px solid ${theme.red}44`,
            borderRadius: 12, padding: 14,
            fontFamily: SF, fontSize: 13, color: theme.red, letterSpacing: -0.1,
          }}>{error}</div>
        </div>
      )}

      {/* Result — preview */}
      {result && (
        <>
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: `linear-gradient(155deg, ${theme.move} 0%, ${theme.accent} 100%)`,
              color: '#fff', borderRadius: 20, padding: 18, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: `repeating-linear-gradient(135deg, transparent 0 20px, rgba(255,255,255,0.05) 20px 21px)`,
              }} />
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', background: 'rgba(255,255,255,0.2)',
                  borderRadius: 100,
                  fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  textTransform: 'uppercase', marginBottom: 8,
                }}>
                  <Icon name="sparkles" size={9} color="#fff" />
                  Generated
                </div>
                <div style={{
                  fontFamily: SFR, fontSize: 24, fontWeight: 700, letterSpacing: -0.5,
                  lineHeight: 1.1,
                }}>{result.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 8px', background: 'rgba(255,255,255,0.2)',
                    borderRadius: 100,
                    fontFamily: SF, fontSize: 11, fontWeight: 600, letterSpacing: -0.08,
                  }}>{result.tag}</span>
                  <span style={{ fontFamily: SF, fontSize: 12, opacity: 0.85, letterSpacing: -0.08 }}>
                    {result.hydrated.length} exercises · ~{result.estMin} min
                  </span>
                </div>
                {result.rationale && (
                  <div style={{
                    marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.2)',
                    fontFamily: SF, fontSize: 13, opacity: 0.9, letterSpacing: -0.1, lineHeight: 1.45,
                  }}>{result.rationale}</div>
                )}
              </div>
            </div>
          </div>

          {/* Exercise list */}
          <Section theme={theme} header="Exercises">
            {result.hydrated.map((ex, i, arr) => (
              <div key={i} style={{
                padding: '12px 14px',
                borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, background: `${theme.move}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={ex.sf || 'dumbbell.fill'} size={16} color={theme.move} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink, letterSpacing: -0.24 }}>
                      {ex.name}
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08 }}>
                      {ex.muscle} · {ex.equipment}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, marginLeft: 42, flexWrap: 'wrap' }}>
                  {ex.sets.map((s, j) => (
                    <div key={j} style={{
                      padding: '4px 10px', borderRadius: 6, background: theme.fill,
                      fontFamily: SFR, fontSize: 11, fontWeight: 600, color: theme.ink2,
                      letterSpacing: -0.08, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {s.weight > 0 ? `${s.weight}×${s.reps}` :
                       s.duration ? `${s.duration}min` :
                       `${s.reps} reps`}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          {/* Actions */}
          <div style={{ padding: '8px 16px 0', display: 'flex', gap: 10 }}>
            <button onClick={() => { setResult(null); setPrompt(''); }}
              style={{
                flex: 1, padding: '13px', background: theme.surface,
                border: `0.5px solid ${theme.hair}`, borderRadius: 12, cursor: 'pointer',
                fontFamily: SF, fontSize: 14, fontWeight: 600, color: theme.ink2, letterSpacing: -0.2,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
              <Icon name="arrow.clockwise" size={12} color={theme.ink2} />
              Try again
            </button>
            <button onClick={() => onSave && onSave(result)}
              style={{
                flex: 2, padding: '13px', background: theme.move, border: 'none',
                borderRadius: 12, cursor: 'pointer',
                fontFamily: SF, fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: -0.24,
                boxShadow: `0 4px 12px ${theme.move}44`,
              }}>
              Save routine
            </button>
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, { RoutineGeneratorScreen });
