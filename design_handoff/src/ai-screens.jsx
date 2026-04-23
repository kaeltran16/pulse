// Ask Pal chat + Onboarding + Ritual builder + Monthly review

// ─── Ask Pal chat ─────────────────────────────────────────
function AskPalScreen({ theme }) {
  const [messages, setMessages] = React.useState([
    { role: 'assistant', text: "Hi Mira. I'm Pal — ask me anything about your money, movement, or rituals. Or just tell me what you did and I'll log it." },
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const scrollerRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, loading]);

  const context = `You are Pal, a gentle, concise coach in an iOS app that tracks money, movement and daily rituals.
Today's entries for Mira:
- 06:42 Morning pages (ritual, 15min)
- 07:15 Run Mission loop (move, 4.8km 24:10, 287 kcal)
- 08:30 Verve Coffee -$5.75 (money, food)
- 09:10 Inbox zero (ritual, 22min)
- 12:40 Tartine lunch -$16.20 (money, food)
- 14:20 Spanish Duolingo (ritual, 18min)
- 17:45 Strength push (move, 42min 312 kcal)
- 19:10 Whole Foods -$38.40 (money, groceries)
- 21:30 Read Pachinko (ritual, 28min)
Daily budget $85, move goal 60min, ritual goal 5. Spent $60.35 so far, moved 66min, 4/5 rituals done.
Week: $435 of $595 spent, 296min moved, 26/35 rituals. 11-day move streak.
Reply in 1-3 short sentences. Friendly, specific, no filler.`;

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const newMsgs = [...messages, { role: 'user', text }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    try {
      const resp = await window.claude.complete({
        messages: [
          { role: 'user', content: context + '\n\nMira: ' + text },
        ],
      });
      setMessages([...newMsgs, { role: 'assistant', text: resp.trim() }]);
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', text: "Sorry — couldn't reach the network. Try again?" }]);
    }
    setLoading(false);
  };

  const suggestions = [
    'Why was Friday expensive?',
    'How am I doing this week?',
    'Suggest an evening ritual',
  ];

  return (
    <div style={{ background: theme.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Ask Pal" subtitle="Your tracking companion"
        trailing={<NavIconButton name="ellipsis" theme={theme} />}
      />

      <div ref={scrollerRef} style={{
        flex: 1, overflowY: 'auto', padding: '8px 16px 12px',
      }}>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} theme={theme} />
        ))}
        {loading && <Bubble role="assistant" text={<TypingDots theme={theme} />} theme={theme} />}

        {messages.length <= 1 && !loading && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontFamily: SF, fontSize: 12, color: theme.ink3,
              letterSpacing: -0.08, textTransform: 'uppercase', fontWeight: 600,
              padding: '0 4px',
            }}>Try asking</div>
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)} style={{
                padding: '12px 14px', background: theme.surface,
                border: 'none', borderRadius: 16,
                textAlign: 'left', cursor: 'pointer',
                fontFamily: SF, fontSize: 15, color: theme.ink,
                letterSpacing: -0.24,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Icon name="sparkles" size={16} color={theme.accent} />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{
        padding: '8px 12px 12px',
        background: theme.blur,
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        borderTop: `0.5px solid ${theme.hair}`,
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about your day or log something…"
            rows={1}
            style={{
              width: '100%', padding: '10px 14px',
              background: theme.surface, border: `0.5px solid ${theme.hair}`,
              borderRadius: 20, resize: 'none',
              fontFamily: SF, fontSize: 15, color: theme.ink,
              letterSpacing: -0.24, outline: 'none',
              maxHeight: 100,
            }}
          />
        </div>
        <button onClick={() => send(input)} disabled={!input.trim() || loading} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: input.trim() ? theme.accent : theme.fill,
          border: 'none', cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="arrow.right" size={18} color={input.trim() ? '#fff' : theme.ink3} />
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, text, theme }) {
  const isUser = role === 'user';
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', marginRight: 8,
          background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.rituals} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="sparkles" size={14} color="#fff" />
        </div>
      )}
      <div style={{
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: 18,
        background: isUser ? theme.accent : theme.surface,
        color: isUser ? '#fff' : theme.ink,
        fontFamily: SF, fontSize: 15, letterSpacing: -0.24,
        lineHeight: 1.4,
        borderBottomRightRadius: isUser ? 4 : 18,
        borderBottomLeftRadius: isUser ? 18 : 4,
      }}>{text}</div>
    </div>
  );
}

