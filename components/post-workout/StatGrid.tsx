import { Text, View } from 'react-native';

export interface StatCell {
  label: string;
  value: string;
  unit: string;
}

export function StatGrid({ cells }: { cells: StatCell[] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 16,
      }}
    >
      {cells.map((c, i) => (
        <View
          key={c.label}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 8,
            backgroundColor: 'rgba(0,0,0,0.14)',
            marginLeft: i === 0 ? 0 : 1,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{c.value}</Text>
          <Text style={{ color: '#fff', opacity: 0.85, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
            {c.label}
          </Text>
          {c.unit ? (
            <Text style={{ color: '#fff', opacity: 0.7, fontSize: 10, marginTop: 1 }}>{c.unit}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
