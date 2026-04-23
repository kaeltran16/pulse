// SF Symbol-style icons drawn as SVG (approximations)
// Uses currentColor for tinting

function Icon({ name, size = 20, color }) {
  const s = { width: size, height: size, color: color, flexShrink: 0 };
  const stroke = 1.8;
  switch (name) {
    case 'house.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M12 3L2 11h2v9h6v-6h4v6h6v-9h2L12 3z"/></svg>;
    case 'calendar':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 3v4M16 3v4"/><circle cx="8" cy="14" r="0.8" fill="currentColor"/><circle cx="12" cy="14" r="0.8" fill="currentColor"/><circle cx="16" cy="14" r="0.8" fill="currentColor"/></svg>;
    case 'chart.bar.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><rect x="3" y="13" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="4" width="4" height="17" rx="1"/></svg>;
    case 'person.crop.circle.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3.5" fill="white"/><path d="M5.5 19c1.5-3 4-4.5 6.5-4.5s5 1.5 6.5 4.5" fill="white" opacity="0"/><path d="M6 19.5c1.5-2.7 3.8-4 6-4s4.5 1.3 6 4" fill="white"/></svg>;
    case 'plus':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
    case 'plus.circle.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="12" cy="12" r="11"/><path d="M12 7v10M7 12h10" stroke="white" strokeWidth={2.4} strokeLinecap="round"/></svg>;
    case 'chevron.right':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron.left':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>;
    case 'chevron.down':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>;
    case 'dollarsign.circle.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="12" cy="12" r="11"/><path d="M12 6v12M9 9h4.5a2 2 0 010 4h-3a2 2 0 000 4H15" stroke="white" strokeWidth={2} fill="none" strokeLinecap="round"/></svg>;
    case 'figure.run':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="15" cy="4" r="2"/><path d="M14 8l-4 3-2 4 3 1 1-2 3 2v6h2v-7l-2-2 2-3 2 3h3v-2h-2l-3-4-3 1z"/></svg>;
    case 'sparkles':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM19 14l.8 2.2 2.2.8-2.2.8L19 20l-.8-2.2-2.2-.8 2.2-.8L19 14zM5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6L5 14z"/></svg>;
    case 'book.closed.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M5 4h12a2 2 0 012 2v13a2 2 0 01-2 2H5a1 1 0 01-1-1v-1a1 1 0 011-1h12V6H5a1 1 0 01-1-1V5a1 1 0 011-1z"/></svg>;
    case 'tray.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M4 13l2-7h12l2 7v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5zm2.5-1h3.5a2 2 0 014 0h3.5l-1.3-4.5H7.8L6.5 12z"/></svg>;
    case 'cup.and.saucer.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M5 6h12v6a5 5 0 01-5 5h-2a5 5 0 01-5-5V6zm12 1v4a2 2 0 104 0V7h-4zM4 19h16v2H4z"/></svg>;
    case 'fork.knife':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M7 2v8a2 2 0 001 1.7V22h2V11.7A2 2 0 0011 10V2H9v5H8V2H7zM14 2c-1 2-1 5-1 7 0 2 .5 3 2 3.5V22h2V2h-3z"/></svg>;
    case 'basket.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M9 4l-4 4H3v2h1l1.5 9a2 2 0 002 1.7h9a2 2 0 002-1.7L20 10h1V8h-2l-4-4h-2l3.5 4h-9L11 4H9zm-.5 8a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm6 0a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z"/></svg>;
    case 'character.book.closed.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M5 4h12a2 2 0 012 2v13a2 2 0 01-2 2H5a1 1 0 01-1-1v-1a1 1 0 011-1h12V6H5V4z"/><text x="8" y="14" fontSize="8" fontWeight="700" fill="white">A</text></svg>;
    case 'dumbbell.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><rect x="2" y="9" width="3" height="6" rx="1"/><rect x="5" y="7" width="3" height="10" rx="1"/><rect x="8" y="10.5" width="8" height="3"/><rect x="16" y="7" width="3" height="10" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/></svg>;
    case 'books.vertical.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><rect x="4" y="3" width="4" height="18" rx="1"/><rect x="9" y="5" width="4" height="16" rx="1"/><path d="M15 6l3.8 1L21 19.5l-3.8 1.2L15 7.5z"/></svg>;
    case 'ellipsis':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>;
    case 'magnifyingglass':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>;
    case 'flame.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M12 2c1 3 4 4 4 8 0 1.5-.5 2.5-1.5 3 .3-1 .3-2-.5-3-.7 2-3 2.5-3 5 0 1 .5 2 1.5 2.5-2 0-4-1.5-4-4.5 0-3 2-4 2-7 0-1.5.5-3 1.5-4z"/></svg>;
    case 'heart.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M12 21s-8-5-8-11a5 5 0 019-3 5 5 0 019 3c0 6-8 11-8 11h-2z"/></svg>;
    case 'star.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M12 2l3 7 7 .5-5.5 5 2 7L12 17.5 5.5 21.5l2-7L2 9.5 9 9l3-7z"/></svg>;
    case 'bell.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M12 3a6 6 0 016 6v4l2 3H4l2-3V9a6 6 0 016-6zm-2 17a2 2 0 004 0h-4z"/></svg>;
    case 'gearshape.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.5 4a8.5 8.5 0 00-.1-1.3l2.2-1.7-2-3.4-2.6 1a8.5 8.5 0 00-2.3-1.3L15 2.5h-4l-.5 2.8a8.5 8.5 0 00-2.3 1.3l-2.6-1-2 3.4 2.2 1.7a8.5 8.5 0 000 2.6l-2.2 1.7 2 3.4 2.6-1a8.5 8.5 0 002.3 1.3l.4 2.8h4l.5-2.8a8.5 8.5 0 002.3-1.3l2.6 1 2-3.4-2.2-1.7c.1-.4.1-.9.1-1.3z"/></svg>;
    case 'arrow.right':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'target':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>;
    case 'delete.left.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M22 5H10L4 12l6 7h12a2 2 0 002-2V7a2 2 0 00-2-2zm-8 4l2.5 2.5L19 9l1.5 1.5L18 13l2.5 2.5L19 17l-2.5-2.5L14 17l-1.5-1.5L15 13l-2.5-2.5L14 9z"/></svg>;
    case 'checkmark':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>;
    case 'play.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M7 4v16l14-8L7 4z"/></svg>;
    case 'pause.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
    case 'timer':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/></svg>;
    case 'arrow.triangle.2.circlepath':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 10a8 8 0 0114-5l2 2M20 14a8 8 0 01-14 5l-2-2"/><path d="M20 3v4h-4M4 21v-4h4" fill="currentColor" stroke="none"/></svg>;
    case 'square.and.arrow.up':
      return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M8 8l4-4 4 4"/><path d="M6 12v6a2 2 0 002 2h8a2 2 0 002-2v-6"/></svg>;
    case 'bolt.fill':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><path d="M13 2L4 14h6l-2 8 10-12h-6l1-8z"/></svg>;
    // Figure icons (stylized body shapes)
    case 'figure.strengthtraining.traditional':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="12" cy="4" r="2"/><path d="M8 8h8l-1 3h-6l-1-3zM6 12h12v2H6v-2zm3 4h6l1 6h-2l-.5-4h-3l-.5 4H9l1-6z"/></svg>;
    case 'figure.strengthtraining.functional':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="12" cy="4" r="2"/><path d="M10 7l-4 4 2 2 2-1v4l-2 6h2l2-5 2 5h2l-2-6v-4l2 1 2-2-4-4h-4z"/></svg>;
    case 'figure.pullup':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><rect x="3" y="2" width="18" height="1.5" rx="0.5"/><path d="M10 3.5v3l-2 1v4l2-1v5l-1 6h2l1-5h0l1 5h2l-1-6v-5l2 1v-4l-2-1v-3h-4z"/><circle cx="12" cy="9" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>;
    case 'figure.walk':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="13" cy="4" r="2"/><path d="M14 7l-3 3v5l2-1v2l-2 5h2l2-4 1 4h2l-1-5-2-2v-3l2 2h3v-2h-2l-2-2-2-2z"/></svg>;
    case 'figure.core.training':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="5" cy="10" r="1.8"/><path d="M7 10h11v3h-8l-3 2-3-1 3-4zM4 15h18v1.5H4z"/></svg>;
    case 'figure.rower':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="6" cy="8" r="1.8"/><path d="M8 9l4 1 3-2 3 1v2l-3 0-2 2 2 4h-2l-2-3-3 1-2 3H4l3-4 0-3 1-2zM2 18h20v1.5H2z"/></svg>;
    case 'figure.indoor.cycle':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="14" cy="4" r="2"/><circle cx="5" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="19" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M14 7l-2 4h3l2 4-3 3M14 11l4 3M12 11L9 14"/></svg>;
    case 'figure.stair.stepper':
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="11" cy="4" r="2"/><path d="M12 7l-2 4 1 3h2l-2 4h2l2-4-1-3 3-2v-2z"/><path d="M4 20h4v-3h4v-3h4v-3h4v-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    default:
      return <svg viewBox="0 0 24 24" style={s} fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>;
  }
}

Object.assign(window, { Icon });
