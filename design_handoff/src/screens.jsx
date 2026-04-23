// Week, Stats, Profile, Detail — iOS system style

function WeekScreen({ theme }) {
  const week = window.WEEK_DATA;
  const maxMoney = Math.max(...week.map(d => d.money));
  const maxMove = Math.max(...week.map(d => d.move));

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Week" subtitle="Apr 17 – 23"
        trailing={<NavIconButton name="calendar" theme={theme} />}
      />

      {/* Top summary */}
      <div style={{ padding: '8px 16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { l: 'Spent', v: '$435', g: '/$595', c: theme.money },
            { l: 'Moved', v: '296', g: 'MIN', c: theme.move },
            { l: 'Rituals', v: '26', g: '/35', c: theme.rituals },
          ].map(s => (
            <div key={s.l} style={{
              background: theme.surface, borderRadius: 14, padding: 12,
            }}>
              <div style={{
                fontFamily: SF, fontSize: 12, fontWeight: 700,
                color: s.c, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>{s.l}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
                <span style={{
                  fontFamily: SFR, fontSize: 22, fontWeight: 700,
                  color: theme.ink, letterSpacing: -0.3,
                  fontVariantNumeric: 'tabular-nums',
                }}>{s.v}</span>
                <span style={{
                  fontFamily: SF, fontSize: 11, fontWeight: 600,
                  color: theme.ink3, letterSpacing: 0.4,
                }}>{s.g}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ margin: '0 16px 20px' }}>
        <div style={{ background: theme.surface, borderRadius: 16, padding: '20px 14px 14px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '0 6px 14px',
          }}>
            <div style={{
              fontFamily: SF, fontSize: 17, fontWeight: 600, color: theme.ink,
              letterSpacing: -0.43,
            }}>Daily rhythm</div>
            <div style={{
              fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08,
            }}>Last 7 days</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, padding: '0 4px' }}>
            {week.map((d, i) => {
              const today = i === 6;
              return (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}>
                  <div style={{
                    position: 'relative', width: '100%', height: 110,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3,
                  }}>
                    <div style={{
                      width: 7, borderRadius: 3,
                      height: `${(d.money / maxMoney) * 100}%`,
                      background: theme.money, opacity: today ? 1 : 0.7,
                    }} />
                    <div style={{
                      width: 7, borderRadius: 3,
                      height: `${(d.move / maxMove) * 100}%`,
                      background: theme.move, opacity: today ? 1 : 0.7,
                    }} />
                    <div style={{
                      width: 7, borderRadius: 3,
                      height: `${(d.rituals / 5) * 100}%`,
                      background: theme.rituals, opacity: today ? 1 : 0.7,
                    }} />
                  </div>
                  <div style={{
                    fontFamily: SF, fontSize: 12, fontWeight: today ? 700 : 500,
                    color: today ? theme.ink : theme.ink3, letterSpacing: -0.08,
                  }}>{d.day}</div>
                  {today && (
                    <div style={{
                      width: 4, height: 4, borderRadius: '50%', background: theme.accent,
                    }} />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 16,
            marginTop: 16, paddingTop: 12, borderTop: `0.5px solid ${theme.hair}`,
          }}>
            {[['Spend', theme.money], ['Move', theme.move], ['Rituals', theme.rituals]].map(([l, c]) => (
              <div key={l} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: SF, fontSize: 12, color: theme.ink2, letterSpacing: -0.08,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Section theme={theme} header="Highlights">
        {[
          { icon: 'star.fill', bg: theme.rituals, title: 'Best day — Wednesday',
            sub: '5 rituals · 55 min move · $28 spent' },
          { icon: 'flame.fill', bg: theme.money, title: 'Friday spend peaked at $120',
            sub: 'Dinner at Cotogna pushed weekly total' },
          { icon: 'figure.run', bg: theme.move, title: '11-day move streak',
            sub: 'At least 20 minutes every day' },
        ].map((h, i, arr) => (
          <ListRow key={i} icon={h.icon} iconBg={h.bg}
            title={h.title} subtitle={h.sub}
            theme={theme} last={i === arr.length - 1} />
        ))}
      </Section>
    </div>
  );
}

function StatsScreen({ theme }) {
  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Stats" subtitle="Last 30 days"
        trailing={<NavIconButton name="ellipsis" theme={theme} />}
      />

      {/* Insight card */}
      <div style={{ margin: '8px 16px 20px' }}>
        <div style={{
          background: theme.accentTint, borderRadius: 16, padding: 18,
          border: `0.5px solid ${theme.accent}22`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <Icon name="sparkles" size={15} color={theme.accent} />
            <span style={{
              fontFamily: SF, fontSize: 13, fontWeight: 700, color: theme.accent,
              letterSpacing: -0.08, textTransform: 'uppercase',
            }}>Pattern found</span>
          </div>
          <div style={{
            fontFamily: SF, fontSize: 17, color: theme.ink, letterSpacing: -0.43,
            lineHeight: 1.4, fontWeight: 500,
          }}>On days you complete morning rituals, you spend <b style={{ color: theme.money }}>32% less on food</b>.</div>
        </div>
      </div>

      {[
        { type: 'money', title: 'Spending', big: '$1,840', sub: 'Total · down 12% vs last month',
          data: [42, 78, 28, 62, 120, 45, 60, 55, 38, 72, 48, 62, 90, 41, 58, 66, 80, 52, 48, 73, 38, 55, 60, 72, 48, 62, 58, 68, 54, 60] },
        { type: 'move', title: 'Activity', big: '1,218 min', sub: 'Up 8% · 23 active days',
          data: [28, 0, 55, 42, 30, 75, 66, 42, 50, 0, 48, 60, 55, 30, 48, 55, 65, 0, 50, 48, 55, 40, 30, 60, 55, 42, 45, 50, 38, 45] },
        { type: 'rituals', title: 'Routine', big: '112 / 150', sub: '75% kept · best month yet',
          data: [3, 4, 5, 4, 3, 2, 4, 4, 3, 4, 5, 4, 3, 4, 4, 3, 5, 4, 4, 3, 4, 4, 5, 3, 4, 4, 4, 5, 4, 4] },
      ].map(t => (
        <div key={t.type} style={{ margin: '0 16px 14px' }}>
          <div style={{ background: theme.surface, borderRadius: 16, padding: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: theme[t.type],
            }}>
              <Icon name={t.type === 'money' ? 'dollarsign.circle.fill' : t.type === 'move' ? 'flame.fill' : 'sparkles'}
                size={15} color={theme[t.type]} />
              <span style={{
                fontFamily: SF, fontSize: 13, fontWeight: 700,
                color: theme[t.type], letterSpacing: 0.3, textTransform: 'uppercase',
              }}>{t.title}</span>
            </div>
            <div style={{
              fontFamily: SFR, fontSize: 32, fontWeight: 700,
              color: theme.ink, letterSpacing: -0.6, marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}>{t.big}</div>
            <div style={{
              fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08,
            }}>{t.sub}</div>
            <svg width="100%" height="50" viewBox={`0 0 ${t.data.length * 10} 50`}
              style={{ marginTop: 10 }} preserveAspectRatio="none">
              {(() => {
                const max = Math.max(...t.data);
                const pts = t.data.map((v, i) => `${i * 10},${50 - (v / max) * 44 - 3}`).join(' ');
                const area = `0,50 ${pts} ${(t.data.length - 1) * 10},50`;
                return (
                  <>
                    <defs>
                      <linearGradient id={'g-' + t.type} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={theme[t.type]} stopOpacity="0.25"/>
                        <stop offset="100%" stopColor={theme[t.type]} stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <polygon points={area} fill={`url(#g-${t.type})`} />
                    <polyline points={pts} fill="none" stroke={theme[t.type]} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={(t.data.length - 1) * 10} cy={50 - (t.data[t.data.length - 1] / max) * 44 - 3} r={3.5} fill={theme[t.type]} />
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileScreen({ theme }) {
  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="You"
        trailing={<NavIconButton name="gearshape.fill" theme={theme} />}
      />

      {/* Profile header card */}
      <div style={{ margin: '8px 16px 20px' }}>
        <div style={{
          background: theme.surface, borderRadius: 16, padding: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.money} 0%, ${theme.rituals} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SFR, fontSize: 26, fontWeight: 600, color: '#fff',
          }}>M</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: SF, fontSize: 20, fontWeight: 600, color: theme.ink,
              letterSpacing: -0.45,
            }}>Mira Okafor</div>
            <div style={{
              fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08,
              marginTop: 2,
            }}>Tracking since Oct 23 · 182 days</div>
          </div>
          <Icon name="chevron.right" size={14} color={theme.ink4} />
        </div>
      </div>

      <Section theme={theme} header="This year">
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { l: 'Entries logged', v: '1,284' },
            { l: 'Total spent', v: '$12.4K' },
            { l: 'Time moved', v: '38 hrs' },
            { l: 'Current streak', v: '11 days' },
          ].map(s => (
            <div key={s.l}>
              <div style={{
                fontFamily: SFR, fontSize: 22, fontWeight: 700,
                color: theme.ink, letterSpacing: -0.3,
                fontVariantNumeric: 'tabular-nums',
              }}>{s.v}</div>
              <div style={{
                fontFamily: SF, fontSize: 13, color: theme.ink3,
                letterSpacing: -0.08, marginTop: 2,
              }}>{s.l}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section theme={theme} header="Goals">
        <ListRow icon="dollarsign.circle.fill" iconBg={theme.money}
          title="Daily budget" value="$85" theme={theme} />
        <ListRow icon="flame.fill" iconBg={theme.move}
          title="Movement goal" value="60 min" theme={theme} />
        <ListRow icon="sparkles" iconBg={theme.rituals}
          title="Daily rituals" value="5" theme={theme} last />
      </Section>

      <Section theme={theme} header="Preferences">
        <ListRow icon="bell.fill" iconBg="#FF3B30" title="Notifications" value="On" theme={theme} />
        <ListRow icon="heart.fill" iconBg="#FF2D55" title="Apple Health" value="Connected" theme={theme} />
        <ListRow icon="target" iconBg={theme.accent} title="Evening reflection" value="9:45 PM" theme={theme} last />
      </Section>

      <Section theme={theme}>
        <ListRow title="Export data" theme={theme} />
        <ListRow title="Help & Support" theme={theme} />
        <ListRow title="Sign out" theme={theme} last />
      </Section>
    </div>
  );
}

function DetailScreen({ theme, type, onBack }) {
  const color = theme[type];
  const tint = theme[type + 'Tint'];
  const entries = window.TODAY_ENTRIES.filter(e => e.type === type);

  const config = {
    money: { title: 'Spending', big: '$60.35', sub: 'Spent today', goal: 'of $85 daily budget',
      pct: 60.35 / 85, icon: 'dollarsign.circle.fill',
      cats: [
        { name: 'Food & Drink', val: '$21.95', pct: 36, icon: 'cup.and.saucer.fill' },
        { name: 'Groceries', val: '$38.40', pct: 64, icon: 'basket.fill' },
      ] },
    move: { title: 'Activity', big: '66', sub: 'Minutes moved', goal: '599 kcal · 2 workouts',
      pct: 1, icon: 'flame.fill',
      cats: [
        { name: 'Run · Mission loop', val: '24 min', pct: 36, icon: 'figure.run' },
        { name: 'Strength · push day', val: '42 min', pct: 64, icon: 'dumbbell.fill' },
      ] },
    rituals: { title: 'Routine', big: '4/5', sub: 'Rituals completed', goal: '1 to close the day',
      pct: 4/5, icon: 'sparkles',
      cats: [
        { name: 'Morning pages', val: '15 min', pct: 20, icon: 'book.closed.fill' },
        { name: 'Inbox zero', val: '22 min', pct: 28, icon: 'tray.fill' },
        { name: 'Language', val: '18 min', pct: 22, icon: 'character.book.closed.fill' },
        { name: 'Read', val: '28 min', pct: 30, icon: 'books.vertical.fill' },
      ] },
  };
  const cfg = config[type];

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title={cfg.title}
        large={true}
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

      {/* Hero */}
      <div style={{ margin: '8px 16px 20px' }}>
        <div style={{
          background: tint, borderRadius: 16, padding: 18,
          border: `0.5px solid ${color}22`,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 14px ${color}55`,
          }}>
            <Icon name={cfg.icon} size={28} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontFamily: SFR, fontSize: 40, fontWeight: 700,
                color: theme.ink, lineHeight: 1, letterSpacing: -1,
                fontVariantNumeric: 'tabular-nums',
              }}>{cfg.big}</span>
            </div>
            <div style={{
              fontFamily: SF, fontSize: 15, fontWeight: 600, color: color,
              letterSpacing: -0.24, marginTop: 4,
            }}>{cfg.sub}</div>
            <div style={{
              fontFamily: SF, fontSize: 13, color: theme.ink2,
              letterSpacing: -0.08, marginTop: 2,
            }}>{cfg.goal}</div>
          </div>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: `conic-gradient(${color} ${Math.min(cfg.pct, 1) * 360}deg, ${color}22 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: tint,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: SF, fontSize: 12, fontWeight: 700,
              color: color,
            }}>{Math.round(Math.min(cfg.pct, 1) * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <Section theme={theme} header="Breakdown">
        {cfg.cats.map((c, i, arr) => (
          <div key={i} style={{ padding: '10px 16px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 29, height: 29, borderRadius: 7,
                background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={c.icon} size={16} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink,
                  letterSpacing: -0.24,
                }}>{c.name}</div>
              </div>
              <div style={{
                fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink,
                letterSpacing: -0.24, fontVariantNumeric: 'tabular-nums',
              }}>{c.val}</div>
            </div>
            <div style={{
              marginTop: 8, marginLeft: 41, height: 4, borderRadius: 100,
              background: color + '22', overflow: 'hidden',
            }}>
              <div style={{ width: `${c.pct}%`, height: '100%', background: color, borderRadius: 100 }} />
            </div>
            {i < arr.length - 1 && (
              <div style={{
                position: 'absolute', left: 57, right: 0, bottom: 0,
                height: 0.5, background: theme.hair,
              }} />
            )}
          </div>
        ))}
      </Section>

      <Section theme={theme} header={`Today's ${window.TYPE_META[type].label.toLowerCase()}`}>
        {entries.map((e, i, arr) => (
          <ListRow key={e.id}
            icon={e.sf} iconBg={color}
            title={e.title}
            subtitle={`${e.time} · ${e.detail}`}
            value={e.value !== null && e.value !== undefined
              ? (typeof e.value === 'number'
                  ? (e.value < 0 ? `−$${Math.abs(e.value).toFixed(2)}` : `$${e.value.toFixed(2)}`)
                  : e.value)
              : null}
            theme={theme} last={i === arr.length - 1}
          />
        ))}
      </Section>
    </div>
  );
}

Object.assign(window, { WeekScreen, StatsScreen, ProfileScreen, DetailScreen });
