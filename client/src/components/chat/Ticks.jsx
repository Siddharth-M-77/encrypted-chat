import Icon from '../Icons.jsx';

const RANK = { sent: 1, delivered: 2, read: 3 };

// Lowest status across all recipients: a message is "read" only once everyone has read it.
export function aggregateStatus(m, meId) {
  if (m.local === 'sending') return 'sending';
  if (m.local === 'failed') return 'failed';
  const others = Object.entries(m.statuses || {}).filter(([uid]) => uid !== meId).map(([, s]) => s);
  if (!others.length) return 'sent';
  return others.reduce((min, s) => (RANK[s] < RANK[min] ? s : min));
}

export default function Ticks({ status }) {
  if (status === 'sending') return <span title="sending" className="text-white/60"><Icon name="clock" size={13} /></span>;
  if (status === 'failed') return <span title="failed" className="text-red-200"><Icon name="alert" size={13} /></span>;
  if (status === 'sent') return <span title="sent" className="text-white/70"><Icon name="check" size={14} strokeWidth={2.4} /></span>;
  return (
    <span title={status} className={status === 'read' ? 'text-cyan-300 drop-shadow-[0_0_6px_rgba(103,232,249,.6)]' : 'text-white/70'}>
      <Icon name="checkCheck" size={15} strokeWidth={2.4} />
    </span>
  );
}