function TypingDots({ theme }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: theme.ink3,
          animation: `blink 1.4s ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes blink { 0%,80%,100% { opacity: 0.2 } 40% { opacity: 1 } }`}</style>
    </span>
  );
}

// ─── Onboarding ─────────────────────────────────────────
function OnboardingScreen({ theme, step = 0 }) {
  const steps = [
    {
      hero: '✦',
      title: 'Welcome to\nExpensePal',
      body: 'One app for money, movement, and the little rituals that hold your day together.',
      cta: 'Get started',
      showChips: false,
    },
    {
      hero: '$',
      color: theme.money,
      title: 'Set a daily\nbudget',
      body: 'We\'ll help you stay under it — gently.',
      value: '$85',
      cta: 'Continue',
      chips: ['$50', '$85', '$120', '$200'],
      selected: '$85',
    },
    {
      hero: '◐',
      color: theme.move,
      title: 'Pick a\nmove goal',
      body: 'Any kind of movement counts — run, walk, yoga, anything.',
      value: '60 MIN',
      cta: 'Continue',
      chips: ['20 min', '45 min', '60 min', '90 min'],
      selected: '60 min',
    },
    {
      hero: '✧',
      color: theme.rituals,
      title: 'Choose your\nrituals',
      body: 'Five small things you want to do each day. You can edit these anytime.',
      cta: 'Start tracking',
      isRituals: true,
    },
  ];
  const s = steps[step];
  return (
    <div style={{ background: theme.bg, minHeight: '100%', padding: '56px 24px 120px', display: 'flex', flexDirection: 'column' }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 36 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 20 : 6, height: 6, borderRadius: 100,
            background: i === step ? theme.accent : theme.fill,
            transition: 'width 200ms ease',
          }} />
        ))}
      </div>

      {/* Hero glyph */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          background: s.color ? `${s.color}1F` : theme.accentTint,
          color: s.color || theme.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: SFR, fontSize: 48, fontWeight: 700,
          boxShadow: `0 12px 40px ${s.color ? s.color + '33' : theme.accent + '33'}`,
        }}>{s.hero}</div>
      </div>

      <div style={{
        fontFamily: SFR, fontSize: 34, fontWeight: 700, color: theme.ink,
        letterSpacing: -0.8, textAlign: 'center', lineHeight: 1.1,
        whiteSpace: 'pre-line', marginBottom: 14,
      }}>{s.title}</div>
      <div style={{
        fontFamily: SF, fontSize: 17, color: theme.ink3,
        letterSpacing: -0.43, textAlign: 'center', lineHeight: 1.4,
        padding: '0 16px', marginBottom: 32,
      }}>{s.body}</div>

      {s.value && (
        <div style={{
          fontFamily: SFR, fontSize: 72, fontWeight: 700,
          color: theme.ink, textAlign: 'center', letterSpacing: -2,
          lineHeight: 1, marginBottom: 24, fontVariantNumeric: 'tabular-nums',
        }}>{s.value}</div>
      )}

      {s.chips && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          {s.chips.map(c => (
            <div key={c} style={{
              padding: '10px 16px', borderRadius: 100,
              background: c === s.selected ? s.color : theme.surface,
              color: c === s.selected ? '#fff' : theme.ink,
              fontFamily: SF, fontSize: 15, fontWeight: 500, letterSpacing: -0.24,
              border: c === s.selected ? 'none' : `0.5px solid ${theme.hair}`,
            }}>{c}</div>
          ))}
        </div>
      )}

      {s.isRituals && (
        <div style={{
          background: theme.surface, borderRadius: 16, margin: '0 0 24px',
          overflow: 'hidden',
        }}>
          {[
            { icon: 'book.closed.fill', title: 'Morning pages', on: true },
            { icon: 'tray.fill', title: 'Inbox zero', on: true },
            { icon: 'character.book.closed.fill', title: 'Language practice', on: true },
            { icon: 'dumbbell.fill', title: 'Stretch', on: false },
            { icon: 'books.vertical.fill', title: 'Read before bed', on: true },
            { icon: 'heart.fill', title: 'Meditate', on: true },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: theme.rituals,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={r.icon} size={15} color="#fff" />
              </div>
              <div style={{ flex: 1, fontFamily: SF, fontSize: 15, color: theme.ink, letterSpacing: -0.24 }}>{r.title}</div>
              <div style={{
                width: 40, height: 24, borderRadius: 100,
                background: r.on ? theme.move : theme.fill,
                position: 'relative', transition: 'all 200ms',
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: r.on ? 18 : 2,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'left 200ms',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <button style={{
        width: '100%', padding: '16px 0',
        background: theme.accent, color: '#fff',
        border: 'none', borderRadius: 14,
        fontFamily: SF, fontSize: 17, fontWeight: 600, letterSpacing: -0.43,
        cursor: 'pointer',
      }}>{s.cta}</button>
      {step > 0 && (
        <button style={{
          marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: SF, fontSize: 15, color: theme.ink3, letterSpacing: -0.24,
        }}>Skip</button>
      )}
    </div>
  );
}

// ─── Ritual builder ─────────────────────────────────────────
function RitualsBuilderScreen({ theme, onBack }) {
  const rituals = [
    { icon: 'book.closed.fill', title: 'Morning pages', cadence: 'Every morning', streak: 22 },
    { icon: 'tray.fill', title: 'Inbox zero', cadence: 'Weekdays', streak: 8 },
    { icon: 'character.book.closed.fill', title: 'Spanish practice', cadence: 'Daily', streak: 45 },
    { icon: 'dumbbell.fill', title: 'Stretch', cadence: 'Evenings', streak: 3 },
    { icon: 'books.vertical.fill', title: 'Read before bed', cadence: 'Daily', streak: 12 },
  ];
  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Rituals"
        subtitle="Your five daily anchors"
        leading={
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.accent, fontFamily: SF, fontSize: 17,
            letterSpacing: -0.43, padding: '4px 4px 4px 0',
          }}>
            <Icon name="chevron.left" size={20} color={theme.accent} />
            You
          </button>
        }
        trailing={<NavIconButton name="plus" theme={theme} />}
      />

      <Section theme={theme} header="Active rituals" footer="Drag to reorder · swipe to remove">
        {rituals.map((r, i, arr) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            minHeight: 56,
          }}>
            <div style={{ color: theme.ink4, fontSize: 14, cursor: 'grab' }}>≡</div>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: theme.rituals,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={r.icon} size={17} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 500, color: theme.ink, letterSpacing: -0.3 }}>{r.title}</div>
              <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 2 }}>
                {r.cadence} · <span style={{ color: theme.move, fontWeight: 600 }}>🔥 {r.streak}d</span>
              </div>
            </div>
            <Icon name="chevron.right" size={14} color={theme.ink4} />
          </div>
        ))}
      </Section>

      <Section theme={theme} header="Suggested by Pal">
        <ListRow icon="heart.fill" iconBg={theme.rituals}
          title="2-minute gratitude" subtitle="Based on your evening patterns"
          value="Add" valueColor={theme.accent} chevron={false} theme={theme} />
        <ListRow icon="sparkles" iconBg={theme.rituals}
          title="Evening shutdown" subtitle="Complements your morning pages"
          value="Add" valueColor={theme.accent} chevron={false} theme={theme} last />
      </Section>

      <Section theme={theme} header="Preferences">
        <ListRow icon="bell.fill" iconBg="#FF3B30"
          title="Remind me" value="8:00 AM" theme={theme} />
        <ListRow icon="target" iconBg={theme.accent}
          title="Daily goal" value="5 of 6" theme={theme} last />
      </Section>
    </div>
  );
}

