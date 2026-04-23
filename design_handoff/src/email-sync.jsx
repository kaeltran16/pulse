// Email sync feature — IMAP + app password flavor (no OAuth)
// Three screens: Empty/intro → App password setup → Synced dashboard (with manual Sync job)

// ─── Empty / intro ───────────────────────────────────────────
function EmailSyncEmptyScreen({ theme, onConnect, onBack }) {
  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Email sync"
        leading={
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.accent, fontFamily: SF, fontSize: 17,
            letterSpacing: -0.43, padding: '4px 4px 4px 0',
          }}>
            <Icon name="chevron.left" size={20} color={theme.accent} />
            Settings
          </button>
        } />

      <div style={{ padding: '16px 24px 28px', textAlign: 'center' }}>
        <div style={{
          width: 120, height: 120, margin: '12px auto 20px',
          borderRadius: 28, background: `linear-gradient(135deg, ${theme.accent}18, ${theme.money}22)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          <Icon name="tray.fill" size={56} color={theme.accent} />
          <div style={{
            position: 'absolute', bottom: -6, right: -6,
            width: 38, height: 38, borderRadius: '50%',
            background: theme.money, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${theme.money}55`,
          }}>
            <Icon name="sparkles" size={18} color="#fff" />
          </div>
        </div>
        <div style={{
          fontFamily: SF, fontSize: 26, fontWeight: 700, color: theme.ink,
          letterSpacing: -0.5, lineHeight: 1.15, textWrap: 'balance',
        }}>Stop logging card<br/>charges by hand.</div>
        <div style={{
          fontFamily: SF, fontSize: 15, color: theme.ink2, letterSpacing: -0.2,
          lineHeight: 1.45, marginTop: 10, textWrap: 'pretty', padding: '0 8px',
        }}>
          Connect your inbox with a <b style={{ color: theme.ink }}>read-only app password</b>. Pal scans for bank alert emails in the background and drops them on your timeline — categorized, deduped, silent.
        </div>
      </div>

      <Section theme={theme} header="How it works">
        {[
          { icon: 'bell.fill', color: theme.money, title: 'Your bank sends alerts', sub: '"You spent $12.40 at Blue Bottle" — most cards do this' },
          { icon: 'magnifyingglass', color: theme.accent, title: 'Pal reads only those', sub: 'Filtered by sender list before anything is parsed' },
          { icon: 'sparkles', color: theme.rituals, title: 'It lands on Today', sub: 'Categorized, deduped, tagged as synced' },
        ].map((step, i, arr) => (
          <div key={i} style={{
            padding: '14px', display: 'flex', alignItems: 'flex-start', gap: 12,
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: `${step.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name={step.icon} size={17} color={step.color} />
            </div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink, letterSpacing: -0.24 }}>
                {step.title}
              </div>
              <div style={{ fontFamily: SF, fontSize: 13, color: theme.ink3, letterSpacing: -0.08, marginTop: 2, lineHeight: 1.4 }}>
                {step.sub}
              </div>
            </div>
          </div>
        ))}
      </Section>

      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: `${theme.accent}0F`, borderRadius: 12,
          padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
          border: `0.5px solid ${theme.accent}33`,
        }}>
          <Icon name="heart.fill" size={14} color={theme.accent} />
          <div style={{
            fontFamily: SF, fontSize: 12, color: theme.ink2, letterSpacing: -0.08,
            lineHeight: 1.5, flex: 1,
          }}>
            <b style={{ color: theme.ink }}>App password, not your real one.</b> You generate a disposable password in your email settings — Pal stores it encrypted in the iOS keychain. Revoke it anytime from Gmail without touching anything else.
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <button onClick={onConnect} style={{
          width: '100%', padding: '15px', borderRadius: 14,
          background: theme.ink, color: theme.bg, border: 'none', cursor: 'pointer',
          fontFamily: SF, fontSize: 16, fontWeight: 600, letterSpacing: -0.2,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: `0 4px 14px ${theme.ink}33`,
        }}>
          <GmailGlyph size={18} />
          Set up Gmail sync
        </button>
        <button style={{
          width: '100%', padding: '12px', background: 'transparent', border: 'none',
          cursor: 'pointer', marginTop: 4,
          fontFamily: SF, fontSize: 14, color: theme.ink3, letterSpacing: -0.2,
        }}>iCloud, Outlook, any IMAP coming</button>
      </div>
    </div>
  );
}

// ─── App password setup ─────────────────────────────────────
function EmailSyncConnectScreen({ theme, onAuthorize, onCancel }) {
  const [email, setEmail] = React.useState('alex@gmail.com');
  const [pw, setPw] = React.useState('xxxx xxxx xxxx xxxx');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [ok, setOk] = React.useState(false);

  const runTest = () => {
    setTesting(true); setOk(false);
    setTimeout(() => { setTesting(false); setOk(true); }, 900);
  };

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} title="Gmail setup"
        leading={
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.accent, fontFamily: SF, fontSize: 17,
            letterSpacing: -0.43, padding: '4px 4px 4px 0',
          }}>Cancel</button>
        }
        trailing={
          <button onClick={onAuthorize} disabled={!ok} style={{
            background: 'none', border: 'none',
            cursor: ok ? 'pointer' : 'default',
            color: ok ? theme.accent : theme.ink4,
            fontFamily: SF, fontSize: 17, fontWeight: 600,
            letterSpacing: -0.43, padding: '4px 0 4px 4px',
          }}>Save</button>
        } />

      {/* Account section */}
      <Section theme={theme} header="Account" footer="Use the Gmail address whose inbox contains your bank alert emails.">
        <FormRow theme={theme} label="Email">
          <input value={email} onChange={e => setEmail(e.target.value)}
            style={inputStyle(theme)} autoCapitalize="none" autoCorrect="off" type="email" />
        </FormRow>
        <FormRow theme={theme} label="App password" last>
          <input value={pw} onChange={e => setPw(e.target.value)}
            style={{ ...inputStyle(theme), fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: 0.5 }}
            type="password" />
        </FormRow>
      </Section>

      {/* How-to */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: theme.surface, borderRadius: 14, padding: 14,
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <GmailGlyph size={18} />
            <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: theme.ink, letterSpacing: -0.1 }}>
              Generate a Gmail app password
            </span>
          </div>
          <ol style={{
            margin: 0, padding: '0 0 0 20px',
            fontFamily: SF, fontSize: 13, color: theme.ink2, letterSpacing: -0.1,
            lineHeight: 1.6,
          }}>
            <li>Turn on 2-Step Verification in your Google Account.</li>
            <li>Open <u style={{ color: theme.accent }}>myaccount.google.com/apppasswords</u>.</li>
            <li>Create an app password labeled "ExpensePal" — paste the 16 characters above.</li>
          </ol>
          <button style={{
            marginTop: 12, padding: '8px 12px', background: theme.fill,
            border: 'none', borderRadius: 100, cursor: 'pointer',
            fontFamily: SF, fontSize: 13, fontWeight: 600, color: theme.accent,
            letterSpacing: -0.08, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="square.and.arrow.up" size={12} color={theme.accent} />
            Open Google app passwords
          </button>
        </div>
      </div>

      {/* Test connection */}
      <div style={{ padding: '0 16px 16px' }}>
        <button onClick={runTest} disabled={testing} style={{
          width: '100%', padding: '13px', borderRadius: 14,
          background: ok ? `${theme.move}22` : theme.surface,
          color: ok ? theme.move : theme.ink,
          border: 'none', cursor: testing ? 'default' : 'pointer',
          fontFamily: SF, fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `0 0 0 0.5px ${ok ? theme.move + '44' : theme.hair}`,
        }}>
          {testing && <Spinner size={14} color={theme.ink2} />}
          {!testing && ok && <Icon name="checkmark" size={14} color={theme.move} />}
          {!testing && !ok && <Icon name="bolt.fill" size={14} color={theme.accent} />}
          {testing ? 'Testing IMAP…' : ok ? 'Connected to imap.gmail.com' : 'Test connection'}
        </button>
      </div>

      {/* Advanced IMAP */}
      <Section theme={theme}>
        <div onClick={() => setShowAdvanced(!showAdvanced)} style={{
          padding: '14px', display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: theme.fill,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="gearshape.fill" size={15} color={theme.ink2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink, letterSpacing: -0.24 }}>
              IMAP server
            </div>
            <div style={{ fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
              imap.gmail.com · port 993 · SSL
            </div>
          </div>
          <Icon name={showAdvanced ? 'chevron.down' : 'chevron.right'} size={13} color={theme.ink4} />
        </div>
        {showAdvanced && (
          <div style={{ borderTop: `0.5px solid ${theme.hair}` }}>
            <FormRow theme={theme} label="Host">
              <input defaultValue="imap.gmail.com" style={inputStyle(theme)} />
            </FormRow>
            <FormRow theme={theme} label="Port">
              <input defaultValue="993" style={inputStyle(theme)} inputMode="numeric" />
            </FormRow>
            <FormRow theme={theme} label="Encryption" last>
              <div style={{
                fontFamily: SF, fontSize: 15, color: theme.ink, letterSpacing: -0.24,
              }}>SSL / TLS</div>
            </FormRow>
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Synced dashboard w/ manual sync job ────────────────────
function EmailSyncedScreen({ theme, onBack }) {
  const [syncState, setSyncState] = React.useState('idle'); // idle | running | done
  const [progress, setProgress] = React.useState(0);
  const [lastMsg, setLastMsg] = React.useState('Last sync 4 min ago');

  const runSync = () => {
    if (syncState === 'running') return;
    setSyncState('running'); setProgress(0);
    const steps = [
      { at: 80, msg: 'Connecting to imap.gmail.com…', prog: 10 },
      { at: 280, msg: 'Scanning INBOX · 1,847 messages', prog: 28 },
      { at: 580, msg: 'Filtering by sender · 62 matches', prog: 55 },
      { at: 900, msg: 'Parsing 3 new receipts…', prog: 80 },
      { at: 1200, msg: 'Pal categorized 3 · 1 duplicate skipped', prog: 100 },
    ];
    steps.forEach(s => setTimeout(() => {
      setLastMsg(s.msg); setProgress(s.prog);
    }, s.at));
    setTimeout(() => {
      setSyncState('done');
      setLastMsg('Last sync just now · 3 new');
      setTimeout(() => setSyncState('idle'), 2200);
    }, 1400);
  };

  const detections = [
    { merchant: 'Blue Bottle Coffee', amount: 6.50, cat: 'Food & Drink', catColor: theme.move, catIcon: 'cup.and.saucer.fill', source: 'Chase', time: '2h ago', fresh: true },
    { merchant: 'Uber', amount: 18.20, cat: 'Transit', catColor: theme.accent, catIcon: 'figure.walk', source: 'Amex', time: '4h ago', fresh: true },
    { merchant: 'Whole Foods', amount: 62.15, cat: 'Groceries', catColor: theme.money, catIcon: 'basket.fill', source: 'Chase', time: 'Yesterday', fresh: true },
    { merchant: 'Netflix', amount: 17.99, cat: 'Subscriptions', catColor: theme.rituals, catIcon: 'star.fill', source: 'Chase', time: 'Yesterday', recurring: true },
    { merchant: 'Shell', amount: 48.30, cat: 'Transit', catColor: theme.accent, catIcon: 'figure.walk', source: 'Amex', time: '2 days ago' },
    { merchant: 'Trader Joe\u2019s', amount: 34.80, cat: 'Groceries', catColor: theme.money, catIcon: 'basket.fill', source: 'Chase', time: '3 days ago' },
  ];

  return (
    <div style={{ background: theme.bg, minHeight: '100%', paddingBottom: 110 }}>
      <NavBar theme={theme} largeTitle="Email sync"
        leading={
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme.accent, fontFamily: SF, fontSize: 17,
            letterSpacing: -0.43, padding: '4px 4px 4px 0',
          }}>
            <Icon name="chevron.left" size={20} color={theme.accent} />
            Settings
          </button>
        }
        trailing={<NavIconButton name="ellipsis" theme={theme} />} />

      {/* Sync job card — hero */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: 16,
          boxShadow: `0 0 0 0.5px ${theme.hair}`, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GmailGlyph size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 600, color: theme.ink, letterSpacing: -0.24,
                }}>alex@gmail.com</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 7px', borderRadius: 100, background: `${theme.move}22`,
                  color: theme.move, fontFamily: SF, fontSize: 11, fontWeight: 600, letterSpacing: -0.05,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: theme.move,
                    animation: syncState === 'running' ? 'pulse 1.2s infinite' : 'none',
                  }} />
                  {syncState === 'running' ? 'Syncing' : 'Connected'}
                </span>
              </div>
              <div style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 2,
                fontVariantNumeric: 'tabular-nums',
              }}>{lastMsg}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            marginTop: 14, height: 4, borderRadius: 2, background: theme.fill,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: syncState === 'done' ? theme.move : theme.accent,
              borderRadius: 2,
              transition: 'width 260ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms',
            }} />
          </div>

          {/* Sync button + schedule */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button onClick={runSync} disabled={syncState === 'running'} style={{
              flex: 1, padding: '11px 14px', borderRadius: 12,
              background: syncState === 'running' ? theme.fill : theme.ink,
              color: syncState === 'running' ? theme.ink2 : theme.bg,
              border: 'none', cursor: syncState === 'running' ? 'default' : 'pointer',
              fontFamily: SF, fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {syncState === 'running' ? (
                <><Spinner size={12} color={theme.ink2} /> Syncing…</>
              ) : syncState === 'done' ? (
                <><Icon name="checkmark" size={13} color={theme.bg} /> Done</>
              ) : (
                <><Icon name="arrow.triangle.2.circlepath" size={13} color={theme.bg} /> Sync now</>
              )}
            </button>
            <button style={{
              padding: '11px 14px', borderRadius: 12,
              background: theme.fill, color: theme.ink, border: 'none', cursor: 'pointer',
              fontFamily: SF, fontSize: 14, fontWeight: 500, letterSpacing: -0.1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="timer" size={13} color={theme.ink2} />
              Every 15m
            </button>
          </div>
        </div>
      </div>

      {/* Stats tiles */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
          background: theme.surface, borderRadius: 14, padding: '16px 10px',
          boxShadow: `0 0 0 0.5px ${theme.hair}`,
        }}>
          {[
            { l: 'This month', v: 147, c: theme.accent },
            { l: 'All time', v: '2,143', c: theme.money },
            { l: 'Recurring', v: 7, c: theme.rituals },
          ].map((x, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: SFR, fontSize: 22, fontWeight: 700, color: x.c,
                fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3,
              }}>{x.v}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: theme.ink3, letterSpacing: -0.08, marginTop: 1 }}>
                {x.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pal surface */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: theme.accentTint, borderRadius: 14, padding: 14,
          border: `0.5px solid ${theme.accent}22`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Icon name="sparkles" size={12} color={theme.accent} />
            <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: theme.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Pal noticed
            </span>
          </div>
          <div style={{ fontFamily: SF, fontSize: 14, color: theme.ink, letterSpacing: -0.2, lineHeight: 1.45 }}>
            You have <b>7 recurring subscriptions</b> totaling $84/mo. Two of them you haven't opened in 30+ days — want me to flag cancel candidates?
          </div>
          <button style={{
            marginTop: 10, padding: '7px 12px', background: theme.accent, color: '#fff',
            border: 'none', borderRadius: 100, cursor: 'pointer',
            fontFamily: SF, fontSize: 13, fontWeight: 600, letterSpacing: -0.08,
          }}>Review subscriptions</button>
        </div>
      </div>

      {/* Recent detections */}
      <Section theme={theme} header="Recently synced"
        footer="Tap any entry to edit or correct the category. Pal learns from your edits.">
        {detections.map((d, i, arr) => (
          <div key={i} style={{
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 11,
            borderBottom: i < arr.length - 1 ? `0.5px solid ${theme.hair}` : 'none',
            background: d.fresh && syncState === 'done' ? `${theme.accent}08` : 'transparent',
            transition: 'background 400ms',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: `${d.catColor}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name={d.catIcon} size={16} color={d.catColor} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: SF, fontSize: 15, fontWeight: 500, color: theme.ink,
                  letterSpacing: -0.24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{d.merchant}</span>
                {d.recurring && (
                  <Icon name="arrow.triangle.2.circlepath" size={11} color={theme.ink3} />
                )}
                {d.fresh && (
                  <span style={{
                    padding: '1px 6px', borderRadius: 100, background: theme.accent, color: '#fff',
                    fontFamily: SF, fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                  }}>NEW</span>
                )}
              </div>
              <div style={{
                fontFamily: SF, fontSize: 12, color: theme.ink3, letterSpacing: -0.08, marginTop: 1,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span>{d.cat}</span>
                <span style={{ color: theme.ink4 }}>·</span>
                <Icon name="tray.fill" size={9} color={theme.ink3} />
                <span>{d.source}</span>
                <span style={{ color: theme.ink4 }}>·</span>
                <span>{d.time}</span>
              </div>
            </div>
            <div style={{
              fontFamily: SFR, fontSize: 16, fontWeight: 600, color: theme.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
            }}>−${d.amount.toFixed(2)}</div>
          </div>
        ))}
      </Section>

      {/* Settings */}
      <Section theme={theme} header="Sync settings">
        <ListRow icon="arrow.triangle.2.circlepath" iconBg={theme.accent} title="Background sync"
          value="Every 15 min" theme={theme} />
        <ListRow icon="bell.fill" iconBg="#FF9500" title="Notify on new detection"
          value="Off" theme={theme} />
        <ListRow icon="sparkles" iconBg={theme.rituals} title="Pal auto-categorize"
          value="On" theme={theme} />
        <ListRow icon="magnifyingglass" iconBg={theme.money} title="Detected senders"
          value="47" theme={theme} last />
      </Section>

      <div style={{ padding: '8px 16px 0' }}>
        <button style={{
          width: '100%', padding: '13px', background: 'transparent', border: 'none',
          cursor: 'pointer',
          fontFamily: SF, fontSize: 15, color: theme.red || '#FF3B30', fontWeight: 500,
          letterSpacing: -0.24,
        }}>Disconnect Gmail</button>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────
function FormRow({ theme, label, children, last }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${theme.hair}`,
      display: 'flex', alignItems: 'center', gap: 10,
      minHeight: 44,
    }}>
      <div style={{
        fontFamily: SF, fontSize: 15, color: theme.ink2, letterSpacing: -0.24,
        width: 100, flexShrink: 0,
      }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function inputStyle(theme) {
  return {
    width: '100%', border: 'none', background: 'transparent',
    fontFamily: SF, fontSize: 15, color: theme.ink,
    letterSpacing: -0.24, outline: 'none', padding: 0,
    textAlign: 'right',
  };
}

function Spinner({ size = 14, color = '#888' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{
      animation: 'spin 800ms linear infinite',
    }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity="0.22" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Small Gmail-ish glyph
function GmailGlyph({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path d="M6 14v22a2 2 0 002 2h6V22l10 7 10-7v16h6a2 2 0 002-2V14l-18 13L6 14z" fill="#E8EAED"/>
      <path d="M6 14l18 13 18-13v-2a2 2 0 00-2-2h-2L24 22 10 10H8a2 2 0 00-2 2v2z" fill="#EA4335"/>
      <path d="M8 38h6V22L6 16v20a2 2 0 002 2z" fill="#34A853"/>
      <path d="M34 38h6a2 2 0 002-2V16l-8 6v16z" fill="#4285F4"/>
      <path d="M14 22l10 7 10-7v-9L24 22 14 13v9z" fill="#FBBC04"/>
    </svg>
  );
}

Object.assign(window, { EmailSyncEmptyScreen, EmailSyncConnectScreen, EmailSyncedScreen, GmailGlyph });
