import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bubble } from './pal/Bubble';
import { TypingDots } from './pal/TypingDots';
import { StarterChips } from './pal/StarterChips';
import { ConfirmEntryBubble } from './pal/ConfirmEntryBubble';

import { db } from '../lib/db/client';
import { buildContext } from '../lib/pal/context';
import { route } from '../lib/pal/route';
import { insertEntry } from '../lib/db/queries/insertEntry';
import type { ChatMessage } from '../lib/pal/client';
import type { ParseResponse } from '../lib/api-types';

type BubbleMsg =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; text: string; streaming?: boolean }
  | { id: string; kind: 'confirm'; entry: Extract<ParseResponse, { kind: 'spend' | 'workout' }>; status: 'pending' | 'committed' | 'discarded' };

let _seq = 0;
const newId = () => `b${Date.now()}_${++_seq}`;

export function PalComposer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<BubbleMsg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const expanded = messages.length > 0 || pending;
  const abortRef = useRef<{ abort: () => void } | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) {
      abortRef.current?.abort();
      abortRef.current = undefined;
      setMessages([]);
      setInput('');
      setPending(false);
    }
  }, [visible]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const userBubble: BubbleMsg = { id: newId(), kind: 'user', text: trimmed };
    setMessages((prev) => [...prev, userBubble]);
    setInput('');
    setPending(true);

    const ctx = await buildContext(db);
    const messagesForChat: ChatMessage[] = [...messages, userBubble]
      .filter((m): m is Extract<BubbleMsg, { kind: 'user' | 'assistant' }> => m.kind === 'user' || m.kind === 'assistant')
      .map((m) => ({ role: m.kind, content: m.text }));

    const handle = await route(
      trimmed,
      { messagesForChat, context: ctx },
      { db },
      {
        onAssistantStart: (id) =>
          setMessages((prev) => [...prev, { id, kind: 'assistant', text: '', streaming: true }]),
        onChunk: (id, delta) =>
          setMessages((prev) => prev.map((m) => (m.id === id && m.kind === 'assistant' ? { ...m, text: m.text + delta } : m))),
        onDone: (id) => {
          setMessages((prev) => prev.map((m) => (m.id === id && m.kind === 'assistant' ? { ...m, streaming: false } : m)));
          setPending(false);
        },
        onError: (id, msg) => {
          setMessages((prev) => {
            const existing = prev.find((m) => m.id === id);
            if (existing && existing.kind === 'assistant') {
              return prev.map((m) => (m.id === id ? { id, kind: 'assistant', text: msg } : m));
            }
            return [...prev, { id, kind: 'assistant', text: msg }];
          });
          setInput(trimmed);
          setPending(false);
        },
        onCommit: (entry) => {
          if (entry.kind !== 'spend' && entry.kind !== 'workout') return;
          const summary = entry.kind === 'spend'
            ? `Logged ${entry.data.merchant ?? 'spend'} — $${entry.data.amount.toFixed(2)} on Money ring.`
            : `Logged ${entry.data.routine ?? 'workout'} — ${entry.data.durationMin}m on Move ring.`;
          setMessages((prev) => [...prev, { id: newId(), kind: 'assistant', text: summary }]);
          setPending(false);
        },
        onConfirmNeeded: (entry) => {
          if (entry.kind !== 'spend' && entry.kind !== 'workout') return;
          setMessages((prev) => [...prev, { id: newId(), kind: 'confirm', entry, status: 'pending' }]);
          setPending(false);
        },
      },
    );
    abortRef.current = handle;
  };

  const onConfirmEntry = async (id: string, updated: Extract<ParseResponse, { kind: 'spend' | 'workout' }>) => {
    try { await insertEntry(db, updated); }
    catch {
      setMessages((prev) => [...prev, { id: newId(), kind: 'assistant', text: "Couldn't save the entry — try again." }]);
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id && m.kind === 'confirm' ? { ...m, entry: updated, status: 'committed' } : m)));
    const summary = updated.kind === 'spend'
      ? `Logged ${updated.data.merchant ?? 'spend'} — $${updated.data.amount.toFixed(2)} on Money ring.`
      : `Logged ${updated.data.routine ?? 'workout'} — ${updated.data.durationMin}m on Move ring.`;
    setMessages((prev) => [...prev, { id: newId(), kind: 'assistant', text: summary }]);
  };

  const onDiscardEntry = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id && m.kind === 'confirm' ? { ...m, status: 'discarded' } : m)));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <Pressable
          onPress={() => {}}
          className="mt-auto bg-bg rounded-t-3xl"
          style={{ height: expanded ? '86%' : 'auto' }}
        >
          <SafeAreaView edges={['bottom']}>
            <View className="items-center pt-2">
              <View className="h-1.5 w-9 rounded-full bg-hair" />
            </View>
            <View className="flex-row items-center px-4 py-2">
              <View className="h-8 w-8 rounded-full bg-accent items-center justify-center">
                <Text className="text-white text-callout">✦</Text>
              </View>
              <View className="ml-2 flex-1">
                <Text className="text-callout text-ink">Pal</Text>
                <Text className="text-caption2 text-ink3">Log, ask, or start anything</Text>
              </View>
              <Pressable onPress={onClose} className="h-8 w-8 rounded-full bg-fill items-center justify-center">
                <Text className="text-ink3">✕</Text>
              </Pressable>
            </View>

            {expanded && (
              <ScrollView ref={scrollRef} className="flex-1 px-4">
                {messages.map((m) => {
                  if (m.kind === 'user' || m.kind === 'assistant') {
                    return <Bubble key={m.id} role={m.kind} text={m.text || (m.streaming ? '…' : '')} />;
                  }
                  return (
                    <ConfirmEntryBubble
                      key={m.id}
                      entry={m.entry}
                      status={m.status}
                      onConfirm={(updated) => onConfirmEntry(m.id, updated)}
                      onDiscard={() => onDiscardEntry(m.id)}
                    />
                  );
                })}
                {pending && messages[messages.length - 1]?.kind !== 'assistant' && <TypingDots />}
              </ScrollView>
            )}

            {!expanded && <StarterChips onPick={send} />}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="flex-row items-end px-3 pb-3 pt-2 gap-2 border-t border-hair">
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder={expanded ? 'Reply or log something…' : 'Log a coffee, ask about your week…'}
                  multiline
                  className="flex-1 bg-fill rounded-2xl px-3 py-2 text-body text-ink max-h-24"
                />
                <Pressable
                  onPress={() => send(input)}
                  disabled={!input.trim() || pending}
                  className={input.trim() && !pending ? 'h-9 w-9 rounded-full bg-accent items-center justify-center' : 'h-9 w-9 rounded-full bg-fill items-center justify-center'}
                >
                  <Text className={input.trim() && !pending ? 'text-white' : 'text-ink3'}>↑</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