// ─── Monthly review ─────────────────────────────────────────
function MonthlyReviewScreen({ theme }) {
  const [narrative, setNarrative] = React.useState(
    "April was your steadiest month yet. Spending stayed 12% below March, movement held at 38 hours — and you kept three-quarters of your rituals. The pattern worth noticing: mornings that started with journaling ended with smaller grocery bills."
  );
  const [loading, setLoading] = React.useState(false);

  const regenerate = async () => {
    setLoading(true);
    try {
      const resp = await window.claude.complete({
        messages: [{
          role: 'user',
          content: `Write a 2-3 sentence warm, specific, editorial reflection on this month's tracking data. Avoid hype words like "amazing" or "crushed it". Be specific and observational.
Data: $1,840 spent (down 12% vs last month), 38 hours moved (up 8%), 23 active days, 112/150 rituals kept (75%). Current 11-day move streak. Top category: food & drink 58%. Pattern: morning ritual days = 32% less food spend.`
        }],
      });
      setNarrative(resp.trim());
    } catch (e) {
      // keep existing
    }
    setLoading(false);
  };

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="April" subtitle="Monthly review"
        trailing={<NavIconButton name="ellipsis" theme={theme} />}
      />

      {/* Narrative card */}
      <div style={{ margin: '8px 16px 20px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${theme.accent}18 0%, ${theme.rituals}18 100%)`,
          border: `0.5px solid ${theme.accent}22`,
          borderRadius: 16, padding: 20,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <Icon name="sparkles" size={15} color={theme.accent} />
            <span style={{
              fontFamily: SF, fontSize: 12, fontWeight: 700, color: theme.accent,
              letterSpacing: 0.5, textTransform: 'uppercase',
            }}>Written by Pal</span>
          </div>
          <div style={{
            fontFamily: SF, fontSize: 17, color: theme.ink, letterSpacing: -0.43,
            lineHeight: 1.5, fontWeight: 400, minHeight: 80,
            opacity: loading ? 0.5 : 1, transition: 'opacity 200ms',
          }}>{narrative}</div>
          <button onClick={regenerate} disabled={loading} style={{
            marginTop: 14, padding: '8px 14px',
            background: theme.surface, border: `0.5px solid ${theme.hair}`,
            borderRadius: 100, cursor: 'pointer',
            fontFamily: SF, fontSize: 13, color: theme.ink2, fontWeight: 500,
            letterSpacing: -0.08, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="sparkles" size={12} color={theme.ink2} />
            {loading ? 'Writing…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* Big stats */}
      <Section theme={theme} header="By the numbers">
        <div style={{ padding: 4 }}>
          {[
            { l: 'Total spent', v: '$1,840', sub: '↓ 12% vs March', c: theme.money, icon: 'dollarsign.circle.fill' },
            { l: 'Time moved', v: '38 hrs', sub: '↑ 8% · 23 active days', c: theme.move, icon: 'flame.fill' },
            { l: 'Rituals kept', v: '112 / 150', sub: '75% · best month yet', c: theme.rituals, icon: 'sparkles' },
            { l: 'Streak', v: '11 days', sub: 'Movement, ongoing', c: theme.accent, icon: 'flame.fill' },
          ].map((s, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px',
              borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: s.c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={s.icon} size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08, fontWeight: 500 }}>{s.l}</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>{s.sub}</div>
              </div>
              <div style={{
                fontFamily: SFR, fontSize: 22, fontWeight: 700, color: theme.ink,
                letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums',
              }}>{s.v}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section theme={theme} header="Patterns Pal found">
        {[
          { t: 'Morning rituals lower food spending', s: 'On days you journal, food costs drop 32%' },
          { t: 'Friday is your spendiest day', s: 'Average $94 — mostly dinner out' },
          { t: 'Movement and sleep are linked', s: 'You move 40% more after 7+ hour nights' },
        ].map((p, i, arr) => (
          <div key={i} style={{
            padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
          }}>
            <Icon name="sparkles" size={16} color={theme.accent} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink, letterSpacing: -0.24 }}>{p.t}</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08, marginTop: 2 }}>{p.s}</div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

Object.assign(window, { AskPalScreen, OnboardingScreen, RitualsBuilderScreen, MonthlyReviewScreen });
