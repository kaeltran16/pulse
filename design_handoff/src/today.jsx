// Today + Add screens — iOS system look

function TodayScreen({ theme, onOpenDetail, onOpenAdd, onOpenPal, onOpenStreak, onOpenCloseout, onOpenInbox, onOpenBills }) {
  const entries = window.TODAY_ENTRIES;
  const moneySpent = entries.filter(e => e.type === 'money').reduce((s, e) => s + Math.abs(e.value), 0);
  const moneyBudget = 85;
  const moveMinutes = 66;
  const moveGoal = 60;
  const ritualsDone = entries.filter(e => e.type === 'rituals').length;
  const ritualsGoal = 5;

  const colorFor = (t) => theme[t];

  // Day progress — 9:41pm shown in status bar but let's peg it to "evening"
  const dayProgress = 0.88; // late evening

  // Group entries by time-of-day for the timeline
  const buckets = [
    { label: 'Morning', rows: entries.filter(e => parseInt(e.time) < 12) },
    { label: 'Afternoon', rows: entries.filter(e => parseInt(e.time) >= 12 && parseInt(e.time) < 18) },
    { label: 'Evening', rows: entries.filter(e => parseInt(e.time) >= 18) },
  ];

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Today"
        subtitle="Thursday, April 23"
        leading={<div style={{
          fontFamily: SF, fontSize: 17, color: theme.accent, fontWeight: 400,
        }}>Apr</div>}
        trailing={<div style={{ display: 'flex', gap: 8 }}>
          <NavIconButton name="bell.fill" theme={theme} onClick={onOpenInbox} />
          <NavIconButton name="magnifyingglass" theme={theme} />
        </div>}
      />

      {/* Activity rings hero card — denser, prouder, with on-pace line */}
      <div style={{ margin: '4px 16px 14px' }}>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: '18px 18px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <ActivityRings theme={theme} size={118}
              values={[moneySpent / moneyBudget, moveMinutes / moveGoal, ritualsDone / ritualsGoal]} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <RingStat color={theme.money} label="Spent" value={`$${moneySpent.toFixed(0)}`}
                goal={`/ $${moneyBudget}`} theme={theme} />
              <RingStat color={theme.move} label="Move" value={`${moveMinutes}`}
                goal={`/ ${moveGoal} MIN`} theme={theme} />
              <RingStat color={theme.rituals} label="Rituals" value={`${ritualsDone}`}
                goal={`/ ${ritualsGoal}`} theme={theme} />
            </div>
          </div>
          {/* Day progress bar */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${theme.hair}` }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 6,
            }}>
              <span style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3,
                fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase',
              }}>Day · 21:30</span>
              <span style={{
                fontFamily: SF, fontSize: 12, color: theme.ink2, fontWeight: 500,
                letterSpacing: -0.08,
              }}>On pace · 1 ritual to close</span>
            </div>
            <div style={{
              height: 4, borderRadius: 2, background: theme.fill,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: `${dayProgress * 100}%`,
                background: `linear-gradient(90deg, ${theme.money}, ${theme.move}, ${theme.rituals})`,
                borderRadius: 2,
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pal insight hero — primary content, tappable to open streak celebration */}
      <div style={{ margin: '0 16px 18px' }}>
        <button onClick={() => onOpenStreak ? onOpenStreak() : onOpenPal && onOpenPal('Tell me more about this pattern')} style={{
          width: '100%', background: theme.surface, borderRadius: 18,
          padding: 16, border: 'none', cursor: 'pointer', textAlign: 'left',
          display: 'block',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
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
            }}>Pal noticed</span>
            <span style={{ flex: 1 }} />
            <Icon name="chevron.right" size={13} color={theme.ink4} />
          </div>
          <div style={{
            fontFamily: SF, fontSize: 17, color: theme.ink, letterSpacing: -0.43,
            lineHeight: 1.38,
          }}>
            You've moved <b>11 days in a row</b>. On days you finish morning rituals, you spend <span style={{ color: theme.money, fontWeight: 600 }}>32% less</span> on food.
          </div>
          <div style={{
            display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap',
          }}>
            {['Why?', 'Show me the days', 'How to keep it up'].map(q => (
              <span key={q} onClick={(e) => { e.stopPropagation(); onOpenPal && onOpenPal(q); }} style={{
                padding: '6px 10px', background: theme.fill, borderRadius: 100,
                fontFamily: SF, fontSize: 12, color: theme.ink2, fontWeight: 500,
                letterSpacing: -0.08,
              }}>{q}</span>
            ))}
          </div>
        </button>
      </div>

      {/* Timeline — grouped by time-of-day */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '0 20px 8px',
      }}>
        <div style={{
          fontFamily: SF, fontSize: 22, fontWeight: 700, color: theme.ink,
          letterSpacing: 0.35,
        }}>Timeline</div>
        <button style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: SF, fontSize: 15, color: theme.accent, letterSpacing: -0.24,
        }}>Week</button>
      </div>

      {buckets.map(b => b.rows.length > 0 && (
        <div key={b.label} style={{ marginBottom: 14 }}>
          <div style={{
            padding: '6px 20px 6px',
            fontFamily: SF, fontSize: 12, fontWeight: 600, color: theme.ink3,
            letterSpacing: 0.3, textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{b.label}</span>
            <span style={{ color: theme.ink4, fontWeight: 500 }}>{b.rows.length} {b.rows.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          <div style={{
            margin: '0 16px', background: theme.surface, borderRadius: 14,
            overflow: 'hidden',
          }}>
            {b.rows.map((e, i) => (
              <div key={e.id} onClick={() => onOpenDetail(e.type)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', cursor: 'pointer',
                borderBottom: i < b.rows.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
              }}>
                <div style={{
                  fontFamily: SF, fontSize: 12, color: theme.ink3,
                  width: 38, fontVariantNumeric: 'tabular-nums', fontWeight: 500,
                  letterSpacing: -0.08,
                }}>{e.time}</div>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: colorFor(e.type),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name={e.sf} size={15} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink,
                    letterSpacing: -0.24, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{e.title}</div>
                  <div style={{
                    fontFamily: SF, fontSize: 12, color: theme.ink3,
                    letterSpacing: -0.08, marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{e.detail}</div>
                </div>
                {e.value !== null && e.value !== undefined && (
                  <div style={{
                    fontFamily: SF, fontSize: 14, fontWeight: 600,
                    color: e.type === 'money' ? theme.ink : theme.ink3,
                    letterSpacing: -0.15, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {typeof e.value === 'number'
                      ? (e.value < 0 ? `−$${Math.abs(e.value).toFixed(2)}` : `$${e.value.toFixed(2)}`)
                      : e.value}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Close-out prompt */}
      <div style={{ margin: '6px 16px 0' }}>
        <button onClick={() => onOpenCloseout ? onOpenCloseout() : onOpenPal && onOpenPal('Help me close out today')} style={{
          width: '100%', padding: '14px 16px',
          background: `${theme.rituals}14`,
          border: `0.5px dashed ${theme.rituals}55`,
          borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: theme.rituals,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="sparkles" size={15} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink,
              letterSpacing: -0.24,
            }}>Close out your day</div>
            <div style={{
              fontFamily: SF, fontSize: 12, color: theme.ink3,
              letterSpacing: -0.08, marginTop: 1,
            }}>1 ritual left · 30 min before sleep</div>
          </div>
          <Icon name="chevron.right" size={13} color={theme.ink4} />
        </button>
      </div>
    </div>
  );
}

function RingStat({ color, label, value, goal, theme }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: SF, fontSize: 12, fontWeight: 700,
        color: color, letterSpacing: 0.5, textTransform: 'uppercase',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontFamily: SF, fontSize: 22, fontWeight: 700,
          color: theme.ink, letterSpacing: -0.3,
          fontVariantNumeric: 'tabular-nums',
        }}>{value}</span>
        <span style={{
          fontFamily: SF, fontSize: 12, fontWeight: 600,
          color: theme.ink3, letterSpacing: 0.5,
        }}>{goal}</span>
      </div>
    </div>
  );
}

function SummaryTile({ type, theme, icon, label, big, unit, sub, onClick }) {
  const color = theme[type];
  return (
    <button onClick={onClick} style={{
      background: theme.surface, borderRadius: 16,
      padding: 14, border: 'none', cursor: 'pointer',
      textAlign: 'left', display: 'flex', flexDirection: 'column',
      gap: 4, minHeight: 120,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: color,
      }}>
        <Icon name={icon} size={16} color={color} />
        <span style={{
          fontFamily: SF, fontSize: 14, fontWeight: 600, letterSpacing: -0.15,
          color: color,
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
        <span style={{
          fontFamily: SFR, fontSize: 28, fontWeight: 700,
          color: theme.ink, letterSpacing: -0.3,
          fontVariantNumeric: 'tabular-nums',
        }}>{big}</span>
        {unit && <span style={{
          fontFamily: SF, fontSize: 13, fontWeight: 600,
          color: theme.ink3, letterSpacing: 0.3,
        }}>{unit}</span>}
      </div>
      <div style={{
        fontFamily: SF, fontSize: 13, color: theme.ink3,
        letterSpacing: -0.08, marginTop: 'auto',
      }}>{sub}</div>
    </button>
  );
}

// Add sheet — iOS modal with AI natural-language logging
function AddSheet({ theme, onClose, onSubmit }) {
  const [type, setType] = React.useState('money');
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [nlInput, setNlInput] = React.useState('');
  const [nlLoading, setNlLoading] = React.useState(false);
  const [nlHint, setNlHint] = React.useState(null);

  const parseWithAI = async () => {
    if (!nlInput.trim() || nlLoading) return;
    setNlLoading(true);
    setNlHint(null);
    try {
      const prompt = `Parse this into JSON with keys type (one of "money","move","rituals"), amount (number), note (short category, <=2 words).
Money = spending. Move = exercise (amount=minutes). Rituals = habits (amount=minutes).
Input: "${nlInput}"
Return ONLY valid JSON, no prose. Example: {"type":"money","amount":14,"note":"Ramen"}`;
      const resp = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const m = resp.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.type && ['money','move','rituals'].includes(parsed.type)) setType(parsed.type);
        if (parsed.amount !== undefined) setAmount(String(parsed.amount));
        if (parsed.note) setNote(parsed.note);
        setNlHint({ ok: true, text: 'Parsed by Pal · tap Add to save' });
      } else {
        setNlHint({ ok: false, text: "Couldn't parse — try 'spent $14 on ramen'" });
      }
    } catch (e) {
      setNlHint({ ok: false, text: 'Network issue — enter manually' });
    }
    setNlLoading(false);
  };

  const typeConfig = {
    money: { color: theme.money, icon: 'dollarsign.circle.fill', unit: '$', placeholder: '0.00',
      quick: ['Coffee', 'Lunch', 'Groceries', 'Transit', 'Dinner', 'Snacks'] },
    move:  { color: theme.move, icon: 'figure.run', unit: 'min', placeholder: '30',
      quick: ['Run', 'Gym', 'Yoga', 'Walk', 'Bike', 'Swim'] },
    rituals: { color: theme.rituals, icon: 'sparkles', unit: 'min', placeholder: '15',
      quick: ['Journal', 'Read', 'Meditate', 'Language', 'Stretch', 'Focus'] },
  };
  const cfg = typeConfig[type];

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.35)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: theme.bg,
        borderRadius: '12px 12px 0 0',
        maxHeight: '92%', overflowY: 'auto',
        animation: 'slideUp 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        {/* Sheet nav */}
        <div style={{
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: theme.bg, zIndex: 2,
          borderBottom: `0.5px solid ${theme.hair}`,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: SF, fontSize: 17, color: theme.accent,
            letterSpacing: -0.43, padding: 10,
          }}>Cancel</button>
          <div style={{
            fontFamily: SF, fontSize: 17, fontWeight: 600, color: theme.ink,
            letterSpacing: -0.43,
          }}>New Entry</div>
          <button onClick={() => onSubmit({ type, amount, note })} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: SF, fontSize: 17, fontWeight: 600, color: theme.accent,
            letterSpacing: -0.43, padding: 10,
          }}>Add</button>
        </div>

        <div style={{ padding: '16px 16px 40px' }}>
          {/* Natural language input — AI-powered */}
          <div style={{
            marginBottom: 16, padding: 12,
            background: `${theme.accent}10`,
            border: `0.5px solid ${theme.accent}33`,
            borderRadius: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Icon name="sparkles" size={14} color={theme.accent} />
              <span style={{
                fontFamily: SF, fontSize: 12, fontWeight: 700,
                color: theme.accent, letterSpacing: 0.3, textTransform: 'uppercase',
              }}>Log with Pal</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') parseWithAI(); }}
                placeholder="spent $14 on ramen"
                style={{
                  flex: 1, padding: '10px 12px',
                  background: theme.surface, border: `0.5px solid ${theme.hair}`,
                  borderRadius: 10, outline: 'none',
                  fontFamily: SF, fontSize: 15, color: theme.ink,
                  letterSpacing: -0.24,
                }} />
              <button onClick={parseWithAI} disabled={!nlInput.trim() || nlLoading}
                style={{
                  padding: '0 14px',
                  background: nlInput.trim() ? theme.accent : theme.fill,
                  color: nlInput.trim() ? '#fff' : theme.ink3,
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  fontFamily: SF, fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
                }}>{nlLoading ? '…' : 'Parse'}</button>
            </div>
            {nlHint && (
              <div style={{
                marginTop: 6,
                fontFamily: SF, fontSize: 12,
                color: nlHint.ok ? theme.move : theme.ink3,
                letterSpacing: -0.08,
              }}>{nlHint.text}</div>
            )}
          </div>

          {/* Segmented */}
          <Segmented theme={theme}
            options={[
              { value: 'money', label: 'Expense' },
              { value: 'move', label: 'Workout' },
              { value: 'rituals', label: 'Routine' },
            ]}
            value={type} onChange={setType} />

          {/* Amount hero */}
          <div style={{
            margin: '24px 0 20px', textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 100,
              background: cfg.color + '22', color: cfg.color,
              fontFamily: SF, fontSize: 13, fontWeight: 600,
              letterSpacing: -0.08, marginBottom: 12,
            }}>
              <Icon name={cfg.icon} size={14} color={cfg.color} />
              {note || `New ${window.TYPE_META[type].singular.toLowerCase()}`}
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4,
            }}>
              {type === 'money' && (
                <span style={{
                  fontFamily: SFR, fontSize: 46, fontWeight: 300,
                  color: theme.ink4, letterSpacing: -1,
                }}>$</span>
              )}
              <span style={{
                fontFamily: SFR, fontSize: 72, fontWeight: 700,
                color: theme.ink, lineHeight: 1, letterSpacing: -2,
                fontVariantNumeric: 'tabular-nums',
              }}>{amount || cfg.placeholder}</span>
              {type !== 'money' && (
                <span style={{
                  fontFamily: SF, fontSize: 20, fontWeight: 600,
                  color: theme.ink3, marginLeft: 6,
                }}>min</span>
              )}
            </div>
          </div>

          {/* Quick pick */}
          <div style={{
            padding: '0 4px 8px',
            fontFamily: SF, fontSize: 13, color: theme.ink3,
            textTransform: 'uppercase', letterSpacing: -0.08,
          }}>Category</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            marginBottom: 20,
          }}>
            {cfg.quick.map(q => {
              const active = note === q;
              return (
                <button key={q} onClick={() => setNote(q)} style={{
                  padding: '12px 6px',
                  background: active ? cfg.color : theme.surface,
                  color: active ? '#fff' : theme.ink,
                  border: 'none', borderRadius: 12,
                  fontFamily: SF, fontSize: 15, fontWeight: 500, letterSpacing: -0.24,
                  cursor: 'pointer',
                }}>{q}</button>
              );
            })}
          </div>

          {/* Keypad */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          }}>
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
              <button key={k} onClick={() => {
                if (k === '⌫') setAmount(a => a.slice(0, -1));
                else if (k === '.' && amount.includes('.')) return;
                else setAmount(a => (a + k).slice(0, 7));
              }} style={{
                padding: '18px 0',
                background: theme.surface,
                border: 'none', borderRadius: 14,
                fontFamily: SFR, fontSize: 26, fontWeight: 500, color: theme.ink,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {k === '⌫' ? <Icon name="delete.left.fill" size={22} color={theme.ink2} /> : k}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TodayScreen, AddSheet });
