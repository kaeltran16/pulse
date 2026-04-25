// PalComposer — the unified input surface.
// Replaces the old QuickActionSheet menu AND the standalone Ask Pal screen.
// Compact by default (greeting + input + chips); expands into a chat as the
// user types. Natural-language input routes to logging, answering, or opening
// the workout flow — so the FAB is one surface, not a menu of menus.

const PAL_CONTEXT = `You are Pal, a gentle, concise coach in an iOS app that tracks money, movement and daily rituals.
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

If the user message sounds like a log entry ("I spent…", "did 30 min of…", "finished morning pages"), respond by confirming the log in ONE short sentence and note what ring it updates. Otherwise answer the question in 1-2 short sentences. Friendly, specific, no filler. Never markdown.`;

function PalComposer({ theme, onClose, onStartWorkout, seed = null }) {
  // seed: optional initial user message (e.g. from a Today chip tap)
  const [messages, setMessages] = React.useState(seed ? [{ role: 'user', text: seed }] : []);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(seed ? true : false);
  const [expanded, setExpanded] = React.useState(seed ? true : false);
  const scrollerRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // Auto-scroll chat to bottom on new messages
  React.useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, loading]);

  // Kick off seed reply
  React.useEffect(() => {
    if (seed) ask(seed, true);
    // eslint-disable-next-line
  }, []);

  const ask = async (text, isSeed = false) => {
    if (!text.trim() || loading) return;
    const base = isSeed ? messages : [...messages, { role: 'user', text }];
    if (!isSeed) setMessages(base);
    setInput('');
    setExpanded(true);
    setLoading(true);
    try {
      const resp = await window.claude.complete({
        messages: [{ role: 'user', content: PAL_CONTEXT + '\n\nMira: ' + text }],
      });
      setMessages([...base, { role: 'assistant', text: (resp || '').trim() }]);
    } catch (e) {
      setMessages([...base, { role: 'assistant', text: "Sorry — couldn't reach the network. Try again?" }]);
    }
    setLoading(false);
  };

  // Starter chips — mirror the three trackers + a workout hand-off
  const starters = [
    { icon: 'dollarsign.circle.fill', color: theme.money,   label: 'Verve coffee, $5' },
    { icon: 'sparkles',                color: theme.rituals, label: 'Finished morning pages' },
    { icon: 'chart.bar.fill',          color: theme.accent,  label: 'How\u2019s my week so far?' },
  ];

  const sheetHeight = expanded ? '86%' : 'auto';

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: theme.surface,
        borderRadius: '18px 18px 0 0',
        padding: 0,
        display: 'flex', flexDirection: 'column',
        height: sheetHeight,
        maxHeight: '92%',
        animation: 'slideUp 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        transition: 'height 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        overflow: 'hidden',
      }}>
        {/* Grabber + header */}
        <div style={{
          padding: '8px 16px 8px',
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 5, borderRadius: 3, background: theme.hair,
            margin: '0 auto 12px',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.rituals} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="sparkles" size={16} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: SF, fontSize: 15, fontWeight: 600,
                color: theme.ink, letterSpacing: -0.24,
              }}>Pal</div>
              <div style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: theme.move,
                }} />
                Log, ask, or start anything
              </div>
            </div>
            <button onClick={onClose} style={{
              background: theme.fill, border: 'none', borderRadius: '50%',
              width: 30, height: 30, cursor: 'pointer', color: theme.ink3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon name="xmark" size={13} color={theme.ink3} />
            </button>
          </div>
        </div>

        {/* Conversation area — only when there's content */}
        {expanded && (
          <div ref={scrollerRef} style={{
            flex: 1, overflowY: 'auto', padding: '12px 16px 4px',
          }}>
            {messages.map((m, i) => (
              <ComposerBubble key={i} role={m.role} text={m.text} theme={theme} />
            ))}
            {loading && <ComposerBubble role="assistant" text={<TypingDots theme={theme} />} theme={theme} />}
          </div>
        )}

        {/* Starter chips — compact state only */}
        {!expanded && (
          <div style={{ padding: '4px 12px 10px' }}>
            <button onClick={() => { onClose(); onStartWorkout && onStartWorkout(); }} style={{
              width: '100%', padding: '12px 14px', background: theme.moveTint,
              border: 'none', borderRadius: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              marginBottom: 10,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: theme.move,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="play.fill" size={14} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 600,
                  color: theme.ink, letterSpacing: -0.24,
                }}>Start a workout</div>
                <div style={{
                  fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08,
                  marginTop: 1,
                }}>Jump into a routine — I'll track it</div>
              </div>
              <Icon name="chevron.right" size={13} color={theme.ink4} />
            </button>

            <div style={{
              fontFamily: SF, fontSize: 11, fontWeight: 700, color: theme.ink3,
              letterSpacing: 0.5, textTransform: 'uppercase',
              padding: '4px 4px 8px',
            }}>Try saying</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {starters.map(s => (
                <button key={s.label} onClick={() => ask(s.label)} style={{
                  padding: '10px 12px', background: theme.surface,
                  border: `0.5px solid ${theme.hair}`, borderRadius: 12,
                  textAlign: 'left', cursor: 'pointer',
                  fontFamily: SF, fontSize: 14, color: theme.ink,
                  letterSpacing: -0.15,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Icon name={s.icon} size={15} color={s.color} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <Icon name="arrow.up.right" size={11} color={theme.ink4} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer — always visible */}
        <div style={{
          padding: '8px 12px 14px',
          borderTop: expanded ? `0.5px solid ${theme.hair}` : 'none',
          background: theme.surface,
          display: 'flex', gap: 8, alignItems: 'flex-end',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              value={input}
              autoFocus
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              placeholder={expanded ? 'Reply or log something\u2026' : 'Log a coffee, ask about your week\u2026'}
              rows={1}
              style={{
                width: '100%', padding: '10px 14px',
                background: theme.fill, border: 'none',
                borderRadius: 20, resize: 'none',
                fontFamily: SF, fontSize: 15, color: theme.ink,
                letterSpacing: -0.24, outline: 'none',
                maxHeight: 100, minHeight: 38,
                lineHeight: 1.3,
              }}
            />
          </div>
          <button onClick={() => ask(input)} disabled={!input.trim() || loading} style={{
            width: 38, height: 38, borderRadius: '50%',
            background: input.trim() ? theme.accent : theme.fill,
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 150ms ease',
          }}>
            <Icon name="arrow.up" size={17} color={input.trim() ? '#fff' : theme.ink4} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposerBubble({ role, text, theme }) {
  const isUser = role === 'user';
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 8, alignItems: 'flex-end', gap: 8,
    }}>
      {!isUser && (
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.rituals} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="sparkles" size={11} color="#fff" />
        </div>
      )}
      <div style={{
        maxWidth: '76%',
        padding: '9px 13px',
        borderRadius: 18,
        background: isUser ? theme.accent : theme.fill,
        color: isUser ? '#fff' : theme.ink,
        fontFamily: SF, fontSize: 15, letterSpacing: -0.24,
        lineHeight: 1.4,
        borderBottomRightRadius: isUser ? 5 : 18,
        borderBottomLeftRadius: isUser ? 18 : 5,
      }}>{text}</div>
    </div>
  );
}

Object.assign(window, { PalComposer });
