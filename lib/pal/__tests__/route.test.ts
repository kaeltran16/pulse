/** @jest-environment node */
import type { ParseResponse } from '../../api-types';

const mockParse = jest.fn<Promise<ParseResponse>, [string]>();
const mockChatStream = jest.fn();
const mockInsertEntry = jest.fn(async () => {});

jest.mock('../client', () => ({
  parse: (text: string) => mockParse(text),
  chatStream: (req: unknown, cb: unknown) => mockChatStream(req, cb),
}));
jest.mock('../../db/queries/insertEntry', () => ({
  insertEntry: (...args: unknown[]) => mockInsertEntry(...(args as [unknown, ParseResponse])),
}));

import { route } from '../route';
import { ValidationError } from '../errors';

const callbacks = () => ({
  onAssistantStart: jest.fn(),
  onChunk: jest.fn(),
  onDone: jest.fn(),
  onError: jest.fn(),
  onCommit: jest.fn(),
  onConfirmNeeded: jest.fn(),
});

const ctx = { messagesForChat: [{ role: 'user' as const, content: 'hi' }], context: { today: {}, recentEntries: [] } };

describe('route()', () => {
  beforeEach(() => { mockParse.mockReset(); mockChatStream.mockReset(); mockInsertEntry.mockClear(); });

  it('chat → calls chatStream, no insertEntry', async () => {
    mockParse.mockResolvedValue({ kind: 'chat', confidence: 'high', raw: 'hi' });
    const cb = callbacks();
    await route('hi', ctx, {} as never, cb);
    expect(mockChatStream).toHaveBeenCalledTimes(1);
    expect(mockInsertEntry).not.toHaveBeenCalled();
    expect(cb.onAssistantStart).toHaveBeenCalled();
  });

  it('high-confidence spend → insertEntry + onCommit, no chatStream', async () => {
    const r: ParseResponse = { kind: 'spend', data: { amount: 5, currency: 'USD' }, confidence: 'high', raw: '$5' };
    mockParse.mockResolvedValue(r);
    const cb = callbacks();
    await route('$5', ctx, { db: 'fake' } as never, cb);
    expect(mockInsertEntry).toHaveBeenCalledWith('fake', r);
    expect(cb.onCommit).toHaveBeenCalledWith(r);
    expect(mockChatStream).not.toHaveBeenCalled();
  });

  it('low-confidence workout → onConfirmNeeded only', async () => {
    const r: ParseResponse = { kind: 'workout', data: { durationMin: 30 }, confidence: 'low', raw: 'ran 30' };
    mockParse.mockResolvedValue(r);
    const cb = callbacks();
    await route('ran 30', ctx, {} as never, cb);
    expect(mockInsertEntry).not.toHaveBeenCalled();
    expect(mockChatStream).not.toHaveBeenCalled();
    expect(cb.onConfirmNeeded).toHaveBeenCalledWith(r);
  });

  it('parse ValidationError → falls through to chatStream', async () => {
    mockParse.mockRejectedValue(new ValidationError('bad'));
    const cb = callbacks();
    await route('weird', ctx, {} as never, cb);
    expect(mockChatStream).toHaveBeenCalledTimes(1);
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('parse network error → onError, no chat', async () => {
    mockParse.mockRejectedValue(new Error('boom'));
    const cb = callbacks();
    await route('x', ctx, {} as never, cb);
    expect(cb.onError).toHaveBeenCalled();
    expect(mockChatStream).not.toHaveBeenCalled();
  });
});
