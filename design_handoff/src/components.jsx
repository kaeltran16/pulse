// iOS-style primitives: NavBar, InsetCard, ListRow, TabBar, Section header

const SF = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif`;
const SFR = `-apple-system-ui-rounded, "SF Pro Rounded", ${SF}`;

// iOS Large-Title navigation bar
function NavBar({ title, theme, trailing, leading, large = true, subtitle }) {
  return (
    <div style={{
      padding: '56px 16px 8px',
      background: theme.bg,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 32, marginBottom: large ? 6 : 0,
      }}>
        <div>{leading}</div>
        <div>{trailing}</div>
      </div>
      {large && (
        <div>
          <div style={{
            fontFamily: SF, fontWeight: 700, fontSize: 34,
            letterSpacing: 0.37, lineHeight: '41px', color: theme.ink,
          }}>{title}</div>
          {subtitle && (
            <div style={{
              fontFamily: SF, fontSize: 15, color: theme.ink3,
              marginTop: 2, letterSpacing: -0.24,
            }}>{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}

// Circular icon button in nav
function NavIconButton({ name, theme, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 32, height: 32, borderRadius: '50%',
      background: theme.fill, border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: theme.accent,
    }}>
      <Icon name={name} size={17} />
    </button>
  );
}

// Inset grouped section
function Section({ header, footer, children, theme, noInset }) {
  return (
    <div style={{ margin: noInset ? '0' : '0 16px 20px' }}>
      {header && (
        <div style={{
          padding: '0 16px 8px',
          fontFamily: SF, fontSize: 13, fontWeight: 400,
          color: theme.ink3, textTransform: 'uppercase',
          letterSpacing: -0.08,
        }}>{header}</div>
      )}
      <div style={{
        background: theme.surface, borderRadius: 12,
        overflow: 'hidden',
      }}>{children}</div>
      {footer && (
        <div style={{
          padding: '8px 16px 0',
          fontFamily: SF, fontSize: 13,
          color: theme.ink3, letterSpacing: -0.08,
        }}>{footer}</div>
      )}
    </div>
  );
}

// iOS list row with SF-style icon tile
function ListRow({ icon, iconBg, title, subtitle, value, valueColor, chevron = true, theme, last, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px', minHeight: 44,
      position: 'relative', cursor: onClick ? 'pointer' : 'default',
    }}>
      {icon && (
        <div style={{
          width: 29, height: 29, borderRadius: 7,
          background: iconBg || theme.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0,
        }}>
          <Icon name={icon} size={17} color="#fff" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: 8 }}>
        <div style={{
          fontFamily: SF, fontSize: 17, color: theme.ink, letterSpacing: -0.43,
          lineHeight: '22px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontFamily: SF, fontSize: 13, color: theme.ink3,
            letterSpacing: -0.08, marginTop: 1,
          }}>{subtitle}</div>
        )}
      </div>
      {value && (
        <div style={{
          fontFamily: SF, fontSize: 17, color: valueColor || theme.ink3,
          letterSpacing: -0.43, fontVariantNumeric: 'tabular-nums',
        }}>{value}</div>
      )}
      {chevron && (
        <Icon name="chevron.right" size={14} color={theme.ink4} />
      )}
      {!last && (
        <div style={{
          position: 'absolute', left: icon ? 57 : 16, right: 0, bottom: 0,
          height: 0.5, background: theme.hair,
        }} />
      )}
    </div>
  );
}

// Tab bar — iOS native style with blur
// Tabs map to the 3 trackers + You; center FAB opens a quick-action sheet.
function TabBar({ active, onTab, theme }) {
  const tabs = [
    { id: 'today',   label: 'Today',   icon: 'house.fill' },
    { id: 'move',    label: 'Move',    icon: 'figure.run' },
    { id: 'add',     label: '',        icon: 'plus', fab: true },
    { id: 'rituals', label: 'Rituals', icon: 'sparkles' },
    { id: 'profile', label: 'You',     icon: 'person.crop.circle.fill' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingBottom: 24, paddingTop: 8,
      background: theme.blur,
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      borderTop: `0.5px solid ${theme.hair}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 40,
    }}>
      {tabs.map(t => {
        if (t.fab) {
          return (
            <button key={t.id} onClick={() => onTab(t.id)} style={{
              width: 50, height: 50, borderRadius: '50%',
              background: theme.accent, color: '#fff',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 14px ${theme.accent}66`,
              marginTop: -2,
            }}>
              <Icon name="plus" size={22} />
            </button>
          );
        }
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onTab(t.id)} style={{
            flex: 1, background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '4px 0',
            color: isActive ? theme.accent : theme.ink3,
          }}>
            <Icon name={t.icon} size={24} />
            <span style={{
              fontFamily: SF, fontSize: 10, fontWeight: 500, letterSpacing: 0.1,
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Segmented control (iOS style)
function Segmented({ options, value, onChange, theme }) {
  return (
    <div style={{
      display: 'flex', padding: 2,
      background: theme.fill, borderRadius: 9,
      position: 'relative',
    }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, padding: '6px 10px',
            background: active ? (theme === window.THEMES.dark ? '#636366' : '#FFFFFF') : 'transparent',
            border: 'none', borderRadius: 7, cursor: 'pointer',
            boxShadow: active ? '0 3px 8px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)' : 'none',
            fontFamily: SF, fontSize: 13, fontWeight: active ? 600 : 500,
            color: theme.ink, letterSpacing: -0.08,
            transition: 'all 150ms ease',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// Pill badge
function Badge({ color, label, theme }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 100,
      background: color + '22', color: color,
      fontFamily: SF, fontSize: 12, fontWeight: 600, letterSpacing: -0.08,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

// Activity ring (nested)
function ActivityRings({ theme, size = 140, values = [0.7, 1, 0.8] }) {
  const colors = [theme.money, theme.move, theme.rituals];
  const cx = size / 2, cy = size / 2;
  const strokeW = 14;
  const gap = 2;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {values.map((v, i) => {
        const r = size / 2 - strokeW / 2 - i * (strokeW + gap);
        const c = 2 * Math.PI * r;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r}
              fill="none" stroke={colors[i] + '33'} strokeWidth={strokeW} />
            <circle cx={cx} cy={cy} r={r}
              fill="none" stroke={colors[i]} strokeWidth={strokeW}
              strokeDasharray={`${c * Math.min(v, 1)} ${c}`}
              strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

Object.assign(window, {
  NavBar, NavIconButton, Section, ListRow, TabBar, Segmented, Badge, ActivityRings, SF, SFR,
});
