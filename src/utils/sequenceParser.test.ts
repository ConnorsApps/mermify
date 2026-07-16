import { describe, expect, test } from 'vitest';
import {
  parseSequenceParticipants,
  parseSequenceMessages,
  addParticipant,
  updateParticipant,
  deleteParticipant,
  reorderParticipants,
  addMessage,
  updateMessage,
  deleteMessage,
  toggleAutonumber,
  updateMessageConnection,
  reverseMessage,
} from './sequenceParser';

describe('sequenceParser', () => {
  const sampleCode = `sequenceDiagram
    actor Alice
    participant P1 as New Boundary
    participant A1@{ "type": "entity" } as New Actor
    participant Bob@{ "type": "collections" }
    Alice->>P1: new msg
    Alice->>P1: second msg
    Alice->>Bob: Hi Bob
    Bob-->>Alice: Hi Alice`;

  describe('parseSequenceParticipants', () => {
    test('extracts explicit participants with shapes and aliases', () => {
      const parts = parseSequenceParticipants(sampleCode);
      expect(parts).toHaveLength(4);
      expect(parts[0]).toEqual({ id: 'Alice', alias: 'Alice', type: 'actor' });
      expect(parts[1]).toEqual({ id: 'P1', alias: 'New Boundary', type: 'participant' });
      expect(parts[2]).toEqual({ id: 'A1', alias: 'New Actor', type: 'entity' });
      expect(parts[3]).toEqual({ id: 'Bob', alias: 'Bob', type: 'collections' });
    });

    test('extracts undeclared participants from messages', () => {
      const code = `sequenceDiagram
        Alice->>Bob: Hello`;
      const parts = parseSequenceParticipants(code);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toEqual({ id: 'Alice', alias: 'Alice', type: 'participant' });
      expect(parts[1]).toEqual({ id: 'Bob', alias: 'Bob', type: 'participant' });
    });
  });

  describe('parseSequenceMessages', () => {
    test('extracts all messages with their line index', () => {
      const msgs = parseSequenceMessages(sampleCode);
      expect(msgs).toHaveLength(4);
      expect(msgs[0]).toEqual({
        from: 'Alice',
        to: 'P1',
        arrow: '->>',
        label: 'new msg',
        lineIndex: 5,
      });
      expect(msgs[3]).toEqual({
        from: 'Bob',
        to: 'Alice',
        arrow: '-->>',
        label: 'Hi Alice',
        lineIndex: 8,
      });
    });
  });

  describe('addParticipant', () => {
    test('inserts participant after sequenceDiagram', () => {
      const code = `sequenceDiagram\n    Alice->>Bob: Hello`;
      const result = addParticipant(code, 'actor');
      expect(result).toContain('actor P1 as Participant 1');
    });

    test('inserts participant with custom JSON type', () => {
      const code = `sequenceDiagram\n    Alice->>Bob: Hello`;
      const result = addParticipant(code, 'boundary');
      expect(result).toContain('participant P1@{ "type": "boundary" } as Participant 1');
    });

    test('inserts after a specific participant', () => {
      const code = `sequenceDiagram
    actor Alice
    actor Bob`;
      const result = addParticipant(code, 'participant', 'Alice');
      const lines = result.split('\n');
      expect(lines[1]).toContain('actor Alice');
      expect(lines[2]).toContain('participant P1 as Participant 1');
      expect(lines[3]).toContain('actor Bob');
    });
  });

  describe('updateParticipant', () => {
    test('updates alias and type of existing actor to participant', () => {
      const code = `sequenceDiagram\n    actor Alice`;
      const result = updateParticipant(code, 'Alice', 'Super Alice', 'participant');
      expect(result).toContain('participant Alice as Super Alice');
    });

    test('updates existing participant with custom shape type', () => {
      const code = `sequenceDiagram\n    participant Bob as Bobby`;
      const result = updateParticipant(code, 'Bob', 'Robert', 'collections');
      expect(result).toContain('participant Bob@{ "type": "collections" } as Robert');
    });
  });

  describe('deleteParticipant', () => {
    test('removes declaration and associated messages', () => {
      const code = `sequenceDiagram
    actor Alice
    participant Bob
    Alice->>Bob: hello
    Bob->>Charlie: hi`;
      const result = deleteParticipant(code, 'Bob');
      expect(result).not.toContain('participant Bob');
      expect(result).not.toContain('Alice->>Bob');
      expect(result).not.toContain('Bob->>Charlie');
      expect(result).toContain('actor Alice');
    });
  });

  describe('reorderParticipants', () => {
    test('reorders participant declarations', () => {
      const code = `sequenceDiagram
    actor Alice
    participant Bob
    Alice->>Bob: hi`;
      const result = reorderParticipants(code, ['Bob', 'Alice']);
      const lines = result.split('\n');
      expect(lines[1]).toContain('participant Bob');
      expect(lines[2]).toContain('actor Alice');
    });
  });

  describe('addMessage', () => {
    test('inserts message at end if index not provided', () => {
      const code = `sequenceDiagram\n    Alice->>Bob: hi`;
      const result = addMessage(code, 'Bob', 'Alice', '-->>', 'hello back');
      const lines = result.split('\n');
      expect(lines[lines.length - 1]).toContain('Bob-->>Alice: hello back');
    });

    test('inserts message at correct index slot', () => {
      const code = `sequenceDiagram
    Alice->>Bob: msg1
    Alice->>Bob: msg3`;
      const result = addMessage(code, 'Alice', 'Bob', '->>', 'msg2', 1);
      const lines = result.split('\n');
      expect(lines[2]).toContain('Alice->>Bob: msg2');
    });

    test('inserts message at the very top if afterLineIndex is -1 and messages exist', () => {
      const code = `sequenceDiagram
    Alice->>Bob: msg2
    Alice->>Bob: msg3`;
      const result = addMessage(code, 'Alice', 'Bob', '->>', 'msg1', -1);
      const lines = result.split('\n');
      expect(lines[1]).toContain('Alice->>Bob: msg1');
      expect(lines[2]).toContain('Alice->>Bob: msg2');
    });
  });

  describe('updateMessage', () => {
    test('updates arrow and label of a message line', () => {
      const code = `sequenceDiagram
    Alice->>Bob: old label`;
      const result = updateMessage(code, 1, 'new label', '-->>');
      expect(result).toContain('Alice-->>Bob: new label');
    });
  });

  describe('deleteMessage', () => {
    test('deletes correct message line', () => {
      const code = `sequenceDiagram
    Alice->>Bob: msg1
    Alice->>Bob: msg2`;
      const result = deleteMessage(code, 1);
      expect(result).not.toContain('msg1');
      expect(result).toContain('msg2');
    });
  });

  describe('updateMessageConnection', () => {
    test('updates sender and receiver of a message line', () => {
      const code = `sequenceDiagram
    Alice->>Bob: old label`;
      const result = updateMessageConnection(code, 1, 'Charlie', 'Delta');
      expect(result).toContain('Charlie->>Delta: old label');
    });
  });

  describe('toggleAutonumber', () => {
    test('adds autonumber if not present', () => {
      const code = `sequenceDiagram\n    Alice->>Bob: hello`;
      const result = toggleAutonumber(code);
      expect(result).toContain('autonumber');
    });

    test('removes autonumber if present', () => {
      const code = `sequenceDiagram\n    autonumber\n    Alice->>Bob: hello`;
      const result = toggleAutonumber(code);
      expect(result).not.toContain('autonumber');
    });
  });

  describe('reverseMessage', () => {
    test('reverses the sender and receiver of a message line', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Can you ask Charlie for the file?`;
      const result = reverseMessage(code, 1);
      expect(result).toContain('Bob->>Alice: Can you ask Charlie for the file?');
    });
  });
});
